import { CONVERSION_BASELINES } from "../knowledge/commerce";
import { NORTH_STAR_DAILY_PROFIT_USD } from "../modules/northstar";
import type { Forecast, Scorecard } from "../types";

/** Ordinary least-squares slope of y over evenly spaced cycles (oldest→newest). */
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = values.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Model the business trajectory from scorecard history so the brain reasons
 * about *where it is heading*, not just where it is — including how far the
 * current slope is from a $10k day.
 */
export function buildForecast(
  scorecards: Scorecard[],
  conversionBaseline = CONVERSION_BASELINES.unknown,
  northStarUsd = NORTH_STAR_DAILY_PROFIT_USD,
): Forecast {
  const chrono = [...scorecards].reverse();
  const revenue = chrono.map((s) => s.revenueUsd);
  const traffic = chrono.map((s) => s.landingViews ?? 0);
  const profits = chrono.map((s) => s.contributionProfitUsd ?? 0);
  const revenueSlope = Number(slope(revenue).toFixed(3));
  const trafficSlope = Number(slope(traffic).toFixed(3));
  const profitSlope = slope(profits);

  const latest = chrono[chrono.length - 1];
  const purchases = latest?.purchases ?? 0;
  const currentTraffic = latest?.landingViews ?? 0;
  const currentProfit = latest?.contributionProfitUsd ?? 0;

  let cyclesToFirstSale: number | null = null;
  if (purchases <= 0) {
    const neededVisitors = 1 / Math.max(conversionBaseline, 1e-6);
    if (currentTraffic >= neededVisitors) {
      cyclesToFirstSale = 0;
    } else if (trafficSlope > 0) {
      cyclesToFirstSale = Math.ceil(
        (neededVisitors - currentTraffic) / trafficSlope,
      );
    }
  } else {
    cyclesToFirstSale = 0;
  }

  let cyclesToNorthStar: number | null = null;
  if (currentProfit >= northStarUsd) {
    cyclesToNorthStar = 0;
  } else if (profitSlope > 0) {
    cyclesToNorthStar = Math.ceil((northStarUsd - currentProfit) / profitSlope);
    if (cyclesToNorthStar > 10_000) cyclesToNorthStar = null;
  }

  let decelerating = false;
  if (traffic.length >= 4) {
    const mid = Math.floor(traffic.length / 2);
    const early = slope(traffic.slice(0, mid));
    const late = slope(traffic.slice(mid));
    decelerating = late < early && late <= 0;
  }

  const note =
    currentProfit >= northStarUsd
      ? `At/above $${northStarUsd.toLocaleString()} day — raise the stretch bar.`
      : purchases > 0
        ? profitSlope > 0 && cyclesToNorthStar != null
          ? `Profit trending up; naive slope says ~${cyclesToNorthStar} cycle(s) to a $${northStarUsd.toLocaleString()} day (treat as upper bound — keep learning).`
          : `Profit flat/slow vs $${northStarUsd.toLocaleString()} day — lost-day learning must change the slope.`
        : trafficSlope > 0
          ? cyclesToFirstSale === null
            ? "Traffic growing but too slowly to project a first sale."
            : `At the current traffic slope, first sale is ~${cyclesToFirstSale} cycle(s) away — then compound toward $${northStarUsd.toLocaleString()}/day.`
          : "No traffic growth; discovery must accelerate or the first sale never arrives.";

  return {
    revenueSlopePerCycle: revenueSlope,
    trafficSlopePerCycle: trafficSlope,
    cyclesToFirstSale,
    cyclesToNorthStar,
    decelerating,
    note,
  };
}
