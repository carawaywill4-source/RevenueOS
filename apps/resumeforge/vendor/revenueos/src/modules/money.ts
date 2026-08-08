import type {
  MoneyPlan,
  MoneyPlanItem,
  Observation,
  Opportunity,
  OpportunityCategory,
  ShortfallReport,
  WorldModel,
} from "../types";

/**
 * Money-printing allocator. Funds the highest profit-per-effort levers under an
 * effort budget, heavily preferring executable (safeActionType) levers so the
 * machine prints money now instead of waiting on owner-gated channels. Under a
 * $10k-day shortfall, discovery/executable capacity expands.
 */

const DEFAULT_EFFORT_BUDGET = 10;

/** Per-window EV → monthly run-rate, honest about how fast the signal arrives. */
export function projectMonthlyProfit(opportunity: Opportunity): number {
  const ev = opportunity.predicted?.expectedProfitUsd ?? 0;
  if (ev <= 0) return 0;
  const windowDays = Math.max(opportunity.predicted?.timeToSignalDays ?? 14, 7);
  const monthly = ev * (30 / windowDays);
  return Number(monthly.toFixed(2));
}

export function buildMoneyPlan(input: {
  opportunities: Opportunity[];
  world: WorldModel;
  observation: Observation;
  effortBudget?: number;
  shortfall?: ShortfallReport;
}): MoneyPlan {
  const shortfallBoost =
    input.shortfall?.dayVerdict === "lost_day"
      ? 1 + Math.min(1.5, (input.shortfall.shortfallUsd / 10_000) * 0.5)
      : 1;
  const effortBudget = Math.ceil(
    (input.effortBudget ?? DEFAULT_EFFORT_BUDGET) * shortfallBoost,
  );

  const candidates: MoneyPlanItem[] = input.opportunities
    .map((o) => {
      const monthly = projectMonthlyProfit(o);
      const effort = Math.max(o.effort, 1);
      // Executable levers print now — prefer them hard in the knapsack.
      const execMult = o.safeActionType ? 1.5 : 1;
      const profitPerEffort = Number(
        ((monthly / effort) * execMult).toFixed(2),
      );
      return {
        opportunityId: o.id,
        title: o.title,
        category: o.category,
        precursorMetric: o.precursorMetric,
        effort,
        projectedMonthlyProfitUsd: monthly,
        profitPerEffort,
        patternKey: o.patternKey,
      };
    })
    .filter((item) => item.projectedMonthlyProfitUsd > 0)
    .sort((a, b) => b.profitPerEffort - a.profitPerEffort);

  const items: MoneyPlanItem[] = [];
  let effortUsed = 0;
  for (const item of candidates) {
    if (effortUsed + item.effort > effortBudget) continue;
    items.push(item);
    effortUsed += item.effort;
  }
  // Fill leftover budget with any remaining positive-EV items that fit.
  if (effortUsed < effortBudget) {
    for (const item of candidates) {
      if (items.some((i) => i.opportunityId === item.opportunityId)) continue;
      if (effortUsed + item.effort > effortBudget) continue;
      items.push(item);
      effortUsed += item.effort;
    }
  }
  if (items.length === 0 && candidates.length > 0) {
    items.push(candidates[0]);
    effortUsed = candidates[0].effort;
  }

  const totalProjectedMonthlyProfitUsd = Number(
    items.reduce((s, i) => s + i.projectedMonthlyProfitUsd, 0).toFixed(2),
  );

  return {
    items,
    totalProjectedMonthlyProfitUsd,
    effortBudget,
    effortUsed,
    marginalDollar: routeMarginalDollar(candidates, input.world),
    note: items.length
      ? `Money press: funded ${items.length} lever(s) with ${effortUsed}/${effortBudget} effort for ~$${totalProjectedMonthlyProfitUsd.toFixed(0)}/mo — executable levers preferred; path to a $10k day, not the destination.`
      : "No positive-EV lever in policy yet — generate a new one before spending effort. Lost days without a funded lever are wasted learning.",
  };
}

function routeMarginalDollar(
  candidates: MoneyPlanItem[],
  world: WorldModel,
): string {
  const best = (category: OpportunityCategory) =>
    candidates.find((c) => c.category === category)?.profitPerEffort ?? 0;
  const acquisition = best("acquisition");
  const conversion = best("conversion");
  const pricing = best("pricing");
  const ranked: Array<[string, number]> = [
    ["acquisition (more qualified traffic)", acquisition],
    ["conversion (close the traffic you have)", conversion],
    ["pricing/margin (earn more per sale)", pricing],
  ];
  ranked.sort((a, b) => b[1] - a[1]);

  const label = ranked[0][0];
  const value = ranked[0][1];
  if (value <= 0) {
    return "No priced lever yet — the cheapest dollar is generating the first working acquisition play.";
  }
  if (
    world.shopper.primaryFriction !== "discovery" &&
    world.shopper.primaryFriction !== "none" &&
    conversion > 0 &&
    conversion >= acquisition * 0.8
  ) {
    return `Cheapest next dollar: conversion (close the traffic you have) — friction is ${world.shopper.primaryFriction}.`;
  }
  return `Cheapest next dollar: ${label} at ~$${value.toFixed(2)}/effort.`;
}
