/**
 * Locate the tightest acquisition constraint.
 * Small samples must NOT claim product/offer failure.
 */

import type { Observation, PursuitEvent } from "../types";
import type { ApexBusinessState, BottleneckKind, DiagnosisEvidence } from "./types";
import {
  buildDiagnosisEvidence,
  countTraffic,
  trafficInsufficient,
  type TrafficCounts,
} from "./evidence-sufficiency";

export type BottleneckDiagnosis = {
  kind: BottleneckKind;
  detail: string;
  counts: TrafficCounts;
  evidence: DiagnosisEvidence;
};

export function diagnoseBottleneck(input: {
  observation: Observation;
  state: ApexBusinessState;
  recentEvents?: PursuitEvent[];
}): BottleneckDiagnosis {
  const counts = countTraffic({
    observation: input.observation,
    state: input.state,
    recentEvents: input.recentEvents,
  });
  const evidence = buildDiagnosisEvidence({
    counts,
    contradictory:
      counts.purchases === 0 ? ["no_revenueos_stranger_sales_yet"] : [],
  });

  const { qualifiedVisits: q, intents, checkouts, purchases, revenueUsd } = counts;
  const hourViews = input.observation.hourPulse?.landingViews;
  // Lifetime landingViews can inflate evidence; require fresh exposure before
  // treating the bottleneck as a landing/offer problem.
  let eventFreshVisits = 0;
  for (const e of input.recentEvents ?? []) {
    const detail = (e.detail ?? {}) as Record<string, unknown>;
    const kind = String(detail.kind ?? "");
    if (
      e.eventType === "beacon" ||
      detail.kind === "apex_commercial_event" ||
      kind === "page_view" ||
      kind === "VISIT"
    ) {
      const created = Date.parse(e.createdAt ?? "");
      if (Number.isFinite(created) && Date.now() - created < 6 * 60 * 60_000) {
        eventFreshVisits += 1;
      }
    }
  }
  const freshExposure =
    (typeof hourViews === "number" && hourViews > 0) || eventFreshVisits > 0;

  // Insufficient evidence: never claim the offer/product is the failure mode.
  if (trafficInsufficient(evidence.evidence_level)) {
    if (q <= 0 && !freshExposure) {
      return {
        kind: "NO_EXPOSURE",
        detail:
          "NO_EXPOSURE — impressions/exposure = 0 (or unmeasured). Discover/distribute; do not mutate product. Do NOT label as CLICKS_NO_ENGAGEMENT.",
        counts,
        evidence,
      };
    }
    if (q <= 0) {
      return {
        kind: "NO_IMPRESSIONS",
        detail:
          "No qualified visits yet — discovery/distribution is the constraint. Acquire exposure; do not mutate product.",
        counts,
        evidence,
      };
    }
    // Visits exist but sample too small for conversion inference.
    return {
      kind: "NO_IMPRESSIONS",
      detail: `${evidence.statement} Funnel label would be premature (intents=${intents}). PRIMARY OBJECTIVE = acquire more qualified evidence — not site redesign.`,
      counts,
      evidence,
    };
  }

  // Stale lifetime views without fresh exposure → still a distribution problem.
  // Lifetime qualified_visits / landingViews must NEVER become CLICKS_NO_ENGAGEMENT.
  if (!freshExposure && purchases === 0 && checkouts === 0) {
    return {
      kind: "NO_EXPOSURE",
      detail:
        `NO_EXPOSURE / stale measurement (hourViews=${hourViews ?? "n/a"}, recentBeaconVisits=${eventFreshVisits}, lifetimeQualified=${q}) ` +
        `— prioritize distribution/acquisition, not offer copy.`,
      counts,
      evidence,
    };
  }

  if (q > 0 && intents === 0 && checkouts === 0 && freshExposure) {
    return {
      kind: "CLICKS_NO_ENGAGEMENT",
      detail: `With fresh exposure + actionable sample (qualified=${q}), no CTA/checkout — relevance/message may be weak.`,
      counts,
      evidence,
    };
  }
  if (intents > 0 && checkouts === 0 && purchases === 0) {
    return {
      kind: "ENGAGEMENT_NO_INTENT",
      detail: `CTA signals=${intents} without checkout starts — product/offer clarity (sample sufficient).`,
      counts,
      evidence,
    };
  }
  if (checkouts > 0 && purchases === 0) {
    return {
      kind: "CHECKOUT_NO_PURCHASE",
      detail: `checkouts=${checkouts} purchases=0 — price/trust/payment friction.`,
      counts,
      evidence,
    };
  }
  if (purchases > 0 && revenueUsd <= 0) {
    return {
      kind: "PURCHASE_NO_PROFIT",
      detail: "Purchases recorded without contribution — economics review.",
      counts,
      evidence,
    };
  }
  if (purchases > 0 && q < 50) {
    return {
      kind: "PROFIT_NO_SCALE",
      detail: "Conversion exists; distribution ceiling is next constraint.",
      counts,
      evidence,
    };
  }
  if (q > 0 && intents > 0 && checkouts === 0) {
    return {
      kind: "INTENT_NO_CHECKOUT",
      detail: "Intent without checkout — trust or CTA path friction.",
      counts,
      evidence,
    };
  }
  return {
    kind: "UNKNOWN",
    detail: `qualified=${q} intents=${intents} checkouts=${checkouts} purchases=${purchases}`,
    counts,
    evidence,
  };
}
