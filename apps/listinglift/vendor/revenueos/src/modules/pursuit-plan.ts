import type { SiteAdapter } from "../adapters/types";
import { buildWorldModel } from "../models";
import { ensurePortableMemory } from "../memory/portable";
import { SEED_LESSONS, type SeedLesson } from "../ledger/seed";
import {
  generateOpportunities,
  opportunitiesToHypotheses,
} from "./strategy";
import { buildCalibration } from "../intelligence/calibration";
import { banditStatsFromExperiments } from "../intelligence/bandit";
import { buildShortfallReport } from "../intelligence/shortfall";
import { curriculumBoost } from "../intelligence/decision";
import { buildCurriculum } from "../intelligence/curriculum";
import { buildAmbition } from "./ambition";
import { buildUnitEconomics } from "./economics";
import { sizeConcurrentBets } from "../intelligence/kelly";
import { buildMetaPolicy } from "../intelligence/meta";
import { detectRegime } from "../intelligence/regime";
import {
  applyGovernorToOpportunities,
  governorPublishGate,
  scoreDiscoveryDoor,
  applyDoorScore,
  dueDiscoveryWindows,
} from "./discovery-governor";
import {
  applyOrganicMasteryPressure,
  scoreOrganicMastery,
} from "./organic-mastery";
import {
  applyProfitPressure,
  buildProfitMandate,
} from "./profit-maximizer";
import { demoteUnavailableSafeActions } from "./capability-gaps";
import { filterAutonomousActions } from "../policy";
import {
  drainPursuits,
  enqueuePursuitsFromOpportunities,
  type DrainResult,
} from "./pursuit-engine";
import {
  applyFirstCustomerPressure,
  evaluateFirstCustomerMode,
} from "./first-customer-mode";
import { filterTransferableLessons } from "../memory/similarity";
import { newId } from "../ledger/store";
import type {
  FirstCustomerMode,
  Lesson,
  Observation,
  Opportunity,
  PursuitJob,
} from "../types";

async function bootstrapSiteMemory(adapter: SiteAdapter) {
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
  for (const seed of [...SEED_LESSONS, ...adapterSeeds]) {
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
  await ensurePortableMemory({
    store,
    siteId: context.siteId,
    industry: context.industry,
  });
}

export type PlanAndEnqueueResult = {
  observation: Observation;
  opportunities: Opportunity[];
  enqueued: PursuitJob[];
  enqueuedCount: number;
  concurrentSlots: number;
  firstCustomerMode: FirstCustomerMode;
  replenishedEmptyQueue: boolean;
};

/**
 * Observe → rank → enqueue durable pursuits. Does not execute actions.
 * Production workers call this then drainPursuits.
 */
export async function planAndEnqueuePursuits(
  adapter: SiteAdapter,
  opts: { maxEnqueue?: number; now?: Date } = {},
): Promise<PlanAndEnqueueResult> {
  const now = opts.now ?? new Date();
  const store = adapter.getExperimentStore();
  await bootstrapSiteMemory(adapter);
  const context = await adapter.getContext();

  const observation = await adapter.observe();
  const signals = adapter.getMarketSignals
    ? await adapter.getMarketSignals()
    : undefined;
  const experiments = await store.listExperiments(context.siteId);
  const rawLessons = await store.listLessons({
    siteId: context.siteId,
    industry: context.industry,
  });
  const priorLessons = filterTransferableLessons({
    lessons: rawLessons,
    target: {
      industry: context.industry,
      siteId: context.siteId,
      ...(context.commercial ?? {}),
    },
  });
  const firstCustomerMode = evaluateFirstCustomerMode(observation);
  const priorScorecards = await store.listScorecards(context.siteId, 28);
  const attributions = await store.listAttributions(context.siteId);
  const calibration = buildCalibration(experiments, attributions);
  const banditStats = banditStatsFromExperiments(experiments);
  const world = buildWorldModel({
    context,
    observation,
    signals,
    banditStats,
  });
  const unitEconomics = buildUnitEconomics(context, observation, world);
  const shortfall = buildShortfallReport({ observation, world });
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
  ambition.concurrentBets = sizeConcurrentBets({
    ambition,
    meta: metaPolicy,
    banditStats,
  });

  const siteExtras = adapter.listSiteOpportunities
    ? await adapter.listSiteOpportunities({ observation })
    : [];
  let opportunities = generateOpportunities({
    context,
    world,
    observation,
    lessons: priorLessons,
    siteExtras,
    calibration,
    banditStats,
    now: now.getTime(),
    shortfall,
  });
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

  let discoveryDoors = adapter.listDiscoveryDoors
    ? await adapter.listDiscoveryDoors()
    : store.listDiscoveryDoors
      ? await store.listDiscoveryDoors(context.siteId)
      : [];
  if (adapter.measureDiscoveryDoor && discoveryDoors.length) {
    const scored: typeof discoveryDoors = [];
    for (const door of discoveryDoors) {
      let next = door;
      for (const windowDays of dueDiscoveryWindows(door, now)) {
        const metrics = await adapter.measureDiscoveryDoor(door);
        const score = scoreDiscoveryDoor({
          door: next,
          metrics,
          windowDays,
          now,
        });
        next = applyDoorScore(next, score);
      }
      if (next !== door && store.saveDiscoveryDoor) {
        await store.saveDiscoveryDoor(next);
      }
      scored.push(next);
    }
    discoveryDoors = scored;
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
  const organicMastery = scoreOrganicMastery({
    observation,
    world,
    doors: discoveryDoors,
  });
  opportunities = applyOrganicMasteryPressure({
    opportunities,
    mastery: organicMastery,
  });
  const profitMandate = buildProfitMandate({
    observation,
    world,
    shortfall,
  });
  opportunities = applyProfitPressure({
    opportunities,
    mandate: profitMandate,
    observation,
  });

  const availableActions = filterAutonomousActions(await adapter.listSafeActions());
  const availableTypes = new Set(availableActions.map((a) => a.type));
  opportunities = demoteUnavailableSafeActions(opportunities, availableTypes);
  opportunities = applyFirstCustomerPressure({
    opportunities,
    mode: firstCustomerMode,
    observation,
  });

  const hypotheses = opportunitiesToHypotheses(opportunities);
  const existing = store.listPursuits
    ? await store.listPursuits(context.siteId)
    : [];
  const openExisting = existing.filter(
    (job) => !["DONE", "FAILED"].includes(job.state),
  );
  // Empty queue is NOT job complete — replenish when below objective.
  const belowObjective =
    observation.money.estimatedProfitUsd < 10_000 ||
    observation.money.purchases === 0;
  const replenishedEmptyQueue = openExisting.length === 0 && belowObjective;

  const enqueued = enqueuePursuitsFromOpportunities({
    siteId: context.siteId,
    opportunities,
    hypotheses,
    existing,
    maxEnqueue:
      opts.maxEnqueue ??
      Math.max(
        replenishedEmptyQueue ? 10 : 8,
        ambition.concurrentBets * 2,
      ),
    now,
  });

  for (const job of enqueued) {
    if (store.savePursuit) await store.savePursuit(job);
    if (store.appendPursuitEvent) {
      await store.appendPursuitEvent({
        id: newId("pevt"),
        pursuitId: job.id,
        siteId: job.siteId,
        eventType: "enqueued",
        detail: {
          title: job.title,
          actionType: job.actionType,
          firstCustomerMode: firstCustomerMode.active,
          replenish: replenishedEmptyQueue,
        },
        createdAt: now.toISOString(),
      });
    }
  }

  return {
    observation,
    opportunities,
    enqueued,
    enqueuedCount: enqueued.length,
    concurrentSlots: ambition.concurrentBets,
    firstCustomerMode,
    replenishedEmptyQueue,
  };
}

/**
 * Full pursuit tick: plan/enqueue then drain under budget.
 * Prefer this from cron workers instead of N× runCycle.
 */
export async function runPursuitTick(
  adapter: SiteAdapter,
  opts: {
    budgetMs?: number;
    maxJobs?: number;
    maxEnqueue?: number;
    skipEnqueue?: boolean;
    now?: Date;
  } = {},
): Promise<{
  plan: PlanAndEnqueueResult;
  drain: DrainResult;
}> {
  let plan: PlanAndEnqueueResult;
  if (opts.skipEnqueue) {
    const observation = await adapter.observe();
    plan = {
      observation,
      opportunities: [],
      enqueued: [],
      enqueuedCount: 0,
      concurrentSlots: 4,
      firstCustomerMode: evaluateFirstCustomerMode(observation),
      replenishedEmptyQueue: false,
    };
  } else {
    plan = await planAndEnqueuePursuits(adapter, {
      maxEnqueue: opts.maxEnqueue,
      now: opts.now,
    });
  }

  const drain = await drainPursuits({
    adapter,
    store: adapter.getExperimentStore(),
    observation: plan.observation,
    budgetMs: opts.budgetMs,
    maxJobs: opts.maxJobs,
    maxConcurrentExecutions: plan.concurrentSlots,
    now: opts.now,
  });

  return { plan, drain };
}
