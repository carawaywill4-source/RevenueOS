/**
 * Tiny health/status HTTP server. Fly.io / Render / Railway all expect a
 * `/healthz` endpoint that returns 200 while the process is alive; a
 * separate `/status` returns a JSON snapshot of every business the
 * scheduler is running.
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
    uptimeSec: number;
    ledgerMode: string | null;
  };
  businesses: BusinessRuntimeStatus[];
};

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
      const snap = input.snapshot();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(snap, null, 2));
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
