/**
 * Per-pattern commercial posteriors.
 *
 * Every acquisition mechanism (identified by patternKey) is judged only on
 * evidence it produced revenue signal: verified_exposure, intent, commercial.
 * Production and distribution alone do not prove pursuit — they are weighed
 * near zero.
 *
 * A pattern is BANNED when it has been attempted enough times to have earned
 * signal and none arrived. A banned pattern cannot be re-enqueued until its
 * cooldown expires. This enforces the invariant:
 *
 *   A failed strategy cannot be repeated unless RevenueOS has new evidence
 *   justifying another attempt.
 *
 * The banned pattern's mechanism class is also recorded so mechanism-diversity
 * enforcement can force a genuinely different acquisition hypothesis next.
 */

import type { Observation, Opportunity, PursuitEvent } from "../types";
import {
  ACTION_CLASS_WEIGHT,
  classifyExecutionActionClass,
  classifyMechanism,
  type MechanismClass,
} from "./action-class";

export type PatternPosterior = {
  patternKey: string;
  mechanism: MechanismClass;
  attempts: number;
  distributionAttempts: number;
  productionAttempts: number;
  verifiedExposures: number;
  intents: number;
  commercialOutcomes: number;
  lastAttemptAt: string | null;
  firstAttemptAt: string | null;
  commercialScore: number;
  banned: boolean;
  banReason?: string;
  banUntil?: string;
};

export type PatternPosteriorMap = Record<string, PatternPosterior>;

/**
 * Number of executed attempts a pattern gets before it must have earned
 * verified_exposure OR intent OR commercial. Beyond this without signal → ban.
 */
export const PATTERN_ATTEMPT_BUDGET = 3;

/** How long a banned pattern stays banned before RevenueOS may retry it. */
const BAN_COOLDOWN_MS = 24 * 3_600_000;

/**
 * Attribution windows: signal (from observation OR from beacon events) is
 * shared across patterns proportional to attempt share. Beacon events give
 * per-path signal that the observation cannot, but we combine both so the
 * posterior always sees the strongest available evidence.
 */
export function buildPatternPosteriors(input: {
  events: PursuitEvent[];
  observation: Observation;
  now?: Date;
}): PatternPosteriorMap {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const posteriors: PatternPosteriorMap = {};

  for (const event of input.events) {
    if (event.eventType !== "executed") continue;
    if (event.detail?.ok !== true) continue;
    const actionType =
      typeof event.detail.actionType === "string"
        ? String(event.detail.actionType)
        : undefined;
    const patternKey =
      typeof event.detail.patternKey === "string"
        ? String(event.detail.patternKey)
        : (actionType ?? "unknown");
    const mechanism = classifyMechanism({
      actionType,
      patternKey,
      category:
        typeof event.detail.category === "string"
          ? String(event.detail.category)
          : undefined,
    });
    const cls = classifyExecutionActionClass(actionType);

    const bucket =
      posteriors[patternKey] ??
      (posteriors[patternKey] = {
        patternKey,
        mechanism,
        attempts: 0,
        distributionAttempts: 0,
        productionAttempts: 0,
        verifiedExposures: 0,
        intents: 0,
        commercialOutcomes: 0,
        lastAttemptAt: null,
        firstAttemptAt: null,
        commercialScore: 0,
        banned: false,
      });
    bucket.attempts += 1;
    if (cls === "distribution") bucket.distributionAttempts += 1;
    if (cls === "production") bucket.productionAttempts += 1;
    if (!bucket.firstAttemptAt) bucket.firstAttemptAt = event.createdAt;
    bucket.lastAttemptAt = event.createdAt;
  }

  // Downstream signal: combine observation (canonical) with beacon events
  // (per-path). Beacon signal is authoritative when present.
  const totalAttempts = Object.values(posteriors).reduce(
    (s, p) => s + p.attempts,
    0,
  );
  let verifiedExposure = Math.max(0, input.observation.funnel.landingViews);
  let intent = Math.max(0, input.observation.funnel.checkouts);
  let commercial = Math.max(0, input.observation.money.purchases);
  let beaconExposure = 0;
  let beaconIntent = 0;
  let beaconCommercial = 0;
  for (const event of input.events) {
    if (event.eventType !== "beacon") continue;
    const kind = String(event.detail?.kind ?? "");
    if (kind === "checkout_complete") beaconCommercial += 1;
    else if (kind === "cta_click" || kind === "checkout_start")
      beaconIntent += 1;
    else beaconExposure += 1;
  }
  verifiedExposure = Math.max(verifiedExposure, beaconExposure);
  intent = Math.max(intent, beaconIntent);
  commercial = Math.max(commercial, beaconCommercial);

  for (const p of Object.values(posteriors)) {
    if (totalAttempts > 0 && p.attempts > 0) {
      const share = p.attempts / totalAttempts;
      p.verifiedExposures = Math.round(verifiedExposure * share * 100) / 100;
      p.intents = Math.round(intent * share * 100) / 100;
      p.commercialOutcomes = Math.round(commercial * share * 100) / 100;
    }
    p.commercialScore = Number(
      (
        p.verifiedExposures * ACTION_CLASS_WEIGHT.verified_exposure +
        p.intents * ACTION_CLASS_WEIGHT.intent +
        p.commercialOutcomes * ACTION_CLASS_WEIGHT.commercial +
        p.distributionAttempts * ACTION_CLASS_WEIGHT.distribution
      ).toFixed(3),
    );

    const eligibleForBan =
      p.attempts >= PATTERN_ATTEMPT_BUDGET &&
      p.verifiedExposures <= 0 &&
      p.intents <= 0 &&
      p.commercialOutcomes <= 0;
    if (eligibleForBan) {
      p.banned = true;
      p.banReason = `${p.attempts} executed with zero verified_exposure/intent/commercial signal`;
      p.banUntil = new Date(nowMs + BAN_COOLDOWN_MS).toISOString();
    }
  }

  return posteriors;
}

export type PatternGate = {
  bannedPatterns: Set<string>;
  bannedMechanisms: Set<MechanismClass>;
  reasons: Record<string, string>;
};

export function computePatternGate(posteriors: PatternPosteriorMap): PatternGate {
  const bannedPatterns = new Set<string>();
  const bannedMechanisms = new Set<MechanismClass>();
  const reasons: Record<string, string> = {};
  for (const p of Object.values(posteriors)) {
    if (!p.banned) continue;
    bannedPatterns.add(p.patternKey);
    bannedMechanisms.add(p.mechanism);
    reasons[p.patternKey] = p.banReason ?? "banned";
  }
  return { bannedPatterns, bannedMechanisms, reasons };
}

/**
 * Drop banned patterns entirely (not merely demote — banning must be an
 * enforced law, not a soft preference). Boost opportunities whose mechanism
 * class is NOT banned so the next hypothesis is genuinely different.
 */
export function applyPatternGate(input: {
  opportunities: Opportunity[];
  gate: PatternGate;
}): Opportunity[] {
  const { gate } = input;
  return input.opportunities
    .filter((opp) => {
      const key = opp.patternKey ?? opp.safeActionType ?? "";
      return !gate.bannedPatterns.has(key);
    })
    .map((opp) => {
      const mechanism = classifyMechanism({
        actionType: opp.safeActionType,
        patternKey: opp.patternKey,
        category: opp.category,
      });
      if (gate.bannedMechanisms.has(mechanism)) {
        // Demote entire banned mechanism family so alternates outrank it.
        return { ...opp, score: Number((opp.score * 0.1).toFixed(2)) };
      }
      return opp;
    })
    .sort((a, b) => b.score - a.score);
}
