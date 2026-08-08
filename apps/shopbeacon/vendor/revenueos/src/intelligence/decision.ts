import type { BanditStat, Hypothesis, Opportunity } from "../types";
import { credibleExploreScore } from "./credible";

/**
 * Decision theory: which experiment is worth running is NOT simply the one with
 * the highest expected value. A lever we already understand teaches us little;
 * an uncertain high-upside lever can be worth running for the *information* it
 * yields. Value of Information (VOI) + credible-bound exploration capture that.
 * Under the $10k north star the meta-policy keeps lambda high so the brain
 * always learns and adjusts.
 */

/** Uncertainty about a pattern's win rate, from how little we've tested it. */
export function patternUncertainty(
  patternKey: string | undefined,
  stats: Map<string, BanditStat>,
): number {
  const stat = patternKey ? stats.get(patternKey) : undefined;
  const trials = stat?.trials ?? 0;
  return 1 / (trials + 2);
}

/**
 * Value of information for an opportunity: upside × uncertainty. High when a
 * promising lever is under-explored, low when we already know the answer.
 */
export function valueOfInformation(
  opportunity: Opportunity,
  stats: Map<string, BanditStat>,
): number {
  const upside = Math.max(0, opportunity.predicted?.expectedProfitUsd ?? 0);
  const uncertainty = patternUncertainty(
    opportunity.patternKey ?? opportunity.category,
    stats,
  );
  return Number((upside * uncertainty).toFixed(2));
}

/**
 * Rank actionable hypotheses by expected value plus exploration (VOI and
 * credible-bound arm score). `lambda` / `exploitBias` come from the meta-policy.
 */
export function rankExperimentHypotheses(
  hypotheses: Hypothesis[],
  opportunitiesById: Map<string, Opportunity>,
  stats: Map<string, BanditStat>,
  lambda = 0.5,
  exploitBias = 0.5,
): Hypothesis[] {
  return [...hypotheses]
    .map((hypothesis) => {
      const opp = opportunitiesById.get(hypothesis.id.replace(/^hyp_/, ""));
      const ev = opp?.predicted?.expectedProfitUsd ?? hypothesis.expectedImpact;
      const voi = opp ? valueOfInformation(opp, stats) : 0;
      const pattern = opp?.patternKey ?? opp?.category ?? hypothesis.patternKey;
      const credible = credibleExploreScore(pattern, stats);
      const score =
        exploitBias * ev +
        (1 - exploitBias) * ev * 0.55 +
        lambda * voi +
        lambda * 20 * credible;
      return { hypothesis, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.hypothesis);
}

/**
 * Pick the single actionable hypothesis that maximizes EV + exploration.
 */
export function selectExperimentHypothesis(
  hypotheses: Hypothesis[],
  opportunitiesById: Map<string, Opportunity>,
  stats: Map<string, BanditStat>,
  lambda = 0.5,
  exploitBias = 0.5,
): Hypothesis | undefined {
  return rankExperimentHypotheses(
    hypotheses,
    opportunitiesById,
    stats,
    lambda,
    exploitBias,
  )[0];
}

/** Boost opportunities that match the curriculum focus category. */
export function curriculumBoost(
  category: Opportunity["category"] | undefined,
  focus: Opportunity["category"] | undefined,
): number {
  if (!category || !focus) return 1;
  return category === focus ? 1.35 : 1;
}
