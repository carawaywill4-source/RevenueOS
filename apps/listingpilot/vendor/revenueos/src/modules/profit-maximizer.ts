import { NORTH_STAR_DAILY_PROFIT_USD } from "./northstar";
import { evaluateSuccess, SUCCESS_DEFINITION } from "./success";
import type {
  Hypothesis,
  MoneyPlan,
  Observation,
  Opportunity,
  OpportunityCategory,
  ShortfallReport,
  WorldModel,
} from "../types";

/**
 * Profit maximizer — money made for the customer is the only success.
 * Traffic, topics, and research are tools. $0 is failing software.
 * Vanity execution without a dollar path is refused.
 */

export type ProfitPathFocus =
  | "fulfillment"
  | "acquisition"
  | "conversion"
  | "margin"
  | "compound";

export type ProfitMandate = {
  northStarDailyProfitUsd: number;
  currentProfitUsd: number;
  shortfallUsd: number;
  pctOfNorthStar: number;
  focus: ProfitPathFocus;
  ordersNeeded: number;
  visitorsNeeded: number;
  contributionMarginUsd: number;
  /** One-line order to the executive and AI planner. */
  order: string;
  /** Why this focus wins more dollars than alternatives right now. */
  why: string;
  /** Dollar falsifier for this cycle's chosen focus. */
  falsifier: string;
  /** Action types allowed as heartbeats this cycle (beyond bet selection). */
  heartbeatActionTypes: string[];
  /** SUCCESS = money made. FAILURE = no money / under north star. */
  successDeclaration: string;
  failurePressure: number;
};

export function resolveProfitPathFocus(input: {
  observation: Observation;
  world: WorldModel;
}): ProfitPathFocus {
  const { observation, world } = input;
  if (!world.business.fulfillmentReliable) return "fulfillment";
  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  const checkouts = observation.funnel.checkouts;
  const cvr = landing > 0 ? purchases / landing : 0;
  const hourViews = observation.hourPulse?.landingViews ?? 0;

  // No strangers → nothing to close. Acquisition is the only print path.
  if (landing < 25 && purchases === 0) return "acquisition";
  if (hourViews < 5 && purchases === 0 && landing < 80) return "acquisition";

  // Traffic without closes → conversion prints faster than more pages.
  if (landing >= 25 && (purchases === 0 || cvr < 0.02)) return "conversion";
  if (checkouts >= 3 && purchases === 0) return "conversion";

  // Sales exist but margin is thin → earn more per close.
  if (
    purchases > 0 &&
    world.business.contributionMarginRatio > 0 &&
    world.business.contributionMarginRatio < 0.35
  ) {
    return "margin";
  }

  // Healthy enough to push all three compounds.
  if (purchases > 0 && cvr >= 0.02 && landing >= 40) return "compound";

  return world.shopper.primaryFriction === "discovery"
    ? "acquisition"
    : world.shopper.primaryFriction === "price" ||
        world.shopper.primaryFriction === "trust"
      ? "conversion"
      : "acquisition";
}

export function buildProfitMandate(input: {
  observation: Observation;
  world: WorldModel;
  shortfall: ShortfallReport;
  northStarUsd?: number;
}): ProfitMandate {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const margin = Math.max(input.world.business.contributionMarginUsd, 0.01);
  const ordersNeeded = Math.ceil(northStar / margin);
  const landing = input.observation.funnel.landingViews;
  const purchases = input.observation.money.purchases;
  const cvr = landing > 0 ? purchases / landing : 0.01;
  const visitorsNeeded = Math.ceil(ordersNeeded / Math.max(cvr, 0.005));
  const focus = resolveProfitPathFocus(input);
  const current = input.shortfall.currentProfitUsd;
  const shortfallUsd = input.shortfall.shortfallUsd;

  const heartbeats = heartbeatTypesForFocus(focus, input.observation);

  const whyByFocus: Record<ProfitPathFocus, string> = {
    fulfillment:
      "Paid orders are failing delivery. Every acquisition dollar is wasted until fulfillment is green.",
    acquisition: `At $${margin.toFixed(2)}/order you need ~${ordersNeeded} sales/day. With ${landing} views and ${purchases} purchases, strangers are the binding constraint — research and doors only if they can buy.`,
    conversion: `You already have ${landing} views at ${(cvr * 100).toFixed(2)}% CVR. Closing existing demand prints faster than minting more pages.`,
    margin: `Sales exist but contribution is thin. Raising $ per order cuts orders-needed for $${northStar.toLocaleString()}/day.`,
    compound: `Machine is alive (${purchases} purchases, ${(cvr * 100).toFixed(2)}% CVR). Compound acquisition + conversion + margin toward $${northStar.toLocaleString()}/day.`,
  };

  const orderByFocus: Record<ProfitPathFocus, string> = {
    fulfillment:
      "FAILING until fulfillment is fixed — no growth action while paid orders burn.",
    acquisition:
      "FAILING without buyers: hunt buyable demand only. Research → sellable doors → index. Traffic without sales is still failure.",
    conversion:
      "FAILING with traffic and no sales: close visitors now. Merch/clarity/kits — topic spam is sabotage.",
    margin:
      "FAILING vs $10k/day on thin margin: raise $ per order. Tools that do not lift contribution profit are waste.",
    compound:
      "Still under north star until money compounds. Fund highest $/effort only. Refuse vanity.",
  };

  const success = evaluateSuccess({
    observation: input.observation,
    northStarUsd: northStar,
  });

  return {
    northStarDailyProfitUsd: northStar,
    currentProfitUsd: current,
    shortfallUsd,
    pctOfNorthStar: input.shortfall.pctOfNorthStar,
    focus,
    ordersNeeded,
    visitorsNeeded,
    contributionMarginUsd: margin,
    order: `${orderByFocus[focus]} ${SUCCESS_DEFINITION}`,
    why: whyByFocus[focus],
    falsifier: `No additional money made for the customer toward $${northStar.toLocaleString()}/day — that bet failed. Failure is not an option; change the play.`,
    heartbeatActionTypes: heartbeats,
    successDeclaration: success.declaration,
    failurePressure: success.failurePressure,
  };
}

function heartbeatTypesForFocus(
  focus: ProfitPathFocus,
  observation: Observation,
): string[] {
  const always = ["scorecard_snapshot", "journal_decision"];
  if (focus === "fulfillment") return always;

  if (focus === "conversion") {
    return [
      ...always,
      "merch_optimize",
      "activate_kit_deal",
      "set_homepage_focus",
      "set_free_shipping_threshold",
      // Keep IndexNow warm for pages already live — cheap, not a publish spam.
      "indexnow_submit",
      "sitemap_ping",
    ];
  }

  if (focus === "margin") {
    return [...always, "merch_optimize", "activate_kit_deal", "indexnow_submit"];
  }

  if (focus === "compound") {
    return [
      ...always,
      "merch_optimize",
      "indexnow_submit",
      "sitemap_ping",
      "market_research",
      "activate_kit_deal",
    ];
  }

  // acquisition focus — discovery heartbeats only when the funnel is empty/thin
  const discovery =
    observation.funnel.landingViews < 80 && observation.money.purchases === 0
      ? ["market_research", "discovery_attack", "indexnow_submit", "sitemap_ping"]
      : ["indexnow_submit", "sitemap_ping", "market_research"];
  return [...always, ...discovery];
}

/** Should this action run as a cycle heartbeat (not merely because it is listed)? */
export function shouldHeartbeatAction(
  actionType: string,
  mandate: ProfitMandate,
  opts?: { moneyPlanFunds?: boolean; betSelected?: boolean },
): boolean {
  if (opts?.betSelected) return true;
  if (opts?.moneyPlanFunds) return true;
  return mandate.heartbeatActionTypes.includes(actionType);
}

/** Re-score opportunities by how fast they close the $10k shortfall. */
export function applyProfitPressure(input: {
  opportunities: Opportunity[];
  mandate: ProfitMandate;
  observation: Observation;
}): Opportunity[] {
  const { mandate, observation } = input;
  return input.opportunities
    .map((opp) => {
      const ev = opp.predicted?.expectedProfitUsd ?? 0;
      const days = Math.max(opp.predicted?.timeToSignalDays ?? 14, 1);
      const dollarsPerDay = ev / days;
      const focusBoost = focusCategoryBoost(opp.category, mandate.focus);
      const metricBoost = moneyMetricBoost(
        opp.precursorMetric,
        mandate.focus,
        observation,
      );
      // Soft-kill landing_views vanity when conversion is the binding constraint.
      const vanityPenalty =
        mandate.focus === "conversion" &&
        opp.precursorMetric === "landing_views" &&
        (opp.safeActionType === "publish_intent_page" ||
          opp.safeActionType === "discovery_attack")
          ? 0.35
          : 1;
      const pressure =
        1 +
        Math.min(2.5, mandate.shortfallUsd / NORTH_STAR_DAILY_PROFIT_USD) *
          Math.max(1, mandate.failurePressure / 2);
      const score = Number(
        (
          opp.score *
          focusBoost *
          metricBoost *
          vanityPenalty *
          (1 + Math.min(1.5, dollarsPerDay / 50)) *
          Math.sqrt(pressure)
        ).toFixed(2),
      );
      return { ...opp, score };
    })
    .sort((a, b) => b.score - a.score);
}

function focusCategoryBoost(
  category: OpportunityCategory | undefined,
  focus: ProfitPathFocus,
): number {
  if (!category) return 1;
  if (focus === "fulfillment") {
    return category === "operations" ? 2.2 : 0.4;
  }
  if (focus === "acquisition") {
    return category === "acquisition" ? 1.45 : category === "conversion" ? 1.05 : 0.9;
  }
  if (focus === "conversion") {
    return category === "conversion" ? 1.55 : category === "acquisition" ? 0.7 : 1.05;
  }
  if (focus === "margin") {
    return category === "pricing" ? 1.5 : category === "conversion" ? 1.2 : 0.85;
  }
  return 1.1;
}

function moneyMetricBoost(
  metric: Opportunity["precursorMetric"],
  focus: ProfitPathFocus,
  observation: Observation,
): number {
  if (!metric) return 1;
  const moneyMetrics = new Set([
    "purchases",
    "contribution_profit",
    "revenue",
    "checkout_started",
    "average_order_value",
    "margin",
  ]);
  if (focus === "conversion" && moneyMetrics.has(metric)) return 1.35;
  if (focus === "acquisition" && metric === "landing_views") {
    // Still acquisition — but only if we truly lack traffic.
    return observation.funnel.landingViews < 40 ? 1.2 : 0.85;
  }
  if (focus === "margin" && (metric === "average_order_value" || metric === "margin")) {
    return 1.4;
  }
  return 1;
}

/**
 * Prefer money-plan funded hypotheses, then fill remaining concurrent slots
 * with the highest-ranked executable profit bets.
 */
export function selectProfitBets(input: {
  ranked: Hypothesis[];
  moneyPlan: MoneyPlan;
  concurrentBets: number;
  opportunitiesById: Map<string, Opportunity>;
}): Hypothesis[] {
  const n = Math.max(1, input.concurrentBets);
  const fundedIds = new Set(input.moneyPlan.items.map((i) => i.opportunityId));
  const byId = new Map(input.ranked.map((h) => [h.id.replace(/^hyp_/, ""), h]));

  const selected: Hypothesis[] = [];
  const seen = new Set<string>();

  for (const item of input.moneyPlan.items) {
    if (selected.length >= n) break;
    const hyp = byId.get(item.opportunityId);
    if (!hyp || seen.has(hyp.id)) continue;
    // Prefer executable funded levers; still keep high-EV advisory as pressure.
    seen.add(hyp.id);
    selected.push(hyp);
  }

  for (const hyp of input.ranked) {
    if (selected.length >= n) break;
    if (seen.has(hyp.id)) continue;
    if (!hyp.safeActionType) continue;
    seen.add(hyp.id);
    selected.push(hyp);
  }

  // One advisory slot max if we still have room — capability-gap pressure.
  if (selected.length < n) {
    for (const hyp of input.ranked) {
      if (selected.length >= n) break;
      if (seen.has(hyp.id)) continue;
      if (hyp.safeActionType) continue;
      const oppId = hyp.id.replace(/^hyp_/, "");
      if (!fundedIds.has(oppId)) continue;
      seen.add(hyp.id);
      selected.push(hyp);
    }
  }

  return selected.slice(0, n);
}

export function moneyPlanFundsAction(
  moneyPlan: MoneyPlan,
  opportunities: Opportunity[],
  actionType: string,
): boolean {
  const funded = new Set(moneyPlan.items.map((i) => i.opportunityId));
  return opportunities.some(
    (o) => funded.has(o.id) && o.safeActionType === actionType,
  );
}
