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
import {
  buildShortfallReport,
  lessonFromShortfall,
} from "./intelligence/shortfall";
import { detectRegime } from "./intelligence/regime";
import { buildMetaPolicy } from "./intelligence/meta";
import { buildCurriculum } from "./intelligence/curriculum";
import { sizeConcurrentBets } from "./intelligence/kelly";
import { buildHourPlan, lessonFromHour } from "./intelligence/hour";
import {
  checkPlannerQuota,
  fingerprintPlannerInput,
  validatePlannerSelection,
} from "./intelligence/planner-quota";
import {
  exposureKeyForAction,
  exposureVersion,
  getRegistryEntry,
} from "./modules/action-registry";
import {
  applyDoorScore,
  applyGovernorToOpportunities,
  decisionsFromScoredDoors,
  dueDiscoveryWindows,
  governorPublishGate,
  lessonFromGovernorDecision,
  scoreDiscoveryDoor,
} from "./modules/discovery-governor";
import { recordGapsFromOpportunities } from "./modules/capability-gaps";
import {
  applyProfitPressure,
  buildProfitMandate,
  moneyPlanFundsAction,
  selectProfitBets,
  shouldHeartbeatAction,
  type ProfitMandate,
} from "./modules/profit-maximizer";
import {
  applyOrganicMasteryPressure,
  lessonFromOrganicMastery,
  organicMasteryCurriculumNote,
  scoreOrganicMastery,
  type OrganicMasteryReport,
} from "./modules/organic-mastery";
import {
  ensurePortableMemory,
  persistPortableLesson,
  type LessonDraft,
} from "./memory/portable";
import { filterAutonomousActions, policyAllows } from "./policy";
import { buildScorecard, formatCycleReport } from "./scorecard";
import { SEED_LESSONS, type SeedLesson } from "./ledger/seed";
import { newId } from "./ledger/store";
import type {
  ActionResult,
  Attribution,
  CapabilityGap,
  DiscoveryDoor,
  Experiment,
  GovernorDecision,
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

  // Promote prior site-scoped transferable lessons → industry/global so a newly
  // attached business inherits the brain's learning instead of starting over.
  await ensurePortableMemory({
    store,
    siteId: context.siteId,
    industry: context.industry,
  });
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
    const saved = await persistPortableLesson(store, {
      lesson,
      siteId: context.siteId,
      industry: context.industry,
      now,
    });
    newLessons.push(saved);
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

  // Discovery governor: score doors, kill losers, gate over-publishing.
  let discoveryDoors: DiscoveryDoor[] = adapter.listDiscoveryDoors
    ? await adapter.listDiscoveryDoors()
    : store.listDiscoveryDoors
      ? await store.listDiscoveryDoors(context.siteId)
      : [];
  const doorsBefore = discoveryDoors.map((d) => ({ ...d }));
  const governorDecisions: GovernorDecision[] = [];
  if (adapter.measureDiscoveryDoor) {
    const scoredDoors: DiscoveryDoor[] = [];
    for (const door of discoveryDoors) {
      let next = door;
      for (const windowDays of dueDiscoveryWindows(door, now)) {
        const metrics = await adapter.measureDiscoveryDoor(door);
        const score = scoreDiscoveryDoor({ door: next, metrics, windowDays, now });
        next = applyDoorScore(next, score);
      }
      if (next !== door && store.saveDiscoveryDoor) {
        await store.saveDiscoveryDoor(next);
      }
      if (
        next.status === "killed" &&
        door.status !== "killed" &&
        adapter.retireDiscoveryDoor
      ) {
        await adapter.retireDiscoveryDoor(next.id, next.killReason ?? "governor_kill");
      }
      scoredDoors.push(next);
    }
    discoveryDoors = scoredDoors;
    for (const decision of decisionsFromScoredDoors(doorsBefore, discoveryDoors)) {
      governorDecisions.push(decision);
      const lesson = lessonFromGovernorDecision({
        siteId: context.siteId,
        industry: context.industry,
        decision,
        now,
      });
      const saved = await persistPortableLesson(store, {
        lesson,
        siteId: context.siteId,
        industry: context.industry,
        now,
      });
      newLessons.push(saved);
    }
  }

  const dayKey = now.toISOString().slice(0, 10);
  const publishesToday = discoveryDoors.filter(
    (d) => d.publishedAt.slice(0, 10) === dayKey,
  ).length;
  const publishGate = governorPublishGate({
    doors: discoveryDoors,
    publishesToday,
    now,
  });
  opportunities = applyGovernorToOpportunities(
    opportunities,
    discoveryDoors,
    publishGate.allowPublish,
  );

  // Organic mastery era: sole business manager. Master organic leads→sales
  // before ads. Okay/decent is failure.
  const organicMastery: OrganicMasteryReport = scoreOrganicMastery({
    observation,
    world,
    doors: discoveryDoors,
  });
  opportunities = applyOrganicMasteryPressure({
    opportunities,
    mastery: organicMastery,
  });

  // Profit maximizer: every ranking and heartbeat serves contribution profit
  // toward a $10k day — traffic/topics are instruments, never the scoreboard.
  const profitMandate: ProfitMandate = buildProfitMandate({
    observation,
    world,
    shortfall,
  });
  opportunities = applyProfitPressure({
    opportunities,
    mandate: profitMandate,
    observation,
  });

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

  const availableActions = filterAutonomousActions(await adapter.listSafeActions());
  let plannerDecision;
  let plannerPolicyRejected = false;
  let plannerPolicyReason: string | undefined;
  if (adapter.planDecision) {
    const priorPlannerRuns = store.listPlannerRuns
      ? await store.listPlannerRuns(context.siteId)
      : [];
    const quota = checkPlannerQuota(priorPlannerRuns, now);
    if (!quota.allowed) {
      plannerDecision = {
        source: "deterministic" as const,
        rationale: "Planner quota exhausted; deterministic ranking retained.",
        evidence: [],
        selectedOpportunityIds: [],
        rejectedOpportunityIds: [],
        falsifier: "Planner quota resets at UTC midnight.",
        fallbackReason: quota.reason,
      };
    } else {
      try {
        const proposed = await adapter.planDecision({
          observation,
          opportunities,
          safeActions: availableActions,
          shortfall,
          moneyPlan,
          profitMandate,
          organicMastery,
        });
        const validated = validatePlannerSelection(
          proposed,
          opportunities,
          availableActions,
        );
        plannerPolicyRejected = validated.policyRejected;
        plannerPolicyReason = validated.policyReason;
        const decision = validated.decision;
        const known = new Set(opportunities.map((opportunity) => opportunity.id));
        const selected = decision.selectedOpportunityIds.filter((id) => known.has(id));
        if (selected.length) {
          const selectedSet = new Set(selected);
          opportunities = [
            ...selected.map((id) => opportunities.find((opportunity) => opportunity.id === id)!),
            ...opportunities.filter((opportunity) => !selectedSet.has(opportunity.id)),
          ];
        }
        plannerDecision = { ...decision, selectedOpportunityIds: selected };
      } catch (error) {
        plannerDecision = {
          source: "deterministic" as const,
          rationale: "Planner unavailable; retained deterministic ranking.",
          evidence: [],
          selectedOpportunityIds: [],
          rejectedOpportunityIds: [],
          falsifier: "A successful validated planner run.",
          fallbackReason: (error as Error).message,
        };
      }
    }
    if (store.savePlannerRun && plannerDecision) {
      await store.savePlannerRun({
        id: newId("planner"),
        siteId: context.siteId,
        createdAt: now.toISOString(),
        source: plannerDecision.source,
        decision: plannerDecision,
        inputFingerprint: fingerprintPlannerInput({
          observation,
          opportunities,
          safeActions: availableActions,
        }),
        policyRejected: plannerPolicyRejected,
        policyReason: plannerPolicyReason,
      });
    }
  }

  const existingGaps = store.listCapabilityGaps
    ? await store.listCapabilityGaps(context.siteId)
    : [];
  const declaredUnavailable = [
    ...(adapter.listUnavailableCapabilities
      ? await adapter.listUnavailableCapabilities()
      : []),
  ];
  // Ads stay an explicit gap until organic mastery unlocks them.
  if (organicMastery.adsReadiness !== "ready") {
    declaredUnavailable.push({
      capability: "paid_ads",
      reason: `Organic mastery ${organicMastery.level} (${organicMastery.score}/100) — ads locked until organic leads→sales is a weapon. ${organicMasteryCurriculumNote(organicMastery)}`,
    });
  }
  const capabilityGapsTouched = recordGapsFromOpportunities({
    siteId: context.siteId,
    opportunities,
    safeActions: availableActions,
    existingGaps,
    declaredUnavailable,
    now,
  });
  if (store.saveCapabilityGap) {
    for (const gap of capabilityGapsTouched) {
      await store.saveCapabilityGap(gap);
    }
  }
  const capabilityGaps: CapabilityGap[] = store.listCapabilityGaps
    ? await store.listCapabilityGaps(context.siteId)
    : capabilityGapsTouched;

  const hypotheses = opportunitiesToHypotheses(opportunities);
  const strategy = buildStrategy(opportunities, world);

  const hourPlan = buildHourPlan({
    observation,
    world,
    opportunities,
    history: priorScorecards,
  });
  const hourLesson = await persistPortableLesson(store, {
    lesson: lessonFromHour({
      siteId: context.siteId,
      industry: context.industry,
      hourPlan,
      now,
    }),
    siteId: context.siteId,
    industry: context.industry,
    now,
  });
  newLessons.push(hourLesson);

  // Persist success/failure truth — portable so the next business inherits it.
  const profitLesson = await persistPortableLesson(store, {
    siteId: context.siteId,
    industry: context.industry,
    now,
    lesson: {
      patternKey: `profit-mandate:${profitMandate.focus}`,
      summary: `${profitMandate.successDeclaration} Focus=${profitMandate.focus}. ${profitMandate.why}`,
      evidenceCount: 1,
      transferable: true,
      sentiment: shortfall.dayVerdict === "won_day" ? "positive" : "negative",
      rankingWeight:
        shortfall.dayVerdict === "won_day"
          ? 1.5
          : 1 + Math.min(0.6, profitMandate.failurePressure * 0.15),
    } satisfies LessonDraft,
  });
  newLessons.push(profitLesson);

  const organicLesson = await persistPortableLesson(store, {
    lesson: lessonFromOrganicMastery({
      siteId: context.siteId,
      industry: context.industry,
      mastery: organicMastery,
      now,
    }),
    siteId: context.siteId,
    industry: context.industry,
    now,
  });
  newLessons.push(organicLesson);

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
  // Fund bets from the money plan first — highest $/effort toward $10k/day.
  const selectedBets = selectProfitBets({
    ranked,
    moneyPlan,
    concurrentBets: Math.max(1, ambition.concurrentBets),
    opportunitiesById,
  });
  // An adapter exposes one concrete action per type. Do not manufacture several
  // simultaneous experiments that would all claim the same execution.
  const seenActionTypes = new Set<string>();
  const bets = selectedBets.filter((bet) => {
    if (!bet.safeActionType) return true;
    if (seenActionTypes.has(bet.safeActionType)) return false;
    seenActionTypes.add(bet.safeActionType);
    return true;
  });
  for (const bet of bets) {
    if (bet.safeActionType) {
      const experiment = createProposedExperiment(
        context.siteId,
        bet,
        observation,
        now,
      );
      experiment.predicted = opportunitiesById.get(
        bet.id.replace(/^hyp_/, ""),
      )?.predicted;
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

  // 6. Act — profit-gated heartbeats + money-plan / bet-selected actions only.
  const executed: Array<{ action: SafeAction; result: ActionResult }> = [];
  const available = availableActions;
  const betActionTypes = new Set(
    bets.map((bet) => bet.safeActionType).filter((t): t is string => Boolean(t)),
  );
  let dailySpend = 0;

  for (const action of available) {
    const gate = policyAllows(action, {
      maxRisk: "safe",
      dailySpendUsd: dailySpend,
      dailyCapUsd: context.autonomousDailyCapUsd,
    });
    if (!gate.ok) continue;

    const selected = betActionTypes.has(action.type);
    const funded = moneyPlanFundsAction(moneyPlan, opportunities, action.type);
    const heartbeat = shouldHeartbeatAction(action.type, profitMandate, {
      betSelected: selected,
      moneyPlanFunds: funded,
    });
    if (!heartbeat && !selected && !funded) continue;

    // Won day + broad discovery: IndexNow is optional, not a vanity ritual.
    if (
      action.type === "indexnow_submit" &&
      shortfall.dayVerdict === "won_day" &&
      !selected &&
      !funded &&
      world.market.discoveryCoverage === "broad"
    ) {
      continue;
    }

    // Empty funnel under acquisition focus: skip merch theater.
    const hourViews = observation.hourPulse?.landingViews ?? 0;
    if (
      action.type === "merch_optimize" &&
      profitMandate.focus === "acquisition" &&
      hourViews < 15 &&
      observation.money.purchases === 0 &&
      !selected
    ) {
      continue;
    }

    // Governor: do not mint more intent pages while overdue doors are unscored
    // or daily/active caps are hit.
    if (
      !publishGate.allowPublish &&
      (action.type === "publish_intent_page" || action.type === "discovery_attack")
    ) {
      continue;
    }

    const linked = experimentsTouched.find(
      (exp) =>
        exp.status === "proposed" && exp.hypothesis.safeActionType === action.type,
    );
    const scopedAction: SafeAction = linked
      ? {
          ...action,
          payload: {
            ...action.payload,
            experimentId: linked.id,
            patternKey: linked.hypothesis.patternKey ?? "",
          },
        }
      : action;
    const result = await adapter.execute(scopedAction);
    executed.push({ action: scopedAction, result });
    dailySpend += result.costUsd ?? 0;

    if (result.ok && store.saveExposure) {
      const registry = getRegistryEntry(scopedAction.type);
      const key = result.exposureKey ?? exposureKeyForAction(scopedAction);
      const version = result.exposureVersion ?? exposureVersion();
      await store.saveExposure({
        id: newId("exposure"),
        siteId: context.siteId,
        experimentId:
          typeof scopedAction.payload?.experimentId === "string"
            ? scopedAction.payload.experimentId
            : linked?.id,
        actionType: scopedAction.type,
        exposureKey: key,
        version,
        startedAt: new Date().toISOString(),
        metadata: registry?.rollbackActionType
          ? { rollbackActionType: registry.rollbackActionType }
          : undefined,
      });
    }

    if (linked) {
      linked.actions.push({
        type: scopedAction.type,
        payload: scopedAction.payload,
        result,
        at: new Date().toISOString(),
      });
      linked.status = result.ok ? "running" : "blocked";
      if (!result.ok) linked.actualOutcome = `Action failed: ${result.detail}`;
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
    `ORGANIC ${organicMastery.level.toUpperCase()} (${organicMastery.score}/100, ads ${organicMastery.adsReadiness}). ` +
    `PROFIT MANDATE [${profitMandate.focus}]: ${profitMandate.order} ` +
    `${hourPlan.overdrive ? "ZERO HOUR overdrive. " : ""}` +
    `${shortfall.dayVerdict === "lost_day" ? "Lost day vs $10k north star. " : "North-star day cleared. "}` +
    `Shortfall $${profitMandate.shortfallUsd.toFixed(0)}. ` +
    (governorDecisions.length
      ? `Governor: ${governorDecisions.map((d) => d.verdict).join(", ")}. `
      : "") +
    (!publishGate.allowPublish ? `Publish gated (${publishGate.reason}). ` : "") +
    (capabilityGapsTouched.length
      ? `${capabilityGapsTouched.length} capability gap(s) updated. `
      : "") +
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
    profitMandate,
    organicMastery: {
      level: organicMastery.level,
      score: organicMastery.score,
      mission: organicMastery.mission,
      adsReadiness: organicMastery.adsReadiness,
      drills: organicMastery.drills,
      gaps: organicMastery.gaps,
      verdict: organicMastery.verdict,
    },
    plannerDecision,
    governorDecisions,
    capabilityGaps: capabilityGaps.slice(0, 20),
    publishAllowed: publishGate.allowPublish,
    reportText: "",
  };
  result.reportText = formatCycleReport(context.displayName, result);
  if (store.saveCycleReport) {
    await store.saveCycleReport({
      id: newId("cycle_report"),
      siteId: context.siteId,
      createdAt: now.toISOString(),
      observedAt: observation.observedAt,
      reportText: result.reportText,
      plannerSource: plannerDecision?.source,
      executedCount: executed.filter((item) => item.result.ok).length,
    });
  }
  return result;
}
