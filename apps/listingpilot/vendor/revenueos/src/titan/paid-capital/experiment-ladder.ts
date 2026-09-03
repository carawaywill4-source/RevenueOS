/**
 * Experiment ladder — smallest useful experiment first.
 * Never jump from a $20 win to the full daily ceiling.
 */

import type { ExperimentLadderStage } from "./types";

/** Max share of remaining daily ceiling allowed at each ladder stage. */
const STAGE_SHARE: Record<ExperimentLadderStage, number> = {
  SMALLEST_USEFUL: 0.05,
  CONFIRM: 0.12,
  EXPAND: 0.3,
  SCALE: 0.6,
  DIMINISHING: 0.4,
};

export function ladderMaxSpend(
  stage: ExperimentLadderStage,
  remainingCeilingUsd: number,
): number {
  const share = STAGE_SHARE[stage] ?? STAGE_SHARE.SMALLEST_USEFUL;
  return Number((Math.max(0, remainingCeilingUsd) * share).toFixed(2));
}

export function nextPaidExperimentLadderStage(
  stage: ExperimentLadderStage,
  input: {
    profitable: boolean;
    sample_acquisitions: number;
    incremental_contribution_positive: boolean;
  },
): ExperimentLadderStage {
  if (!input.profitable || !input.incremental_contribution_positive) {
    return "SMALLEST_USEFUL";
  }
  if (stage === "SMALLEST_USEFUL" && input.sample_acquisitions >= 3) return "CONFIRM";
  if (stage === "CONFIRM" && input.sample_acquisitions >= 10) return "EXPAND";
  if (stage === "EXPAND" && input.sample_acquisitions >= 25) return "SCALE";
  return stage;
}

/**
 * Diminishing returns: stop expanding when marginal profit falls below next-best opportunity.
 */
export function shouldReallocateAway(input: {
  marginal_profit_per_dollar: number;
  next_best_marginal_profit_per_dollar: number;
}): boolean {
  return input.marginal_profit_per_dollar + 1e-9 < input.next_best_marginal_profit_per_dollar;
}
