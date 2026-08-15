import type {
  NorthStarPath,
  Observation,
  UnitEconomics,
  WorldModel,
} from "../types";

/**
 * Absolute money north star. Record-beating stretch is not enough — the machine
 * aims at a $10,000 contribution-profit day. Anything short is a lost day and a
 * learning event. Because that bar is improbable at early stages, the brain
 * never settles into pure exploitation: it always learns and adjusts.
 */
export const NORTH_STAR_DAILY_PROFIT_USD = 10_000;

/** Beyond the north star, keep multiplying the record so the brain never coasts. */
export const POST_NORTH_STAR_STRETCH = 3;

/**
 * Reverse-engineer what must be true to hit a $10k day given current unit
 * economics and funnel health. This is the compound path — not a hope.
 */
export function buildNorthStarPath(input: {
  observation: Observation;
  world: WorldModel;
  unitEconomics?: UnitEconomics;
  northStarUsd?: number;
}): NorthStarPath {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const margin =
    input.unitEconomics?.contributionMarginUsd ??
    input.world.business.contributionMarginUsd;
  const safeMargin = Math.max(margin, 0.01);
  const ordersNeeded = Math.ceil(northStar / safeMargin);

  const landing = input.observation.funnel.landingViews;
  const purchases = input.observation.money.purchases;
  const observedCvr = landing > 0 ? purchases / landing : null;
  const assumedCvr = Math.max(
    observedCvr ?? 0,
    input.unitEconomics?.breakEvenVisitors
      ? 1 / Math.max(input.unitEconomics.breakEvenVisitors, 1)
      : 0.01,
  );

  const visitorsNeeded = Math.ceil(ordersNeeded / Math.max(assumedCvr, 1e-6));
  const requiredConversionRate =
    landing > 0 ? Number((ordersNeeded / Math.max(landing, 1)).toFixed(4)) : null;

  const bottleneck = input.observation.bottleneck;
  let bottleneckToClose: string;
  if (!input.world.business.fulfillmentReliable) {
    bottleneckToClose = "fulfillment reliability (protect revenue already earned)";
  } else if (bottleneck.level >= 4 || landing < 50) {
    bottleneckToClose = `discovery/traffic — need ~${visitorsNeeded} qualified visitors/day at ~${(assumedCvr * 100).toFixed(1)}% CVR`;
  } else if (bottleneck.level === 3 || (landing > 0 && purchases === 0)) {
    bottleneckToClose = `conversion — ${landing} visitors must close at ~${((requiredConversionRate ?? assumedCvr) * 100).toFixed(1)}% to hit the day`;
  } else if (bottleneck.level === 2) {
    bottleneckToClose = "checkout completion / payment friction";
  } else {
    bottleneckToClose = `scale — ${ordersNeeded} orders/day at $${safeMargin.toFixed(2)} margin`;
  }

  const note =
    purchases <= 0
      ? `Pre-revenue on a $${northStar.toLocaleString()} day target. First sale (~$${safeMargin.toFixed(2)} margin) is a milestone, not the finish line — then compound to ${ordersNeeded} orders/day.`
      : `Need ${ordersNeeded} orders/day at $${safeMargin.toFixed(2)} margin (~${visitorsNeeded} visitors at ${(assumedCvr * 100).toFixed(1)}% CVR). Closing: ${bottleneckToClose}.`;

  return {
    northStarDailyProfitUsd: northStar,
    ordersNeeded,
    visitorsNeeded,
    requiredConversionRate,
    contributionMarginUsd: Number(safeMargin.toFixed(2)),
    bottleneckToClose,
    note,
  };
}

/** Daily target: never below the north star; after crushing it, stretch the record. */
export function resolveDayTarget(input: {
  currentProfitUsd: number;
  recordProfitUsd: number;
  northStarUsd?: number;
  stretch?: number;
}): { targetProfitUsd: number; usedNorthStar: boolean } {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const stretch = input.stretch ?? POST_NORTH_STAR_STRETCH;
  if (input.recordProfitUsd >= northStar) {
    const stretched = Number((input.recordProfitUsd * stretch).toFixed(2));
    return {
      targetProfitUsd: Math.max(stretched, northStar),
      usedNorthStar: false,
    };
  }
  return { targetProfitUsd: northStar, usedNorthStar: true };
}
