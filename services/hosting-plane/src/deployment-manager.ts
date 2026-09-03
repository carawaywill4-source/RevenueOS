/**
 * DeploymentManager — zero-downtime deploy / rollback / pause / resume / retire.
 * Failed candidate → DEPLOYMENT_FAILED; known-good stays live.
 */

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
import { createStaticRuntime } from "./runtime/static-runtime.js";
import { nativeSiteDomain, nativeSiteUrl } from "./public-domain.js";
import { publicArtifactPasses } from "./static-brand-build.js";
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
  const prefer = (process.env.HOSTING_RUNTIME || "static").toLowerCase();
  const docker = createDockerRuntime(repoRoot);
  const proc = createProcessRuntime(repoRoot);
  const stat = createStaticRuntime();
  if (prefer === "static") return stat;
  if (prefer === "docker") return docker;
  if (prefer === "process") return proc;
  // Default: static — works on small Azure VMs without per-site Node.
  return stat;
}

let lastCaddyReloadAt = 0;
function reloadCaddy(_gatewayDir: string) {
  // Debounce: bulk deploys must not thrash systemd (start-limit-hit).
  const now = Date.now();
  if (now - lastCaddyReloadAt < 8_000) return;
  lastCaddyReloadAt = now;
  const main = "/etc/caddy/Caddyfile";
  if (existsSync(main)) {
    const reload = spawnSync(
      "sudo",
      ["caddy", "reload", "--config", main, "--force"],
      { encoding: "utf8" },
    );
    if (reload.status === 0) return;
  }
  spawnSync("sudo", ["systemctl", "restart", "caddy"], { encoding: "utf8" });
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
        const preferStatic =
          (process.env.HOSTING_RUNTIME || "static").toLowerCase() === "static";
        const limits: SiteLimits = {
          ...DEFAULT_SITE_LIMITS,
          ...(preferStatic
            ? { cpuMillicores: 10, memoryMb: 8, diskMb: 256 }
            : {}),
          ...(req.limits ?? {}),
        };
        // Redeploy of an already-tracked site must not consume a new slot.
        const sitesForAlloc = state.sites.filter((s) => s.siteId !== req.siteId);
        const alloc = canAllocate(state.capacity, sitesForAlloc, limits);
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
        const artifactRoot = path.join(dataDir, "artifacts");
        const built = await buildSite({
          repoRoot,
          siteId: req.siteId,
          appRelPath: appRel,
          version: req.version,
          artifactRoot,
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
            detail: `BUILD_FAILED:${built.error}`,
            verification: { build: built.error },
          };
        }

        const rt = await getRuntime();
        const safeEnv = sanitizeEnv(req.env);
        writeSiteEnv(dataDir, req.siteId, safeEnv);
        const isStatic = rt.kind === "static" || built.mode === "static";
        const candidatePort = isStatic ? 0 : allocatePort(state);
        const start = await rt.start({
          siteId: req.siteId,
          deploymentId,
          appDir: isStatic ? built.artifactDir : built.appDir,
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
            detail: `NATIVE_DEPLOY_FAILED:${start.detail}`,
            verification: { start: start.detail },
          };
        }

        const existing = state.sites.find((s) => s.siteId === req.siteId);
        const domains = req.domain
          ? [req.domain]
          : existing?.domains?.length
            ? existing.domains
            : [nativeSiteDomain(req.siteId)];

        // For static: gateway first, then public health via Caddy hostname.
        // For process: local port health before cutover.
        let health = { ok: true, detail: "static_artifact", checkedAt: new Date().toISOString() };
        let smoke = { ok: true, detail: "deferred_to_public_verify" };
        if (!isStatic) {
          const baseUrl = `http://127.0.0.1:${candidatePort}`;
          health = await checkHttpHealth({ baseUrl, healthPath: "/" });
          smoke = await smokeCheckoutReady({ baseUrl });
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
              detail: `COMMERCIAL_VERIFY_FAILED:health:${health.detail}`,
              verification: { health, smoke },
            };
          }
        }

        if (!existsSync(built.artifactDir) && isStatic) {
          return {
            ok: false,
            deploymentId,
            siteId: req.siteId,
            version: req.version,
            detail: "BUILD_FAILED:artifact_missing",
            verification: { artifact: built.artifactDir },
          };
        }

        // Cut traffic only after candidate health OK.
        if (existing?.status === "healthy" || existing?.status === "degraded") {
          // Keep previous known-good temporarily for rollback.
          const prevId = existing.deploymentId;
          const prevPort = existing.port;
          const prevArtifact = existing.artifactDir;
          existing.previousDeploymentId = prevId;
          existing.previousPort = prevPort;
          existing.previousArtifactDir = prevArtifact;
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
          existing.artifactDir = isStatic ? built.artifactDir : undefined;
          existing.reason = req.reason;
          existing.hypothesis = req.hypothesis;
          existing.domain = domains[0];
          existing.domains = domains;
          existing.pid = start.pid;
          existing.containerId = start.containerId;
          existing.runtimeKind = isStatic ? "static" : rt.kind;

          // Stop previous after grace (best-effort; keep port recorded for rollback window)
          if (!isStatic && prevPort) {
            setTimeout(() => {
              void getRuntime().then((r) =>
                r.stop({
                  siteId: req.siteId,
                  deploymentId: prevId,
                  port: prevPort,
                }),
              );
            }, 30_000);
          }
        } else {
          const record: SiteRuntimeRecord = {
            siteId: req.siteId,
            version: req.version,
            deploymentId,
            runtimeKind: isStatic ? "static" : rt.kind,
            status: "healthy",
            port: candidatePort,
            artifactDir: isStatic ? built.artifactDir : undefined,
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
        reloadCaddy(gatewayDir);

        const publicUrl = nativeSiteUrl(req.siteId);
        let publicVerify: { ok: boolean; detail: string; missing?: string[] } = {
          ok: true,
          detail: "process_runtime_skip_static_markers",
        };
        if (isStatic) {
          publicVerify = { ok: false, detail: "unverified" };
          for (let attempt = 0; attempt < 4; attempt++) {
            await new Promise((r) => setTimeout(r, attempt === 0 ? 400 : 1200));
            try {
              const res = await fetch(publicUrl, {
                redirect: "follow",
                headers: { "user-agent": "RevenueOS-HostingPlane/deploy-verify" },
                signal: AbortSignal.timeout(8000),
              });
              const html = await res.text();
              const pass = publicArtifactPasses(html);
              const privacy = await fetch(`${publicUrl}/legal/privacy/`, {
                signal: AbortSignal.timeout(6000),
              }).catch(() => null);
              if (pass.ok && privacy && privacy.status < 400) {
                publicVerify = {
                  ok: true,
                  detail: `public_ok status=${res.status} renderer_markers`,
                };
                break;
              }
              publicVerify = {
                ok: false,
                detail: `DEPLOYMENT_DIVERGENCE http=${res.status} privacy=${privacy?.status ?? "n/a"}`,
                missing: pass.missing,
              };
            } catch (e) {
              publicVerify = {
                ok: false,
                detail: `DEPLOYMENT_DIVERGENCE fetch:${e instanceof Error ? e.message : String(e)}`,
              };
            }
          }
        }

        if (isStatic && !publicVerify.ok) {
          remember({
            business_id: req.siteId,
            deployment_id: deploymentId,
            version: req.version,
            reason: req.reason,
            hypothesis: req.hypothesis,
            status: "DEPLOYMENT_FAILED",
            errors: [publicVerify.detail, ...(publicVerify.missing ?? [])],
            rollback_status: "none",
          });
          audit(state, "DEPLOYMENT_FAILED", publicVerify.detail, {
            siteId: req.siteId,
            actor: "core",
          });
          return {
            ok: false,
            deploymentId,
            siteId: req.siteId,
            version: req.version,
            publicUrl,
            detail: publicVerify.detail,
            verification: { health, smoke, publicVerify, artifactDir: built.artifactDir },
          };
        }

        remember({
          business_id: req.siteId,
          deployment_id: deploymentId,
          version: req.version,
          reason: req.reason,
          hypothesis: req.hypothesis,
          changes_made: isStatic
            ? `static_native:${built.artifactDir}`
            : `deployed to port ${candidatePort}`,
          status: "DEPLOYED",
          rollback_status: "none",
        });
        audit(
          state,
          "DEPLOY",
          `v=${req.version} mode=${isStatic ? "static" : "process"}`,
          {
            siteId: req.siteId,
            actor: "core",
          },
        );

        return {
          ok: true,
          deploymentId,
          siteId: req.siteId,
          version: req.version,
          port: candidatePort || undefined,
          publicUrl,
          detail: isStatic ? "DEPLOYED_STATIC_NATIVE" : "DEPLOYED",
          verification: { health, smoke, artifactDir: built.artifactDir },
        };
      });
    },

    async rollback(siteId, actor = "owner") {
      return withStateAsync(async (state) => {
        const site = state.sites.find((s) => s.siteId === siteId);
        const hasStaticGood = Boolean(site?.previousArtifactDir);
        const hasProcessGood = Boolean(
          site?.previousDeploymentId && site.previousPort,
        );
        if (!site || (!hasStaticGood && !hasProcessGood)) {
          return {
            ok: false,
            deploymentId: site?.deploymentId ?? "none",
            siteId,
            version: site?.version ?? "",
            detail: "no_previous_known_good",
            verification: {},
          };
        }
        // Swap: previous known-good becomes current.
        const badId = site.deploymentId;
        const badPort = site.port;
        const badArtifact = site.artifactDir;
        const goodId = site.previousDeploymentId ?? `rollback_${Date.now()}`;
        const goodPort = site.previousPort ?? 0;
        const goodArtifact = site.previousArtifactDir;

        // Static rollback: point Caddy at previous artifact — no process restart.
        if (site.runtimeKind === "static" && goodArtifact && existsSync(goodArtifact)) {
          site.deploymentId = goodId;
          site.port = 0;
          site.previousDeploymentId = badId;
          site.previousPort = badPort;
          site.previousArtifactDir = badArtifact;
          site.artifactDir = goodArtifact;
          site.status = "healthy";
          site.lastHealthAt = new Date().toISOString();
          site.lastHealthOk = true;
          site.lastDeployAt = new Date().toISOString();
          refreshGatewayLocked(state);
          reloadCaddy(gatewayDir);
          remember({
            business_id: siteId,
            deployment_id: goodId,
            version: site.version,
            reason: "rollback_static_native",
            status: "ROLLED_BACK",
            rollback_status: "rolled_back",
          });
          audit(state, "ROLLBACK", `static→${goodArtifact}`, {
            siteId,
            actor,
          });
          return {
            ok: true,
            deploymentId: goodId,
            siteId,
            version: site.version,
            publicUrl: nativeSiteUrl(siteId),
            detail: "ROLLED_BACK_STATIC_NATIVE",
            verification: { artifactDir: goodArtifact },
            rolledBackTo: goodId,
          };
        }

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
        reloadCaddy(gatewayDir);
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
          // Static sites have no process port — probe public hostname or artifact.
          if (site.runtimeKind === "static" || site.port === 0) {
            const publicUrl =
              site.domain
                ? `https://${site.domain}`
                : nativeSiteUrl(site.siteId);
            let health = await checkHttpHealth({
              baseUrl: publicUrl,
              timeoutMs: 10_000,
            });
            if (!health.ok && site.artifactDir && existsSync(site.artifactDir)) {
              health = {
                ok: true,
                httpOk: true,
                latencyMs: 0,
                statusCode: 200,
                detail: "static_artifact_present",
                checkedAt: new Date().toISOString(),
              };
            }
            site.lastHealthAt = health.checkedAt;
            site.lastHealthOk = health.ok;
            site.status = health.ok
              ? health.latencyMs > 3000
                ? "degraded"
                : "healthy"
              : "degraded";
            continue;
          }
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
