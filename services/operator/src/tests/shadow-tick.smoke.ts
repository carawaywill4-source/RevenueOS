/**
 * One-shot shadow tick: prove Core loads @revenueos/core + Supabase memory
 * without claiming or mutating pursuits.
 *
 *   npx tsx src/tests/shadow-tick.smoke.ts
 */
import { createOperatorAdapter, runOperatorTick } from "@revenueos/core";
import { hydrateEnvFromFiles, loadEnv } from "../env.js";
import { PORTFOLIO } from "../portfolio.js";
import { createSupabaseStore } from "../lib/supabase-store.js";
import { listOperatorSafeActions } from "../lib/safe-actions.js";

async function main() {
  hydrateEnvFromFiles();
  process.env.SHADOW_MODE ??= "1";
  process.env.CLAIM_ENABLED ??= "0";
  process.env.BUSINESSES ??= "raiseready";
  const env = loadEnv();
  const siteId = (env.BUSINESSES || "raiseready").split(",")[0]!.trim();
  const biz = PORTFOLIO.find((b) => b.siteId === siteId);
  if (!biz) throw new Error(`unknown business ${siteId}`);

  const { store, mode } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const ledger = await mode();
  const adapter = createOperatorAdapter({
    manifest: biz,
    store,
    safeActionSource: listOperatorSafeActions,
    executor: async (a) => ({ ok: true, detail: `shadow ${a.type}` }),
  });

  const tick = await runOperatorTick({
    businessId: siteId,
    adapter,
    skipEnqueue: true,
    tickBudgetMs: 90_000,
    maxJobsPerTick: 0,
    logger: (level, event, fields) => {
      console.log(level, event, JSON.stringify(fields ?? {}).slice(0, 240));
    },
  });

  console.log(
    JSON.stringify(
      {
        siteId,
        ledger,
        ok: tick.ok,
        durationMs: tick.durationMs,
        purchases: tick.plan.observation?.money?.purchases,
        profitUsd: tick.plan.observation?.money?.estimatedProfitUsd,
        fcm: tick.plan.firstCustomerMode,
        executed: tick.drain.executed,
        error: tick.errorMessage ?? null,
      },
      null,
      2,
    ),
  );
  if (!tick.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
