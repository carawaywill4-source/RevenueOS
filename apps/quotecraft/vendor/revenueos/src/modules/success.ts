import type { Observation, PrecursorMetric } from "../types";
import { NORTH_STAR_DAILY_PROFIT_USD } from "./northstar";

/**
 * The only success criterion for RevenueOS.
 *
 * Money made for the customer = success.
 * Everything else (traffic, topics, research, IndexNow, merch, lessons) is a
 * tool. Zero money is a failing product — not a soft landing, not "brand
 * building," not an acceptable steady state. Learning and competition exist
 * to destroy that failure, never to make peace with it.
 */

export const SUCCESS_DEFINITION =
  "SUCCESS = money made for the customer (contribution profit from real sales). " +
  "FAILURE = no money / short of a $10,000 contribution-profit day. " +
  "Traffic, pages, research, and experiments are tools only. " +
  "Failure is not an option — learn harder and hunt until money prints.";

/** Precursors that count as true money outcomes (not vanity). */
export const MONEY_SUCCESS_METRICS = new Set<PrecursorMetric>([
  "revenue",
  "contribution_profit",
  "purchases",
  "average_order_value",
  "margin",
]);

export function isMoneySuccessMetric(metric: string | undefined): boolean {
  if (!metric) return false;
  return MONEY_SUCCESS_METRICS.has(metric as PrecursorMetric);
}

/** True only when the business has printed contribution profit. */
export function hasPrintedMoney(observation: Observation): boolean {
  return (
    observation.money.estimatedProfitUsd > 0 ||
    observation.money.purchases > 0 ||
    observation.money.revenueUsd > 0
  );
}

export type SuccessVerdict = {
  status: "success" | "failing" | "north_star_cleared";
  moneyMadeUsd: number;
  purchases: number;
  /** Human-readable. Never softens $0 into "progress." */
  declaration: string;
  /** Ranking pressure: how hard to punish inactivity / vanity. */
  failurePressure: number;
};

export function evaluateSuccess(input: {
  observation: Observation;
  northStarUsd?: number;
}): SuccessVerdict {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const money = input.observation.money.estimatedProfitUsd;
  const purchases = input.observation.money.purchases;
  const revenue = input.observation.money.revenueUsd;

  if (money >= northStar) {
    return {
      status: "north_star_cleared",
      moneyMadeUsd: money,
      purchases,
      declaration: `SUCCESS: $${money.toFixed(2)} contribution profit ≥ $${northStar.toLocaleString()} north star. Money made for the customer is the only win. Raise the bar — do not coast.`,
      failurePressure: 0.5,
    };
  }

  if (money <= 0 && purchases <= 0 && revenue <= 0) {
    return {
      status: "failing",
      moneyMadeUsd: 0,
      purchases: 0,
      declaration: `FAILING SOFTWARE: $0 made for the customer. This is not a test, not a lull, not acceptable. Sales are the only success. Every tool (AI, web, merch, topics) exists to end this failure — failure is not an option.`,
      failurePressure: 3,
    };
  }

  const shortfall = Math.max(0, northStar - money);
  return {
    status: "failing",
    moneyMadeUsd: money,
    purchases,
    declaration: `FAILING vs north star: only $${money.toFixed(2)} contribution profit / ${purchases} sale(s) — $${shortfall.toFixed(0)} short of $${northStar.toLocaleString()}/day. Activity without closing that gap is still failure. Money made = success.`,
    failurePressure: money < 100 ? 2.5 : money < 1000 ? 2 : 1.5,
  };
}
