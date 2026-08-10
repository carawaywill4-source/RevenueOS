/**
 * DeploymentManager — zero-downtime deploy / rollback / pause / resume / retire.
 * Failed candidate → DEPLOYMENT_FAILED; known-good stays live.
 */

import { randomBytes } from "node:crypto";
import path from "node:path";
import { buildSite } from "./build-manager.js";
import { checkHttpHealth, smokeCheckoutReady } from "./health.js";
import { writeCaddyfile, writeNginxSnippet } from "./gateway.js";
import {
  canAllocate,
  DEFAULT_SITE_LIMITS,
  summarizeHost,
} from "./resource-governor.js";
import { createDockerRuntime } from "./runtime/docker-runtime.js";
import { createProcessRuntime } from "./runtime/process-runtime.js";
import type {
  DeployRequest,
  DeployResult,
  RuntimeAdapter,
  SiteLimits,
  SiteRuntimeRecord,
} from "./runtime/types.js";
import {
  audit,
  loadState,
  saveState,
  type HostingPlaneState,
} from "./state.js";
import {
  createSupabaseFromEnv,
  recordDeployment,
  type DeploymentExperiment,
} from "./deployment-memory.js";
import { readSiteEnv, writeSiteEnv } from "./site-secrets.js";

export type DeploymentManager = {
  deploy(req: DeployRequest): Promise<DeployResult>;
  rollback(siteId: string, actor?: "owner" | "core" | "system"): Promise<DeployResult>;
  pause(siteId: string): Promise<{ ok: boolean; detail: string }>;
  resume(siteId: string): Promise<{ ok: boolean; detail: string }>;
  restart(siteId: string): Promise<{ ok: boolean; detail: string }>;
  retire(siteId: string): Promise<{ ok: boolean; detail: string }>;
  attachDomain(siteId: string, domain: string): Promise<{ ok: boolean; detail: string }>;
  detachDomain(siteId: string, domain: string): Promise<{ ok: boolean; detail: string }>;
  status(): ReturnType<typeof summarizeHost> & {
    mode: string;
    sites: SiteRuntimeRecord[];
    runtimeKind: string;
  };
  getSite(siteId: string): SiteRuntimeRecord | undefined;
  refreshGateway(): void;
  tickHealth(): Promise<void>;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

async function pickRuntime(repoRoot: string): Promise<RuntimeAdapter> {
  const prefer = (process.env.HOSTING_RUNTIME || "auto").toLowerCase();
  const docker = createDockerRuntime(repoRoot);
  const proc = createProcessRuntime(repoRoot);
  if (prefer === "docker") return docker;
  if (prefer === "process") return proc;
  if (await docker.available()) return docker;
  return proc;
}

export function createDeploymentManager(input: {
  repoRoot: string;
  dataDir: string;
  gatewayDir?: string;
}): DeploymentManager {
  const repoRoot = input.repoRoot;
  const dataDir = input.dataDir;
  const gatewayDir = input.gatewayDir ?? path.join(dataDir, "gateway");
  let runtime: RuntimeAdapter | null = null;
  async function getRuntime() {
    if (!runtime) runtime = await pickRuntime(repoRoot);
    return runtime;
  }
  const sb = createSupabaseFromEnv();

  function withState<T>(fn: (state: HostingPlaneState) => T): T {
    const state = loadState(dataDir);
    const result = fn(state);
    saveState(dataDir, state);
    return result;
  }

  async function withStateAsync<T>(
    fn: (state: HostingPlaneState) => Promise<T>,
  ): Promise<T> {
    const state = loadState(dataDir);
    const result = await fn(state);
    saveState(dataDir, state);
    return result;
  }

  function refreshGatewayLocked(state: HostingPlaneState) {
    writeCaddyfile({ outDir: gatewayDir, sites: state.sites });
    writeNginxSnippet({ outDir: gatewayDir, sites: state.sites });
  }

  function allocatePort(state: HostingPlaneState): number {
    const used = new Set(state.sites.flatMap((s) => [s.port, s.previousPort].filter(Boolean) as number[]));
    let p = state.nextPort;
    while (used.has(p)) p += 1;
    state.nextPort = p + 1;
    return p;
  }

  function remember(
    exp: Omit<DeploymentExperiment, "created_at" | "updated_at"> & {
      created_at?: string;
    },
  ) {
    const now = new Date().toISOString();
    recordDeployment(
      dataDir,
      {
        ...exp,
        created_at: exp.created_at ?? now,
        updated_at: now,
      },
      sb,
    );
  }

  return {
    async deploy(req) {
      return withStateAsync(async (state) => {
        const deploymentId = newId("dep");
        const limits: SiteLimits = {
          ...DEFAULT_SITE_LIMITS,
          ...(req.limits ?? {}),
        };
        const alloc = canAllocate(state.capacity, state.sites, limits);
        if (!alloc.ok) {
          remember({
            business_id: req.siteId,
            deployment_id: deploymentId,
            version: req.version,
            reason: req.reason,
            hypothesis: req.hypothesis,
            status: "DEPLOYMENT_FAILED",
            errors: [alloc.detail],
            rollback_status: "none",
          });
          audit(state, "DEPLOYMENT_FAILED", alloc.detail, {
            siteId: req.siteId,
            actor: "core",
          });
          return {
            ok: false,
            deploymentId,
            siteId: req.siteId,
            version: req.version,
            detail: `DEPLOYMENT_FAILED:${alloc.detail}`,
            verification: { allocate: alloc.detail },
          };
        }

        const appRel = path.isAbsolute(req.appDir)
          ? path.relative(repoRoot, req.appDir)
          : req.appDir;
        const built = await buildSite({
          repoRoot,
          siteId: req.siteId,
          appRelPath: appRel,
          version: req.version,
        });
        if (!built.ok) {
          remember({
            business_id: req.siteId,
            deployment_id: deploymentId,
            version: req.version,
            reason: req.reason,
            hypothesis: req.hypothesis,
            status: "DEPLOYMENT_FAILED",
            errors: [built.error],
            rollback_status: "none",
          });
          audit(state, "DEPLOYMENT_FAILED", built.error, {
            siteId: req.siteId,
            actor: "core",
          });
          return {
            ok: false,
            deploymentId,
            siteId: req.siteId,
            version: req.version,
            detail: `DEPLOYMENT_FAILED:${built.error}`,
            verification: { build: built.error },
          };
        }

        const candidatePort = allocatePort(state);
        const rt = await getRuntime();
        const safeEnv = sanitizeEnv(req.env);
        writeSiteEnv(dataDir, req.siteId, safeEnv);
        const start = await rt.start({
          siteId: req.siteId,
          deploymentId,
          appDir: built.appDir,
          port: candidatePort,
          env: safeEnv,
          limits,
        });
        if (!start.ok) {
          remember({
            business_id: req.siteId,
            deployment_id: deploymentId,
            version: req.version,
            reason: req.reason,
            hypothesis: req.hypothesis,
            status: "DEPLOYMENT_FAILED",
            errors: [start.detail],
            rollback_status: "none",
          });
          audit(state, "DEPLOYMENT_FAILED", start.detail, {
            siteId: req.siteId,
            actor: "core",
          });
          return {
            ok: false,
            deploymentId,
            siteId: req.siteId,
            version: req.version,
            detail: `DEPLOYMENT_FAILED:${start.detail}`,
            verification: { start: start.detail },
          };
        }

        const baseUrl = `http://127.0.0.1:${candidatePort}`;
        const health = await checkHttpHealth({ baseUrl, healthPath: "/" });
        const smoke = await smokeCheckoutReady({ baseUrl });
        if (!health.ok) {
          await rt.stop({
            siteId: req.siteId,
            deploymentId,
            port: candidatePort,
            pid: start.pid,
            containerId: start.containerId,
          });
          remember({
            business_id: req.siteId,
            deployment_id: deploymentId,
            version: req.version,
            reason: req.reason,
            hypothesis: req.hypothesis,
            status: "DEPLOYMENT_FAILED",
            errors: [health.detail],
            rollback_status: "none",
          });
          audit(state, "DEPLOYMENT_FAILED", health.detail, {
            siteId: req.siteId,
            actor: "core",
          });
          return {
            ok: false,
            deploymentId,
            siteId: req.siteId,
            version: req.version,
            detail: `DEPLOYMENT_FAILED:health:${health.detail}`,
            verification: { health, smoke },
          };
        }

        const existing = state.sites.find((s) => s.siteId === req.siteId);
        const domains = req.domain
          ? [req.domain]
          : existing?.domains?.length
            ? existing.domains
            : [`${req.siteId}.localhost`];

        // Cut traffic only after candidate health OK.
        if (existing?.status === "healthy" || existing?.status === "degraded") {
          // Keep previous known-good temporarily for rollback.
          const prevId = existing.deploymentId;
          const prevPort = existing.port;
          existing.previousDeploymentId = prevId;
          existing.previousPort = prevPort;
          existing.deploymentId = deploymentId;
          existing.version = req.version;
          existing.port = candidatePort;
          existing.lastDeployAt = new Date().toISOString();
          existing.status = "healthy";
          existing.lastHealthAt = health.checkedAt;
          existing.lastHealthOk = true;
          existing.limits = limits;
          existing.envKeys = Object.keys(safeEnv);
          existing.appDir = built.appDir;
          existing.reason = req.reason;
          existing.hypothesis = req.hypothesis;
          existing.domain = domains[0];
          existing.domains = domains;
          existing.pid = start.pid;
          existing.containerId = start.containerId;
          existing.runtimeKind = rt.kind;

          // Stop previous after grace (best-effort; keep port recorded for rollback window)
          setTimeout(() => {
            void getRuntime().then((r) =>
              r.stop({
                siteId: req.siteId,
                deploymentId: prevId,
                port: prevPort,
              }),
            );
          }, 30_000);
        } else {
          const record: SiteRuntimeRecord = {
            siteId: req.siteId,
            version: req.version,
            deploymentId,
            runtimeKind: rt.kind,
            status: "healthy",
            port: candidatePort,
            domain: domains[0],
            domains,
            createdAt: new Date().toISOString(),
            lastDeployAt: new Date().toISOString(),
            lastHealthAt: health.checkedAt,
            lastHealthOk: true,
            limits,
            envKeys: Object.keys(safeEnv),
            appDir: built.appDir,
            reason: req.reason,
            hypothesis: req.hypothesis,
            pid: start.pid,
            containerId: start.containerId,
          };
          if (existing) {
            Object.assign(existing, record);
          } else {
            state.sites.push(record);
          }
        }

        refreshGatewayLocked(state);
        remember({
          business_id: req.siteId,
          deployment_id: deploymentId,
          version: req.version,
          reason: req.reason,
          hypothesis: req.hypothesis,
          changes_made: `deployed to port ${candidatePort}`,
          status: "DEPLOYED",
          rollback_status: "none",
        });
        audit(state, "DEPLOY", `v=${req.version} port=${candidatePort}`, {
          siteId: req.siteId,
          actor: "core",
        });

        const publicHost = domains[0];
        return {
          ok: true,
          deploymentId,
          siteId: req.siteId,
          version: req.version,
          port: candidatePort,
          publicUrl:
            state.mode === "development"
              ? baseUrl
              : `https://${publicHost}`,
          detail: "DEPLOYED",
          verification: { health, smoke },
        };
      });
    },

    async rollback(siteId, actor = "owner") {
      return withStateAsync(async (state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        if (!site?.previousDeploymentId || !site.previousPort) {
          return {
            ok: false,
            deploymentId: site?.deploymentId ?? "none",
            siteId,
            version: site?.version ?? "",
            detail: "no_previous_known_good",
            verification: {},
          };
        }
        // Swap ports: previous becomes current. We may need to restart previous if stopped.
        const badId = site.deploymentId;
        const badPort = site.port;
        const goodId = site.previousDeploymentId;
        const goodPort = site.previousPort;

        const rt = await getRuntime();
        const env = readSiteEnv(dataDir, siteId);
        const restart = await rt.start({
          siteId,
          deploymentId: goodId,
          appDir: site.appDir,
          port: goodPort,
          env,
          limits: site.limits,
        });
        if (!restart.ok) {
          remember({
            business_id: siteId,
            deployment_id: badId,
            version: site.version,
            reason: "rollback",
            status: "DEPLOYMENT_FAILED",
            errors: [restart.detail],
            rollback_status: "rollback_failed",
          });
          return {
            ok: false,
            deploymentId: badId,
            siteId,
            version: site.version,
            detail: `rollback_failed:${restart.detail}`,
            verification: { restart },
          };
        }

        const health = await checkHttpHealth({
          baseUrl: `http://127.0.0.1:${goodPort}`,
        });
        if (!health.ok) {
          return {
            ok: false,
            deploymentId: badId,
            siteId,
            version: site.version,
            detail: `rollback_health_failed:${health.detail}`,
            verification: { health },
          };
        }

        site.deploymentId = goodId;
        site.port = goodPort;
        site.previousDeploymentId = badId;
        site.previousPort = badPort;
        site.status = "healthy";
        site.lastHealthAt = health.checkedAt;
        site.lastHealthOk = true;
        site.lastDeployAt = new Date().toISOString();
        site.pid = restart.pid;
        site.containerId = restart.containerId;
        refreshGatewayLocked(state);
        await rt.stop({
          siteId,
          deploymentId: badId,
          port: badPort,
        });
        remember({
          business_id: siteId,
          deployment_id: badId,
          version: site.version,
          reason: "rollback",
          status: "ROLLED_BACK",
          rollback_status: "rolled_back",
        });
        audit(state, "ROLLBACK", `restored ${goodId}`, {
          siteId,
          actor,
        });
        return {
          ok: true,
          deploymentId: goodId,
          siteId,
          version: site.version,
          port: goodPort,
          publicUrl: `http://127.0.0.1:${goodPort}`,
          detail: "ROLLED_BACK",
          verification: { health },
          rolledBackTo: goodId,
        };
      });
    },

    async pause(siteId) {
      return withStateAsync(async (state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        if (!site) return { ok: false, detail: "not_found" };
        const rt = await getRuntime();
        await rt.stop({
          siteId,
          deploymentId: site.deploymentId,
          port: site.port,
          pid: site.pid,
          containerId: site.containerId,
        });
        site.status = "stopped";
        refreshGatewayLocked(state);
        remember({
          business_id: siteId,
          deployment_id: site.deploymentId,
          version: site.version,
          reason: "pause",
          status: "PAUSED",
          rollback_status: "none",
        });
        audit(state, "PAUSE", "paused", { siteId, actor: "owner" });
        return { ok: true, detail: "paused" };
      });
    },

    async resume(siteId) {
      return withStateAsync(async (state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        if (!site) return { ok: false, detail: "not_found" };
        const rt = await getRuntime();
        const start = await rt.start({
          siteId,
          deploymentId: site.deploymentId,
          appDir: site.appDir,
          port: site.port,
          env: readSiteEnv(dataDir, siteId),
          limits: site.limits,
        });
        if (!start.ok) return { ok: false, detail: start.detail };
        const health = await checkHttpHealth({
          baseUrl: `http://127.0.0.1:${site.port}`,
        });
        site.status = health.ok ? "healthy" : "degraded";
        site.pid = start.pid;
        site.containerId = start.containerId;
        site.lastHealthAt = health.checkedAt;
        site.lastHealthOk = health.ok;
        refreshGatewayLocked(state);
        audit(state, "RESUME", health.detail, { siteId, actor: "owner" });
        return { ok: health.ok, detail: health.detail };
      });
    },

    async restart(siteId) {
      await this.pause(siteId);
      return this.resume(siteId);
    },

    async retire(siteId) {
      return withStateAsync(async (state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        if (!site) return { ok: false, detail: "not_found" };
        const rt = await getRuntime();
        await rt.stop({
          siteId,
          deploymentId: site.deploymentId,
          port: site.port,
          pid: site.pid,
          containerId: site.containerId,
        });
        if (site.previousDeploymentId && site.previousPort) {
          await rt.stop({
            siteId,
            deploymentId: site.previousDeploymentId,
            port: site.previousPort,
          });
        }
        site.status = "retired";
        // Keep record + learning; never wipe deployment memory.
        refreshGatewayLocked(state);
        remember({
          business_id: siteId,
          deployment_id: site.deploymentId,
          version: site.version,
          reason: "retire",
          status: "RETIRED",
          rollback_status: "none",
        });
        audit(state, "RETIRE", "retired_runtime_kept_history", {
          siteId,
          actor: "owner",
        });
        return { ok: true, detail: "retired" };
      });
    },

    async attachDomain(siteId, domain) {
      return withState((state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        if (!site) return { ok: false, detail: "not_found" };
        if (!site.domains.includes(domain)) site.domains.push(domain);
        site.domain = site.domains[0];
        refreshGatewayLocked(state);
        audit(state, "ATTACH_DOMAIN", domain, { siteId, actor: "owner" });
        return { ok: true, detail: "attached" };
      });
    },

    async detachDomain(siteId, domain) {
      return withState((state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        if (!site) return { ok: false, detail: "not_found" };
        site.domains = site.domains.filter((d) => d !== domain);
        site.domain = site.domains[0];
        refreshGatewayLocked(state);
        audit(state, "DETACH_DOMAIN", domain, { siteId, actor: "owner" });
        return { ok: true, detail: "detached" };
      });
    },

    status() {
      const state = loadState(dataDir);
      return {
        ...summarizeHost(state.capacity, state.sites),
        mode: state.mode,
        sites: state.sites,
        runtimeKind: runtime?.kind ?? "process",
      };
    },

    getSite(siteId) {
      return loadState(dataDir).sites.find((s) => s.siteId === siteId);
    },

    refreshGateway() {
      withState((state) => {
        refreshGatewayLocked(state);
      });
    },

    async tickHealth() {
      await withStateAsync(async (state) => {
        for (const site of state.sites) {
          if (site.status === "retired" || site.status === "stopped") continue;
          const health = await checkHttpHealth({
            baseUrl: `http://127.0.0.1:${site.port}`,
          });
          site.lastHealthAt = health.checkedAt;
          site.lastHealthOk = health.ok;
          if (health.ok) {
            site.status = health.latencyMs > 3000 ? "degraded" : "healthy";
            continue;
          }
          site.status = "degraded";
          // Self-heal: restart once
          audit(state, "SELF_HEAL_RESTART", health.detail, {
            siteId: site.siteId,
            actor: "system",
          });
          const rt = await getRuntime();
          await rt.stop({
            siteId: site.siteId,
            deploymentId: site.deploymentId,
            port: site.port,
            pid: site.pid,
            containerId: site.containerId,
          });
          const start = await rt.start({
            siteId: site.siteId,
            deploymentId: site.deploymentId,
            appDir: site.appDir,
            port: site.port,
            env: readSiteEnv(dataDir, site.siteId),
            limits: site.limits,
          });
          if (!start.ok) {
            site.status = "failed";
            audit(state, "SELF_HEAL_FAILED", start.detail, {
              siteId: site.siteId,
              actor: "system",
            });
            continue;
          }
          site.pid = start.pid;
          site.containerId = start.containerId;
          const again = await checkHttpHealth({
            baseUrl: `http://127.0.0.1:${site.port}`,
          });
          site.lastHealthAt = again.checkedAt;
          site.lastHealthOk = again.ok;
          site.status = again.ok ? "healthy" : "failed";
          if (!again.ok) {
            audit(state, "ESCALATE_REASONING", again.detail, {
              siteId: site.siteId,
              actor: "system",
            });
          }
        }
        refreshGatewayLocked(state);
      });
    },
  };
}

/** Never pass secrets that belong only in Core into storefront env blindly —
 * still allow explicit NEXT_PUBLIC_* and webhook-needed keys from caller. */
function sanitizeEnv(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const block = new Set([
    "OPENAI_API_KEY",
    "CURSOR_API_KEY",
    "REVENUEOS_INTERNAL_TOKEN",
    "DEPLOY_SSH_KEY",
  ]);
  for (const [k, v] of Object.entries(env)) {
    if (block.has(k)) continue;
    if (typeof v !== "string") continue;
    out[k] = v;
  }
  return out;
}
