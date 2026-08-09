/**
 * Tiny health/status HTTP server. Fly.io / Render / Railway / macOS Core
 * all expect a `/healthz` endpoint that returns 200 while the process is
 * alive; `/status` returns a JSON snapshot of every business the scheduler
 * is running; `/money` returns REAL Stripe balance (Available / Pending)
 * when STRIPE_SECRET_KEY is set — never invented RevenueOS totals.
 *
 * No framework — the node built-in http module is enough and keeps the
 * container image small.
 */

import http from "node:http";
import type { BusinessRuntimeStatus } from "./scheduler.js";

export type StatusSnapshotProvider = () => {
  service: {
    name: string;
    version: string;
    startedAt: string;
    ledgerMode: string | null;
    uptimeSec: number;
  };
  businesses: BusinessRuntimeStatus[];
};

async function fetchStripeMoney(): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return {
      ok: false,
      reason: "STRIPE_SECRET_KEY missing",
      note: "Stripe is financial truth — not configured on Core yet",
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
      };
    }
    const balance = (await balRes.json()) as {
      available?: Array<{ amount: number; currency: string }>;
      pending?: Array<{ amount: number; currency: string }>;
    };
    const payRes = await fetch(
      "https://api.stripe.com/v1/payouts?limit=5",
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payouts = payRes.ok
      ? ((await payRes.json()) as { data?: unknown[] }).data ?? []
      : [];
    return {
      ok: true,
      source: "stripe",
      // Explicit labels — NOT "bank balance"
      stripe: {
        available: balance.available ?? [],
        pending: balance.pending ?? [],
      },
      payouts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message.slice(0, 160) };
  }
}

function authorizedLocal(req: http.IncomingMessage): boolean {
  const token = process.env.CORE_API_TOKEN || process.env.OWNER_DIALOG_TOKEN;
  if (!token) return true; // local Phase 1 convenience
  const auth = req.headers.authorization || "";
  const hdr = req.headers["x-revenueos-token"];
  return auth === `Bearer ${token}` || hdr === token;
}

export function createHealthServer(input: {
  port: number;
  snapshot: StatusSnapshotProvider;
  logger: (msg: string, meta?: Record<string, unknown>) => void;
}): { server: http.Server; close: () => Promise<void> } {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, at: new Date().toISOString() }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/status") {
      if (!authorizedLocal(req)) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      const snap = input.snapshot();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(snap, null, 2));
      return;
    }
    if (req.method === "GET" && url.pathname === "/money") {
      if (!authorizedLocal(req)) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      void fetchStripeMoney().then((money) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(money, null, 2));
      });
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
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
