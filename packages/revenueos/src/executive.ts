import type { SiteAdapter } from "./adapters/types";
import { buildWorldModel } from "./models";
import {
  generateOpportunities,
  opportunitiesToHypotheses,
  precursorValueFromObservation,
} from "./modules/strategy";
import {
  alreadyTriedRecently,
  createProposedExperiment,
  lessonFromBlockedAction,
} from "./modules/experimentation";
import {
  attributeExperiment,
  dueForAttribution,
  lessonFromAttribution,
} from "./modules/attribution";
import { diagnose } from "./modules/diagnosis";
import { buildUnitEconomics } from "./modules/economics";
import { buildStrategy } from "./modules/planner";
import { buildAmbition } from "./modules/ambition";
import { buildMoneyPlan } from "./modules/money";
import { buildCalibration } from "./intelligence/calibration";
import { banditStatsFromExperiments } from "./intelligence/bandit";
import { buildForecast } from "./intelligence/forecast";
import { detectAnomalies } from "./intelligence/anomaly";
import {
  curriculumBoost,
  rankExperimentHypotheses,
} from "./intelligence/decision";
import { selectHuntingBets } from "./intelligence/hunting";
import {
  buildShortfallReport,
  lessonFromShortfall,
} from "./intelligence/shortfall";
import { detectRegime } from "./intelligence/regime";
import { buildMetaPolicy } from "./intelligence/meta";
import { buildCurriculum } from "./intelligence/curriculum";
import { sizeConcurrentBets } from "./intelligence/kelly";
import { buildHourPlan, lessonFromHour } from "./intelligence/hour";
import { filterAutonomousActions, policyAllows } from "./policy";
import { buildScorecard, formatCycleReport } from "./scorecard";
import { SEED_LESSONS, type SeedLesson } from "./ledger/seed";
import type {
  ActionResult,
  Attribution,
  Experiment,
  Lesson,
  Opportunity,
  SafeAction,
  WorldModel,
} from "./types";

async function ensureSeedLessons(adapter: SiteAdapter) {
  const context = await adapter.getContext();
  const store = adapter.getExperimentStore();
  const existing = await store.listLessons({
    siteId: context.siteId,
    industry: context.industry,
  });
  const have = new Set(existing.map((lesson) => lesson.id));
  const now = new Date().toISOString();

  const adapterSeeds: SeedLesson[] = adapter.getSeedLessons
    ? await adapter.getSeedLessons()
    : [];
  const seeds: SeedLesson[] = [...SEED_LESSONS, ...adapterSeeds];

  for (const seed of seeds) {
    if (have.has(seed.id)) continue;
    if (seed.scope === "site" && seed.siteId !== context.siteId) continue;
    if (
      seed.scope === "industry" &&
      seed.industry &&
      seed.industry !== context.industry
    ) {
      continue;
    }
    const lesson: Lesson = { ...seed, createdAt: now, updatedAt: now };
    await store.saveLesson(lesson);
  }
}

/**
 * The full loop:
 * Observe → Model → Find Opportunity → Predict ROI → Prioritize → Act →
 * Measure → Attribute → Learn (including lost-day shortfall) → Repeat.
 *
 * North star: a $10,000 contribution-profit day. Every day under that bar is a
 * loss + lesson; because the bar is improbable early, the brain always learns.
 */
export async function runCycle(adapter: SiteAdapter) {
  await ensureSeedLessons(adapter);

  const context = await adapter.getContext();
  const store = adapter.getExperimentStore();

  // 1. Observe
  const observation = await adapter.observe();
  const priorExperiments = await store.listExperiments(context.siteId);
  const priorLessons = await store.listLessons({
    siteId: context.siteId,
    industry: context.industry,
  });
  // Deeper history for regime / forecast / shortfall learning.
  const priorScorecards = await store.listScorecards(context.siteId, 30);
  const signals = adapter.getMarketSignals
    ? await adapter.getMarketSignals()
    : undefined;

  const forecast = buildForecast(priorScorecards);
  const anomalies = detectAnomalies(observation, priorScorecards);

  // 2. Attribute open experiments whose signal window has elapsed.
  const attributions: Attribution[] = [];
  const newLessons: Lesson[] = [];
  const now = new Date();
  for (const experiment of priorExperiments) {
    if (!dueForAttribution(experiment, now.getTime())) continue;
    const metric = experiment.measurement!.metric;
    const measured = adapter.getMeasurement
      ? await adapter.getMeasurement(metric)
      : null;
    const currentValue =
      measured ?? precursorValueFromObservation(metric, observation);
    const trendDrift =
      metric === "revenue" || metric === "contribution_profit"
        ? forecast.revenueSlopePerCycle
        : metric === "landing_views" ||
            metric === "product_started" ||
            metric === "checkout_started"
          ? forecast.trafficSlopePerCycle
          : 0;
    const expectedBaseline = experiment.measurement!.baselineValue + trendDrift;
    const { attribution, experiment: closed } = attributeExperiment(
      experiment,
      currentValue,
      now,
      expectedBaseline,
    );
    await store.saveAttribution(attribution);
    await store.saveExperiment(closed);
    attributions.push(attribution);
    const lesson = lessonFromAttribution({
      experiment: closed,
      attribution,
      industry: context.industry,
      now,
    });
    await store.saveLesson(lesson);
    newLessons.push(lesson);
  }

  const experimentsForLearning = await store.listExperiments(context.siteId);
  const allAttributions = await store.listAttributions(context.siteId);
  const calibration = buildCalibration(experimentsForLearning, allAttributions);
  const banditStats = banditStatsFromExperiments(experimentsForLearning);

  // 3. Model the world
  const world: WorldModel = buildWorldModel({
    context,
    observation,
    signals,
    banditStats,
  });
  const unitEconomics = buildUnitEconomics(context, observation, world);

  // North-star day accounting: under $10k is a lost day → durable lesson.
  const shortfall = buildShortfallReport({ observation, world });
  const shortfallLesson = lessonFromShortfall({
    siteId: context.siteId,
    industry: context.industry,
    shortfall,
    now,
  });
  await store.saveLesson(shortfallLesson);
  newLessons.push(shortfallLesson);

  const regime = detectRegime(
    priorScorecards,
    observation.money.estimatedProfitUsd,
    observation.money.purchases,
  );
  const metaPolicy = buildMetaPolicy({
    shortfall,
    calibration,
    regime,
    hourPulse: observation.hourPulse,
  });
  const curriculum = buildCurriculum({
    shortfall,
    regime,
    world,
    observation,
  });

  const ambition = buildAmbition({
    observation,
    history: priorScorecards,
    unitEconomics,
    world,
    salesDifficulty: world.audience.salesDifficulty,
  });

  // Kelly-size parallel bets from aggression + meta learning pressure.
  ambition.concurrentBets = sizeConcurrentBets({
    ambition,
    meta: metaPolicy,
    banditStats,
  });

  const lessons = [...newLessons, ...priorLessons];

  // 4-5. Find opportunities, predict ROI, prioritize.
  const siteExtras = adapter.listSiteOpportunities
    ? await adapter.listSiteOpportunities({ observation })
    : [];
  let opportunities = generateOpportunities({
    context,
    world,
    observation,
    lessons,
    siteExtras,
    calibration,
    banditStats,
    now: now.getTime(),
    shortfall,
  });

  // Curriculum reweights: boost levers that close the active information gap.
  opportunities = [...opportunities]
    .map((o) => ({
      ...o,
      score: Number(
        (o.score * curriculumBoost(o.category, curriculum.focusCategory)).toFixed(
          2,
        ),
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const hypotheses = opportunitiesToHypotheses(opportunities);
  const strategy = buildStrategy(opportunities, world);

  const moneyPlan = buildMoneyPlan({
    opportunities,
    world,
    observation,
    effortBudget:
      (ambition.overdrive ? 16 : 8) +
      2 * ambition.aggression +
      (metaPolicy.alwaysLearning ? 3 : 0),
    shortfall,
  });

  const hourPlan = buildHourPlan({
    observation,
    world,
    opportunities,
    history: priorScorecards,
  });
  const hourLesson = lessonFromHour({
    siteId: context.siteId,
    industry: context.industry,
    hourPlan,
    now,
  });
  await store.saveLesson(hourLesson);
  newLessons.push(hourLesson);

  const experimentsTouched: Experiment[] = [];

  const openExperiments = await store.listExperiments(context.siteId);
  const opportunitiesById = new Map<string, Opportunity>(
    opportunities.map((o) => [o.id, o]),
  );
  const candidateHypotheses = hypotheses.filter(
    (h) => !alreadyTriedRecently(openExperiments, h.id),
  );
  // If every executable lever is on a recent cooldown, still keep at least one
  // in the hunt — otherwise the machine looks idle while waiting on owners.
  let huntPool = candidateHypotheses;
  if (!huntPool.some((h) => h.safeActionType)) {
    const exec = hypotheses.filter((h) => h.safeActionType);
    if (exec.length) huntPool = [...huntPool, ...exec.slice(0, 2)];
  }
  const ranked = rankExperimentHypotheses(
    huntPool,
    opportunitiesById,
    banditStats,
    metaPolicy.explorationLambda,
    metaPolicy.exploitBias,
  );
  // Never fill the cycle with owner-waiting asks — keep hunting executable money.
  const bets = selectHuntingBets(ranked, Math.max(1, ambition.concurrentBets));
  for (const bet of bets) {
    if (bet.safeActionType) {
      const experiment = createProposedExperiment(
        context.siteId,
        bet,
        observation,
        now,
      );
      await store.saveExperiment(experiment);
      experimentsTouched.push(experiment);
    } else {
      const blocked: Experiment = {
        ...createProposedExperiment(context.siteId, bet, observation, now),
        status: "blocked",
      };
      await store.saveExperiment(blocked);
      experimentsTouched.push(blocked);
      const lesson = lessonFromBlockedAction(
        context.siteId,
        context.industry,
        bet,
        "requires owner action or a non-autonomous change",
      );
      await store.saveLesson(lesson);
      newLessons.push(lesson);
    }
  }

  // 6. Act — only within policy.
  const executed: Array<{ action: SafeAction; result: ActionResult }> = [];
  const available = filterAutonomousActions(await adapter.listSafeActions());
  let dailySpend = 0;

  for (const action of available) {
    const gate = policyAllows(action, {
      maxRisk: "safe",
      dailySpendUsd: dailySpend,
      dailyCapUsd: context.autonomousDailyCapUsd,
    });
    if (!gate.ok) continue;

    // Money press: never pause IndexNow while hunting a $10k day.
    if (
      action.type === "indexnow_submit" &&
      !ambition.alwaysLearning &&
      !metaPolicy.alwaysLearning &&
      shortfall.dayVerdict === "won_day" &&
      observation.bottleneck.level !== 4 &&
      world.market.discoveryCoverage === "broad"
    ) {
      continue;
    }

    const result = await adapter.execute(action);
    executed.push({ action, result });
    dailySpend += result.costUsd ?? 0;

    const linked = experimentsTouched[0];
    if (linked && linked.status === "running") {
      linked.actions.push({
        type: action.type,
        payload: action.payload,
        result,
        at: new Date().toISOString(),
      });
      linked.updatedAt = new Date().toISOString();
      await store.saveExperiment(linked);
    }
  }

  const snapshotAction = available.find((a) => a.type === "scorecard_snapshot");
  if (
    snapshotAction &&
    !executed.some((item) => item.action.type === "scorecard_snapshot")
  ) {
    const result = await adapter.execute(snapshotAction);
    executed.push({ action: snapshotAction, result });
  }

  // 8-9. Diagnose and assemble the scorecard.
  const allExperiments = await store.listExperiments(context.siteId);
  const { stuck, diagnosis } = diagnose({
    observation,
    world,
    priorScorecards,
    experiments: allExperiments,
  });

  const openPipeline = allExperiments.filter(
    (e) => e.status === "running" || e.status === "proposed",
  );
  const expectedProfitPipelineUsd = Number(
    openPipeline
      .reduce((sum, e) => sum + (e.predicted?.expectedProfitUsd ?? 0), 0)
      .toFixed(2),
  );

  const learningDelta =
    `${hourPlan.overdrive ? "ZERO HOUR overdrive. " : ""}` +
    `${shortfall.dayVerdict === "lost_day" ? "Lost day vs north star. " : "North-star day cleared. "}` +
    (newLessons.length > 0
      ? `${newLessons.length} lesson(s) recorded; ${attributions.filter((a) => a.verdict === "won").length} win / ${attributions.filter((a) => a.verdict === "lost").length} loss attributed. Meta: λ=${metaPolicy.explorationLambda}. Curriculum: ${curriculum.priority}.`
      : `No experiment attributions; shortfall lesson still applied. Meta: λ=${metaPolicy.explorationLambda}.`);

  const topAnomaly = anomalies.find((a) => a.severity === "high") ?? anomalies[0];
  const diagnosisNote = topAnomaly
    ? topAnomaly.note
    : stuck
      ? diagnosis
      : forecast.decelerating
        ? forecast.note
        : shortfall.dayVerdict === "lost_day"
          ? shortfall.learningImperative
          : undefined;

  const scorecard = buildScorecard({
    siteId: context.siteId,
    observation,
    opportunities,
    experiments: allExperiments,
    expectedProfitPipelineUsd,
    attributionsClosed: attributions.length,
    learningDelta,
    diagnosis: diagnosisNote,
    unitEconomics,
    forecast,
    calibrationBrier: calibration.overall.samples
      ? calibration.overall.brier
      : undefined,
    anomalyCount: anomalies.length,
    projectedProfitUsd: strategy.projectedProfitUsd,
    ambition,
    projectedMonthlyProfitUsd: moneyPlan.totalProjectedMonthlyProfitUsd,
    shortfall,
    regime,
    metaPolicy,
    curriculum,
    hourPlan,
  });
  await store.saveScorecard(scorecard);

  const lessonsTouched = [...newLessons, ...priorLessons].slice(0, 10);

  const result = {
    observedAt: observation.observedAt,
    observation,
    world,
    hypotheses,
    opportunities,
    executed,
    experimentsTouched,
    attributions,
    lessons: lessonsTouched,
    scorecard,
    unitEconomics,
    forecast,
    calibration,
    strategy,
    anomalies,
    ambition,
    moneyPlan,
    shortfall,
    regime,
    metaPolicy,
    curriculum,
    hourPlan,
    reportText: "",
  };
  result.reportText = formatCycleReport(context.displayName, result);
  return result;
}
