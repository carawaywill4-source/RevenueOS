import type {
  DayVerdict,
  Lesson,
  Observation,
  ShortfallReport,
  WorldModel,
} from "../types";
import { NORTH_STAR_DAILY_PROFIT_USD } from "../modules/northstar";
import { SUCCESS_DEFINITION } from "../modules/success";
import { toPortableLesson } from "../memory/portable";

/**
 * Every day under the north star is a lost day = failing software.
 * Money made for the customer is the only success. Learning exists to destroy
 * that failure, never to accept it. The shortfall reweights the next cycle
 * toward whatever bottleneck kept money from printing.
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
        ? `SUCCESS: money made hit/exceeded $${northStar.toLocaleString()}. Raise the bar. Keep what printed cash.`
        : current <= 0
          ? `FAILING SOFTWARE: $0 for the customer. ${SUCCESS_DEFINITION} Root cause: ${rootCause.label}. Hate this outcome — learn and attack until money prints. Failure is not an option.`
          : `FAILING vs north star: $${shortfallUsd.toFixed(0)} short of $${northStar.toLocaleString()} (only $${current.toFixed(2)} made). Money made = success; this is still failure. Attack: ${rootCause.label}.`,
  };
}

/**
 * Persist a portable lesson from a lost/won day. Transferable → industry/global
 * so the next attached business inherits the failure/success signal.
 */
export function lessonFromShortfall(input: {
  siteId: string;
  industry: string;
  shortfall: ShortfallReport;
  now?: Date;
}): Lesson {
  const now = input.now ?? new Date();
  const lost = input.shortfall.dayVerdict === "lost_day";
  return toPortableLesson({
    siteId: input.siteId,
    industry: input.industry,
    now,
    lesson: {
      patternKey: input.shortfall.lessonPatternKey,
      summary: lost
        ? input.shortfall.currentProfitUsd <= 0
          ? `FAILING: $0 made for the customer vs $${input.shortfall.northStarDailyProfitUsd.toLocaleString()}/day. ${SUCCESS_DEFINITION} Root: ${input.shortfall.rootCause}. Do not celebrate traffic, topics, or research — only sales end this failure.`
          : `FAILING: $${input.shortfall.shortfallUsd.toFixed(0)} short of $${input.shortfall.northStarDailyProfitUsd.toLocaleString()} (only $${input.shortfall.currentProfitUsd.toFixed(0)} made). Money made = success. Root: ${input.shortfall.rootCause}. Attack the bottleneck; activity without dollars is still failure.`
        : `SUCCESS: $${input.shortfall.currentProfitUsd.toFixed(0)} contribution profit ≥ $${input.shortfall.northStarDailyProfitUsd.toLocaleString()} north star. Prefer patterns that printed this money; raise the stretch bar immediately.`,
      evidenceCount: 1,
      transferable: true,
      sentiment: lost ? "negative" : "positive",
      rankingWeight: lost
        ? input.shortfall.currentProfitUsd <= 0
          ? 1.55
          : 1.35
        : 1.5,
    },
  });
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
