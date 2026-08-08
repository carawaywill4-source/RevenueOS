import type { FirstCustomerMode, Observation, Opportunity } from "../types";

const BUYER_EXPOSURE_ACTIONS = [
  "publish_intent_page",
  "discovery_attack",
  "indexnow_submit",
  "sitemap_ping",
  "feature_product",
  "publish_bundle",
  "market_research",
];

/**
 * FIRST_CUSTOMER_MODE: when purchases == 0, prioritize actions that can put a
 * real buyer in front of a payable offer. Do not polish vanity while invisible.
 */
export function evaluateFirstCustomerMode(
  observation: Observation,
): FirstCustomerMode {
  const purchases = observation.money.purchases;
  const active = purchases <= 0;
  return {
    active,
    reason: active
      ? "Zero customers — prioritize buyer exposure over polish."
      : "Customers exist — evidence-driven optimization.",
    priority: "buyer_exposure",
    preferredActionTypes: BUYER_EXPOSURE_ACTIONS,
  };
}

/** Boost opportunities that create buyer exposure when in FIRST_CUSTOMER_MODE. */
export function applyFirstCustomerPressure(input: {
  opportunities: Opportunity[];
  mode: FirstCustomerMode;
}): Opportunity[] {
  if (!input.mode.active) return input.opportunities;
  const preferred = new Set(input.mode.preferredActionTypes);
  return [...input.opportunities]
    .map((opp) => {
      const type = opp.safeActionType ?? "";
      const boost = preferred.has(type) ? 1.35 : type ? 0.85 : 0.6;
      return {
        ...opp,
        score: Number((opp.score * boost).toFixed(2)),
      };
    })
    .sort((a, b) => b.score - a.score);
}
