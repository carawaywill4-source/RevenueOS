/**
 * Static runtime — Caddy serves built HTML; no per-site Node process.
 * Required on small Azure VMs (≪1GB RAM) where 24× next start is impossible.
 */

import type { RuntimeAdapter } from "./types.js";

export function createStaticRuntime(): RuntimeAdapter {
  return {
    kind: "static",
    async available() {
      return true;
    },
    async start(input) {
      // Traffic is served by Caddy file_server from artifact dir — no process.
      return {
        ok: true,
        detail: `static_artifact:${input.appDir}`,
      };
    },
    async stop() {
      return { ok: true, detail: "static_noop" };
    },
  };
}
