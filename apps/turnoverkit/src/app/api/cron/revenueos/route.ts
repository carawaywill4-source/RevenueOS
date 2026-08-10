import { NextResponse } from "next/server";
import {
  buildOwnerReportSummary,
  formatOwnerReport,
  runPursuitTick,
  checkOperatorHosting,
} from "@revenueos/core";
import { createAdapter } from "@/revenueos/adapter";
import { resolveDurableLedgerMode } from "@/revenueos/durable-store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // PHASE 2 — Mac is the RevenueOS brain. Vercel must not run autonomy.
  if (process.env.REVENUEOS_VERCEL_BRAIN !== "1") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      mode: "mac_brain_only",
      cycleStatus: "refused_cloud_brain",
      note: "RevenueOS autonomous execution runs on Mac Core only",
    });
  }
  const adapter = createAdapter();
  const host = await checkOperatorHosting(adapter.id);
  if (host.hosted) {
    return NextResponse.json({
      ok: true,
      site: adapter.id,
      mode: "hosted_by_operator",
      cycleStatus: "hosted_by_operator",
      skipped: true,
      host,
      note: "RevenueOSCore holds an active claim — Vercel cron no-ops to prevent dual execution",
    });
  }
  const durableLedger = await resolveDurableLedgerMode();
  const { plan, drain } = await runPursuitTick(adapter, {
    budgetMs: 55_000,
    maxJobs: 12,
  });
  const store = adapter.getExperimentStore();
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 3_600_000).toISOString();
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents(adapter.id, { since: windowStart })
    : [];
  const pursuits = store.listPursuits
    ? await store.listPursuits(adapter.id)
    : [];
  const report = buildOwnerReportSummary({
    siteId: adapter.id,
    windowStart,
    windowEnd,
    events,
    pursuits,
    hourRevenueUsd: plan.observation.hourPulse?.revenueUsd ?? 0,
    hourPurchases: plan.observation.hourPulse?.purchases ?? 0,
    hourLandingViews: plan.observation.hourPulse?.landingViews ?? 0,
    hadExecutableCapacity: plan.concurrentSlots > 0,
    firstCustomerMode: plan.firstCustomerMode.active,
    firstCustomerStage: plan.firstCustomerMode.stage,
  });
  const suspended = Boolean(plan.suspension?.suspended);
  const mechanismsExhausted = Boolean(plan.mechanismsExhausted);
  const bannedPatterns = plan.patternGate
    ? [...plan.patternGate.bannedPatterns]
    : [];
  const bannedMechanisms = plan.patternGate
    ? [...plan.patternGate.bannedMechanisms]
    : [];

  const cycleFailed =
    !suspended &&
    (durableLedger === "ephemeral" ||
      (plan.firstCustomerMode.active &&
        report.actionsCompleted === 0 &&
        drain.executed === 0) ||
      Boolean(plan.stagnation?.systemFailure));

  return NextResponse.json({
    ok: !cycleFailed,
    site: adapter.id,
    mode: "persistent_pursuit",
    durableLedger,
    suspended,
    suspensionReasons: plan.suspension?.reasons ?? [],
    mechanismsExhausted,
    firstCustomerMode: plan.firstCustomerMode.active,
    firstCustomerStage: plan.firstCustomerMode.stage,
    replenishedEmptyQueue: plan.replenishedEmptyQueue,
    enqueued: plan.enqueuedCount,
    bannedPatterns,
    bannedMechanisms,
    stagnation: plan.stagnation
      ? {
          stagnant: plan.stagnation.stagnant,
          systemFailure: plan.stagnation.systemFailure,
          consecutiveIdentical: plan.stagnation.consecutiveIdentical,
          killActionTypes: plan.stagnation.killActionTypes,
          reason: plan.stagnation.reason,
        }
      : null,
    drain,
    actionsCompleted: report.actionsCompleted,
    cycleStatus: suspended
      ? "suspended"
      : mechanismsExhausted
        ? "mechanisms_exhausted"
        : cycleFailed
          ? plan.stagnation?.systemFailure
            ? "stagnant"
            : "failed"
          : "ok",
    ownerReportPreview: formatOwnerReport(report).slice(0, 500),
  });
}
