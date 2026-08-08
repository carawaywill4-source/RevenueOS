import type {
  Curriculum,
  Observation,
  OpportunityCategory,
  RegimeReport,
  ShortfallReport,
  WorldModel,
} from "../types";

/**
 * Active learning curriculum: given how far we are from a $10k day, decide what
 * information would most reduce the shortfall if learned next. This keeps the
 * brain adjusting instead of randomly thrashing or obsessing one lever.
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
      "Cannot scale to a $10k day on a broken delivery promise.",
      "Fulfillment failure rate and refund precursors",
    );
  }

  if (regime.regime === "decline") {
    return make(
      "conversion",
      "Diagnose what broke in the money funnel",
      "Decline regime — learn the regression cause before pouring more traffic.",
      "Which step's drop-off widened vs. the prior winning window",
    );
  }

  if (observation.bottleneck.level >= 4 || observation.funnel.landingViews < 30) {
    return make(
      "acquisition",
      "Find the first repeatable qualified-traffic channel",
      `$${shortfall.shortfallUsd.toFixed(0)} shortfall is mostly empty top-of-funnel. Learn which persona×channel actually arrives.`,
      "Arrival rate and intent quality by channel/persona arm",
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
      `Remove ${world.shopper.primaryFriction} friction on existing traffic`,
      "Traffic without closes cannot compound to a $10k day. Learn which message/offer/trust fix converts.",
      "Visitor→purchase lift by messaging angle and friction hypothesis",
    );
  }

  if (observation.bottleneck.level === 2) {
    return make(
      "conversion",
      "Close checkout drop-off",
      "Demand is arriving but dying at payment — learn the checkout fix.",
      "Checkout start→purchase conversion under alternate checkout copy/price framing",
    );
  }

  if (shortfall.pctOfNorthStar < 0.1) {
    return make(
      "acquisition",
      "Scale the winning acquisition arm aggressively",
      "Selling exists but volume is tiny vs. $10k. Learn how far the best channel can scale before diminishing returns.",
      "Marginal orders per incremental discovery action on the top arm",
    );
  }

  return make(
    "pricing",
    "Raise contribution per order without killing conversion",
    "Approaching meaningful volume — learn whether margin/packaging expands the day faster than more traffic.",
    "Contribution profit per visitor under alternate offer structures",
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
