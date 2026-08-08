import { channelByKey } from "../knowledge/audiences";
import type { ChannelPlay, Observation, Opportunity, WorldModel } from "../types";
import { isMeaningfulFunnelDrop } from "./conversion";

/**
 * Acquisition engine: get more qualified strangers in front of the offer.
 *
 * Traffic is never the excuse. The audience model always hands us a ranked plan
 * of zero-spend, in-policy persona × channel plays — we turn every one into a
 * measurable opportunity so there is always a way to earn more traffic. When
 * the sale is hard, resolve rises: expected impact is multiplied, not cut.
 *
 * We still avoid pouring traffic into a leaking funnel: pure discovery plays are
 * de-emphasized (not removed) when conversion is the proven bottleneck.
 */
export function proposeAcquisition(input: {
  world: WorldModel;
  observation: Observation;
  siteExtras?: Array<Omit<Opportunity, "score">>;
}): Array<Omit<Opportunity, "score">> {
  const { world, observation } = input;
  const items: Array<Omit<Opportunity, "score">> = [];
  const resolve = world.audience.resolveMultiplier; // 1..2, higher when hard

  for (const extra of input.siteExtras ?? []) {
    items.push({
      category: "acquisition",
      precursorMetric: "landing_views",
      ...extra,
    });
  }

  // Discovery is weak when there is little traffic or thin coverage. In that
  // state, discovery plays are premium; under a lost $10k day they stay hot.
  const discoveryUrgent =
    observation.bottleneck.level === 4 ||
    world.market.discoveryCoverage === "none" ||
    world.market.discoveryCoverage === "thin" ||
    observation.money.estimatedProfitUsd < 10_000;

  // The executable, account-free discovery lever always stays available.
  items.push({
    id: "index-known-urls",
    title: "Get public URLs discovered and indexed",
    metric: "indexed URLs",
    category: "acquisition",
    precursorMetric: "landing_views",
    expectedImpact: Number(((discoveryUrgent ? 8 : 5) * resolve).toFixed(2)),
    confidence: 0.55,
    effort: 1,
    action:
      "Submit known public URLs via IndexNow and pursue account-free directories; do not fabricate links. Never wait on a marketplace.",
    safeActionType: "indexnow_submit",
    patternKey: "indexnow-discovery",
  });

  // Turn every persona × channel play into a concrete acquisition opportunity.
  for (const play of world.audience.channelPlan) {
    items.push(playToOpportunity(play, resolve, discoveryUrgent));
  }

  return items;
}

function playToOpportunity(
  play: ChannelPlay,
  resolve: number,
  discoveryUrgent: boolean,
): Omit<Opportunity, "score"> {
  const channel = channelByKey(play.channel);
  const label = channel?.label ?? play.channel;
  // Base impact by intent; scaled by persona/channel fit and resolve, with a
  // discovery bonus when we genuinely need traffic.
  const baseImpact =
    play.intent === "high" ? 8 : play.intent === "medium" ? 6 : 4;
  const discoveryBonus = discoveryUrgent && play.intent !== "low" ? 1 : 0;
  const expectedImpact = Number(
    ((baseImpact + discoveryBonus) * (0.6 + play.fit * 0.4) * resolve).toFixed(2),
  );
  return {
    id: `acq-${play.channel}-${play.persona}`,
    title: `Win ${play.persona} via ${label}`,
    metric: play.precursor === "purchases" ? "attributed purchases" : "qualified visits",
    category: "acquisition",
    precursorMetric: play.precursor,
    expectedImpact,
    confidence: Number((0.4 + play.fit * 0.3).toFixed(2)),
    effort: play.effort,
    action: `${play.angle}. ${play.rationale}`,
    patternKey: play.patternKey,
  };
}

/**
 * Conversion levers: turn existing qualified traffic into checkouts/purchases.
 * Meaningful only once enough sessions exist to read the funnel.
 */
export function proposeConversionLevers(input: {
  world: WorldModel;
  observation: Observation;
}): Array<Omit<Opportunity, "score">> {
  const { world, observation } = input;
  const items: Array<Omit<Opportunity, "score">> = [];
  const drop = observation.funnel.largestDrop;

  if (!isMeaningfulFunnelDrop(drop, observation.funnel.landingViews) || !drop) {
    return items;
  }

  const step = drop.step.toLowerCase();
  if (step.includes("start") || step.includes("builder") || step.includes("signup")) {
    items.push({
      id: "landing-to-start",
      title: "Improve landing → product start",
      metric: "product_started rate",
      category: "conversion",
      precursorMetric: "product_started",
      expectedImpact: 7,
      confidence: 0.6,
      effort: 2,
      action: world.shopper.frictionHypotheses[0] ??
        "Clarify the offer and place the primary CTA beside a concrete sample.",
      patternKey: "landing-to-start",
    });
  }
  if (step.includes("checkout")) {
    items.push({
      id: "preview-to-checkout",
      title: "Improve preview → checkout",
      metric: "checkout_started rate",
      category: "conversion",
      precursorMetric: "checkout_started",
      expectedImpact: 8,
      confidence: 0.65,
      effort: 2,
      action:
        "Put price, deliverables, and the purchase control beside the finished preview.",
      patternKey: "preview-to-checkout",
    });
  }
  if (step.includes("purchase")) {
    items.push({
      id: "trust-at-purchase",
      title: "Reduce trust friction at purchase",
      metric: "purchase completion rate",
      category: "conversion",
      precursorMetric: "purchases",
      expectedImpact: 7,
      confidence: 0.55,
      effort: 2,
      action:
        "Surface guarantees, secure-checkout signals, and truthful delivery proof at the pay step.",
      patternKey: "trust-at-purchase",
    });
  }

  return items;
}
