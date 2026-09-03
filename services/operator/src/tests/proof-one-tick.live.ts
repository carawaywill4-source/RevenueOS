/**
 * Operational proof: one business tick outside the hung portfolio scheduler.
 * Usage: npx tsx src/tests/proof-one-tick.live.ts [siteId]
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOperatorAdapter, runOperatorTick } from "@revenueos/core";
import { createSupabaseStore } from "../lib/supabase-store.js";
import { listCutoverSafeActions } from "../lib/agent-executor.js";
import { findBusiness } from "../portfolio.js";

if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error stub for Node 20
  globalThis.WebSocket = class {
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = path.join(root, "services/operator/.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2] ?? "";
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

const siteId = process.argv[2] || "rfpstrike";
const biz = findBusiness(siteId);
if (!biz) {
  console.error("NO_BIZ", siteId);
  process.exit(1);
}

const t0 = Date.now();
const { store } = createSupabaseStore({
  url: process.env.SUPABASE_URL!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});
console.log(JSON.stringify({ phase: "store_ready", ms: Date.now() - t0, siteId }));

const adapter = await createOperatorAdapter({
  manifest: biz,
  store,
  safeActionSource: listCutoverSafeActions,
  executor: async (action) => ({
    ok: true,
    detail: `proof_noop:${action.type}`,
  }),
});
console.log(JSON.stringify({ phase: "adapter_ready", ms: Date.now() - t0 }));

const tick = await Promise.race([
  runOperatorTick({
    businessId: biz.siteId,
    adapter,
    tickBudgetMs: 60_000,
    maxJobsPerTick: 3,
    logger: (level, event, meta) => {
      console.log(
        JSON.stringify({
          level,
          event,
          ms: Date.now() - t0,
          ...(meta ?? {}),
        }),
      );
    },
  }),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("proof_timeout_120s")), 120_000),
  ),
]);

console.log(
  JSON.stringify({
    phase: "TICK_RESULT",
    ok: tick.ok,
    durationMs: tick.durationMs,
    enqueued: tick.plan.enqueuedCount,
    executed: tick.drain.executed,
    apex: tick.apex?.bottleneck ?? null,
    titan: tick.titan?.constraints.primary ?? null,
    error: tick.errorMessage ?? null,
  }),
);
process.exit(tick.ok ? 0 : 2);
