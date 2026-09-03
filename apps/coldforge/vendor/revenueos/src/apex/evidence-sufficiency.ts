/**
 * EvidenceGate + TrafficSufficiencyModel + DecisionConfidence.
 *
 * Tiny traffic ≠ conversion failure.
 * Lack of conversion from 2 visits is NOT evidence the offer is bad.
 */

import type { Observation, PursuitEvent } from "../types";
import type { ApexBusinessState } from "./types";
import type {
  CommercialTruthTier,
  DiagnosisEvidence,
  EvidenceLevel,
} from "./types";
import { shouldLearnFromTraffic } from "./traffic-quality";
import type { TrafficQuality } from "./types";

export const EVIDENCE_RANK: Record<EvidenceLevel, number> = {
  NO_EVIDENCE: 0,
  WEAK_SIGNAL: 1,
  EMERGING_SIGNAL: 2,
  ACTIONABLE_SIGNAL: 3,
  STRONG_EVIDENCE: 4,
};

/** Minimum qualified exposures before product/conversion mutation is allowed. */
export const MIN_QUALIFIED_FOR_PRODUCT_MUTATION = 25;
/** Minimum checkouts before checkout/price conclusions are actionable. */
export const MIN_CHECKOUTS_FOR_CONVERSION_CLAIM = 5;
/** Independent stranger purchases for STRONG_EVIDENCE. */
export const MIN_PURCHASES_FOR_STRONG = 3;

export type TrafficCounts = {
  rawVisits: number;
  visits: number;
  qualifiedVisits: number;
  engagements: number;
  intents: number;
  checkouts: number;
  purchases: number;
  revenueUsd: number;
  sourceMix: Record<string, number>;
};

export function countTraffic(input: {
  observation: Observation;
  state: ApexBusinessState;
  recentEvents?: PursuitEvent[];
}): TrafficCounts {
  let visits = 0;
  let qualifiedVisits = 0;
  let engagements = 0;
  let intents = 0;
  let checkouts = 0;
  let rawVisits = 0;
  const sourceMix: Record<string, number> = {};

  for (const e of input.recentEvents ?? []) {
    const detail = (e.detail ?? {}) as Record<string, unknown>;
    const ce = (detail.commercial_event ?? {}) as Record<string, unknown>;
    if (e.eventType !== "beacon" && detail.kind !== "apex_commercial_event") {
      continue;
    }
    const q = (detail.traffic_quality as TrafficQuality | undefined) ?? "LIKELY_HUMAN";
    const kind = String(detail.kind ?? ce.event_type ?? "");
    const source = String(
      detail.utm_source ?? ce.source ?? detail.referrer ?? "unknown",
    ).slice(0, 80);
    sourceMix[source] = (sourceMix[source] ?? 0) + 1;

    if (q === "RAW" || !shouldLearnFromTraffic(q)) {
      rawVisits += 1;
      continue;
    }

    const isPage = kind === "page_view" || kind === "VISIT" || kind === "scroll_depth";
    const isEngage = kind === "scroll_depth" || kind === "ENGAGEMENT";
    const isIntent = kind === "cta_click" || kind === "CTA" || kind === "checkout_start";
    const isCheckout = kind === "checkout_start" || kind === "CHECKOUT";
    const isPurchase =
      kind === "checkout_complete" || kind === "PURCHASE" || kind === "apex_purchase";

    if (isPage) {
      visits += 1;
      if (q === "QUALIFIED" || q === "LIKELY_HUMAN") qualifiedVisits += 1;
    }
    if (isEngage) engagements += 1;
    if (isIntent) intents += 1;
    if (isCheckout) checkouts += 1;
    if (isPurchase) {
      /* purchases counted from money/state below */
    }
  }

  const landing = input.observation.funnel.landingViews ?? 0;
  const obsCheckouts = input.observation.funnel.checkouts ?? 0;
  const purchases = Math.max(
    input.observation.money?.purchases ?? 0,
    input.state.purchases,
  );
  const revenueUsd = Math.max(
    input.observation.money?.revenueUsd ?? 0,
    input.state.revenue_usd,
  );

  return {
    rawVisits,
    visits: Math.max(visits, landing),
    qualifiedVisits: Math.max(
      qualifiedVisits,
      landing,
      input.state.qualified_visits,
    ),
    engagements,
    intents,
    checkouts: Math.max(checkouts, obsCheckouts, input.state.checkouts),
    purchases,
    revenueUsd,
    sourceMix,
  };
}

export function strongestTruthTier(counts: TrafficCounts): CommercialTruthTier {
  if (counts.purchases > 0 || counts.revenueUsd > 0) return "PURCHASE";
  if (counts.checkouts > 0) return "CHECKOUT";
  if (counts.intents > 0) return "HIGH_INTENT";
  if (counts.engagements > 0) return "PRODUCT_ENGAGEMENT";
  if (counts.qualifiedVisits > 0) return "QUALIFIED_VISIT";
  if (counts.visits > 0) return "VISIT";
  return "THEORY";
}

export function classifyEvidenceLevel(counts: TrafficCounts): EvidenceLevel {
  if (counts.purchases >= MIN_PURCHASES_FOR_STRONG) return "STRONG_EVIDENCE";
  if (counts.purchases >= 1) return "ACTIONABLE_SIGNAL";
  if (
    counts.qualifiedVisits >= MIN_QUALIFIED_FOR_PRODUCT_MUTATION ||
    counts.checkouts >= MIN_CHECKOUTS_FOR_CONVERSION_CLAIM
  ) {
    return "ACTIONABLE_SIGNAL";
  }
  if (counts.qualifiedVisits >= 15 || counts.checkouts >= 1 || counts.intents >= 3) {
    return "EMERGING_SIGNAL";
  }
  if (counts.qualifiedVisits >= 3 || counts.visits >= 3) return "WEAK_SIGNAL";
  return "NO_EVIDENCE";
}

export function buildDiagnosisEvidence(input: {
  counts: TrafficCounts;
  observationWindow?: string;
  contradictory?: string[];
}): DiagnosisEvidence {
  const level = classifyEvidenceLevel(input.counts);
  const tier = strongestTruthTier(input.counts);
  const q = input.counts.qualifiedVisits;
  const completeness =
    q <= 0
      ? 0
      : Math.min(
          1,
          (input.counts.intents + input.counts.checkouts * 2 + input.counts.purchases * 4) /
            Math.max(1, q),
        );

  let statement: string;
  if (level === "NO_EVIDENCE" || level === "WEAK_SIGNAL") {
    if (q === 0) {
      statement =
        "No qualified exposure yet — insufficient evidence for any conversion claim.";
    } else {
      statement = `No engagement observed yet among ${q} qualified visit(s). This is NOT evidence the offer is bad — sample too small for conversion inference.`;
    }
  } else if (level === "EMERGING_SIGNAL") {
    statement = `Emerging signal only (qualified=${q}, intents=${input.counts.intents}, checkouts=${input.counts.checkouts}). Treat conversion hypotheses as provisional.`;
  } else if (level === "ACTIONABLE_SIGNAL") {
    statement = `Actionable commercial signal present. Product/conversion changes may be justified with isolation.`;
  } else {
    statement = `Strong evidence from repeated commercial outcomes (purchases=${input.counts.purchases}).`;
  }

  const buyerIntentQuality = Math.min(
    1,
    (input.counts.intents * 0.15 +
      input.counts.checkouts * 0.35 +
      input.counts.purchases * 0.5) /
      Math.max(1, Math.sqrt(Math.max(1, q))),
  );

  const confidence =
    level === "STRONG_EVIDENCE"
      ? 0.85
      : level === "ACTIONABLE_SIGNAL"
        ? 0.65
        : level === "EMERGING_SIGNAL"
          ? 0.4
          : level === "WEAK_SIGNAL"
            ? 0.2
            : 0.08;

  return {
    sample_size: Math.max(input.counts.visits, input.counts.qualifiedVisits),
    qualified_sample_size: input.counts.qualifiedVisits,
    observation_window: input.observationWindow ?? "recent_pursuit_events+observation",
    source_mix: input.counts.sourceMix,
    buyer_intent_quality: Number(buyerIntentQuality.toFixed(3)),
    event_completeness: Number(completeness.toFixed(3)),
    confidence,
    minimum_evidence_required: "ACTIONABLE_SIGNAL",
    contradictory_evidence: input.contradictory ?? [],
    decision_reversibility:
      level === "NO_EVIDENCE" || level === "WEAK_SIGNAL" ? "high" : "medium",
    evidence_level: level,
    strongest_truth_tier: tier,
    statement,
  };
}

/** Decision confidence capped by evidence — prevents overconfident tiny-sample claims. */
export function decisionConfidence(input: {
  baseConfidence: number;
  evidence: DiagnosisEvidence;
  collided?: boolean;
}): number {
  const cap =
    input.evidence.evidence_level === "STRONG_EVIDENCE"
      ? 0.9
      : input.evidence.evidence_level === "ACTIONABLE_SIGNAL"
        ? 0.7
        : input.evidence.evidence_level === "EMERGING_SIGNAL"
          ? 0.45
          : input.evidence.evidence_level === "WEAK_SIGNAL"
            ? 0.25
            : 0.15;
  let c = Math.min(input.baseConfidence, cap, input.evidence.confidence + 0.1);
  if (input.collided) c *= 0.6;
  return Number(Math.max(0.05, c).toFixed(3));
}

export function evidenceAllowsProductMutation(level: EvidenceLevel): boolean {
  return EVIDENCE_RANK[level] >= EVIDENCE_RANK.ACTIONABLE_SIGNAL;
}

export function trafficInsufficient(level: EvidenceLevel): boolean {
  return EVIDENCE_RANK[level] < EVIDENCE_RANK.ACTIONABLE_SIGNAL;
}
