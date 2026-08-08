/**
 * Compatibility façade. GrowthOS now runs on RevenueOS + the TributeReady adapter.
 * Prefer importing from @/revenueos or @tributeready/revenueos for new code.
 */
import {
  runCycle,
  type CycleResult,
  type FunnelStepStat,
  type Opportunity,
} from "@tributeready/revenueos";
import { createTributeReadyAdapter } from "@/revenueos/adapter";

export const PRICE_USD = 34.99;
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_USD = 0.3;
export const OPENAI_PER_DRAFT_USD = 0.02;
export const MAX_AUTONOMOUS_DAILY_COST_USD = Number(
  process.env.MAX_AUTONOMOUS_DAILY_COST_USD ?? "3",
);

export type { FunnelStepStat, Opportunity };

export type GrowthSnapshot = {
  generatedAt: string;
  windows: {
    today: unknown;
    d7: unknown;
    d28: unknown;
    d90: unknown;
  };
  money: {
    revenueUsd: number;
    purchases: number;
    awaitingPayment: number;
    refunded: number;
    estimatedVariableCostUsd: number;
    estimatedProfitUsd: number;
    mrr: number;
    arr: number;
  };
  funnel: {
    steps: FunnelStepStat[];
    largestDrop: FunnelStepStat | null;
  };
  bottleneck: {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    label: string;
    detail: string;
  };
  opportunities: Opportunity[];
  nextAction: string;
  spend: {
    autonomousDailyCapUsd: number;
    estimatedNewMonthlyCostUsd: number;
  };
  /** Present when built via RevenueOS cycle. */
  cycle?: CycleResult;
};

export async function runTributeReadyRevenueCycle(): Promise<CycleResult> {
  return runCycle(createTributeReadyAdapter());
}

export async function buildGrowthSnapshot(): Promise<GrowthSnapshot> {
  const cycle = await runTributeReadyRevenueCycle();
  const windows = (cycle.observation.rawWindows ?? {
    today: {},
    d7: {},
    d28: {},
    d90: {},
  }) as GrowthSnapshot["windows"];

  return {
    generatedAt: cycle.scorecard.generatedAt,
    windows,
    money: {
      revenueUsd: cycle.observation.money.revenueUsd,
      purchases: cycle.observation.money.purchases,
      awaitingPayment: cycle.observation.money.awaitingPayment,
      refunded: cycle.observation.money.refunded,
      estimatedVariableCostUsd:
        cycle.observation.money.estimatedVariableCostUsd,
      estimatedProfitUsd: cycle.observation.money.estimatedProfitUsd,
      mrr: cycle.observation.money.mrr,
      arr: cycle.observation.money.arr,
    },
    funnel: {
      steps: cycle.observation.funnel.steps,
      largestDrop: cycle.observation.funnel.largestDrop,
    },
    bottleneck: cycle.observation.bottleneck,
    opportunities: cycle.opportunities,
    nextAction: cycle.scorecard.nextAction,
    spend: {
      autonomousDailyCapUsd: MAX_AUTONOMOUS_DAILY_COST_USD,
      estimatedNewMonthlyCostUsd: 0,
    },
    cycle,
  };
}

export function formatExecutiveReport(snapshot: GrowthSnapshot) {
  if (snapshot.cycle?.reportText) return snapshot.cycle.reportText;

  const drop = snapshot.funnel.largestDrop;
  return [
    "TributeReady — daily growth review",
    `Generated: ${snapshot.generatedAt}`,
    "",
    "MONEY (7-day)",
    `Revenue: $${snapshot.money.revenueUsd.toFixed(2)}`,
    `Purchases: ${snapshot.money.purchases}`,
    `Awaiting payment: ${snapshot.money.awaitingPayment}`,
    `Refunds: ${snapshot.money.refunded}`,
    `Est. variable cost: $${snapshot.money.estimatedVariableCostUsd.toFixed(2)}`,
    `Est. profit: $${snapshot.money.estimatedProfitUsd.toFixed(2)}`,
    `MRR: $${snapshot.money.mrr.toFixed(2)} (no subscriptions yet)`,
    "",
    "FUNNEL (7-day)",
    ...snapshot.funnel.steps.map((step) => {
      const rate =
        step.dropRate === null
          ? ""
          : `  drop ${(step.dropRate * 100).toFixed(0)}%`;
      return `${step.step}: ${step.count}${rate}`;
    }),
    drop
      ? `Largest drop: ${drop.step} (${((drop.dropRate ?? 0) * 100).toFixed(0)}%)`
      : "Largest drop: none measurable",
    "",
    "BOTTLENECK",
    `Level ${snapshot.bottleneck.level} — ${snapshot.bottleneck.label}`,
    snapshot.bottleneck.detail,
    "",
    "TOP OPPORTUNITIES",
    ...snapshot.opportunities.slice(0, 5).map(
      (item, index) =>
        `${index + 1}. [${item.score}] ${item.title} — ${item.action}`,
    ),
    "",
    "NEXT ACTION",
    snapshot.nextAction,
    "",
    `Autonomous daily cost cap: $${snapshot.spend.autonomousDailyCapUsd}`,
  ].join("\n");
}
