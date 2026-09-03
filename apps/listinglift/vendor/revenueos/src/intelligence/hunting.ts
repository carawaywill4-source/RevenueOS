import type { Hypothesis } from "../types";

/**
 * Never wait on a single owner-gated channel. Concurrent bets must keep the
 * machine hunting money on executable / open levers even while owner asks
 * (marketplace signup, etc.) sit in the pipeline.
 */
export function selectHuntingBets(
  ranked: Hypothesis[],
  concurrentBets: number,
): Hypothesis[] {
  const n = Math.max(1, concurrentBets);
  const executable = ranked.filter((h) => Boolean(h.safeActionType));
  const advisory = ranked.filter((h) => !h.safeActionType);

  const selected: Hypothesis[] = [];
  const seen = new Set<string>();
  const take = (list: Hypothesis[], count: number) => {
    for (const h of list) {
      if (selected.length >= count) break;
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      selected.push(h);
    }
  };

  // Majority of slots go to things we can act on without waiting.
  const execQuota = Math.max(1, Math.ceil(n * 0.85));
  take(executable, execQuota);
  take(advisory, n);
  take(executable, n);

  // If somehow nothing ranked, return empty — caller still snapshots.
  return selected.slice(0, n);
}

/** True when a hypothesis is blocked on owner action (cannot execute now). */
export function isOwnerWaiting(hypothesis: Hypothesis): boolean {
  return !hypothesis.safeActionType;
}
