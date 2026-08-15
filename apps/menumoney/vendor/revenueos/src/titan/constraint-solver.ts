/**
 * Executive constraint solver + why-tree + bottleneck probabilities.
 * Focus resources on the binding constraint. Reality updates probabilities.
 */

import type { ApexCycleResult, EvidenceLevel } from "../apex/types";
import type {
  BusinessSnapshot,
  ConstraintDiagnosis,
  ExecutiveConstraintKind,
} from "./types";

function normalize(probs: Record<string, number>): Record<string, number> {
  const sum = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(probs)) {
    out[k] = Number((v / sum).toFixed(3));
  }
  return out;
}

/**
 * Diagnose binding constraints from APEX + business snapshot.
 * Small samples → acquisition/qualified_exposure, never offer failure.
 */
export function diagnoseExecutiveConstraints(input: {
  snapshot: BusinessSnapshot;
  apex?: Pick<
    ApexCycleResult,
    | "bottleneck"
    | "evidence_level"
    | "diagnosis_evidence"
    | "product_mutation_blocked"
    | "first_customer_mode"
    | "learning_clock"
  > | null;
}): ConstraintDiagnosis {
  const s = input.snapshot;
  const evidence: EvidenceLevel = input.apex?.evidence_level ?? s.evidence_level;
  const q = s.qualified_visits;
  const checkouts = s.checkouts;
  const purchases = s.purchases;

  let primary: ExecutiveConstraintKind = "unknown";
  let secondary: ExecutiveConstraintKind = "unknown";
  let emerging: ExecutiveConstraintKind = "reliability";
  const why: string[] = [];
  let probs: Record<string, number> = {
    acquisition: 0.2,
    qualified_exposure: 0.2,
    offer: 0.1,
    product_market_fit: 0.1,
    price: 0.1,
    trust: 0.1,
    checkout: 0.1,
    conversion: 0.1,
  };

  // Case: tiny sample / first customer — do not blame offer.
  if (
    purchases === 0 &&
    (evidence === "NO_EVIDENCE" ||
      evidence === "WEAK_SIGNAL" ||
      evidence === "EMERGING_SIGNAL" ||
      q < 50)
  ) {
    primary = "qualified_exposure";
    secondary = "acquisition";
    emerging = "awareness";
    why.push("No revenue");
    why.push("No purchases");
    why.push("Insufficient qualified traffic to evaluate conversion");
    why.push("Distribution / APEX channel execution is the binding constraint");
    probs = {
      qualified_exposure: 0.55,
      acquisition: 0.25,
      awareness: 0.1,
      offer: 0.03,
      product_market_fit: 0.03,
      price: 0.02,
      trust: 0.01,
      checkout: 0.01,
    };
  } else if (
    purchases === 0 &&
    q >= 50 &&
    checkouts >= 20 &&
    s.checkout_status === "VERIFIED"
  ) {
    // Acquisition worked; conversion/offer/price become primary.
    primary = "conversion";
    secondary = "offer";
    emerging = "pricing";
    why.push("Qualified demand reached the product");
    why.push("Many CTA/checkout starts without purchases");
    why.push("Checkout technically healthy → investigate price, trust, offer mismatch");
    probs = {
      offer: 0.28,
      pricing: 0.22,
      trust: 0.18,
      conversion: 0.15,
      checkout: 0.07,
      product_market_fit: 0.1,
    };
  } else if (purchases === 0 && q >= 50 && checkouts === 0) {
    primary = "conversion";
    secondary = "trust";
    emerging = "offer";
    why.push("Traffic arrives but intent does not reach checkout");
    why.push("Investigate CTA clarity, trust, offer framing");
    probs = {
      conversion: 0.3,
      trust: 0.25,
      offer: 0.25,
      product_market_fit: 0.1,
      pricing: 0.1,
    };
  } else if (purchases > 0 && s.revenue_usd > 0) {
    primary = "acquisition";
    secondary = "retention";
    emerging = "capacity";
    why.push("First commercial proof exists");
    why.push("Scale qualified acquisition while protecting reliability");
    probs = {
      acquisition: 0.4,
      retention: 0.2,
      conversion: 0.15,
      capacity: 0.1,
      margin: 0.15,
    };
  }

  // Apex bottleneck hint (soft prior).
  const apexBn = input.apex?.bottleneck;
  if (apexBn === "NO_IMPRESSIONS" || apexBn === "IMPRESSIONS_NO_CLICKS") {
    probs.awareness = (probs.awareness ?? 0) + 0.15;
    probs.acquisition = (probs.acquisition ?? 0) + 0.1;
  }

  const statement =
    primary === "qualified_exposure"
      ? "PRIMARY CONSTRAINT: insufficient qualified exposure. Tiny traffic is not offer failure."
      : primary === "conversion" && checkouts > 0
        ? "PRIMARY CONSTRAINT: conversion/offer after demonstrated acquisition."
        : `PRIMARY CONSTRAINT: ${primary}.`;

  return {
    business_id: s.business_id,
    primary,
    secondary,
    emerging,
    why_tree: why,
    bottleneck_probabilities: normalize(probs),
    evidence_level: evidence,
    statement,
  };
}
