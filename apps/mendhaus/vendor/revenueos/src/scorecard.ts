import type {
  Ambition,
  Curriculum,
  CycleResult,
  Experiment,
  Forecast,
  HourPlan,
  MetaPolicy,
  Observation,
  Opportunity,
  RegimeReport,
  Scorecard,
  ShortfallReport,
  UnitEconomics,
} from "./types";

export function buildScorecard(input: {
  siteId: string;
  observation: Observation;
  opportunities: Opportunity[];
  experiments: Experiment[];
  failures?: number;
  expectedProfitPipelineUsd?: number;
  attributionsClosed?: number;
  learningDelta?: string;
  diagnosis?: string;
  unitEconomics?: UnitEconomics;
  forecast?: Forecast;
  calibrationBrier?: number;
  anomalyCount?: number;
  projectedProfitUsd?: number;
  ambition?: Ambition;
  projectedMonthlyProfitUsd?: number;
  shortfall?: ShortfallReport;
  regime?: RegimeReport;
  metaPolicy?: MetaPolicy;
  curriculum?: Curriculum;
  hourPlan?: HourPlan;
}): Scorecard {
  const { observation, opportunities, experiments } = input;
  const won = experiments.filter((item) => item.status === "won").length;
  const lost = experiments.filter((item) => item.status === "lost").length;
  const open = experiments.filter(
    (item) => item.status === "proposed" || item.status === "running",
  ).length;
  const landing = observation.funnel.landingViews;
  const visitorToPurchase =
    landing > 0 ? observation.money.purchases / landing : null;

  const evidence =
    landing + observation.money.purchases * 20 + won * 5 + lost * 3;
  const confidence = Math.max(0.15, Math.min(0.95, evidence / 200));

  return {
    generatedAt: new Date().toISOString(),
    siteId: input.siteId,
    revenueUsd: observation.money.revenueUsd,
    contributionProfitUsd: observation.money.estimatedProfitUsd,
    purchases: observation.money.purchases,
    landingViews: landing,
    visitorToPurchase,
    experimentsWon: won,
    experimentsLost: lost,
    openExperiments: open,
    failures: input.failures ?? observation.errors.length,
    confidence: Number(confidence.toFixed(2)),
    bottleneckLevel: observation.bottleneck.level,
    nextAction:
      opportunities[0]?.action ??
      "Re-run discovery for a $0, in-policy lever that moves a revenue precursor.",
    topOpportunities: opportunities.slice(0, 5),
    expectedProfitPipelineUsd: input.expectedProfitPipelineUsd ?? 0,
    attributionsClosed: input.attributionsClosed ?? 0,
    learningDelta: input.learningDelta ?? "No learning delta.",
    diagnosis: input.diagnosis,
    unitEconomics: input.unitEconomics,
    forecast: input.forecast,
    calibrationBrier: input.calibrationBrier,
    anomalyCount: input.anomalyCount,
    projectedProfitUsd: input.projectedProfitUsd,
    ambition: input.ambition,
    projectedMonthlyProfitUsd: input.projectedMonthlyProfitUsd,
    shortfall: input.shortfall,
    regime: input.regime,
    metaPolicy: input.metaPolicy,
    curriculum: input.curriculum,
    hourPlan: input.hourPlan,
  };
}

export function formatCycleReport(
  displayName: string,
  result: CycleResult,
): string {
  const {
    observation,
    world,
    scorecard,
    opportunities,
    executed,
    lessons,
    strategy,
    anomalies,
  } = result;
  const drop = observation.funnel.largestDrop;
  const ambition = result.ambition;
  const shortfall = result.shortfall;
  const path = ambition.path;
  return [
    `${displayName} — RevenueOS cycle`,
    `Generated: ${scorecard.generatedAt}`,
    `Confidence: ${scorecard.confidence}`,
    "",
    "LAST HOUR",
    result.hourPlan.confession,
    `Hour verdict: ${result.hourPlan.hourVerdict} · $${result.hourPlan.lastHourRevenueUsd.toFixed(2)} · ${result.hourPlan.lastHourPurchases} sale(s) · ${result.hourPlan.lastHourLandingViews} view(s) · ${result.hourPlan.lastHourCheckouts} checkout(s) · overdrive=${result.hourPlan.overdrive}`,
    `Learned from last hour: ${result.hourPlan.learnedFromLastHour}`,
    `Next-hour bar: beat $${result.hourPlan.nextHourBarUsd.toFixed(2)}. Never give up.`,
    "NEXT HOUR — maximize profit",
    ...result.hourPlan.nextHourMoves.map(
      (move, i) =>
        `  ${i + 1}. ${move.title}${move.ownerGated ? " (owner)" : ""} — ${move.why}`,
    ),
    "",
    "NORTH STAR ($10k day)",
    shortfall.learningImperative,
    `Day verdict: ${shortfall.dayVerdict} · current $${shortfall.currentProfitUsd.toFixed(2)} · shortfall $${shortfall.shortfallUsd.toFixed(0)} · ${(shortfall.pctOfNorthStar * 100).toFixed(2)}% of $${shortfall.northStarDailyProfitUsd.toLocaleString()}`,
    `Root cause: ${shortfall.rootCause}`,
    ...(path
      ? [
          `Path: ${path.ordersNeeded} orders/day @ $${path.contributionMarginUsd.toFixed(2)} margin · ~${path.visitorsNeeded} visitors · close: ${path.bottleneckToClose}`,
        ]
      : []),
    "",
    "AMBITION (never satisfied)",
    ambition.verdict,
    `Record profit $${ambition.recordProfitUsd.toFixed(2)} → target $${ambition.targetProfitUsd.toFixed(2)} · current $${ambition.currentProfitUsd.toFixed(2)} · gap $${ambition.gapToTargetUsd.toFixed(2)} · aggression ${ambition.aggression}/3 · ${ambition.concurrentBets} bet(s) · alwaysLearning=${ambition.alwaysLearning}`,
    "",
    "META / REGIME / CURRICULUM (always adjusting)",
    `Regime: ${result.regime.regime} (${result.regime.confidence}) — ${result.regime.note}`,
    `Meta: ${result.metaPolicy.reason}`,
    `Learn next: [${result.curriculum.focusCategory}] ${result.curriculum.priority} — ${result.curriculum.informationGap}`,
    "",
    "MONEY MACHINE (this cycle's plan)",
    `Projected ~$${result.moneyPlan.totalProjectedMonthlyProfitUsd.toFixed(0)}/mo · effort ${result.moneyPlan.effortUsed}/${result.moneyPlan.effortBudget} · ${result.moneyPlan.marginalDollar}`,
    result.moneyPlan.note,
    ...result.moneyPlan.items.slice(0, 5).map(
      (item, i) =>
        `  ${i + 1}. ${item.title} — ~$${item.projectedMonthlyProfitUsd.toFixed(0)}/mo ($${item.profitPerEffort.toFixed(1)}/effort, ${item.category ?? "?"})`,
    ),
    "",
    "MONEY (window from adapter)",
    `Revenue: $${scorecard.revenueUsd.toFixed(2)}`,
    `Contribution profit: $${scorecard.contributionProfitUsd.toFixed(2)}`,
    `Purchases: ${scorecard.purchases}`,
    `Visitor→purchase: ${
      scorecard.visitorToPurchase === null
        ? "n/a"
        : `${(scorecard.visitorToPurchase * 100).toFixed(2)}%`
    }`,
    `Open EV pipeline: $${scorecard.expectedProfitPipelineUsd.toFixed(2)}`,
    ...(scorecard.unitEconomics
      ? [
          `Unit economics: LTV $${scorecard.unitEconomics.ltvUsd.toFixed(2)}, CAC ceiling $${scorecard.unitEconomics.cacCeilingUsd.toFixed(2)}, break-even ${scorecard.unitEconomics.breakEvenVisitors ?? "n/a"} visitors/sale`,
        ]
      : []),
    ...(scorecard.forecast
      ? [
          `Forecast: revenue slope ${scorecard.forecast.revenueSlopePerCycle}/cycle, traffic slope ${scorecard.forecast.trafficSlopePerCycle}/cycle. ${scorecard.forecast.note}`,
        ]
      : []),
    ...(scorecard.calibrationBrier !== undefined
      ? [`Prediction calibration (Brier, lower is better): ${scorecard.calibrationBrier}`]
      : []),
    "",
    "WORLD MODEL",
    `Business: ${world.business.monetizationStage}, margin $${world.business.contributionMarginUsd.toFixed(2)}/sale, fulfillment ${world.business.fulfillmentReliable ? "ok" : "FAILING"}`,
    `Market: demand ${world.market.demandProxy}, discovery ${world.market.discoveryCoverage}, competition ${world.market.competitivePressure}`,
    `Shopper: ${world.shopper.intentTemperature} intent, primary friction ${world.shopper.primaryFriction}`,
    "",
    "AUDIENCE & ACQUISITION (traffic is never the excuse)",
    `Personas: ${world.audience.personas.map((p) => p.label).join(", ")}`,
    `Sales difficulty: ${world.audience.salesDifficulty.toFixed(2)} → resolve ×${world.audience.resolveMultiplier} (${world.audience.difficultyReasons[0]})`,
    "Top channel plays:",
    ...world.audience.channelPlan.slice(0, 5).map(
      (play, i) =>
        `  ${i + 1}. [fit ${play.fit}] ${play.rationale.split(".")[0]} — "${play.angle}"`,
    ),
    "",
    "BOTTLENECK",
    `Level ${observation.bottleneck.level} — ${observation.bottleneck.label}`,
    observation.bottleneck.detail,
    drop
      ? `Largest funnel drop: ${drop.step} (${((drop.dropRate ?? 0) * 100).toFixed(0)}%)`
      : "Largest funnel drop: none measurable",
    "",
    "EXPERIMENTS",
    `Won ${scorecard.experimentsWon} · Lost ${scorecard.experimentsLost} · Open ${scorecard.openExperiments} · Attributed this cycle ${scorecard.attributionsClosed}`,
    "",
    "EXECUTED THIS CYCLE",
    ...(executed.length
      ? executed.map(
          (item) =>
            `- ${item.action.type}: ${item.result.ok ? "ok" : "fail"} — ${item.result.detail}`,
        )
      : ["- (none)"]),
    "",
    ...(anomalies && anomalies.length
      ? [
          "ANOMALIES (vigilance)",
          ...anomalies.map(
            (a) => `- [${a.severity}] ${a.metric}: ${a.note}`,
          ),
          "",
        ]
      : []),
    "TOP OPPORTUNITIES (ranked by expected profit)",
    ...opportunities.slice(0, 5).map((item, index) => {
      const ev = item.predicted
        ? `~$${item.predicted.expectedProfitUsd.toFixed(0)} via ${item.predicted.precursorMetric}`
        : "EV n/a";
      return `${index + 1}. [${item.score}] ${item.title} (${item.category ?? "?"}, ${ev}) — ${item.action}`;
    }),
    "",
    ...(strategy && strategy.steps.length
      ? [
          `STRATEGY (sequenced plan, ~$${strategy.projectedProfitUsd.toFixed(0)} horizon profit)`,
          ...strategy.steps.map(
            (step) =>
              `${step.order}. ${step.title} — ${step.rationale}${step.blockedBy ? " (blocked until prior step lands)" : ""}`,
          ),
          "",
        ]
      : []),
    "LEARNING",
    scorecard.learningDelta,
    ...(lessons.length
      ? lessons.slice(0, 5).map((lesson) => `- [${lesson.scope}] ${lesson.summary}`)
      : ["- (no lessons yet)"]),
    "",
    ...(scorecard.diagnosis
      ? ["DIAGNOSIS (stuck — changing approach)", scorecard.diagnosis, ""]
      : []),
    "NEXT ACTION",
    scorecard.nextAction,
  ].join("\n");
}
