/**
 * Tiny health/status HTTP server + owner control API for SwiftUI.
 */

import http from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAICapabilityStatus } from "@revenueos/core";
import type { BusinessRuntimeStatus } from "./scheduler.js";
import { buildOwnerDashboard } from "./owner-api.js";
import { buildBusinessDetail, ownerChat } from "./owner-chat.js";
import type { OwnerControlState } from "./owner-controls.js";
import { createHostingPlaneClient } from "./hosting-plane-client.js";
import {
  getHeartbeat,
  recentSuspendGaps,
} from "./runtime-heartbeat.js";

export type StatusSnapshotProvider = () => {
  service: {
    name: string;
    version: string;
    startedAt: string;
    ledgerMode: string | null;
    uptimeSec: number;
  };
  businesses: BusinessRuntimeStatus[];
  cutover?: {
    shadowMode: boolean;
    claimEnabled: boolean;
    operator: string;
  };
  capabilities?: Record<string, unknown>;
  ownerControls?: {
    portfolioPaused: boolean;
    pausedBusinesses: string[];
    prioritizedBusinesses: string[];
  };
};

async function fetchStripeMoney(): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return {
      ok: false,
      reason: "STRIPE_SECRET_KEY missing",
      note: "Stripe is financial truth — not configured on Core yet",
      stripeAvailableLabel: "unavailable",
      stripePendingLabel: "unavailable",
    };
  }
  try {
    const balRes = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!balRes.ok) {
      return {
        ok: false,
        reason: `stripe balance ${balRes.status}`,
        stripeAvailableLabel: "unavailable",
        stripePendingLabel: "unavailable",
      };
    }
    const balance = (await balRes.json()) as {
      available?: Array<{ amount: number; currency: string }>;
      pending?: Array<{ amount: number; currency: string }>;
    };
    const payRes = await fetch("https://api.stripe.com/v1/payouts?limit=5", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    const payouts = payRes.ok
      ? ((await payRes.json()) as { data?: unknown[] }).data ?? []
      : [];
    const chargesRes = await fetch(
      "https://api.stripe.com/v1/charges?limit=10",
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const charges = chargesRes.ok
      ? ((await chargesRes.json()) as { data?: Array<Record<string, unknown>> })
          .data ?? []
      : [];
    return {
      ok: true,
      source: "stripe",
      stripe: {
        available: balance.available ?? [],
        pending: balance.pending ?? [],
      },
      stripeAvailableLabel: formatStripe(balance.available),
      stripePendingLabel: formatStripe(balance.pending),
      payouts: payouts.map(sanitizePayout),
      recentPayments: charges.map(sanitizeCharge),
      fetchedAt: new Date().toISOString(),
      note: "Stripe Available / Pending are Stripe account balances — not a bank balance",
    };
  } catch (err) {
    return {
      ok: false,
      reason: (err as Error).message.slice(0, 160),
      stripeAvailableLabel: "unavailable",
      stripePendingLabel: "unavailable",
    };
  }
}

function formatStripe(
  rows?: Array<{ amount: number; currency: string }>,
): string {
  const first = rows?.[0];
  if (!first) return "$0.00";
  const dollars = (first.amount ?? 0) / 100;
  return first.currency?.toUpperCase() === "USD"
    ? `$${dollars.toFixed(2)}`
    : `${first.currency} ${dollars.toFixed(2)}`;
}

function sanitizePayout(p: unknown) {
  const row = p as Record<string, unknown>;
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    arrivalDate: row.arrival_date,
  };
}

function sanitizeCharge(c: Record<string, unknown>) {
  const meta = (c.metadata ?? {}) as Record<string, string>;
  return {
    id: c.id,
    amount: c.amount,
    currency: c.currency,
    status: c.status,
    created: c.created,
    businessId:
      meta.revenueos_business_id ?? meta.site_id ?? meta.business_id ?? null,
  };
}

function authorizedLocal(req: http.IncomingMessage): boolean {
  const token = process.env.CORE_API_TOKEN || process.env.OWNER_DIALOG_TOKEN;
  if (!token) return true;
  const auth = req.headers.authorization || "";
  const hdr = req.headers["x-revenueos-token"];
  return auth === `Bearer ${token}` || hdr === token;
}

function readJson(
  req: http.IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function createHealthServer(input: {
  port: number;
  snapshot: StatusSnapshotProvider;
  logger: (msg: string, meta?: Record<string, unknown>) => void;
  client?: SupabaseClient;
  /** Native Postgres dashboard builder (no Supabase). */
  buildNativeDashboard?: (
    snap: ReturnType<StatusSnapshotProvider>,
  ) => Promise<Record<string, unknown>>;
  onAddBusiness?: (siteId: string) => { ok: boolean; detail: string };
  getOwnerControls?: () => OwnerControlState;
  onOwnerControl?: (
    command: string,
    siteId?: string,
  ) => Promise<{ ok: boolean; state: OwnerControlState; detail: string }>;
}): { server: http.Server; close: () => Promise<void> } {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body, null, 2));
    };

    if (req.method === "GET" && url.pathname === "/healthz") {
      json(200, { ok: true, at: new Date().toISOString() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/heartbeat") {
      const hb = getHeartbeat();
      json(200, {
        ok: true,
        ...hb,
        suspend_gaps_recent: recentSuspendGaps().slice(-10),
        note: hb.suspend_gap
          ? "SUSPEND_GAP — macOS likely slept; Core resumed"
          : "continuous",
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/status") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      const snap = input.snapshot();
      const openai = getOpenAICapabilityStatus();
      json(200, {
        ...snap,
        capabilities: {
          ...(snap.capabilities ?? {}),
          openai,
          commercialExecution: true,
          memory: true,
          learning: true,
          portfolio: true,
          openaiReasoning: openai.status === "ok" ? "ok" : "degraded",
          revenueosStatus: "operating",
          revenueosNote:
            openai.status === "ok"
              ? "Full generative + commercial limbs available"
              : openai.note,
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/money") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      void fetchStripeMoney().then((money) => json(200, money));
      return;
    }

    if (req.method === "GET" && url.pathname === "/owner/dashboard") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      const snap = input.snapshot();
      if (!input.client && input.buildNativeDashboard) {
        void input
          .buildNativeDashboard(snap)
          .then(async (dash) => {
            const money = await Promise.race([
              fetchStripeMoney(),
              new Promise<Record<string, unknown>>((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      ok: false,
                      reason: "stripe_timeout",
                      stripeAvailableLabel: "unavailable",
                      stripePendingLabel: "unavailable",
                    }),
                  2_500,
                ),
              ),
            ]);
            json(200, {
              ...dash,
              today: {
                ...(dash.today as object),
                ...(money as object),
              },
            });
          })
          .catch((err) =>
            json(500, {
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        return;
      }
      if (!input.client) {
        json(200, {
          ok: true,
          businesses: snap.businesses,
          note: "memory client unavailable",
        });
        return;
      }
      // Activity must return fast for the Mac app (10s client timeout).
      // Never block the dashboard on Stripe — /money owns financial truth.
      void buildOwnerDashboard({
        client: input.client,
        businesses: snap.businesses,
        uptimeSec: snap.service.uptimeSec,
        startedAt: snap.service.startedAt,
        ownerControls: input.getOwnerControls?.(),
      })
        .then(async (dash) => {
          const money = await Promise.race([
            fetchStripeMoney(),
            new Promise<Record<string, unknown>>((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: false,
                    reason: "stripe_timeout",
                    stripeAvailableLabel: "unavailable",
                    stripePendingLabel: "unavailable",
                  }),
                2_000,
              ),
            ),
          ]);
          json(200, {
            ...dash,
            today: {
              ...((dash.today as object) ?? {}),
              stripeAvailableLabel:
                (money as { stripeAvailableLabel?: string })
                  .stripeAvailableLabel ?? "unavailable",
              stripePendingLabel:
                (money as { stripePendingLabel?: string }).stripePendingLabel ??
                "unavailable",
            },
            money,
          });
        })
        .catch((err) => {
          // Still surface in-memory tick activity if dashboard assembly fails.
          const operational = snap.businesses
            .filter((b) => b.lastTickAt)
            .sort(
              (a, b) =>
                Date.parse(b.lastTickAt ?? "0") -
                Date.parse(a.lastTickAt ?? "0"),
            )
            .slice(0, 25)
            .map((b) => ({
              at: b.lastTickAt,
              business: b.displayName,
              summary:
                b.lastOk === false
                  ? `Repairing — ${b.lastError ?? "tick error"}`
                  : (b.lastExecuted ?? 0) > 0
                    ? `Executed ${b.lastExecuted} commercial action(s)`
                    : (b.lastEnqueued ?? 0) > 0
                      ? `Planned ${b.lastEnqueued} next move(s)`
                      : "Operating cycle completed",
            }));
          json(200, {
            ok: true,
            health: { label: "Operating", uptimeSec: snap.service.uptimeSec },
            businesses: snap.businesses,
            activity: operational,
            note: "dashboard_partial",
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return;
    }

    if (req.method === "POST" && url.pathname === "/control/add-business") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      void readJson(req)
        .then((body) => {
          const siteId = String(body.siteId ?? "").trim();
          if (!siteId || !input.onAddBusiness) {
            json(400, { ok: false, detail: "siteId required" });
            return;
          }
          json(200, input.onAddBusiness(siteId));
        })
        .catch(() => json(400, { ok: false, detail: "invalid_json" }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/owner/controls") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      json(200, {
        ok: true,
        controls: input.getOwnerControls?.() ?? null,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/owner/control") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      void readJson(req)
        .then(async (body) => {
          const command = String(body.command ?? "").trim();
          const siteId = body.siteId ? String(body.siteId).trim() : undefined;
          const allowed = new Set([
            "pause_revenueos",
            "resume_revenueos",
            "pause_business",
            "resume_business",
            "prioritize_business",
          ]);
          if (!allowed.has(command) || !input.onOwnerControl) {
            json(400, { ok: false, detail: "invalid_command" });
            return;
          }
          const result = await input.onOwnerControl(command, siteId);
          json(200, result);
        })
        .catch(() => json(400, { ok: false, detail: "invalid_json" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/owner/chat") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      void readJson(req)
        .then(async (body) => {
          const message = String(body.message ?? "").trim();
          if (!message) {
            json(400, { ok: false, reason: "empty_message" });
            return;
          }
          if (!input.client) {
            json(200, {
              ok: true,
              answer:
                "Core memory client unavailable — cannot query RevenueOS state.",
              source: "deterministic",
              capabilities: { openaiReasoning: "unavailable" },
            });
            return;
          }
          const snap = input.snapshot();
          const result = await ownerChat({
            message,
            client: input.client,
            businesses: snap.businesses,
            uptimeSec: snap.service.uptimeSec,
          });
          json(200, result);
        })
        .catch(() => json(400, { ok: false, detail: "invalid_json" }));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/owner/business/")) {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      const siteId = decodeURIComponent(
        url.pathname.replace("/owner/business/", "").replace(/\/$/, ""),
      );
      const snap = input.snapshot();
      const runtime = snap.businesses.find((b) => b.siteId === siteId);
      if (!input.client) {
        json(200, { ok: false, reason: "supabase_unavailable", siteId });
        return;
      }
      void buildBusinessDetail({
        client: input.client,
        siteId,
        runtime,
      }).then((detail) => json(200, detail));
      return;
    }

    // Hosting plane control surface (Core proxies; storefronts live elsewhere).
    if (req.method === "GET" && url.pathname === "/infra/host") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      const hp = createHostingPlaneClient();
      void hp.available().then(async (up) => {
        if (!up) {
          json(200, {
            ok: false,
            hostingPlane: "offline",
            baseUrl: hp.baseUrl,
            note: "Start services/hosting-plane — storefronts already deployed keep serving independently.",
          });
          return;
        }
        const status = await hp.status();
        json(200, { ok: true, hostingPlane: "online", ...status });
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/infra/host/deploy") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      void readJson(req)
        .then(async (body) => {
          const hp = createHostingPlaneClient();
          if (!(await hp.available())) {
            json(503, { ok: false, detail: "hosting_plane_offline" });
            return;
          }
          const siteId = String(body.siteId ?? "").trim();
          if (!siteId) {
            json(400, { ok: false, detail: "siteId required" });
            return;
          }
          const result = await hp.deploy({
            siteId,
            appDir: body.appDir ? String(body.appDir) : `apps/${siteId}`,
            version: body.version ? String(body.version) : undefined,
            reason: String(body.reason ?? "owner_deploy"),
            hypothesis: body.hypothesis ? String(body.hypothesis) : undefined,
            domain: body.domain ? String(body.domain) : undefined,
            env:
              body.env && typeof body.env === "object"
                ? (body.env as Record<string, string>)
                : undefined,
          });
          json(200, result);
        })
        .catch(() => json(400, { ok: false, detail: "invalid_json" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/infra/host/action") {
      if (!authorizedLocal(req)) return json(401, { error: "Unauthorized" });
      void readJson(req)
        .then(async (body) => {
          const hp = createHostingPlaneClient();
          if (!(await hp.available())) {
            json(503, { ok: false, detail: "hosting_plane_offline" });
            return;
          }
          const siteId = String(body.siteId ?? "").trim();
          const action = String(body.action ?? "").trim();
          if (!siteId || !action) {
            json(400, { ok: false, detail: "siteId and action required" });
            return;
          }
          const map: Record<
            string,
            (id: string) => Promise<Record<string, unknown>>
          > = {
            rollback: (id) => hp.rollback(id),
            pause: (id) => hp.pause(id),
            resume: (id) => hp.resume(id),
            restart: (id) => hp.restart(id),
            retire: (id) => hp.retire(id),
          };
          const fn = map[action];
          if (!fn) {
            json(400, {
              ok: false,
              detail: "action must be rollback|pause|resume|restart|retire",
            });
            return;
          }
          json(200, await fn(siteId));
        })
        .catch(() => json(400, { ok: false, detail: "invalid_json" }));
      return;
    }

    json(404, { error: "not_found" });
  });

  server.listen(input.port, () => {
    input.logger(`operator.health.listening`, { port: input.port });
  });

  return {
    server,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
}
