import {
  proposeAcquisition,
  proposeConversionLevers,
} from "./acquisition";
import { proposeRetention } from "./retention";
import { valuePerPrecursorUnit } from "./economics";
import { SIGNAL_WINDOW_DAYS } from "../knowledge/commerce";
import { shrinkForSample } from "../intelligence/statistics";
import { banditMultiplier } from "../intelligence/bandit";
import { calibrationFactor } from "../intelligence/calibration";
import {
  buildMoneyPress,
  printMovesToOpportunities,
} from "../intelligence/press";
import type {
  BanditStat,
  BusinessContext,
  CalibrationModel,
  Experiment,
  Hypothesis,
  Lesson,
  Observation,
  Opportunity,
  PredictedImpact,
  PrecursorMetric,
  ShortfallReport,
  WorldModel,
} from "../types";

type Unscored = Omit<Opportunity, "score">;

function proposePricing(input: {
  world: WorldModel;
  observation: Observation;
}): Unscored[] {
  const { world, observation } = input;
  if (observation.money.purchases <= 0) return [];
  const items: Unscored[] = [];
  if (world.business.contributionMarginRatio < 0.9) {
    items.push({
      id: "margin-price-test",
      title: "Test price / AOV to lift contribution margin",
      metric: "average order value",
      category: "pricing",
      precursorMetric: "average_order_value",
      expectedImpact: 5,
      confidence: 0.4,
      effort: 2,
      action:
        "Recommend an A/B price or bundle test (owner-gated). Never change price autonomously.",
      patternKey: "price-test",
    });
  }
  return items;
}

function proposeOperations(input: { world: WorldModel }): Unscored[] {
  const { world } = input;
  const items: Unscored[] = [];
  if (!world.business.fulfillmentReliable) {
    items.push({
      id: "fix-fulfillment",
      title: "Fix fulfillment failures",
      metric: "fulfillment reliability",
      category: "operations",
      precursorMetric: "fulfillment_reliability",
      expectedImpact: 9,
      confidence: 0.9,
      effort: 2,
      action:
        "Delivery is failing on paid orders. Fix fulfillment before spending any attention on acquisition.",
      patternKey: "fix-fulfillment",
    });
  }
  items.push({
    id: "qa-guard",
    title: "Keep output QA regressions green",
    metric: "broken-artifact rate",
    category: "operations",
    precursorMetric: "fulfillment_reliability",
    expectedImpact: 4,
    confidence: 0.9,
    effort: 1,
    action:
      "Never ship output-renderer changes without regression assertions on the deliverable.",
    patternKey: "qa-guard",
  });
  return items;
}

/**
 * Honest incremental-unit estimates. Never invent a traffic windfall — fake
 * "max(40, …)" landing lifts made discovery look more profitable than closing
 * real visitors. Prefer purchase/checkout units when any demand exists.
 */
function estimateIncrementalUnits(
  metric: PrecursorMetric,
  expectedImpact: number,
  observation: Observation,
): number {
  const scale = expectedImpact / 7;
  const landing = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  const checkouts = observation.funnel.checkouts;
  switch (metric) {
    case "landing_views":
      // Modest lift from current baseline; do not fabricate dozens of visitors.
      return Math.max(2, Math.min(landing > 0 ? landing * 0.12 : 8, 20)) * scale;
    case "product_started":
      return Math.max(1, landing > 0 ? landing * 0.03 : 3) * scale;
    case "checkout_started":
      return (
        Math.max(0.5, checkouts > 0 ? checkouts * 0.2 : Math.max(1, landing * 0.02)) *
        scale
      );
    case "purchases":
      // Closing sales is the prize — keep purchase units competitive vs traffic.
      return Math.max(0.75, purchases > 0 ? purchases * 0.25 : 1.5) * scale;
    case "repeat_rate":
      return Math.max(0.5, purchases) * 0.1 * scale;
    case "average_order_value":
      return Math.max(0.5, purchases > 0 ? purchases : 1) * 0.08 * scale;
    case "fulfillment_reliability":
      return scale;
    case "margin":
      return Math.max(1, observation.money.revenueUsd) * 0.02 * scale;
    case "contribution_profit":
    case "revenue":
      return Math.max(1, purchases > 0 ? purchases : 1) * scale;
    default:
      return scale;
  }
}

/** Effective sample backing a precursor estimate, used to shrink confidence. */
function sampleSizeFor(
  metric: PrecursorMetric,
  observation: Observation,
): number {
  switch (metric) {
    case "landing_views":
    case "product_started":
      return observation.funnel.landingViews;
    case "checkout_started":
      return observation.funnel.checkouts;
    case "purchases":
    case "average_order_value":
    case "repeat_rate":
    case "fulfillment_reliability":
      return observation.money.purchases;
    default:
      return observation.funnel.landingViews;
  }
}

/** Attach dollar-denominated ROI reasoning to a candidate lever. */
export function predictImpact(
  opportunity: Unscored,
  world: WorldModel,
  observation: Observation,
): PredictedImpact {
  const metric: PrecursorMetric = opportunity.precursorMetric ?? "purchases";
  const category = opportunity.category ?? "acquisition";
  const units = estimateIncrementalUnits(
    metric,
    opportunity.expectedImpact,
    observation,
  );
  const unitValue = valuePerPrecursorUnit(
    metric,
    world.business,
    observation,
    world.shopper.intentTemperature === "unknown"
      ? "unknown"
      : world.shopper.intentTemperature,
  );
  // Be honest: shrink confidence toward 0.5 when the backing sample is thin.
  const effectiveConfidence = shrinkForSample(
    opportunity.confidence,
    sampleSizeFor(metric, observation),
  );
  const costUsd = 0;
  const expectedProfitUsd = Number(
    (units * unitValue * effectiveConfidence - costUsd).toFixed(2),
  );
  return {
    precursorMetric: metric,
    expectedProfitUsd,
    confidence: effectiveConfidence,
    effort: opportunity.effort,
    costUsd,
    timeToSignalDays: SIGNAL_WINDOW_DAYS[category] ?? 14,
  };
}

function lessonMatches(lesson: Lesson, opportunity: Unscored): boolean {
  if (!lesson.patternKey) return false;
  return (
    lesson.patternKey === opportunity.patternKey ||
    lesson.patternKey === opportunity.category ||
    lesson.patternKey === opportunity.id
  );
}

/**
 * Competitive, learning-aware ranking. EV drives order; lessons bend it:
 * negative lessons downrank and cooldowns suppress; positive lessons boost.
 */
export function prioritize(input: {
  opportunities: Unscored[];
  lessons: Lesson[];
  world: WorldModel;
  observation: Observation;
  calibration?: CalibrationModel;
  banditStats?: Map<string, BanditStat>;
  now?: number;
}): Opportunity[] {
  const now = input.now ?? Date.now();
  const scored: Opportunity[] = input.opportunities.map((opportunity) => {
    const predicted =
      opportunity.predicted ??
      predictImpact(opportunity, input.world, input.observation);
    let weight = 1;
    let suppressed = false;
    for (const lesson of input.lessons) {
      if (!lessonMatches(lesson, opportunity)) continue;
      if (typeof lesson.rankingWeight === "number") weight *= lesson.rankingWeight;
      if (lesson.cooldownUntil && Date.parse(lesson.cooldownUntil) > now) {
        suppressed = true;
      }
    }
    // Meta-learning: scale EV by how well this category predicted in the past.
    const calFactor = input.calibration
      ? calibrationFactor(input.calibration, opportunity.category)
      : 1;
    // Explore/exploit: proven winners lift, novel levers get an exploration bonus.
    const bandit = input.banditStats
      ? banditMultiplier(opportunity.patternKey ?? opportunity.category, input.banditStats)
      : 1;
    // Executable levers print now — but never outrank a higher-$ close path
    // just because they are clickable. Soft boost only when EV is real.
    const executableBoost =
      opportunity.safeActionType && predicted.expectedProfitUsd > 0
        ? 1.25
        : opportunity.safeActionType
          ? 1.05
          : 0.95;
    // Prefer dollars/day over vague precursor points.
    const dollarsPerDay =
      predicted.expectedProfitUsd / Math.max(predicted.timeToSignalDays, 1);
    const moneySpeedBoost = 1 + Math.min(1.2, dollarsPerDay / 40);
    let score =
      (predicted.expectedProfitUsd *
        weight *
        calFactor *
        bandit *
        executableBoost *
        moneySpeedBoost) /
      Math.sqrt(Math.max(opportunity.effort, 1));
    if (suppressed) score *= 0.1;
    return {
      ...opportunity,
      predicted,
      score: Number(score.toFixed(2)),
    };
  });
  return scored.sort((a, b) => b.score - a.score);
}

/** Generate the full, ranked opportunity set across every lever category. */
export function generateOpportunities(input: {
  context: BusinessContext;
  world: WorldModel;
  observation: Observation;
  lessons: Lesson[];
  siteExtras?: Array<Omit<Opportunity, "score">>;
  calibration?: CalibrationModel;
  banditStats?: Map<string, BanditStat>;
  now?: number;
  shortfall?: ShortfallReport;
}): Opportunity[] {
  const press = printMovesToOpportunities(
    buildMoneyPress({
      observation: input.observation,
      world: input.world,
      shortfall: input.shortfall,
    }),
  );
  const candidates: Unscored[] = [
    ...proposeOperations({ world: input.world }),
    ...press,
    ...proposeAcquisition({
      world: input.world,
      observation: input.observation,
      siteExtras: input.siteExtras,
    }),
    ...proposeConversionLevers({
      world: input.world,
      observation: input.observation,
    }),
    ...proposeRetention({
      world: input.world,
      observation: input.observation,
    }),
    ...proposePricing({ world: input.world, observation: input.observation }),
  ];
  // Dedupe by id — press moves can overlap acquisition ids' intent; keep highest impact.
  const byId = new Map<string, Unscored>();
  for (const c of candidates) {
    const prev = byId.get(c.id);
    if (!prev || c.expectedImpact > prev.expectedImpact) byId.set(c.id, c);
  }
  return prioritize({
    opportunities: [...byId.values()],
    lessons: input.lessons,
    world: input.world,
    observation: input.observation,
    calibration: input.calibration,
    banditStats: input.banditStats,
    now: input.now,
  });
}

export function opportunitiesToHypotheses(
  opportunities: Opportunity[],
): Hypothesis[] {
  return opportunities.slice(0, 12).map((item) => ({
    id: `hyp_${item.id}`,
    title: item.title,
    metric: item.metric,
    predictedDelta: item.predicted
      ? `+$${item.predicted.expectedProfitUsd.toFixed(0)} profit via ${item.predicted.precursorMetric} in ~${item.predicted.timeToSignalDays}d`
      : `Improve ${item.metric}`,
    confidence: item.confidence,
    effort: item.effort,
    expectedImpact: item.expectedImpact,
    action: item.action,
    safeActionType: item.safeActionType,
    category: item.category,
    precursorMetric: item.precursorMetric,
    patternKey: item.patternKey,
    constraintsChecked: [
      "legal_only",
      "truthful_marketing",
      "no_unauthorized_accounts",
      "spend_cap",
    ],
  }));
}

/** Convenience for the executive: current value of a precursor from observation. */
export function precursorValueFromObservation(
  metric: PrecursorMetric,
  observation: Observation,
): number {
  switch (metric) {
    case "revenue":
    case "contribution_profit":
      return observation.money.estimatedProfitUsd;
    case "purchases":
      return observation.money.purchases;
    case "checkout_started":
      return observation.funnel.checkouts;
    case "landing_views":
      return observation.funnel.landingViews;
    case "fulfillment_reliability":
      return observation.funnel.fulfillmentFailed === 0 ? 1 : 0;
    case "average_order_value":
      return observation.money.purchases > 0
        ? observation.money.revenueUsd / observation.money.purchases
        : 0;
    case "margin":
      return observation.money.revenueUsd > 0
        ? observation.money.estimatedProfitUsd / observation.money.revenueUsd
        : 0;
    case "product_started": {
      const started = observation.funnel.steps.find((s) =>
        /start|builder|signup/i.test(s.step),
      );
      return started?.count ?? 0;
    }
    case "repeat_rate":
      return 0;
    default:
      return 0;
  }
}
