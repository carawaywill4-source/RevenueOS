import type { Opportunity, OpportunityCategory } from "../types";

/**
 * Lightweight scenario simulation. A one-time conversion win pays once; an
 * acquisition win compounds as traffic accumulates; retention compounds on the
 * installed base. This projects a lever's contribution profit over a planning
 * horizon so the brain can compare compounding strategies, not just next-cycle EV.
 */
const HORIZON_MULTIPLIER: Record<OpportunityCategory, number> = {
  acquisition: 3, // traffic accumulates over the horizon
  conversion: 1.5, // a fixed funnel improvement pays on ongoing traffic
  pricing: 1.5,
  retention: 2.5, // compounds on repeat buyers
  operations: 1, // protective; does not compound
};

export function projectHorizonProfit(opportunity: Opportunity): number {
  const ev = opportunity.predicted?.expectedProfitUsd ?? 0;
  const category = opportunity.category ?? "acquisition";
  return Number((ev * (HORIZON_MULTIPLIER[category] ?? 1)).toFixed(2));
}
