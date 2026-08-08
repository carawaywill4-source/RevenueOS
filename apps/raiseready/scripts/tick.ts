import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  buildOwnerReportSummary,
  formatOwnerReport,
  resolveFirstCustomerStage,
  runPursuitTick,
} from "@revenueos/core";
import { createAdapter } from "../src/revenueos/adapter";

async function main() {
  const root = path.resolve(__dirname, "../../..");
  function loadEnv(file: string) {
    if (!existsSync(file)) return;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]!]) process.env[m[1]!] = m[2];
    }
  }
  loadEnv(path.join(root, ".env.local"));
  process.env.NEXT_PUBLIC_APP_URL ??= "https://raiseready.vercel.app";
  process.env.REVENUEOS_LEDGER_DIR ??= path.join(process.cwd(), ".data/revenueos");

  const adapter = createAdapter();
  const { plan, drain } = await runPursuitTick(adapter, {
    budgetMs: 25_000,
    maxJobs: 8,
  });
  const store = adapter.getExperimentStore();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const events = (await store.listPursuitEvents?.("raiseready", { since })) ?? [];
  const pursuits = (await store.listPursuits?.("raiseready")) ?? [];
  const report = buildOwnerReportSummary({
    siteId: "raiseready",
    windowStart: since,
    windowEnd: new Date().toISOString(),
    events,
    pursuits,
    hourRevenueUsd: plan.observation.money.revenueUsd,
    hourPurchases: plan.observation.money.purchases,
    hourLandingViews: plan.observation.funnel.landingViews,
    hourCheckouts: plan.observation.funnel.checkouts,
    hadExecutableCapacity: true,
    firstCustomerMode: plan.firstCustomerMode.active,
    firstCustomerStage: resolveFirstCustomerStage(plan.observation),
  });
  console.log(
    JSON.stringify(
      {
        commerciallyBlocked: plan.observation.errors,
        firstCustomerMode: plan.firstCustomerMode,
        enqueued: plan.enqueuedCount,
        replenished: plan.replenishedEmptyQueue,
        drain: {
          claimed: drain.claimed,
          advanced: drain.advanced,
          executed: drain.executed,
          remaining: drain.claimableRemaining,
        },
        work: drain.jobs.map((j) => ({
          state: j.state,
          title: j.title,
          summary: j.workSummary,
        })),
      },
      null,
      2,
    ),
  );
  console.log("\n" + formatOwnerReport(report));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
