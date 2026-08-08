import { NextResponse } from "next/server";
import {
  buildOwnerReportSummary,
  formatOwnerReport,
  runPursuitTick,
} from "@revenueos/core";
import { createAdapter } from "@/revenueos/adapter";

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
  const adapter = createAdapter();
  const { plan, drain } = await runPursuitTick(adapter, {
    budgetMs: 45_000,
    maxJobs: 8,
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
  });
  return NextResponse.json({
    ok: true,
    site: adapter.id,
    mode: "persistent_pursuit",
    firstCustomerMode: plan.firstCustomerMode.active,
    replenishedEmptyQueue: plan.replenishedEmptyQueue,
    enqueued: plan.enqueuedCount,
    drain,
    ownerReportPreview: formatOwnerReport(report).slice(0, 500),
  });
}
