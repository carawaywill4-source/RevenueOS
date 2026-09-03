/**
 * Structured evidence contracts between APEX, FORGE, and TITAN.
 */

import type { EvidenceLevel } from "../apex/types";
import type { ForgeEvidenceContract } from "./enterprise-types";

export const FORGE_EVIDENCE_CONTRACT: ForgeEvidenceContract = {
  weak_apex_blocks_product_mutation: true,
  forge_confidence_never_overrides_market: true,
  apex_owns: "acquisition_execution_and_learning",
  forge_owns: "company_product_operations_evolution",
  titan_owns: "resource_arbitration_strategy_portfolio",
};

const WEAK: EvidenceLevel[] = ["NO_EVIDENCE", "WEAK_SIGNAL", "EMERGING_SIGNAL"];

/**
 * Never allow weak APEX evidence to authorize destructive product mutation.
 */
export function apexEvidenceAllowsProductMutation(level: EvidenceLevel): boolean {
  return !WEAK.includes(level);
}

/**
 * FORGE confidence cannot override strong negative market evidence.
 * Example: forge_confidence 0.91 + strong checkout abandonment → investigate product/offer.
 */
export function forgeConfidenceVsMarket(input: {
  forge_confidence: number;
  market_evidence_level: EvidenceLevel;
  qualified_visits: number;
  checkouts: number;
  purchases: number;
}): {
  forge_may_claim_product_ready: boolean;
  market_overrides_forge: boolean;
  directive: string;
} {
  const strongMarketNoPurchase =
    input.qualified_visits >= 100 &&
    input.checkouts >= 20 &&
    input.purchases === 0 &&
    (input.market_evidence_level === "ACTIONABLE_SIGNAL" ||
      input.market_evidence_level === "STRONG_EVIDENCE");

  if (strongMarketNoPurchase) {
    return {
      forge_may_claim_product_ready: false,
      market_overrides_forge: true,
      directive:
        "Strong market evidence of non-purchase overrides forge_confidence — FORGE must investigate offer/price/trust/UX",
    };
  }

  if (WEAK.includes(input.market_evidence_level)) {
    return {
      forge_may_claim_product_ready: input.forge_confidence >= 0.8,
      market_overrides_forge: false,
      directive:
        "Weak APEX evidence — FORGE may maintain product readiness claims but must not mutate from tiny samples; APEX acquires",
    };
  }

  return {
    forge_may_claim_product_ready: input.forge_confidence >= 0.7,
    market_overrides_forge: false,
    directive: "Market and FORGE evidence jointly inform TITAN allocation",
  };
}

/** Structured handoff when APEX learns a persona/segment signal. */
export type ApexToForgeMarketEvidence = {
  business_id: string;
  persona: string;
  signal: string;
  lift?: number;
  sample_size: number;
  evidence_level: EvidenceLevel;
  suggested_forge_investigation: string;
};

export function forgeInvestigationFromApex(
  ev: ApexToForgeMarketEvidence,
): { accept: boolean; investigation: string; reason: string } {
  if (ev.sample_size < 20 || WEAK.includes(ev.evidence_level)) {
    return {
      accept: false,
      investigation: "",
      reason: "sample_too_weak — log belief only; do not redesign",
    };
  }
  return {
    accept: true,
    investigation: ev.suggested_forge_investigation,
    reason: `APEX market evidence accepted for FORGE investigation (n=${ev.sample_size})`,
  };
}
