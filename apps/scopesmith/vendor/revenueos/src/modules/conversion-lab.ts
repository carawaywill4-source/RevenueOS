/**
 * Conversion laboratory.
 *
 * Once verified_exposure > 0 but purchases = 0, the problem is no longer
 * "get more strangers" — it's "the funnel leaks." Content publishing is now
 * strictly wrong. This module generates opportunities that test the OFFER,
 * PRICE, CTA, URGENCY, TRUST, and GUARANTEE instead.
 *
 * Each returned opportunity carries a concrete mutation directive that the
 * site adapter (or a future variant server) can apply.
 */

import type { Observation, Opportunity } from "../types";

export type ConversionMutation =
  | {
      kind: "cta_directness";
      variant: "buy_now" | "instant_download" | "start_free" | "get_result";
    }
  | { kind: "urgency"; variant: "spots_left" | "price_up_soon" | "cohort_close" }
  | { kind: "price"; variant: "-10" | "-20" | "-30" | "usd_49" | "usd_29" }
  | {
      kind: "guarantee";
      variant: "refund_14d" | "refund_30d" | "money_back_first_purchase";
    }
  | { kind: "trust"; variant: "testimonials" | "logos" | "founder_story" }
  | { kind: "offer_shape"; variant: "bundle" | "trial" | "starter_tier" };

export type ConversionOpportunity = Omit<Opportunity, "score"> & {
  mutation: ConversionMutation;
};

/**
 * Trigger conversion experiments when we have verified traffic but no revenue.
 * `landingViews` should be beacon-verified, not fabricated.
 */
export function proposeConversionExperiments(input: {
  observation: Observation;
  minLandingViews?: number;
}): Array<Omit<Opportunity, "score">> {
  const min = input.minLandingViews ?? 5;
  const landing = input.observation.funnel.landingViews;
  const checkouts = input.observation.funnel.checkouts;
  const purchases = input.observation.money.purchases;
  const items: Array<Omit<Opportunity, "score">> = [];

  if (landing < min) return items;

  // Traffic exists, no purchases → funnel is leaking.
  const anyCheckoutStarts = checkouts > 0;

  // 1) Direct CTA — remove the "back to home" hop.
  items.push({
    id: "conv-cta-direct",
    title: "Route topic-page CTA straight to checkout (skip home)",
    metric: "checkout_started_rate",
    category: "conversion",
    precursorMetric: "checkout_started",
    expectedImpact: 7,
    confidence: 0.7,
    effort: 1,
    action:
      "Change every topic page CTA from href=/ to a direct checkout POST — remove the re-orient step.",
    safeActionType: "change_default_cta",
    patternKey: "conv:cta_directness:buy_now",
  });

  // 2) Guarantee — reduce risk perception.
  items.push({
    id: "conv-guarantee",
    title: "Surface a 30-day guarantee at the CTA",
    metric: "purchase_rate",
    category: "conversion",
    precursorMetric: "purchases",
    expectedImpact: 6,
    confidence: 0.6,
    effort: 1,
    action:
      "Add explicit 30-day money-back guarantee beside the buy button. Text: 'Full refund within 30 days, no questions asked.'",
    safeActionType: "rewrite_page_copy",
    patternKey: "conv:guarantee:refund_30d",
  });

  // 3) Price test — only when NO buyers convert at current price.
  if (purchases === 0 && landing >= min * 2) {
    items.push({
      id: "conv-price-cut",
      title: "Test a 30% first-week discount",
      metric: "purchase_rate",
      category: "pricing",
      precursorMetric: "purchases",
      expectedImpact: 8,
      confidence: 0.55,
      effort: 1,
      action:
        "Create a Stripe coupon FIRSTCUSTOMER_30 that discounts 30%. Show as promo banner. Kill after first sale.",
      safeActionType: "feature_product",
      patternKey: "conv:price:-30",
    });
  }

  // 4) Urgency — light social proof for first-customer stage.
  items.push({
    id: "conv-urgency",
    title: "Add first-customer urgency banner",
    metric: "checkout_started_rate",
    category: "conversion",
    precursorMetric: "checkout_started",
    expectedImpact: 5,
    confidence: 0.5,
    effort: 1,
    action:
      "Show a subtle banner: 'Founding-customer price locked for the next 24h.' Cycle if no purchase.",
    safeActionType: "rewrite_page_copy",
    patternKey: "conv:urgency:price_up_soon",
  });

  // 5) Offer shape — bundle or starter tier.
  if (purchases === 0) {
    items.push({
      id: "conv-starter-tier",
      title: "Add a cheaper starter tier",
      metric: "purchase_rate",
      category: "pricing",
      precursorMetric: "purchases",
      expectedImpact: 7,
      confidence: 0.5,
      effort: 2,
      action:
        "Introduce a $9 starter tier alongside the main product. Buyers who try it can upgrade credit.",
      safeActionType: "publish_bundle",
      patternKey: "conv:offer_shape:starter_tier",
    });
  }

  // 6) Trust — social proof.
  if (anyCheckoutStarts) {
    items.push({
      id: "conv-trust-logos",
      title: "Add trust signals at checkout",
      metric: "purchase_completion_rate",
      category: "conversion",
      precursorMetric: "purchases",
      expectedImpact: 6,
      confidence: 0.55,
      effort: 1,
      action:
        "Show 'Powered by Stripe' + 'SSL secured' + '14-day refund' badges beside the pay button.",
      safeActionType: "rewrite_page_copy",
      patternKey: "conv:trust:logos",
    });
  }

  return items;
}
