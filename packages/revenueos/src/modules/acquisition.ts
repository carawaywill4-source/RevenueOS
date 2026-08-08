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

  // Discovery is urgent only when strangers are the binding constraint.
  // Being under $10k/day alone must NOT force topic spam if conversion is broken.
  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  const cvr = landing > 0 ? purchases / landing : 0;
  const discoveryUrgent =
    observation.bottleneck.level === 4 ||
    world.market.discoveryCoverage === "none" ||
    world.market.discoveryCoverage === "thin" ||
    (landing < 40 && purchases === 0) ||
    (world.shopper.primaryFriction === "discovery" && cvr >= 0.02);

  // Executable, account-free discovery levers — always available, hotter when empty.
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
  items.push({
    id: "internet-market-research",
    title: "Learn from the live internet who is buying now",
    metric: "qualified visits",
    category: "acquisition",
    precursorMetric: "landing_views",
    expectedImpact: Number(((discoveryUrgent ? 9.5 : 6) * resolve).toFixed(2)),
    confidence: 0.6,
    effort: 1,
    action:
      "Search the public web for people ready to buy what we sell at contribution profit. Persist only sellable attacks — never vanity queries.",
    safeActionType: "market_research",
    patternKey: "internet-market-research",
  });
  // Full discovery attack / publish only when traffic is the bottleneck.
  if (discoveryUrgent) {
    items.push({
      id: "discovery-attack-compound",
      title: "Compound discovery attack for sales: research → publish → index",
      metric: "purchases via new demand",
      category: "acquisition",
      precursorMetric: "landing_views",
      expectedImpact: Number((9.5 * resolve).toFixed(2)),
      confidence: 0.62,
      effort: 2,
      action:
        "Open one buyable door. Success = purchases, not page count. Kill clusters that do not convert.",
      safeActionType: "discovery_attack",
      patternKey: "discovery-attack",
    });
    items.push({
      id: "publish-intent-from-research",
      title: "Publish a buyable intent door from research",
      metric: "organic purchases",
      category: "acquisition",
      precursorMetric: "landing_views",
      expectedImpact: Number((8.5 * resolve).toFixed(2)),
      confidence: 0.55,
      effort: 2,
      action:
        "Publish only if the query maps to catalog products someone can buy today, then index it.",
      safeActionType: "publish_intent_page",
      patternKey: "publish-intent-page",
    });
  }

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
  // Map open organic channels to executable discovery actions so the brain
  // does not mint blocked "advice-only" bets while strangers never arrive.
  const safeActionType =
    play.channel === "organic_search" || play.channel === "content_seo"
      ? "publish_intent_page"
      : play.channel === "directories"
        ? "sitemap_ping"
        : play.channel === "referral"
          ? "discovery_attack"
          : undefined;

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
    safeActionType,
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
