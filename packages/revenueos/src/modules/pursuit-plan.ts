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
  releaseFastCycleWaiting,
  type DrainResult,
} from "./pursuit-engine";
import {
  applyFirstCustomerPressure,
  evaluateFirstCustomerMode,
} from "./first-customer-mode";
import {
  detectExecutionStagnation,
  executedActionTypesFromEvents,
  fingerprintsFromEvents,
  mutateOpportunitiesAfterStagnation,
  type StagnationVerdict,
} from "./stagnation";
import {
  applyPatternGate,
  buildPatternPosteriors,
  computePatternGate,
  type PatternGate,
  type PatternPosteriorMap,
} from "./pattern-posterior";
import { proposeLlmStrategies } from "./llm-strategist";
import { enforceMechanismDiversity } from "./mechanism-diversity";
import {
  applyExplorationFloor,
  type ExplorationFloorReport,
} from "./exploration-floor";
import {
  applyRevenuePriority,
  EMPTY_PORTFOLIO_SIGNAL,
  type PortfolioSignal,
} from "./revenue-priority";
import {
  applyMechanismBandit,
  buildMechanismArms,
  sampleMechanismRanking,
  type MechanismSample,
} from "./mechanism-bandit";
import { proposeConversionExperiments } from "./conversion-lab";
import { proposeUnlocksForBannedMechanisms } from "./concrete-escalations";
import {
  evaluateBusinessSuspension,
  type SuspensionVerdict,
} from "./business-suspension";
import { filterTransferableLessons } from "../memory/similarity";
import { newId } from "../ledger/store";
import {
  discoverChannels,
  shouldRunChannelDiscovery,
} from "./channel-discovery";
import {
  loadChannels,
  runChannelRegistryTick,
  type ChannelArm,
} from "./channel-registry";
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
  stagnation?: StagnationVerdict;
  patternPosteriors?: PatternPosteriorMap;
  patternGate?: PatternGate;
  suspension?: SuspensionVerdict;
  mechanismsExhausted?: boolean;
  mechanismBandit?: {
    ranking: Array<{ mechanism: string; sample: number }>;
    best: string | null;
  };
  unlockProposals?: ReturnType<typeof proposeUnlocksForBannedMechanisms>;
  /** Portfolio insight sentence returned by the LLM strategist this cycle. */
  llmInsight?: string;
  /** Channel Registry allocation for this cycle. */
  channelAllocation?: {
    channelCount: number;
    discovered: number;
    ranking: Array<{ platform: string; score: number; revenuePerAction: number }>;
  };
  /**
   * Exploration-floor invariants applied this cycle (A/B/C/E). Present so
   * cron routes can prove the floor fired instead of the planner silently
   * skipping it.
   */
  explorationFloor?: {
    forcedChannelDiscover: boolean;
    forcedBuyerDiscovery: boolean;
    forcedExternal: boolean;
    cappedActionTypes: string[];
    externalMechanismInTopN: string | null;
    buyerLeadCount: number;
    activeChannelCount: number;
    topN: number;
  };
};

/**
 * Observe → rank → enqueue durable pursuits. Does not execute actions.
 * Production workers call this then drainPursuits.
 */
export async function planAndEnqueuePursuits(
  adapter: SiteAdapter,
  opts: {
    maxEnqueue?: number;
    now?: Date;
    /**
     * Cross-portfolio commercial signal aggregated from OTHER sites — the
     * revenue-priority scorer uses this to transfer proven mechanisms.
     */
    portfolioSignal?: PortfolioSignal;
  } = {},
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

  // Suspension: owner-blocked businesses do not consume experimentation budget.
  const suspension = evaluateBusinessSuspension({ context });

  // Stagnation: identical zero-result cycles must mutate strategy, not repeat.
  // Look back far enough to reach the ATTEMPT budget under fast-cycle timing.
  const recentEvents = store.listPursuitEvents
    ? await store.listPursuitEvents(context.siteId, {
        since: new Date(now.getTime() - 12 * 3_600_000).toISOString(),
        limit: 500,
      })
    : [];

  // Pattern posteriors: any pattern that has attempted PATTERN_ATTEMPT_BUDGET
  // times with zero verified_exposure/intent/commercial signal is BANNED and
  // cannot be re-enqueued. This is a law, not a preference.
  const patternPosteriors = buildPatternPosteriors({
    events: recentEvents,
    observation,
    now,
  });
  const patternGate = computePatternGate(patternPosteriors);

  // Channel Discovery + Registry — the acquisition decision layer.
  // discover/update → score by revenue_per_action → pick next_action.
  // Hardcoded "post every business to Reddit every hour" is forbidden;
  // Thompson sampling allocates effort by attributable profit per hour.
  let channelAllocation: PlanAndEnqueueResult["channelAllocation"];
  let channelArms: ChannelArm[] = [];
  try {
    const existingChannels = await loadChannels(store, context.siteId);
    const pausedRatio =
      existingChannels.length === 0
        ? 0
        : existingChannels.filter((c) => c.status === "paused").length /
          existingChannels.length;
    const lastDiscoveryAt = existingChannels
      .map((c) => c.updatedAt)
      .sort()
      .at(-1);
    let candidates: Awaited<ReturnType<typeof discoverChannels>>["candidates"] =
      [];
    let discovered = 0;
    if (
      shouldRunChannelDiscovery({
        channelCount: existingChannels.length,
        lastDiscoveryAt,
        pausedRatio,
        now,
      })
    ) {
      const discovery = await discoverChannels({
        context,
        maxCandidates: 8,
      });
      candidates = discovery.candidates;
      discovered = candidates.length;
    }
    const registry = await runChannelRegistryTick({
      store,
      context,
      candidates,
      events: recentEvents.map((e) => ({
        eventType: e.eventType,
        detail: e.detail,
        createdAt: e.createdAt,
      })),
      portfolioSignal: opts.portfolioSignal,
      persist: true,
    });
    channelArms = registry.arms;
    if (registry.opportunities.length > 0) {
      opportunities = [...opportunities, ...registry.opportunities].sort(
        (a, b) => b.score - a.score,
      );
    }
    channelAllocation = {
      channelCount: registry.channels.length,
      discovered,
      ranking: channelArms.slice(0, 6).map((a) => ({
        platform: a.channel.platform,
        score: a.score,
        revenuePerAction: a.channel.revenuePerAction,
      })),
    };
    // Stagnation across a channel family: paused channels already dropped from
    // next_action; force discovery opportunity when most arms are dry.
    if (pausedRatio >= 0.5 || (channelArms.length > 0 && channelArms.every((a) => a.channel.revenuePerAction <= 0 && a.channel.experimentsRun >= 3))) {
      opportunities.unshift({
        id: `channel-discover-${context.siteId}-${dayKey}`,
        title: "Channel discovery: find higher-yield surfaces",
        metric: "landing_views",
        category: "acquisition",
        action:
          "Prior channel families produced no commercial signal — discover alternative zero-cost surfaces specific to this business (no spam repeats).",
        expectedImpact: 8,
        confidence: 0.55,
        effort: 2,
        score: 95,
        safeActionType: "channel_discover",
        patternKey: `channel:discover:${context.siteId}`,
        precursorMetric: "landing_views",
      });
    }
  } catch {
    // Registry path is best-effort; static + LLM paths still run.
  }

  // LLM strategist — propose new acquisition hypotheses grounded in the
  // current state, pattern posteriors, and pattern gate. Guarded so a network
  // hiccup can never break the planner: on any failure we fall back to the
  // static catalog. Injected BEFORE the pattern gate so the gate uniformly
  // filters both static and LLM-proposed opportunities.
  let llmInsight: string | undefined;
  try {
    const llmStrategy = await proposeLlmStrategies({
      context,
      observation,
      bannedMechanisms: patternGate.bannedMechanisms,
      bannedPatterns: patternGate.bannedPatterns,
      patternPosteriors,
      portfolioSignal: opts.portfolioSignal,
      now,
    });
    if (llmStrategy.opportunities.length > 0) {
      opportunities = [...opportunities, ...llmStrategy.opportunities].sort(
        (a, b) => b.score - a.score,
      );
    }
    llmInsight = llmStrategy.portfolioInsight;
  } catch {
    // LLM path is best-effort; the deterministic path still runs.
  }

  if (patternGate.bannedPatterns.size > 0) {
    opportunities = applyPatternGate({ opportunities, gate: patternGate });
  }

  // Revenue-priority scoring: rank by evidence of contribution to revenue.
  // Own commercial > own intent > own verified_exposure > portfolio commercial
  // transfer > everything else. Production activity earns ZERO boost. This is
  // the single most important line separating "activity" from "pursuit".
  opportunities = applyRevenuePriority({
    opportunities,
    ownPosteriors: patternPosteriors,
    portfolioSignal: opts.portfolioSignal ?? EMPTY_PORTFOLIO_SIGNAL,
    bannedMechanisms: patternGate.bannedMechanisms,
  });

  // Conversion Lab: once verified traffic exists but no purchases, publishing
  // more content is strictly wrong. Inject offer/CTA/urgency/guarantee tests.
  const conversionOpps = proposeConversionExperiments({ observation });
  if (conversionOpps.length > 0) {
    // Reuse the existing governor scoring by treating conv opps as scored
    // opportunities with high base score to jump ahead.
    for (const co of conversionOpps) {
      opportunities.push({ ...co, score: 100 });
    }
    opportunities.sort((a, b) => b.score - a.score);
  }

  // CRITICAL: LLM / channel registry / conversion-lab inject AFTER the first
  // demote. Re-demote so we never enqueue Adapter-missing pursuits.
  opportunities = demoteUnavailableSafeActions(opportunities, availableTypes);

  // Thompson-sampling mechanism bandit — makes each cycle GENUINELY different
  // by sampling from a posterior over mechanism classes, so we don't keep
  // running the same ordering every hour.
  const arms = buildMechanismArms({
    ownPosteriors: patternPosteriors,
    portfolioSignal: opts.portfolioSignal,
    bannedMechanisms: patternGate.bannedMechanisms,
  });
  const banditSample = sampleMechanismRanking({ arms });
  opportunities = applyMechanismBandit({
    opportunities,
    sample: banditSample,
  });

  // Force mechanism diversity — a failed mechanism family cannot be replaced by
  // another opportunity from the same family.
  opportunities = enforceMechanismDiversity({
    opportunities,
    bannedMechanisms: patternGate.bannedMechanisms,
    maxPerMechanism: 3,
  });

  const priorFingerprints = fingerprintsFromEvents(recentEvents, {
    purchases: observation.money.purchases,
    revenueUsd: observation.money.revenueUsd,
    landingViews: observation.funnel.landingViews,
    checkouts: observation.funnel.checkouts,
    stage: firstCustomerMode.stage,
  });
  const currentFingerprint = priorFingerprints[priorFingerprints.length - 1] ?? {
    hash: "none",
    actionTypes: executedActionTypesFromEvents(recentEvents),
    purchases: observation.money.purchases,
    revenueUsd: observation.money.revenueUsd,
    landingViews: observation.funnel.landingViews,
    checkouts: observation.funnel.checkouts,
    stage: firstCustomerMode.stage,
    at: now.toISOString(),
  };
  const stagnation = detectExecutionStagnation({
    prior: priorFingerprints.slice(0, -1),
    current: currentFingerprint,
  });
  if (stagnation.stagnant) {
    opportunities = mutateOpportunitiesAfterStagnation({
      opportunities,
      killActionTypes: stagnation.killActionTypes,
    });
  }

  // Exploration floor — HARD invariants the planner MUST honor per cycle.
  //   A. external-mechanism floor (FCM w/ 0 purchases → ≥1 external in top-N)
  //   B. channel-registry cold-start floor (<5 channels → force channel_discover)
  //   C. FCM buyer-lead floor (0 leads in FCM → force buyer_discovery)
  //   E. per-cycle same-action cap (no action type >2× per cycle)
  //
  // These land LAST (right before enqueue) so no downstream re-score can
  // re-drown the top-N in publish_* loops. `topN` mirrors the enqueue slice
  // computed below and matches `maxEnqueue` used by
  // `enqueuePursuitsFromOpportunities`.
  const belowObjectiveForFloor =
    observation.money.estimatedProfitUsd < 10_000 ||
    observation.money.purchases === 0;
  const floorTopN =
    opts.maxEnqueue ??
    Math.max(belowObjectiveForFloor ? 14 : 8, ambition.concurrentBets * 2);
  const buyerLeadCount =
    typeof adapter.getBuyerLeadCount === "function"
      ? await adapter.getBuyerLeadCount().catch(() => 0)
      : 0;
  const activeChannelCount = channelArms.length
    ? channelArms.filter((a) => a.channel.status !== "paused").length
    : 0;
  const floorReport: ExplorationFloorReport = applyExplorationFloor({
    opportunities,
    firstCustomerModeActive: firstCustomerMode.active,
    purchases: observation.money.purchases,
    buyerLeadCount,
    activeChannelCount,
    recentEvents,
    siteId: context.siteId,
    topN: floorTopN,
    now,
  });
  opportunities = floorReport.opportunities;

  // Final demote after exploration floor injections — never enqueue unexecutable types.
  opportunities = demoteUnavailableSafeActions(opportunities, availableTypes);

  const hypotheses = opportunitiesToHypotheses(opportunities);
  let existing = store.listPursuits
    ? await store.listPursuits(context.siteId)
    : [];

  // Stagnation: close repeated zero-result pursuits so mutated bets can enqueue.
  if (stagnation.stagnant && stagnation.killActionTypes.length && store.savePursuit) {
    const killed = new Set(stagnation.killActionTypes);
    const iso = now.toISOString();
    existing = await Promise.all(
      existing.map(async (job) => {
        if (
          job.actionType &&
          killed.has(job.actionType) &&
          !["DONE", "FAILED"].includes(job.state)
        ) {
          const next = {
            ...job,
            state: "DONE" as const,
            workSummary: `${job.workSummary ?? "Executed"} · closed by stagnation detector`,
            updatedAt: iso,
            leaseOwner: null,
            leaseUntil: null,
          };
          await store.savePursuit!(next);
          return next;
        }
        return job;
      }),
    );
  }

  const openExisting = existing.filter(
    (job) => !["DONE", "FAILED"].includes(job.state),
  );
  const executableOpen = openExisting.filter((job) =>
    ["DISCOVER", "QUALIFY", "EXECUTE", "REPLENISH"].includes(job.state),
  );
  // Below objective with no executable work = failure mode. Replenish even if
  // other pursuits are WAITING_FOR_EVIDENCE — money work never idles 24/7.
  const belowObjective =
    observation.money.estimatedProfitUsd < 10_000 ||
    observation.money.purchases === 0;
  const replenishedEmptyQueue =
    belowObjective && executableOpen.length === 0;

  // Waiting fast-cycle jobs were blocking re-enqueue (same idempotency keys).
  // Release them so the operator keeps creating buyer exposure 24/7.
  if (replenishedEmptyQueue) {
    const released = releaseFastCycleWaiting(existing, now);
    for (let i = 0; i < released.length; i++) {
      if (released[i] !== existing[i] && store.savePursuit) {
        await store.savePursuit(released[i]!);
      }
    }
    existing = released;
  }

  // Suspended businesses do not enqueue any new autonomous work — their owner
  // blocker makes further production actions waste. The scheduler still ticks
  // to close waiting jobs and honor stagnation cleanup.
  const enqueued = suspension.suspended
    ? []
    : enqueuePursuitsFromOpportunities({
        siteId: context.siteId,
        opportunities,
        hypotheses,
        existing,
        // Same slice size the exploration floor computed against — otherwise
        // the floor might promote an external mechanism at position N-1 and
        // this call would still slice it off.
        maxEnqueue: floorTopN,
        now,
      });

  // Escalate: if we have opportunities but none survive the pattern gate +
  // mechanism cap, autonomous acquisition on this site is exhausted. Instead
  // of a soft "keep trying," emit a concrete list of provider unlocks with
  // specific costs and expected revenue impact.
  const mechanismsExhausted =
    !suspension.suspended &&
    enqueued.length === 0 &&
    opportunities.length === 0 &&
    patternGate.bannedPatterns.size > 0 &&
    store.appendPursuitEvent !== undefined;
  let unlockProposals:
    | ReturnType<typeof proposeUnlocksForBannedMechanisms>
    | undefined;
  if (mechanismsExhausted) {
    unlockProposals = proposeUnlocksForBannedMechanisms({
      bannedMechanisms: patternGate.bannedMechanisms,
      siteId: context.siteId,
      observation: {
        landingViews: observation.funnel.landingViews,
        purchases: observation.money.purchases,
      },
    });
    if (store.appendPursuitEvent) {
      await store.appendPursuitEvent({
        id: newId("pevt"),
        pursuitId: "mechanisms-exhausted",
        siteId: context.siteId,
        eventType: "failed",
        detail: {
          reason: "permissionless_reach_exhausted",
          bannedPatterns: [...patternGate.bannedPatterns],
          bannedMechanisms: [...patternGate.bannedMechanisms],
          proposedUnlocks: unlockProposals.map((u) => ({
            mechanism: u.mechanism,
            desiredAction: u.desiredAction,
            expectedValueUsd: u.expectedValueUsd,
            providers: u.providers.map((p) => ({
              name: p.name,
              costPerMonthUsd: p.costPerMonthUsd,
              setupTime: p.setupTime,
            })),
          })),
        },
        createdAt: now.toISOString(),
      });
    }
  }

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
          patternKey: job.patternKey,
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
    stagnation,
    patternPosteriors,
    patternGate,
    suspension,
    mechanismsExhausted,
    mechanismBandit: {
      ranking: banditSample.ranking.map((r) => ({
        mechanism: r.mechanism,
        sample: Number(r.sample.toFixed(3)),
      })),
      best: banditSample.best,
    },
    unlockProposals,
    llmInsight,
    channelAllocation,
    explorationFloor: {
      forcedChannelDiscover: floorReport.forcedChannelDiscover,
      forcedBuyerDiscovery: floorReport.forcedBuyerDiscovery,
      forcedExternal: floorReport.forcedExternal,
      cappedActionTypes: floorReport.cappedActionTypes,
      externalMechanismInTopN: floorReport.externalMechanismInTopN,
      buyerLeadCount,
      activeChannelCount,
      topN: floorTopN,
    },
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
    /** Cross-portfolio commercial signal from other sites — transfer boost. */
    portfolioSignal?: PortfolioSignal;
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
      stagnation: undefined,
      patternPosteriors: undefined,
      patternGate: undefined,
      suspension: undefined,
    };
  } else {
    plan = await planAndEnqueuePursuits(adapter, {
      maxEnqueue: opts.maxEnqueue,
      now: opts.now,
      portfolioSignal: opts.portfolioSignal,
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
