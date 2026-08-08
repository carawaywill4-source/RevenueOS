import {
  buildOwnerReportSummary,
  runPursuitTick,
  type DrainResult,
  type OwnerReportSummary,
  type PlanAndEnqueueResult,
} from "@revenueos/core";
import {
  MAX_AUTONOMOUS_DAILY_COST_USD,
  type GrowthSnapshot,
} from "@/lib/growthos";
import { createTributeReadyAdapter } from "@/revenueos/adapter";

/**
 * Continuous money hunt via the Persistent Revenue Pursuit Engine.
 * Cron dispatches short workers: enqueue once + drain under budget.
 * Chain only while claimable backlog remains.
 */

const DEFAULT_BUDGET_MS = 50_000;
const DEFAULT_MAX_JOBS = 8;

export type ContinuousHuntResult = {
  rounds: number;
  elapsedMs: number;
  snapshots: GrowthSnapshot[];
  last: GrowthSnapshot;
  plan: PlanAndEnqueueResult;
  drain: DrainResult;
  ownerReport: OwnerReportSummary;
  claimableRemaining: number;
};

export async function runContinuousHunt(opts?: {
  budgetMs?: number;
  maxRounds?: number;
  maxJobs?: number;
  skipEnqueue?: boolean;
  onRound?: (snapshot: GrowthSnapshot, round: number) => void;
}): Promise<ContinuousHuntResult> {
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS;
  const maxJobs = opts?.maxJobs ?? opts?.maxRounds ?? DEFAULT_MAX_JOBS;
  const started = Date.now();
  const adapter = createTributeReadyAdapter();
  const store = adapter.getExperimentStore();

  // Root ticks claim a short lease so overlapping cron invocations don't double-plan.
  // Chained drain ticks skip this so backlog can continue under the same minute.
  if (!opts?.skipEnqueue && store.claimLease) {
    const leaseUntil = new Date(Date.now() + 55_000).toISOString();
    const got = await store.claimLease({
      id: `tick:tributeready:pursuit`,
      siteId: "tributeready",
      kind: "tick",
      leaseUntil,
    });
    if (!got) {
      const observation = await adapter.observe();
      const snapshot: GrowthSnapshot = {
        generatedAt: new Date().toISOString(),
        windows: (observation.rawWindows ?? {
          today: {},
          d7: {},
          d28: {},
          d90: {},
        }) as GrowthSnapshot["windows"],
        money: {
          revenueUsd: observation.money.revenueUsd,
          purchases: observation.money.purchases,
          awaitingPayment: observation.money.awaitingPayment,
          refunded: observation.money.refunded,
          estimatedVariableCostUsd: observation.money.estimatedVariableCostUsd,
          estimatedProfitUsd: observation.money.estimatedProfitUsd,
          mrr: observation.money.mrr,
          arr: observation.money.arr,
        },
        funnel: {
          steps: observation.funnel.steps,
          largestDrop: observation.funnel.largestDrop,
        },
        bottleneck: observation.bottleneck,
        opportunities: [],
        nextAction: "Tick lease held by another worker",
        spend: {
          autonomousDailyCapUsd: MAX_AUTONOMOUS_DAILY_COST_USD,
          estimatedNewMonthlyCostUsd: 0,
        },
      };
      const emptyDrain: DrainResult = {
        claimed: 0,
        advanced: 0,
        executed: 0,
        stillWaiting: 0,
        claimableRemaining: 0,
        jobs: [],
      };
      const windowEnd = new Date().toISOString();
      const windowStart = new Date(Date.now() - 3_600_000).toISOString();
      return {
        rounds: 0,
        elapsedMs: Date.now() - started,
        snapshots: [snapshot],
        last: snapshot,
        plan: {
          observation,
          opportunities: [],
          enqueued: [],
          enqueuedCount: 0,
          concurrentSlots: 0,
        },
        drain: emptyDrain,
        ownerReport: buildOwnerReportSummary({
          siteId: "tributeready",
          windowStart,
          windowEnd,
          events: [],
          pursuits: [],
          hourRevenueUsd: observation.hourPulse?.revenueUsd ?? 0,
          hourPurchases: observation.hourPulse?.purchases ?? 0,
          hourLandingViews: observation.hourPulse?.landingViews ?? 0,
          hadExecutableCapacity: false,
        }),
        claimableRemaining: 0,
      };
    }
  }

  const { plan, drain } = await runPursuitTick(adapter, {
    budgetMs,
    maxJobs,
    skipEnqueue: opts?.skipEnqueue,
  });

  const observation = plan.observation;
  const top = plan.opportunities[0];
  const snapshot: GrowthSnapshot = {
    generatedAt: new Date().toISOString(),
    windows: (observation.rawWindows ?? {
      today: {},
      d7: {},
      d28: {},
      d90: {},
    }) as GrowthSnapshot["windows"],
    money: {
      revenueUsd: observation.money.revenueUsd,
      purchases: observation.money.purchases,
      awaitingPayment: observation.money.awaitingPayment,
      refunded: observation.money.refunded,
      estimatedVariableCostUsd: observation.money.estimatedVariableCostUsd,
      estimatedProfitUsd: observation.money.estimatedProfitUsd,
      mrr: observation.money.mrr,
      arr: observation.money.arr,
    },
    funnel: {
      steps: observation.funnel.steps,
      largestDrop: observation.funnel.largestDrop,
    },
    bottleneck: observation.bottleneck,
    opportunities: plan.opportunities,
    nextAction:
      drain.jobs[0]?.workSummary ??
      top?.action ??
      "Drain claimable pursuits",
    spend: {
      autonomousDailyCapUsd: MAX_AUTONOMOUS_DAILY_COST_USD,
      estimatedNewMonthlyCostUsd: 0,
    },
  };
  opts?.onRound?.(snapshot, 1);

  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 3_600_000).toISOString();
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents("tributeready", {
        since: windowStart,
        limit: 100,
      })
    : [];
  const pursuits = store.listPursuits
    ? await store.listPursuits("tributeready")
    : [];
  const hour = observation.hourPulse;
  const ownerReport = buildOwnerReportSummary({
    siteId: "tributeready",
    windowStart,
    windowEnd,
    events,
    pursuits,
    hourRevenueUsd: hour?.revenueUsd ?? 0,
    hourPurchases: hour?.purchases ?? 0,
    hourLandingViews: hour?.landingViews ?? 0,
    hadExecutableCapacity: plan.concurrentSlots > 0,
  });

  return {
    rounds: Math.max(1, drain.advanced),
    elapsedMs: Date.now() - started,
    snapshots: [snapshot],
    last: snapshot,
    plan,
    drain,
    ownerReport,
    claimableRemaining: drain.claimableRemaining,
  };
}

/** Chain only while the pursuit queue still has claimable work. */
export function shouldChainHunt(
  result: ContinuousHuntResult | GrowthSnapshot,
): boolean {
  if ("claimableRemaining" in result) {
    return result.claimableRemaining > 0;
  }
  return false;
}
