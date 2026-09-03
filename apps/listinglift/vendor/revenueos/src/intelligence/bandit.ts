import type { BanditStat, Experiment } from "../types";

/**
 * Explore/exploit intelligence. The brain balances doubling down on levers that
 * have won before against testing under-explored levers that might win more.
 * Uses a UCB-style bonus (deterministic given counts) rather than pure greed.
 */

function patternKeyOf(experiment: Experiment): string | undefined {
  return experiment.hypothesis.patternKey ?? experiment.category ?? undefined;
}

/** Aggregate win/loss history per pattern from closed experiments. */
export function banditStatsFromExperiments(
  experiments: Experiment[],
  prior = 0.3,
): Map<string, BanditStat> {
  const map = new Map<string, BanditStat>();
  for (const exp of experiments) {
    const key = patternKeyOf(exp);
    if (!key) continue;
    if (exp.status !== "won" && exp.status !== "lost") continue;
    const stat = map.get(key) ?? {
      patternKey: key,
      trials: 0,
      wins: 0,
      losses: 0,
      posteriorWinRate: prior,
    };
    stat.trials += 1;
    if (exp.status === "won") stat.wins += 1;
    else stat.losses += 1;
    map.set(key, stat);
  }
  // Beta(1,1)-style posterior mean with a weak prior toward `prior`.
  for (const stat of map.values()) {
    const a = prior * 4 + stat.wins;
    const b = (1 - prior) * 4 + stat.losses;
    stat.posteriorWinRate = Number((a / (a + b)).toFixed(4));
  }
  return map;
}

/**
 * UCB-style exploration bonus in ~[0, 1]. Grows for levers tried few times
 * relative to total activity, so novel high-upside levers get a fair shot.
 */
export function explorationBonus(
  trials: number,
  totalTrials: number,
  c = 0.7,
): number {
  const bonus = c * Math.sqrt(Math.log(totalTrials + Math.E) / (trials + 1));
  return Number(Math.min(1, bonus).toFixed(4));
}

/**
 * Multiplier applied to an opportunity's score. Combines exploitation (higher
 * for proven winners) with exploration (higher for under-tested patterns).
 */
export function banditMultiplier(
  patternKey: string | undefined,
  stats: Map<string, BanditStat>,
): number {
  const totalTrials = [...stats.values()].reduce((s, x) => s + x.trials, 0);
  const stat = patternKey ? stats.get(patternKey) : undefined;
  const trials = stat?.trials ?? 0;
  const explore = explorationBonus(trials, totalTrials);
  // Exploit: proven winners (>base) lift, proven losers dampen.
  const winRate = stat?.posteriorWinRate ?? 0.3;
  const exploit = 0.6 + winRate; // 0.6..1.6 around a 0.3 base → ~0.9..1.6
  return Number((exploit * (1 + explore * 0.5)).toFixed(4));
}

/**
 * UCB-style score for a single arm (a specific pattern key). Blends the learned
 * win-rate posterior with an exploration bonus, so an unproven arm still gets a
 * fair shot but a proven winner rises. Used to choose channels and messaging
 * angles that actually make money.
 */
export function armScore(
  patternKey: string,
  stats: Map<string, BanditStat>,
): number {
  const totalTrials = [...stats.values()].reduce((s, x) => s + x.trials, 0);
  const stat = stats.get(patternKey);
  const trials = stat?.trials ?? 0;
  const winRate = stat?.posteriorWinRate ?? 0.3;
  const explore = explorationBonus(trials, totalTrials);
  return Number((winRate + 0.5 * explore).toFixed(4));
}

/**
 * Pick the best arm (highest UCB score) among candidate pattern keys. Returns
 * the index and key so callers can map back to angles/channels. Deterministic
 * given counts; ties resolve to the first candidate (stable rotation via the
 * exploration term as trials accrue).
 */
export function pickBestArm(
  keys: string[],
  stats: Map<string, BanditStat>,
): { index: number; key: string; score: number } {
  let best = { index: 0, key: keys[0] ?? "", score: -Infinity };
  keys.forEach((key, index) => {
    const score = armScore(key, stats);
    if (score > best.score) best = { index, key, score };
  });
  return best;
}
