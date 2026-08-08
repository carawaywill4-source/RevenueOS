import type {
  Observation,
  Opportunity,
  ShortfallReport,
  UnitEconomics,
  WorldModel,
} from "../types";
import { NORTH_STAR_DAILY_PROFIT_USD } from "../modules/northstar";

/**
 * Money press: reverse-engineer the highest-velocity path from current state to
 * a $10k day and mint concrete, ranked "print" moves — compound acquisition,
 * conversion lift, and margin — so the brain always has an immediate press.
 */

export type PrintMove = {
  id: string;
  title: string;
  category: Opportunity["category"];
  expectedImpact: number;
  effort: number;
  velocityNote: string;
  patternKey: string;
  safeActionType?: string;
  action: string;
};

export function buildMoneyPress(input: {
  observation: Observation;
  world: WorldModel;
  unitEconomics?: UnitEconomics;
  shortfall?: ShortfallReport;
  northStarUsd?: number;
}): PrintMove[] {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const margin = Math.max(
    input.unitEconomics?.contributionMarginUsd ??
      input.world.business.contributionMarginUsd,
    0.01,
  );
  const ordersNeeded = Math.ceil(northStar / margin);
  const landing = input.observation.funnel.landingViews;
  const purchases = input.observation.money.purchases;
  const cvr = landing > 0 ? purchases / landing : 0;
  const shortfall =
    input.shortfall?.shortfallUsd ??
    Math.max(0, northStar - input.observation.money.estimatedProfitUsd);
  const urgency = 1 + Math.min(1, shortfall / northStar);

  const moves: PrintMove[] = [];

  // Always keep the discovery press hot — account-free, executable now.
  moves.push({
    id: "press-discovery-indexnow",
    title: "Press: blast public URLs into discovery indexes",
    category: "acquisition",
    expectedImpact: Number((8 * urgency).toFixed(2)),
    effort: 1,
    velocityNote: `Need ~${ordersNeeded} orders/day @ $${margin.toFixed(2)} margin. Discovery compounds first.`,
    patternKey: "indexnow-discovery",
    safeActionType: "indexnow_submit",
    action:
      "Submit every public money page via IndexNow now. Do not wait on any marketplace.",
  });

  if (landing < Math.max(100, ordersNeeded * 20) || purchases === 0) {
    moves.push({
      id: "press-organic-intent",
      title: "Press: capture high-intent organic queries",
      category: "acquisition",
      expectedImpact: Number((9 * urgency).toFixed(2)),
      effort: 3,
      velocityNote: `At ${(cvr * 100).toFixed(1)}% CVR need ~${Math.ceil(ordersNeeded / Math.max(cvr, 0.01))} visitors/day for the north star.`,
      patternKey: "acq:organic_search:urgent-need:a0",
      action:
        "Deepen the highest-intent product pages (maker, cost, examples, templates) so strangers searching today convert today.",
    });
  }

  if (landing >= 20 && (purchases === 0 || cvr < 0.02)) {
    moves.push({
      id: "press-conversion",
      title: "Press: lift visitor→purchase on traffic you already have",
      category: "conversion",
      expectedImpact: Number((8.5 * urgency).toFixed(2)),
      effort: 2,
      velocityNote: `Current CVR ${(cvr * 100).toFixed(2)}%. Doubling CVR halves the traffic needed for $${northStar.toLocaleString()}/day.`,
      patternKey: "conversion-press",
      action:
        "Attack the largest funnel drop with a truthful clarity/trust fix. Closing existing visitors prints faster than cold acquisition alone.",
    });
  }

  moves.push({
    id: "press-directory-coverage",
    title: "Press: free directory & index coverage",
    category: "acquisition",
    expectedImpact: Number((6.5 * urgency).toFixed(2)),
    effort: 1,
    velocityNote: "Parallel free discovery while organic compounds.",
    patternKey: "acq:directories:urgent-need:a0",
    action:
      "Keep submitting to account-free directories and structured indexes. Parallel to SEO and IndexNow — never sequential-wait.",
  });

  if (purchases > 0) {
    moves.push({
      id: "press-margin-aov",
      title: "Press: raise contribution per order",
      category: "pricing",
      expectedImpact: Number((6 * urgency).toFixed(2)),
      effort: 2,
      velocityNote: `Each +$1 margin cuts orders-needed for $${northStar.toLocaleString()} by ${Math.max(1, Math.ceil(northStar / margin) - Math.ceil(northStar / (margin + 1)))}.`,
      patternKey: "price-test",
      action:
        "Owner-gated: test packaging/AOV lifts that preserve dignity and truthfulness. More $ per close accelerates the day.",
    });
  }

  return moves.sort((a, b) => b.expectedImpact / b.effort - a.expectedImpact / a.effort);
}

/** Turn print moves into unscored opportunities for the strategy engine. */
export function printMovesToOpportunities(
  moves: PrintMove[],
): Array<Omit<Opportunity, "score">> {
  return moves.map((m) => ({
    id: m.id,
    title: m.title,
    metric: m.category === "conversion" ? "purchase rate" : "qualified traffic / profit",
    category: m.category,
    precursorMetric:
      m.category === "conversion"
        ? "purchases"
        : m.category === "pricing"
          ? "average_order_value"
          : "landing_views",
    expectedImpact: m.expectedImpact,
    confidence: 0.55,
    effort: m.effort,
    action: `${m.action} (${m.velocityNote})`,
    safeActionType: m.safeActionType,
    patternKey: m.patternKey,
  }));
}
