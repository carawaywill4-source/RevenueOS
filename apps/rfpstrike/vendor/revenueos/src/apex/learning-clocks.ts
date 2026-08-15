/**
 * Two independent learning clocks.
 *
 * FAST — acquisition: put offer in front of more likely buyers.
 * SLOW — product/conversion: only when evidence is sufficient.
 */

import type { EvidenceLevel, LearningClock } from "./types";
import { evidenceAllowsProductMutation, trafficInsufficient } from "./evidence-sufficiency";

const PRODUCT_MUTATION_ACTIONS = new Set([
  "offer_clarity_update",
  "message_genome_test",
  "trust_signal_pack",
  "conversion_lab_cta",
  // checkout_friction_audit allowed as obvious UX/tech repair even on small samples
  "unit_economics_review",
]);

/** Obvious defect repairs FORGE may still do in FCM — not endless redesign. */
const ALLOWED_DEFECT_REPAIRS = new Set([
  "checkout_friction_audit",
]);

const ACQUISITION_ACTIONS = new Set([
  "publish_discovery_door",
  "distribute_owned_urls",
  "list_gumroad",
  "demand_radar_sweep",
  "scale_proven_channel",
  "buyer_discovery",
  "distribute_reddit",
  "email_outreach",
  "list_producthunt",
  "list_indiehackers",
  "hn_show",
]);

export function classifyActionClock(action: string): LearningClock {
  const a = action.toLowerCase();
  if (PRODUCT_MUTATION_ACTIONS.has(a) || a.includes("redesign") || a.includes("reprice")) {
    return "SLOW_PRODUCT_CONVERSION";
  }
  if (
    ACQUISITION_ACTIONS.has(a) ||
    a.includes("distribut") ||
    a.includes("publish") ||
    a.includes("outreach") ||
    a.includes("discover") ||
    a.includes("list_") ||
    a.includes("index")
  ) {
    return "FAST_ACQUISITION";
  }
  if (ALLOWED_DEFECT_REPAIRS.has(a)) return "SLOW_PRODUCT_CONVERSION";
  return "FAST_ACQUISITION";
}

export function selectActiveClock(input: {
  evidenceLevel: EvidenceLevel;
  firstCustomerMode: boolean;
  purchases: number;
  /** From BusinessCapabilityManifest when present. */
  manifestPrimaryObjective?: string;
  forgeConfidence?: number;
}): {
  clock: LearningClock;
  primaryObjective: string;
  productMutationBlocked: boolean;
  acquisitionUrgency: "low" | "normal" | "high" | "critical";
} {
  const insufficient = trafficInsufficient(input.evidenceLevel);
  const productMutationBlocked =
    insufficient || !evidenceAllowsProductMutation(input.evidenceLevel);

  if (input.firstCustomerMode || input.purchases === 0) {
    const obj =
      input.manifestPrimaryObjective ??
      "FIRST ATTRIBUTED STRANGER PURCHASE";
    return {
      clock: "FAST_ACQUISITION",
      primaryObjective: `${obj} — product READY (FORGE≠market validation); APEX tests channel/persona/intent/message only`,
      productMutationBlocked: true,
      acquisitionUrgency:
        input.evidenceLevel === "NO_EVIDENCE" ? "critical" : "high",
    };
  }

  if (insufficient) {
    return {
      clock: "FAST_ACQUISITION",
      primaryObjective:
        "ACQUIRE_MORE_QUALIFIED_EVIDENCE — primary objective under insufficient traffic",
      productMutationBlocked: true,
      acquisitionUrgency:
        input.evidenceLevel === "NO_EVIDENCE" ? "critical" : "high",
    };
  }

  return {
    clock: "SLOW_PRODUCT_CONVERSION",
    primaryObjective:
      "IMPROVE_CONVERSION_WITH_SUFFICIENT_EVIDENCE — product changes allowed under isolation",
    productMutationBlocked: false,
    acquisitionUrgency: "normal",
  };
}

export function isProductMutationAction(action: string): boolean {
  return classifyActionClock(action) === "SLOW_PRODUCT_CONVERSION";
}

export function isAllowedDefectRepair(action: string): boolean {
  return ALLOWED_DEFECT_REPAIRS.has(action.toLowerCase());
}
