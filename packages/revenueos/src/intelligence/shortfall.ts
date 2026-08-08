import { newId } from "../ledger/store";
import type {
  DayVerdict,
  Lesson,
  Observation,
  ShortfallReport,
  WorldModel,
} from "../types";
import { NORTH_STAR_DAILY_PROFIT_USD } from "../modules/northstar";

/**
 * Every day under the north star is a lost day. That is not drama — it is the
 * training signal. The shortfall becomes a durable lesson that reweights the
 * next cycle toward whatever bottleneck kept the day under $10k.
 */

export function dayVerdict(
  currentProfitUsd: number,
  northStarUsd = NORTH_STAR_DAILY_PROFIT_USD,
): DayVerdict {
  return currentProfitUsd >= northStarUsd ? "won_day" : "lost_day";
}

export function buildShortfallReport(input: {
  observation: Observation;
  world: WorldModel;
  northStarUsd?: number;
}): ShortfallReport {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const current = Number(input.observation.money.estimatedProfitUsd.toFixed(2));
  const shortfallUsd = Number(Math.max(0, northStar - current).toFixed(2));
  const verdict = dayVerdict(current, northStar);
  const pctOfNorthStar = Number(
    Math.min(1, current / Math.max(northStar, 1)).toFixed(4),
  );

  const rootCause = rootCauseFromWorld(input.observation, input.world);
  const lessonPatternKey = `shortfall:l${input.observation.bottleneck.level}:${rootCause.key}`;

  return {
    northStarDailyProfitUsd: northStar,
    currentProfitUsd: current,
    shortfallUsd,
    pctOfNorthStar,
    dayVerdict: verdict,
    rootCause: rootCause.label,
    lessonPatternKey,
    learningImperative:
      verdict === "won_day"
        ? "Day won against the north star — raise the bar and keep learning what scaled."
        : `Lost day: $${shortfallUsd.toFixed(0)} short of $${northStar.toLocaleString()}. Treat as a failure signal and adjust — ${rootCause.label}.`,
  };
}

/**
 * Persist a site lesson from a lost day so ranking and channel selection bend
 * toward closing the shortfall cause. Won days still record a positive lesson
 * so the brain remembers what scaled.
 */
export function lessonFromShortfall(input: {
  siteId: string;
  industry: string;
  shortfall: ShortfallReport;
  now?: Date;
}): Lesson {
  const now = input.now ?? new Date();
  const lost = input.shortfall.dayVerdict === "lost_day";
  return {
    id: newId("lesson"),
    scope: "site",
    siteId: input.siteId,
    industry: input.industry,
    patternKey: input.shortfall.lessonPatternKey,
    summary: lost
      ? `Lost day vs $${input.shortfall.northStarDailyProfitUsd.toLocaleString()} north star: $${input.shortfall.shortfallUsd.toFixed(0)} short (${(input.shortfall.pctOfNorthStar * 100).toFixed(2)}% of target). Root cause: ${input.shortfall.rootCause}. Prefer levers that attack this bottleneck; do not celebrate activity.`
      : `Won day: hit/exceeded $${input.shortfall.northStarDailyProfitUsd.toLocaleString()} north star at $${input.shortfall.currentProfitUsd.toFixed(0)}. Prefer patterns that produced this scale; immediately raise the stretch bar.`,
    evidenceCount: 1,
    transferable: true,
    sentiment: lost ? "negative" : "positive",
    // Lost days boost bottleneck-resolving categories via pattern key match;
    // mild downrank on complacent "ops-only" patterns when still far from target.
    rankingWeight: lost ? 1.25 : 1.5,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function rootCauseFromWorld(
  observation: Observation,
  world: WorldModel,
): { key: string; label: string } {
  if (!world.business.fulfillmentReliable) {
    return { key: "fulfillment", label: "fulfillment failures burning paid orders" };
  }
  const level = observation.bottleneck.level;
  if (level >= 4) {
    return {
      key: "discovery",
      label: "almost no qualified traffic (L4 discovery)",
    };
  }
  if (level === 3) {
    return {
      key: "conversion",
      label: `visitors stall on ${world.shopper.primaryFriction} friction`,
    };
  }
  if (level === 2) {
    return { key: "checkout", label: "checkout / payment drop-off" };
  }
  if (observation.money.purchases > 0 && observation.money.estimatedProfitUsd < 500) {
    return {
      key: "scale",
      label: "selling, but volume/margin far below a $10k day",
    };
  }
  return {
    key: `l${level}`,
    label: observation.bottleneck.detail || observation.bottleneck.label,
  };
}
