/**
 * Execution stagnation: when consecutive cycles observe the same commercial
 * state and repeat the same action types with no new buyer signal, the operator
 * must mutate strategy — not re-report the same heartbeat.
 */

import type { Opportunity, PursuitEvent } from "../types";

/** Actions that are distribution infrastructure, not active buyer pursuit alone. */
export const INFRASTRUCTURE_ONLY_ACTIONS = new Set([
  "indexnow_submit",
  "sitemap_ping",
  "ping_search_engines",
  "publish_llms_txt",
  "scorecard_snapshot",
]);

export type CycleFingerprint = {
  hash: string;
  actionTypes: string[];
  purchases: number;
  revenueUsd: number;
  landingViews: number;
  checkouts: number;
  stage: string;
  at: string;
};

export function executedActionTypesFromEvents(
  events: PursuitEvent[],
): string[] {
  const types = events
    .filter(
      (e) =>
        e.eventType === "executed" &&
        e.detail?.ok === true &&
        typeof e.detail.actionType === "string",
    )
    .map((e) => String(e.detail.actionType));
  return [...new Set(types)].sort();
}

/** Non-infrastructure executed actions (buyer-pursuit substance). */
export function commercialActionTypesFromEvents(
  events: PursuitEvent[],
): string[] {
  return executedActionTypesFromEvents(events).filter(
    (t) => !INFRASTRUCTURE_ONLY_ACTIONS.has(t),
  );
}

export function buildCycleFingerprint(input: {
  actionTypes: string[];
  purchases: number;
  revenueUsd: number;
  landingViews: number;
  checkouts?: number;
  stage: string;
  at?: string;
}): CycleFingerprint {
  const actionTypes = [...new Set(input.actionTypes)].sort();
  const checkouts = input.checkouts ?? 0;
  const signalBucket =
    input.purchases > 0
      ? "paid"
      : checkouts > 0
        ? "checkout"
        : input.landingViews > 0
          ? "views"
          : "zero";
  const hash = [
    signalBucket,
    input.stage,
    actionTypes.join(",") || "none",
  ].join("|");
  return {
    hash,
    actionTypes,
    purchases: input.purchases,
    revenueUsd: input.revenueUsd,
    landingViews: input.landingViews,
    checkouts,
    stage: input.stage,
    at: input.at ?? new Date().toISOString(),
  };
}

export type StagnationVerdict = {
  stagnant: boolean;
  consecutiveIdentical: number;
  systemFailure: boolean;
  killActionTypes: string[];
  reason: string;
  current: CycleFingerprint;
};

/**
 * Three materially identical zero-result cycles = system failure.
 * Repeating the same action unchanged is prohibited without new signal.
 */
export function detectExecutionStagnation(input: {
  prior: CycleFingerprint[];
  current: CycleFingerprint;
  threshold?: number;
}): StagnationVerdict {
  const threshold = input.threshold ?? 3;
  const current = input.current;
  let consecutiveIdentical = 1;
  for (let i = input.prior.length - 1; i >= 0; i -= 1) {
    const prev = input.prior[i]!;
    if (prev.hash === current.hash) consecutiveIdentical += 1;
    else break;
  }

  const zeroResult =
    current.purchases <= 0 &&
    current.revenueUsd <= 0 &&
    current.landingViews <= 0 &&
    current.checkouts <= 0;

  const onlyInfrastructure =
    current.actionTypes.length > 0 &&
    current.actionTypes.every((t) => INFRASTRUCTURE_ONLY_ACTIONS.has(t));

  const stagnant =
    zeroResult &&
    (consecutiveIdentical >= 2 || onlyInfrastructure) &&
    (current.actionTypes.length > 0 || consecutiveIdentical >= 2);

  const systemFailure =
    zeroResult &&
    (consecutiveIdentical >= threshold ||
      (onlyInfrastructure && consecutiveIdentical >= 2));

  return {
    stagnant: stagnant || systemFailure,
    consecutiveIdentical,
    systemFailure,
    killActionTypes: systemFailure || stagnant ? [...current.actionTypes] : [],
    reason: systemFailure
      ? `${consecutiveIdentical} identical zero-result cycles (${current.hash}) — strategy mutation required.`
      : stagnant
        ? onlyInfrastructure
          ? `Infrastructure-only actions (${current.actionTypes.join(", ")}) with zero buyer signal — not pursuit; mutate.`
          : `Repeated zero-result cycle (${current.hash}) — do not repeat unchanged.`
        : "Cycle has new signal or novel action mix.",
    current,
  };
}

/**
 * Demote/kill repeated zero-result actions and boost unexplored alternatives.
 * Proves consecutive zero-result cycles cause strategy mutation.
 */
export function mutateOpportunitiesAfterStagnation(input: {
  opportunities: Opportunity[];
  killActionTypes: string[];
  explorationBoost?: number;
}): Opportunity[] {
  const killed = new Set(input.killActionTypes);
  const boost = input.explorationBoost ?? 1.8;
  if (!killed.size) return input.opportunities;

  return [...input.opportunities]
    .map((opp) => {
      const type = opp.safeActionType ?? "";
      if (type && killed.has(type)) {
        return {
          ...opp,
          score: Number((opp.score * 0.05).toFixed(2)),
        };
      }
      // Prefer non-infrastructure alternatives when mutating away from a rut.
      const infraPenalty = INFRASTRUCTURE_ONLY_ACTIONS.has(type) ? 0.4 : 1;
      return {
        ...opp,
        score: Number((opp.score * boost * infraPenalty).toFixed(2)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function fingerprintsFromEvents(
  events: PursuitEvent[],
  observation: {
    purchases: number;
    revenueUsd: number;
    landingViews: number;
    checkouts?: number;
    stage: string;
  },
  bucketMs = 60 * 60_000,
): CycleFingerprint[] {
  const executed = events.filter(
    (e) => e.eventType === "executed" && e.detail?.ok === true,
  );
  if (!executed.length) {
    return [
      buildCycleFingerprint({
        actionTypes: [],
        purchases: observation.purchases,
        revenueUsd: observation.revenueUsd,
        landingViews: observation.landingViews,
        checkouts: observation.checkouts,
        stage: observation.stage,
      }),
    ];
  }

  const buckets = new Map<number, PursuitEvent[]>();
  for (const e of executed) {
    const t = Date.parse(e.createdAt);
    const bucket = Math.floor(t / bucketMs);
    const list = buckets.get(bucket) ?? [];
    list.push(e);
    buckets.set(bucket, list);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, evts]) =>
      buildCycleFingerprint({
        actionTypes: executedActionTypesFromEvents(evts),
        purchases: observation.purchases,
        revenueUsd: observation.revenueUsd,
        landingViews: observation.landingViews,
        checkouts: observation.checkouts,
        stage: observation.stage,
        at: new Date(bucket * bucketMs).toISOString(),
      }),
    );
}
