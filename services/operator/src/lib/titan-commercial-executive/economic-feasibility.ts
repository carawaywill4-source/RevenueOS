/**
 * ECONOMIC_FEASIBILITY_MODEL — price alone never decides.
 * Low-ticket one-shot remains a strong NEGATIVE PRIOR; evidence can override.
 */

export type FeasibilityClass =
  | "CREDIBLE"
  | "PLAUSIBLE"
  | "PLAUSIBLE_WITH_REMODEL"
  | "HIGH_VOLUME_RISK"
  | "WEAK"
  | "IMPLAUSIBLE";

export type EconomicFeasibility = {
  class: FeasibilityClass;
  priceUsd: number;
  purchasesPerDay: number;
  requiredQualifiedVisitsPerDay: number;
  requiredImpressionsPerDay: number;
  score: number;
  factors: string[];
  penalties: string[];
  positives: string[];
  note: string;
  /** Compatible with legacy tournament/mission "plausible" boolean */
  plausible: boolean;
};

export type FeasibilityInput = {
  priceUsd: number | null;
  revenueModel?: string | null;
  organic?: string | null;
  crowded?: boolean;
  recurringHint?: boolean;
  upsellHint?: boolean;
  productLedDistribution?: boolean;
  largeMarketHint?: boolean;
  buyerBudgetHint?: "low" | "medium" | "high" | null;
  automationFit?: number | null; // 0–1
  fulfillmentCostLow?: boolean;
};

export function evaluateEconomicFeasibility(
  input: FeasibilityInput,
): EconomicFeasibility {
  const price = input.priceUsd && input.priceUsd > 0 ? input.priceUsd : 49;
  const model = String(input.revenueModel ?? "one_shot").toLowerCase();
  const recurring =
    Boolean(input.recurringHint) ||
    /sub|month|recur|saas|retainer|usage|team|b2b|license/i.test(model);
  const purchasesPerDay = Math.ceil(10000 / price);
  // Recurring: treat as ~new customers/day needed for steady-state $10k if LTV ~20× price
  const effectiveDaily =
    recurring ? Math.ceil(purchasesPerDay / 20) : purchasesPerDay;
  const assumedConversion = 0.02;
  const requiredQualifiedVisitsPerDay = Math.ceil(
    effectiveDaily / assumedConversion,
  );
  const requiredImpressionsPerDay = requiredQualifiedVisitsPerDay * 20;

  let score = 55;
  const factors: string[] = [
    `price=$${price}`,
    `model=${model}`,
    `raw_purchases_per_day=${purchasesPerDay}`,
    `effective_daily_acquisitions=${effectiveDaily}`,
  ];
  const penalties: string[] = [];
  const positives: string[] = [];

  // --- NEGATIVE PRIOR: low-ticket one-shot (portfolio lesson) ---
  const lowTicketOneShot = !recurring && price < 79 && purchasesPerDay > 120;
  if (lowTicketOneShot) {
    score -= 22;
    penalties.push(
      "NEG_PRIOR:low_ticket_one_shot_high_volume (portfolio lesson)",
    );
  }
  if (!recurring && purchasesPerDay > 300) {
    score -= 18;
    penalties.push("extreme_one_shot_volume");
  } else if (!recurring && purchasesPerDay > 200) {
    score -= 10;
    penalties.push("high_one_shot_volume");
  }

  if (input.crowded) {
    score -= 8;
    penalties.push("crowded_market");
  }
  if (input.organic === "low") {
    score -= 12;
    penalties.push("weak_organic");
  }

  // --- POSITIVE / OVERRIDE FEATURES ---
  if (recurring) {
    score += 18;
    positives.push("recurring_or_ltv_model");
  }
  if (input.upsellHint) {
    score += 6;
    positives.push("upsell_potential");
  }
  if (input.productLedDistribution) {
    score += 8;
    positives.push("product_led_distribution");
  }
  if (input.largeMarketHint || input.organic === "high") {
    score += 10;
    positives.push("large_or_high_organic_demand");
  }
  if (input.buyerBudgetHint === "high") {
    score += 8;
    positives.push("high_buyer_budget");
  } else if (input.buyerBudgetHint === "medium") {
    score += 3;
  }
  if ((input.automationFit ?? 0.5) >= 0.7) {
    score += 5;
    positives.push("high_automation_fit");
  }
  if (input.fulfillmentCostLow !== false) {
    score += 3;
    positives.push("low_marginal_fulfillment");
  }
  if (price >= 149 && !recurring) {
    score += 8;
    positives.push("higher_ticket_one_shot");
  }
  if (price >= 49 && purchasesPerDay <= 150 && input.organic === "high") {
    score += 6;
    positives.push("moderate_volume_with_strong_organic");
  }

  // Evidence override: strong positives can rescue low-ticket one-shot
  if (lowTicketOneShot && positives.length >= 3 && score >= 50) {
    factors.push("evidence_override_of_low_ticket_prior");
  }

  score = Math.max(0, Math.min(100, score));

  let cls: FeasibilityClass;
  if (score >= 72) cls = "CREDIBLE";
  else if (score >= 58) cls = "PLAUSIBLE";
  else if (score >= 48 && (recurring || price >= 99 || positives.length >= 2))
    cls = "PLAUSIBLE_WITH_REMODEL";
  else if (!recurring && purchasesPerDay > 200 && score >= 40)
    cls = "HIGH_VOLUME_RISK";
  else if (score >= 35) cls = "WEAK";
  else cls = "IMPLAUSIBLE";

  // Price alone never forces IMPLAUSIBLE
  if (cls === "IMPLAUSIBLE" && (recurring || input.organic === "high")) {
    cls = "HIGH_VOLUME_RISK";
    factors.push("price_alone_cannot_force_implausible");
  }

  const plausible =
    cls === "CREDIBLE" ||
    cls === "PLAUSIBLE" ||
    cls === "PLAUSIBLE_WITH_REMODEL";

  return {
    class: cls,
    priceUsd: price,
    purchasesPerDay,
    requiredQualifiedVisitsPerDay,
    requiredImpressionsPerDay,
    score,
    factors,
    penalties,
    positives,
    note: `${cls} score=${score}: $${price} → ${purchasesPerDay}/day raw (${effectiveDaily} effective)${recurring ? " recurring-adjusted" : ""}`,
    plausible,
  };
}
