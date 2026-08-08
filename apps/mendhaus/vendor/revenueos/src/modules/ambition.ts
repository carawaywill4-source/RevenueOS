import type {
  Ambition,
  Observation,
  Scorecard,
  UnitEconomics,
  WorldModel,
} from "../types";
import {
  NORTH_STAR_DAILY_PROFIT_USD,
  buildNorthStarPath,
  resolveDayTarget,
} from "./northstar";
import { dayVerdict } from "../intelligence/shortfall";
import { hourVerdictOf, isZeroHour } from "../intelligence/hour";

/**
 * Competitive drive aimed at a $10,000 contribution-profit day. Matching or
 * slightly beating the prior record is failure while under the north star.
 * Every lost day raises aggression and learning pressure. After crushing
 * $10k/day, the bar stretches again so the brain never coasts.
 */

export function buildAmbition(input: {
  observation: Observation;
  history: Scorecard[]; // newest-first
  unitEconomics?: UnitEconomics;
  world?: WorldModel;
  /** 0..1 from the audience model. A hard sell RAISES drive, never lowers it. */
  salesDifficulty?: number;
  northStarUsd?: number;
}): Ambition {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const current = Number(input.observation.money.estimatedProfitUsd.toFixed(2));
  const profits = input.history.map((s) => s.contributionProfitUsd ?? 0);
  const revenues = input.history.map((s) => s.revenueUsd ?? 0);
  const recordProfit = Number(Math.max(0, current, ...profits).toFixed(2));
  const recordRevenue = Number(
    Math.max(0, input.observation.money.revenueUsd, ...revenues).toFixed(2),
  );

  const { targetProfitUsd, usedNorthStar } = resolveDayTarget({
    currentProfitUsd: current,
    recordProfitUsd: recordProfit,
    northStarUsd: northStar,
  });

  const gapToTargetUsd = Number((targetProfitUsd - current).toFixed(2));
  const shortfallUsd = Number(Math.max(0, northStar - current).toFixed(2));
  const verdictDay = dayVerdict(current, northStar);
  const onPace = current >= targetProfitUsd;

  // Streak: consecutive cycles that did not lose ground on profit.
  let streak = 0;
  let prev = current;
  for (const s of input.history) {
    const p = s.contributionProfitUsd ?? 0;
    if (prev >= p) {
      streak += 1;
      prev = p;
    } else break;
  }

  // Aggression: under the north star, distance to $10k dominates. A lost day
  // never gets aggression 0.
  const behindRatio =
    targetProfitUsd > 0 ? Math.max(0, gapToTargetUsd) / targetProfitUsd : 0;
  let aggression: Ambition["aggression"] = 0;
  if (verdictDay === "lost_day") {
    if (behindRatio >= 0.95 || current <= 0) aggression = 3;
    else if (behindRatio >= 0.7) aggression = 3;
    else if (behindRatio >= 0.4) aggression = 2;
    else aggression = 1;
  } else if (!onPace) {
    if (behindRatio < 0.34) aggression = 1;
    else if (behindRatio < 0.67) aggression = 2;
    else aggression = 3;
  }

  const difficulty = input.salesDifficulty ?? 0;
  const hardSell = difficulty >= 0.5;
  if (!onPace && hardSell && aggression < 3) {
    aggression = (aggression + 1) as Ambition["aggression"];
  }

  const hourVerdict = hourVerdictOf(input.observation.hourPulse);
  const overdrive = isZeroHour(input.observation.hourPulse);
  if (overdrive) {
    aggression = 3;
  }

  // Parallel bets: more when losing the day / far from north star.
  // A $0 hour fires the maximum salvo — empty hours must not repeat.
  const concurrentBets = overdrive
    ? 6
    : verdictDay === "won_day" && onPace
      ? 1
      : 1 + aggression;

  const path =
    input.world != null
      ? buildNorthStarPath({
          observation: input.observation,
          world: input.world,
          unitEconomics: input.unitEconomics,
          northStarUsd: northStar,
        })
      : undefined;

  const hardSellClause = hardSell
    ? " This is a hard sell — good. That is exactly why we want it more."
    : "";

  const zeroHourClause = overdrive
    ? " ZERO HOUR: last 60 minutes printed $0. That is failure. Overdrive until the next hour is not empty."
    : "";

  let verdict: string;
  if (verdictDay === "won_day" && onPace) {
    verdict = `NORTH STAR DAY: $${current.toFixed(0)} ≥ $${northStar.toLocaleString()}. Bar resets — next target $${targetProfitUsd.toFixed(0)}. Keep pressing.${hardSellClause}${zeroHourClause}`;
  } else if (usedNorthStar) {
    const milestone =
      current <= 0
        ? `First sale (~$${(input.unitEconomics?.contributionMarginUsd ?? 1).toFixed(2)} margin) is only the first milestone on the path to $${northStar.toLocaleString()}/day.`
        : path
          ? path.note
          : `Need the machine that produces $${northStar.toLocaleString()} contribution profit in a day.`;
    verdict = `LOST DAY vs $${northStar.toLocaleString()} north star. Current $${current.toFixed(2)} — shortfall $${shortfallUsd.toFixed(0)}. Matching the old record ($${recordProfit.toFixed(2)}) is still failure. ${milestone} Firing ${concurrentBets} bet(s). Giving up is not an option — learn from the last hour and want better.${hardSellClause}${zeroHourClause}`;
  } else {
    verdict = `Under stretch target $${targetProfitUsd.toFixed(0)} (north star already cleared once). Currently $${current.toFixed(2)}, gap $${gapToTargetUsd.toFixed(2)}. Firing ${concurrentBets} bet(s).${hardSellClause}${zeroHourClause} Not satisfied.`;
  }

  return {
    currentProfitUsd: current,
    recordProfitUsd: recordProfit,
    recordRevenueUsd: recordRevenue,
    targetProfitUsd,
    gapToTargetUsd,
    onPace,
    aggression,
    streak,
    concurrentBets,
    verdict,
    northStarDailyProfitUsd: northStar,
    shortfallUsd,
    dayVerdict: verdictDay,
    alwaysLearning: true,
    neverGiveUp: true,
    overdrive,
    hourVerdict,
    path,
  };
}
