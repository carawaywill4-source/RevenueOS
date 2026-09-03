/**
 * Per-business target tracking.
 *
 * RevenueOS runs against a hard, non-negotiable daily target:
 *   TARGET_DAILY_PROFIT_USD_PER_BUSINESS = $10,000
 *
 * The tracker converts current profit-so-far into a % progress against the
 * remaining day and computes an "aggressiveness dial" — multipliers the rest
 * of the system uses to open concurrency, expand mechanism exploration, and
 * mutate prompts more often when we're behind.
 *
 * Rule of thumb the specification calls out: a site 24h in with <5% progress
 * must be scaled up dramatically. This module treats that as a hard trigger
 * for `high` aggressiveness with multipliers well above 1.
 */

import type { MoneyObservation } from "../types";

export const TARGET_DAILY_PROFIT_USD_PER_BUSINESS = 10_000;

export type TargetProgress = {
  siteId?: string;
  targetProfitUsd: number;
  currentProfitUsd: number;
  progressPercent: number;
  hoursSinceStart: number;
  onPace: boolean;
  neededProfitPerHourUsd: number;
  status: "behind" | "on_pace" | "ahead";
};

export type AggressivenessLevel = "low" | "medium" | "high" | "max";

export type AggressivenessDial = {
  level: AggressivenessLevel;
  concurrencyMultiplier: number;
  mechanismExplorationMultiplier: number;
  mutationFrequencyMultiplier: number;
  reason: string;
};

const DAY_HOURS = 24;

/**
 * Where the business is against its $10k profit target.
 */
export function progressTowardTarget(input: {
  observation: Pick<MoneyObservation, "estimatedProfitUsd" | "revenueUsd">;
  hoursSinceStart: number;
  siteId?: string;
  targetProfitUsd?: number;
}): TargetProgress {
  const target = input.targetProfitUsd ?? TARGET_DAILY_PROFIT_USD_PER_BUSINESS;
  const current = Math.max(
    0,
    Number(input.observation.estimatedProfitUsd ?? 0),
  );
  const hours = Math.max(0, input.hoursSinceStart);
  const progressPercent = Number(((current / target) * 100).toFixed(2));
  const expectedProgressPercent = Math.min(
    100,
    (hours / DAY_HOURS) * 100,
  );
  const onPace = progressPercent >= expectedProgressPercent - 5;
  const hoursRemaining = Math.max(0.001, DAY_HOURS - hours);
  const neededProfitPerHourUsd = Number(
    Math.max(0, (target - current) / hoursRemaining).toFixed(2),
  );
  const status: TargetProgress["status"] =
    progressPercent >= expectedProgressPercent + 5
      ? "ahead"
      : onPace
        ? "on_pace"
        : "behind";
  return {
    siteId: input.siteId,
    targetProfitUsd: target,
    currentProfitUsd: current,
    progressPercent,
    hoursSinceStart: hours,
    onPace,
    neededProfitPerHourUsd,
    status,
  };
}

/**
 * Compute the aggressiveness dial. Multipliers are floored at 1.0 (baseline)
 * and rise when the site is behind.
 *
 * Hard rule: 24h in with progressPercent < 5 → "high" (or "max" if < 1).
 */
export function aggressivenessDial(input: {
  progressPercent: number;
  hoursSinceStart: number;
}): AggressivenessDial {
  const pct = input.progressPercent;
  const hours = input.hoursSinceStart;

  // Full-day-in-with-nothing hard trigger.
  if (hours >= DAY_HOURS && pct < 1) {
    return {
      level: "max",
      concurrencyMultiplier: 4,
      mechanismExplorationMultiplier: 5,
      mutationFrequencyMultiplier: 4,
      reason:
        "24h+ with <1% of target — flood mechanisms, mutate prompts, open every legal channel.",
    };
  }
  if (hours >= DAY_HOURS && pct < 5) {
    return {
      level: "high",
      concurrencyMultiplier: 3,
      mechanismExplorationMultiplier: 4,
      mutationFrequencyMultiplier: 3,
      reason:
        "24h in with <5% of target — scale aggressiveness up dramatically.",
    };
  }

  // Expected linear pace during the first 24h.
  const expected = Math.min(100, (hours / DAY_HOURS) * 100);
  const gap = expected - pct;

  if (gap > 40) {
    return {
      level: "high",
      concurrencyMultiplier: 2.5,
      mechanismExplorationMultiplier: 3,
      mutationFrequencyMultiplier: 2.5,
      reason: `${gap.toFixed(0)}pp behind expected pace — high aggressiveness.`,
    };
  }
  if (gap > 20) {
    return {
      level: "medium",
      concurrencyMultiplier: 1.75,
      mechanismExplorationMultiplier: 2,
      mutationFrequencyMultiplier: 1.75,
      reason: `${gap.toFixed(0)}pp behind expected pace — medium aggressiveness.`,
    };
  }
  if (gap > 5) {
    return {
      level: "medium",
      concurrencyMultiplier: 1.25,
      mechanismExplorationMultiplier: 1.5,
      mutationFrequencyMultiplier: 1.25,
      reason: `${gap.toFixed(0)}pp slightly behind — a nudge up.`,
    };
  }
  // On pace or ahead — hold multipliers at baseline.
  return {
    level: "low",
    concurrencyMultiplier: 1,
    mechanismExplorationMultiplier: 1,
    mutationFrequencyMultiplier: 1,
    reason: pct >= expected ? "On pace or ahead — hold baseline." : "Within tolerance — hold baseline.",
  };
}
