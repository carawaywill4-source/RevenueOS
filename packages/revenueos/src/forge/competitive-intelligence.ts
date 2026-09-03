/**
 * Competitive Intelligence Engine.
 * Competition is evidence and benchmark — not an enemy to attack.
 */

import { newId } from "../ledger/store";
import type { CompetitorProfile, EconomicOpportunity } from "./enterprise-types";

export function buildCompetitorProfiles(
  opp: EconomicOpportunity,
  known?: Array<Partial<CompetitorProfile> & { name: string }>,
): CompetitorProfile[] {
  const fromKnown = (known ?? []).map((k) => normalizeCompetitor(k, opp));
  if (fromKnown.length) return fromKnown;

  // Derive thin profiles from signal strings when structured intel absent.
  return opp.signals.competitors.slice(0, 5).map((line, i) =>
    normalizeCompetitor(
      {
        name: line.split(/[-–:]/)[0]?.trim() || `Competitor ${i + 1}`,
        sells: line,
        weaknesses: opp.signals.complaints.slice(0, 3),
        complaints: opp.signals.complaints,
        evidence: [line, ...opp.signals.reviews.slice(0, 2)],
      },
      opp,
    ),
  );
}

function normalizeCompetitor(
  partial: Partial<CompetitorProfile> & { name: string },
  opp: EconomicOpportunity,
): CompetitorProfile {
  return {
    competitor_id: partial.competitor_id ?? newId("comp"),
    name: partial.name,
    sells: partial.sells ?? "unknown offering",
    buyers: partial.buyers ?? opp.buyer,
    why_customers_choose: partial.why_customers_choose ?? ["incumbent familiarity"],
    why_customers_leave: partial.why_customers_leave ?? opp.signals.complaints.slice(0, 3),
    pricing: partial.pricing ?? opp.signals.pricing[0] ?? "unknown",
    positioning: partial.positioning ?? "generic category player",
    distribution: partial.distribution ?? opp.signals.communities.slice(0, 3),
    seo_footprint: partial.seo_footprint ?? "unknown",
    features: partial.features ?? [],
    trust_signals: partial.trust_signals ?? [],
    brand_quality: partial.brand_quality ?? "unknown",
    onboarding: partial.onboarding ?? "unknown",
    sales_process: partial.sales_process ?? "self-serve or unknown",
    retention: partial.retention ?? [],
    reviews_summary: partial.reviews_summary ?? opp.signals.reviews[0] ?? "sparse",
    complaints: partial.complaints ?? opp.signals.complaints,
    missing_capabilities: partial.missing_capabilities ?? [],
    switching_costs: partial.switching_costs ?? "unknown",
    moat: partial.moat ?? "unknown",
    weaknesses: partial.weaknesses ?? [],
    recent_changes: partial.recent_changes ?? [],
    evidence: partial.evidence ?? [],
    confidence: partial.confidence ?? 0.45,
  };
}

/**
 * Strongest relevant competitors — prefer higher confidence + clearer weaknesses.
 */
export function strongestCompetitors(
  profiles: CompetitorProfile[],
  limit = 3,
): CompetitorProfile[] {
  return [...profiles]
    .sort((a, b) => {
      const score = (p: CompetitorProfile) =>
        p.confidence * 2 +
        (p.weaknesses.length + p.complaints.length) * 0.1 -
        (p.moat === "strong" ? 0.5 : 0);
      return score(b) - score(a);
    })
    .slice(0, limit);
}
