/**
 * RevenueOS Hosting Plane — independent of RevenueOSCore.
 * Control plane (Core) talks to this API; storefronts keep serving if Core dies.
 *
 * Default listen: 127.0.0.1:8090
 * Production: run on VPS; Core on Mac reaches it via HOSTING_PLANE_URL.
 */

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDeploymentManager } from "./deployment-manager.js";
import { loadLocalMemory, improvedVsBaseline } from "./deployment-memory.js";
import { loadState } from "./state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT =
  process.env.REVENUEOS_REPO_ROOT ||
  path.resolve(__dirname, "../../..");
const DATA_DIR =
  process.env.HOSTING_DATA_DIR ||
  path.join(REPO_ROOT, ".data", "hosting-plane");
const PORT = Number(process.env.HOSTING_PLANE_PORT || 8090);
const BIND = process.env.HOSTING_PLANE_BIND || "127.0.0.1";
const TOKEN =
  process.env.HOSTING_PLANE_TOKEN ||
  process.env.CRON_SECRET ||
  "";

const mgr = createDeploymentManager({
  repoRoot: REPO_ROOT,
  dataDir: DATA_DIR,
});

function authorized(req: http.IncomingMessage): boolean {
  if (!TOKEN) {
    // Localhost-only bind is the default safety when token unset.
    const host = req.socket.remoteAddress || "";
    return host === "127.0.0.1" || host === "::1" || host === "::ffff:127.0.0.1";
  }
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7) : "";
  const alt = req.headers["x-revenueos-token"];
  return bearer === TOKEN || alt === TOKEN;
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${BIND}:${PORT}`);
  const json = (code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  if (req.method === "GET" && url.pathname === "/healthz") {
    json(200, {
      ok: true,
      service: "revenueos-hosting-plane",
      at: new Date().toISOString(),
    });
    return;
  }

  if (!authorized(req)) {
    json(401, { error: "Unauthorized" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    const st = mgr.status();
    const state = loadState(DATA_DIR);
    json(200, {
      ok: true,
      controlPlaneNote:
        "This process is the HOSTING plane. RevenueOSCore is the CONTROL plane.",
      host: st,
      auditTail: state.audit.slice(0, 20),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/deployments") {
    const siteId = url.searchParams.get("siteId") || undefined;
    const rows = loadLocalMemory(DATA_DIR).filter((r) =>
      siteId ? r.business_id === siteId : true,
    );
    json(200, {
      ok: true,
      deployments: rows.slice(0, 100).map((r) => ({
        ...r,
        improvement: improvedVsBaseline(r),
      })),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/deploy") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        const appDir = String(body.appDir ?? `apps/${siteId}`).trim();
        const version = String(body.version ?? new Date().toISOString()).trim();
        const reason = String(body.reason ?? "manual_deploy").trim();
        if (!siteId) return json(400, { ok: false, detail: "siteId required" });
        const env =
          body.env && typeof body.env === "object"
            ? (body.env as Record<string, string>)
            : {};
        const result = await mgr.deploy({
          siteId,
          appDir,
          version,
          reason,
          hypothesis: body.hypothesis ? String(body.hypothesis) : undefined,
          domain: body.domain ? String(body.domain) : undefined,
          env,
          limits:
            body.limits && typeof body.limits === "object"
              ? (body.limits as {
                  cpuMillicores?: number;
                  memoryMb?: number;
                  diskMb?: number;
                })
              : undefined,
        });
        json(result.ok ? 200 : 422, result);
      })
      .catch((e) =>
        json(400, {
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        }),
      );
    return;
  }

  if (req.method === "POST" && url.pathname === "/rollback") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        if (!siteId) return json(400, { ok: false, detail: "siteId required" });
        const result = await mgr.rollback(siteId, "owner");
        json(result.ok ? 200 : 422, result);
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/pause") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        json(200, await mgr.pause(siteId));
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/resume") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        json(200, await mgr.resume(siteId));
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/restart") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        json(200, await mgr.restart(siteId));
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/retire") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        json(200, await mgr.retire(siteId));
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/domains/attach") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        const domain = String(body.domain ?? "").trim();
        json(200, await mgr.attachDomain(siteId, domain));
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/domains/detach") {
    void readJson(req)
      .then(async (body) => {
        const siteId = String(body.siteId ?? "").trim();
        const domain = String(body.domain ?? "").trim();
        json(200, await mgr.detachDomain(siteId, domain));
      })
      .catch(() => json(400, { ok: false, detail: "invalid_json" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/health/tick") {
    void mgr.tickHealth().then(() => json(200, { ok: true, status: mgr.status() }));
    return;
  }

  json(404, { error: "not_found" });
});

server.listen(PORT, BIND, () => {
  console.log(
    JSON.stringify({
      event: "hosting_plane.listening",
      bind: BIND,
      port: PORT,
      dataDir: DATA_DIR,
      repoRoot: REPO_ROOT,
      note: "Storefronts continue if RevenueOSCore stops.",
    }),
  );
});

const HEALTH_MS = Number(process.env.HOSTING_HEALTH_INTERVAL_MS || 60_000);
const healthTimer = setInterval(() => {
  void mgr.tickHealth().catch((e) => {
    console.error("hosting_plane.health_tick_error", e);
  });
}, HEALTH_MS);

process.on("SIGTERM", () => {
  clearInterval(healthTimer);
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  clearInterval(healthTimer);
  server.close(() => process.exit(0));
});
