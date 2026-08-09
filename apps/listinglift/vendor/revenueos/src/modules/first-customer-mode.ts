import type {
  FirstCustomerMode,
  Observation,
  Opportunity,
} from "../types";

/**
 * FIRST_CUSTOMER_MODE priority ladder (purchases = 0):
 * buyer exposure → qualified visits → offer/message testing → checkout starts
 * → purchase → (only then) conversion polish.
 */
export const FIRST_CUSTOMER_STAGES = [
  "buyer_exposure",
  "qualified_visits",
  "offer_testing",
  "checkout_starts",
  "purchase",
  "conversion_optimization",
] as const;

export type FirstCustomerStage = (typeof FIRST_CUSTOMER_STAGES)[number];

const STAGE_ACTIONS: Record<FirstCustomerStage, string[]> = {
  buyer_exposure: [
    "distribute_owned_urls",
    "publish_programmatic_door",
    "publish_free_resource",
    "publish_lead_magnet",
    "discovery_attack",
    "publish_intent_page",
    "publish_howto_cluster",
    "publish_comparison_page",
    "indexnow_submit",
    "ping_search_engines",
    "sitemap_ping",
    "market_research",
  ],
  qualified_visits: [
    "publish_free_resource",
    "publish_programmatic_door",
    "publish_intent_page",
    "discovery_attack",
    "feature_product",
    "distribute_owned_urls",
    "indexnow_submit",
  ],
  offer_testing: [
    "feature_product",
    "publish_bundle",
    "change_default_cta",
    "publish_template_landing",
    "publish_comparison_page",
  ],
  checkout_starts: [
    "feature_product",
    "change_default_cta",
    "publish_bundle",
  ],
  purchase: ["feature_product", "publish_bundle"],
  conversion_optimization: [
    "scorecard_snapshot",
    "feature_product",
    "change_default_cta",
  ],
};

const COSMETIC_OR_IDLE = new Set([
  "scorecard_snapshot",
  "rewrite_page_copy",
]);

export function resolveFirstCustomerStage(
  observation: Observation,
): FirstCustomerStage {
  const purchases = observation.money.purchases;
  if (purchases > 0) return "conversion_optimization";
  const views = observation.funnel.landingViews;
  const checkouts = observation.funnel.checkouts;
  if (checkouts > 0) return "purchase";
  if (views >= 50) return "offer_testing";
  if (views >= 10) return "qualified_visits";
  if (views > 0) return "buyer_exposure";
  return "buyer_exposure";
}

/**
 * FIRST_CUSTOMER_MODE: when purchases == 0, prioritize actions that can put a
 * real buyer in front of a payable offer. Do not polish vanity while invisible.
 */
export function evaluateFirstCustomerMode(
  observation: Observation,
): FirstCustomerMode {
  const purchases = observation.money.purchases;
  const active = purchases <= 0;
  const stage = resolveFirstCustomerStage(observation);
  return {
    active,
    stage,
    reason: active
      ? `Zero customers — stage ${stage}: chase buyers before polish.`
      : "Customers exist — evidence-driven optimization.",
    priority: "buyer_exposure",
    preferredActionTypes: STAGE_ACTIONS[stage],
  };
}

/** Boost opportunities that create buyer exposure when in FIRST_CUSTOMER_MODE. */
export function applyFirstCustomerPressure(input: {
  opportunities: Opportunity[];
  mode: FirstCustomerMode;
  observation?: Observation;
}): Opportunity[] {
  if (!input.mode.active) return input.opportunities;
  const preferred = new Set(input.mode.preferredActionTypes);
  const stage = input.observation
    ? resolveFirstCustomerStage(input.observation)
    : "buyer_exposure";

  return [...input.opportunities]
    .map((opp) => {
      const type = opp.safeActionType ?? "";
      let boost = 0.55;
      if (preferred.has(type)) boost = 1.55;
      else if (STAGE_ACTIONS.buyer_exposure.includes(type)) boost = 1.25;
      else if (type && !COSMETIC_OR_IDLE.has(type)) boost = 0.9;
      else if (COSMETIC_OR_IDLE.has(type) && stage === "buyer_exposure") {
        boost = 0.25; // actively demote polish while invisible
      }
      return {
        ...opp,
        score: Number((opp.score * boost).toFixed(2)),
      };
    })
    .sort((a, b) => b.score - a.score);
}
