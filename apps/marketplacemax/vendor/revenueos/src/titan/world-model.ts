/**
 * ExecutiveWorldModel — continuously updated model of commercial reality.
 * Distinct from site-level `WorldModel` in types.ts.
 */

import type { ApexCycleResult } from "../apex/types";
import type { BusinessCapabilityManifest } from "../forge/capability-manifest";
import type { BusinessSnapshot, ExecutiveWorldModel } from "./types";
import { TITAN_NORTH_STAR_DAILY_REVENUE_USD } from "./constitution";

export function snapshotFromCommercialReality(input: {
  businessId: string;
  apex?: ApexCycleResult | null;
  capability?: BusinessCapabilityManifest | null;
  purchases: number;
  revenueUsd: number;
  strangerRevenueUsd?: number;
  checkouts?: number;
  qualifiedVisitsOverride?: number;
}): BusinessSnapshot {
  const apex = input.apex;
  const cap = input.capability;
  return {
    business_id: input.businessId,
    stage: String(cap?.current_business_stage ?? "UNKNOWN"),
    price_usd: cap?.price.current ?? 0,
    revenue_usd: input.revenueUsd,
    purchases: input.purchases,
    stranger_revenue_usd: input.strangerRevenueUsd ?? input.revenueUsd,
    qualified_visits:
      input.qualifiedVisitsOverride ??
      apex?.diagnosis_evidence?.qualified_sample_size ??
      0,
    checkouts: input.checkouts ?? 0,
    evidence_level: apex?.evidence_level ?? "NO_EVIDENCE",
    learning_clock: apex?.learning_clock ?? "FAST_ACQUISITION",
    product_mutation_blocked: apex?.product_mutation_blocked ?? true,
    forge_confidence: cap?.forge_confidence ?? 0,
    forge_confidence_is_not_wtp: true,
    product_status: String(cap?.product.status ?? "UNKNOWN"),
    checkout_status: String(cap?.checkout.status ?? "UNKNOWN"),
    fulfillment_status: String(cap?.fulfillment.status ?? "UNKNOWN"),
    reliability_status: String(cap?.reliability.status ?? "UNKNOWN"),
    primary_objective:
      cap?.primary_objective ?? "FIRST ATTRIBUTED STRANGER PURCHASE",
    known_uncertainties: cap?.known_product_uncertainties ?? [],
    apex_allowed_to_test: (cap?.apex_allowed_to_test ?? []).map(String),
  };
}

export function buildExecutiveWorldModel(input: {
  businesses: BusinessSnapshot[];
  now?: Date;
  notes?: string[];
}): ExecutiveWorldModel {
  const businesses = input.businesses;
  const stranger = businesses.reduce((a, b) => a + b.stranger_revenue_usd, 0);
  const weakest = [...businesses].sort((a, b) => {
    const rank: Record<string, number> = {
      NO_EVIDENCE: 0,
      WEAK_SIGNAL: 1,
      EMERGING_SIGNAL: 2,
      ACTIONABLE_SIGNAL: 3,
      STRONG_EVIDENCE: 4,
    };
    return (rank[a.evidence_level] ?? 0) - (rank[b.evidence_level] ?? 0);
  })[0];

  return {
    version: 1,
    updated_at: (input.now ?? new Date()).toISOString(),
    businesses,
    portfolio: {
      active_count: businesses.length,
      stranger_revenue_usd: stranger,
      top_opportunity:
        weakest && weakest.purchases === 0
          ? `${weakest.business_id}: first attributed stranger purchase via qualified exposure`
          : "scale proven economics",
      top_constraint:
        weakest?.evidence_level === "WEAK_SIGNAL" ||
        weakest?.evidence_level === "NO_EVIDENCE"
          ? "insufficient qualified exposure"
          : "evaluate conversion under healthy traffic",
      top_risk: "small-sample product mutation / false offer blame",
    },
    uncertainty: businesses.flatMap((b) => b.known_uncertainties),
    north_star_daily_usd: TITAN_NORTH_STAR_DAILY_REVENUE_USD,
    notes: input.notes ?? [],
  };
}
