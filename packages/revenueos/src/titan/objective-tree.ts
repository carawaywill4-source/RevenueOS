/**
 * $10K/day ladder + goal tree.
 * Ambition stays; economics confront mathematics. Never fabricate progress.
 */

import { TITAN_NORTH_STAR_DAILY_REVENUE_USD } from "./constitution";
import type {
  LadderRequirement,
  ObjectiveTree,
  RevenueLadderStage,
  BusinessSnapshot,
} from "./types";

const LADDER_THRESHOLDS: Array<{ stage: RevenueLadderStage; minDaily: number }> = [
  { stage: "ZERO", minDaily: 0 },
  { stage: "FIRST_STRANGER_DOLLAR", minDaily: 0.01 },
  { stage: "TEN_PER_DAY", minDaily: 10 },
  { stage: "HUNDRED_PER_DAY", minDaily: 100 },
  { stage: "FIVE_HUNDRED_PER_DAY", minDaily: 500 },
  { stage: "THOUSAND_PER_DAY", minDaily: 1_000 },
  { stage: "TWENTY_FIVE_HUNDRED_PER_DAY", minDaily: 2_500 },
  { stage: "FIVE_THOUSAND_PER_DAY", minDaily: 5_000 },
  { stage: "TEN_THOUSAND_PER_DAY", minDaily: 10_000 },
  { stage: "BEYOND", minDaily: 10_000.01 },
];

export function classifyLadderStage(dailyRevenueUsd: number): RevenueLadderStage {
  if (dailyRevenueUsd <= 0) return "ZERO";
  let stage: RevenueLadderStage = "FIRST_STRANGER_DOLLAR";
  for (const row of LADDER_THRESHOLDS) {
    if (dailyRevenueUsd >= row.minDaily) stage = row.stage;
  }
  if (dailyRevenueUsd > 10_000) return "BEYOND";
  return stage;
}

export function nextLadderStage(current: RevenueLadderStage): RevenueLadderStage | null {
  const order = LADDER_THRESHOLDS.map((r) => r.stage);
  const i = order.indexOf(current);
  if (i < 0 || i >= order.length - 1) return null;
  return order[i + 1] ?? null;
}

export function reverseEngineerTenK(input: {
  priceUsd: number;
  dailyRevenueUsd?: number;
}): LadderRequirement {
  const price = Math.max(input.priceUsd, 0.01);
  const purchasesPerDay = Math.ceil(TITAN_NORTH_STAR_DAILY_REVENUE_USD / price);
  const stage = classifyLadderStage(input.dailyRevenueUsd ?? 0);
  const next = nextLadderStage(stage);
  return {
    stage,
    next_stage: next,
    daily_revenue_usd: input.dailyRevenueUsd ?? 0,
    price_usd: price,
    purchases_per_day_for_10k: purchasesPerDay,
    what_must_become_true: [
      `At $${price}/sale, ~${purchasesPerDay} purchases/day for $10k revenue.`,
      "Sufficient qualified demand exists or model must expand (segment, upsell, recurring, B2B).",
      "Conversion, fulfillment, margin, and infrastructure must support that volume.",
      "Do not lower ambition automatically; confront structural ceilings with model change or honesty.",
    ],
  };
}

export function buildObjectiveTree(snapshot: BusinessSnapshot): ObjectiveTree {
  const ladder = reverseEngineerTenK({
    priceUsd: snapshot.price_usd,
    dailyRevenueUsd: snapshot.revenue_usd,
  });
  const firstStranger = snapshot.purchases > 0 && snapshot.stranger_revenue_usd > 0;
  const hasQualifiedDemand = snapshot.qualified_visits >= 50;
  const hasConversionSignal =
    snapshot.checkouts > 0 || snapshot.purchases > 0;
  const productReady =
    snapshot.product_status === "READY" &&
    snapshot.checkout_status === "VERIFIED" &&
    snapshot.fulfillment_status === "VERIFIED";

  const primary =
    snapshot.primary_objective ||
    (firstStranger
      ? "Advance to next ladder stage with repeatable economics"
      : "FIRST ATTRIBUTED STRANGER PURCHASE");

  return {
    business_id: snapshot.business_id,
    north_star_daily_revenue_usd: TITAN_NORTH_STAR_DAILY_REVENUE_USD,
    current_ladder_stage: ladder.stage,
    primary_objective: primary,
    root: {
      id: "ten_k_day",
      label: "$10K/day (long-term North Star)",
      measurable: `$${TITAN_NORTH_STAR_DAILY_REVENUE_USD}/day revenue with sustainable profit`,
      satisfied: ladder.stage === "TEN_THOUSAND_PER_DAY" || ladder.stage === "BEYOND",
      evidence_note: `ladder=${ladder.stage}; ${ladder.purchases_per_day_for_10k} purchases/day at current price`,
      children: [
        {
          id: "qualified_demand",
          label: "sufficient qualified demand",
          measurable: "qualified exposures at buyer-intent quality",
          satisfied: hasQualifiedDemand,
          evidence_note: `qualified_visits=${snapshot.qualified_visits}`,
        },
        {
          id: "conversion",
          label: "sufficient conversion",
          measurable: "checkout→purchase rate under healthy traffic",
          satisfied: hasConversionSignal && snapshot.purchases > 0,
          evidence_note: `checkouts=${snapshot.checkouts}; purchases=${snapshot.purchases}`,
        },
        {
          id: "value_pricing",
          label: "viable pricing + value",
          measurable: "customers pay willingly; margin positive",
          satisfied: firstStranger,
          evidence_note: firstStranger
            ? "at least one stranger purchase observed"
            : "willingness-to-pay unvalidated",
        },
        {
          id: "fulfillment",
          label: "reliable fulfillment",
          measurable: "instant/delivery VERIFIED + HEALTHY reliability",
          satisfied: productReady,
          evidence_note: `product=${snapshot.product_status}; checkout=${snapshot.checkout_status}; fulfill=${snapshot.fulfillment_status}`,
        },
        {
          id: "first_stranger",
          label: "first attributed stranger purchase",
          measurable: "Stripe-attributed purchase from non-owner traffic",
          satisfied: firstStranger,
            evidence_note: firstStranger
              ? `stranger_revenue=$${snapshot.stranger_revenue_usd}`
              : "$0 stranger revenue — not yet proven",
          children: [
            {
              id: "exposure",
              label: "qualified exposure",
              measurable: "enough high-intent visitors to learn",
              satisfied: snapshot.qualified_visits >= 20,
              evidence_note: `q=${snapshot.qualified_visits}; evidence=${snapshot.evidence_level}`,
            },
          ],
        },
      ],
    },
  };
}
