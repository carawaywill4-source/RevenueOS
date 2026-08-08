import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildOwnerReportSummary,
  formatOwnerReport,
  resolveFirstCustomerStage,
  runPursuitTick,
} from "@revenueos/core";

const siteId = process.argv[2] || "raiseready";
const root = process.cwd();
const appDir = path.join(root, "apps", siteId);

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
}

loadEnv(path.join(root, ".env.local"));
process.env.NEXT_PUBLIC_APP_URL ??= `https://${siteId}.vercel.app`;
process.env.REVENUEOS_LEDGER_DIR = path.join(appDir, ".data/revenueos");

async function main() {
  const mod = await import(
    pathToFileURL(path.join(appDir, "src/revenueos/adapter.ts")).href
  );
  const adapter = mod.createAdapter();
  const { plan, drain } = await runPursuitTick(adapter, {
    budgetMs: 25_000,
    maxJobs: 8,
  });
  const store = adapter.getExperimentStore();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents(siteId, { since })
    : [];
  const pursuits = store.listPursuits
    ? await store.listPursuits(siteId)
    : [];
  const report = buildOwnerReportSummary({
    siteId,
    windowStart: since,
    windowEnd: new Date().toISOString(),
    events,
    pursuits,
    hourRevenueUsd: plan.observation.money.revenueUsd,
    hourPurchases: plan.observation.money.purchases,
    hourLandingViews: plan.observation.funnel.landingViews,
    hourCheckouts: plan.observation.funnel.checkouts,
    hadExecutableCapacity: plan.concurrentSlots > 0,
    firstCustomerMode: plan.firstCustomerMode.active,
    firstCustomerStage: resolveFirstCustomerStage(plan.observation),
    effortNext: plan.opportunities
      .slice(0, 3)
      .map((o: { safeActionType?: string; title: string }) =>
        `${o.safeActionType}: ${o.title}`,
      ),
  });

  console.log(
    JSON.stringify(
      {
        siteId,
        commerciallyBlocked: plan.observation.errors,
        firstCustomerMode: plan.firstCustomerMode,
        enqueued: plan.enqueuedCount,
        replenishedEmptyQueue: plan.replenishedEmptyQueue,
        drain: {
          claimed: drain.claimed,
          advanced: drain.advanced,
          executed: drain.executed,
          remaining: drain.claimableRemaining,
        },
        work: drain.jobs.slice(0, 6).map(
          (j: { state: string; title: string; workSummary?: string }) => ({
            state: j.state,
            title: j.title,
            summary: j.workSummary,
          }),
        ),
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
