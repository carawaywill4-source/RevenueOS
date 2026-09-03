import type { Ambition, BanditStat, MetaPolicy } from "../types";

/**
 * Kelly-inspired bet sizing. Maps edge and aggression into how many parallel
 * experiments to run — more when the edge is uncertain and the shortfall is
 * huge (learn fast), fewer when a clear winner should be scaled.
 */

export function sizeConcurrentBets(input: {
  ambition: Pick<Ambition, "aggression" | "onPace" | "dayVerdict" | "overdrive">;
  meta: MetaPolicy;
  banditStats: Map<string, BanditStat>;
  maxBets?: number;
}): number {
  const maxBets = input.maxBets ?? 8;
  if (input.ambition.overdrive) {
    return maxBets;
  }
  // Even a north-star day keeps hunting — never collapse to a single bet.

  const stats = [...input.banditStats.values()];
  const totalTrials = stats.reduce((s, x) => s + x.trials, 0);
  const avgWin = stats.length
    ? stats.reduce((s, x) => s + x.posteriorWinRate, 0) / stats.length
    : 0.3;

  // Fractional Kelly proxy: edge ≈ winRate - 0.5, bankroll proxy = aggression.
  const edge = Math.max(0, avgWin - 0.35);
  const uncertainty = 1 / (totalTrials + 2);
  const kellyFraction = edge + uncertainty * 0.8;

  const fromAggression = 1 + input.ambition.aggression;
  const fromLearning = input.meta.alwaysLearning
    ? Math.ceil(1 + kellyFraction * 4)
    : Math.ceil(1 + kellyFraction * 2);
  const fromLambda = Math.ceil(input.meta.explorationLambda);

  const bets = Math.max(fromAggression, fromLearning, fromLambda);
  return Math.max(1, Math.min(maxBets, bets));
}
