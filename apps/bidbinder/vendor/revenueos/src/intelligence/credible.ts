import type { BanditStat } from "../types";
import { wilsonInterval } from "./statistics";

/**
 * Deterministic "Thompson-like" scoring via the upper credible bound of each
 * arm's win-rate posterior. Explores uncertain high-upside arms without
 * injecting randomness that would make cycles non-reproducible.
 */

export function credibleExploreScore(
  patternKey: string | undefined,
  stats: Map<string, BanditStat>,
  prior = 0.3,
): number {
  const stat = patternKey ? stats.get(patternKey) : undefined;
  const wins = stat?.wins ?? 0;
  const trials = stat?.trials ?? 0;
  // Pseudocounts from prior so virgin arms get an optimistic upper bound.
  const pseudoWins = wins + prior * 2;
  const pseudoTrials = trials + 2;
  const { upper, mean } = wilsonInterval(pseudoWins, pseudoTrials, 1.64);
  // Blend mean (exploit) with upper bound (explore).
  return Number((0.45 * mean + 0.55 * upper).toFixed(4));
}

/**
 * Rank pattern keys by credible explore score (desc).
 */
export function rankArmsByCredibleBound(
  keys: string[],
  stats: Map<string, BanditStat>,
): Array<{ key: string; score: number }> {
  return keys
    .map((key) => ({ key, score: credibleExploreScore(key, stats) }))
    .sort((a, b) => b.score - a.score);
}
