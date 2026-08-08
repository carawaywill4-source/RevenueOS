import type {
  Curriculum,
  Observation,
  OpportunityCategory,
  RegimeReport,
  ShortfallReport,
  WorldModel,
} from "../types";

/**
 * Active learning curriculum under the organic mastery era.
 * RevenueOS is the sole business manager. Until organic leads→sales is mastered,
 * the curriculum refuses to "wait for ads" and drills organic excellence.
 */

export function buildCurriculum(input: {
  shortfall: ShortfallReport;
  regime: RegimeReport;
  world: WorldModel;
  observation: Observation;
}): Curriculum {
  const { world, observation, shortfall, regime } = input;

  if (!world.business.fulfillmentReliable) {
    return make(
      "operations",
      "Prove fulfillment is reliable on paid orders",
      "Cannot master organic growth on a broken delivery promise.",
      "Fulfillment failure rate and refund precursors",
    );
  }

  if (regime.regime === "decline") {
    return make(
      "conversion",
      "Diagnose what broke in the organic money funnel",
      "Decline — learn the regression before pouring more organic traffic.",
      "Which step's drop-off widened vs. the prior winning window",
    );
  }

  if (observation.bottleneck.level >= 4 || observation.funnel.landingViews < 30) {
    return make(
      "acquisition",
      "Master organic qualified demand (buyable queries → indexed doors)",
      `Organic era: $${shortfall.shortfallUsd.toFixed(0)} shortfall with empty top-of-funnel. Ads locked until organic leads work. Learn which intent clusters arrive and can buy.`,
      "Organic arrival rate + intent quality by query cluster / door",
    );
  }

  if (
    observation.money.purchases === 0 ||
    observation.bottleneck.level === 3 ||
    (world.shopper.primaryFriction !== "discovery" &&
      world.shopper.primaryFriction !== "none")
  ) {
    return make(
      "conversion",
      `Master organic close: remove ${world.shopper.primaryFriction} friction`,
      "Organic leads without sales is not mastery — it is failure. Learn which message/offer/trust fix converts strangers who already arrived.",
      "Organic visitor→purchase lift by messaging angle and friction hypothesis",
    );
  }

  if (observation.bottleneck.level === 2) {
    return make(
      "conversion",
      "Master checkout close on organic demand",
      "Organic demand dies at payment — learn the checkout fix before scaling doors or dreaming of ads.",
      "Checkout start→purchase conversion under alternate checkout copy/price framing",
    );
  }

  if (shortfall.pctOfNorthStar < 0.1) {
    return make(
      "acquisition",
      "Scale winning organic arms to mastery volume",
      "Selling exists but far from $10k. Compound only expand-verdict organic clusters — mastery is volume with close rate intact.",
      "Marginal orders per organic discovery action on the top converting cluster",
    );
  }

  return make(
    "pricing",
    "Raise contribution per organic order without killing conversion",
    "Organic volume meaningful — learn whether margin/packaging expands the day faster than more doors.",
    "Contribution profit per organic visitor under alternate offer structures",
  );
}

function make(
  focusCategory: OpportunityCategory,
  priority: string,
  rationale: string,
  informationGap: string,
): Curriculum {
  return { priority, focusCategory, rationale, informationGap };
}
