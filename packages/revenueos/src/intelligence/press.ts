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
  const needsTraffic = landing < Math.max(40, ordersNeeded * 8) && purchases === 0;
  const needsClose = landing >= 20 && (purchases === 0 || cvr < 0.02);

  // IndexNow is cheap compounding — keep warm, but never the whole strategy.
  moves.push({
    id: "press-discovery-indexnow",
    title: "Press: keep money pages discoverable (IndexNow)",
    category: "acquisition",
    expectedImpact: Number(((needsTraffic ? 7 : 4) * urgency).toFixed(2)),
    effort: 1,
    velocityNote: `Need ~${ordersNeeded} orders/day @ $${margin.toFixed(2)} margin for $${northStar.toLocaleString()}. Indexing serves sales, not vanity traffic.`,
    patternKey: "indexnow-discovery",
    safeActionType: "indexnow_submit",
    action:
      "Submit money pages via IndexNow. Goal is buyers finding buyable URLs — not impression counts.",
  });

  if (needsTraffic) {
    moves.push({
      id: "press-organic-intent",
      title: "Press: publish a buyable intent door (not content volume)",
      category: "acquisition",
      expectedImpact: Number((8.5 * urgency).toFixed(2)),
      effort: 2,
      velocityNote: `At ${(cvr * 100).toFixed(1)}% CVR need ~${Math.ceil(ordersNeeded / Math.max(cvr, 0.01))} visitors/day who can purchase.`,
      patternKey: "publish-intent-page",
      safeActionType: "publish_intent_page",
      action:
        "Publish only if the query maps to a product someone can buy today. Kill doors that do not convert.",
    });
    moves.push({
      id: "press-internet-research",
      title: "Press: find who is buying on the live internet",
      category: "acquisition",
      expectedImpact: Number((9 * urgency).toFixed(2)),
      effort: 1,
      velocityNote:
        "Research must name buyable demand + margin path. Query volume without purchase intent is waste.",
      patternKey: "internet-market-research",
      safeActionType: "market_research",
      action:
        "Search the public web for people ready to buy what we sell at contribution profit. Persist only sellable attacks.",
    });
    moves.push({
      id: "press-discovery-attack",
      title: "Press: research→publish→index attack for sales",
      category: "acquisition",
      expectedImpact: Number((9.5 * urgency).toFixed(2)),
      effort: 2,
      velocityNote: "One sellable door per attack. Success = purchases, not page count.",
      patternKey: "discovery-attack",
      safeActionType: "discovery_attack",
      action:
        "Run discovery attack only to open a path to a sale. Do not congratulate publish without revenue.",
    });
  }

  if (needsClose) {
    moves.push({
      id: "press-conversion",
      title: "Press: convert traffic you already paid attention for",
      category: "conversion",
      expectedImpact: Number((10 * urgency).toFixed(2)),
      effort: 2,
      velocityNote: `Current CVR ${(cvr * 100).toFixed(2)}%. Doubling CVR halves traffic needed for $${northStar.toLocaleString()}/day.`,
      patternKey: "conversion-press",
      safeActionType: "merch_optimize",
      action:
        "Close existing visitors: homepage focus, kit deals, clarity. More topics while CVR is near zero is profit sabotage.",
    });
  }

  moves.push({
    id: "press-directory-coverage",
    title: "Press: sitemap ping (keep buyable URLs crawlable)",
    category: "acquisition",
    expectedImpact: Number(((needsTraffic ? 6 : 3.5) * urgency).toFixed(2)),
    effort: 1,
    velocityNote: "Crawlability supports sales; it is not a KPI.",
    patternKey: "sitemap-ping",
    safeActionType: "sitemap_ping",
    action: "Ping Google/Bing with the live sitemap so money pages stay eligible to rank.",
  });

  if (purchases > 0) {
    moves.push({
      id: "press-margin-aov",
      title: "Press: raise contribution per order",
      category: "pricing",
      expectedImpact: Number((7 * urgency).toFixed(2)),
      effort: 2,
      velocityNote: `Each +$1 margin cuts orders-needed for $${northStar.toLocaleString()}.`,
      patternKey: "price-test",
      action:
        "Owner-gated: test packaging/AOV that preserves truthfulness. More $ per close accelerates the day.",
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
          : m.safeActionType === "merch_optimize"
            ? "purchases"
            : "landing_views",
    expectedImpact: m.expectedImpact,
    confidence: 0.55,
    effort: m.effort,
    action: `${m.action} (${m.velocityNote})`,
    safeActionType: m.safeActionType,
    patternKey: m.patternKey,
  }));
}
