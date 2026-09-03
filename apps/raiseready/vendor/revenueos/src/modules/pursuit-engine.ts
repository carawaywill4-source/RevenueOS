import type { SiteAdapter } from "../adapters/types";
import { newId, type ExperimentStore } from "../ledger/store";
import { getRegistryEntry, exposureKeyForAction, exposureVersion } from "./action-registry";
import { createProposedExperiment } from "./experimentation";
import {
  attributeExperiment,
  dueForAttribution,
  lessonFromAttribution,
} from "./attribution";
import { precursorValueFromObservation } from "./strategy";
import { persistPortableLesson } from "../memory/portable";
import { filterAutonomousActions, policyAllows } from "../policy";
import type {
  Hypothesis,
  Observation,
  Opportunity,
  OwnerReportSummary,
  PursuitEvent,
  PursuitJob,
  PursuitKind,
  SafeAction,
} from "../types";

const EXECUTION_STATES = new Set(["DISCOVER", "QUALIFY", "EXECUTE", "REPLENISH"]);

/** High-frequency organic actions must re-fire often — never sit 7 days idle. */
export const FAST_CYCLE_ACTIONS = new Set([
  "indexnow_submit",
  "sitemap_ping",
  "ping_search_engines",
  "distribute_owned_urls",
  "publish_programmatic_door",
  "publish_free_resource",
  "publish_lead_magnet",
  "publish_howto_cluster",
  "publish_comparison_page",
  "publish_intent_page",
  "discovery_attack",
  "refresh_discovery_door",
  "publish_llms_txt",
  "market_research",
  "feature_product",
]);

/** Close measuring fast-cycle jobs so 24/7 replenish can enqueue fresh work. */
export function releaseFastCycleWaiting(jobs: PursuitJob[], now: Date): PursuitJob[] {
  const iso = now.toISOString();
  return jobs.map((job) => {
    if (
      job.state === "WAITING_FOR_EVIDENCE" &&
      job.actionType &&
      FAST_CYCLE_ACTIONS.has(job.actionType)
    ) {
      return {
        ...job,
        state: "DONE" as const,
        workSummary: `${job.workSummary ?? "Executed"} · released for 24/7 replenish`,
        updatedAt: iso,
        leaseOwner: null,
        leaseUntil: null,
      };
    }
    return job;
  });
}

export function pursuitIdempotencyKey(
  opportunity: Opportunity,
  now: Date = new Date(),
): string {
  const base = [
    opportunity.safeActionType ?? "advisory",
    opportunity.patternKey ?? opportunity.id,
    opportunity.id,
  ].join(":");
  // 10-minute bucket so permissionless work re-fires all day — prior waves
  // can keep measuring without blocking the next money attempt.
  if (
    opportunity.safeActionType &&
    FAST_CYCLE_ACTIONS.has(opportunity.safeActionType)
  ) {
    const bucket = Math.floor(now.getTime() / (10 * 60_000));
    return `${base}:${bucket}`;
  }
  return base;
}

function measureWaitMs(actionType: string | undefined): number {
  if (actionType && FAST_CYCLE_ACTIONS.has(actionType)) {
    return 45 * 60_000; // 45 minutes — keep cycling for revenue
  }
  return 7 * 86_400_000;
}

export function kindForOpportunity(opportunity: Opportunity): PursuitKind {
  if (
    opportunity.safeActionType?.includes("discovery") ||
    opportunity.safeActionType === "publish_intent_page" ||
    opportunity.safeActionType === "market_research" ||
    opportunity.safeActionType === "sitemap_ping"
  ) {
    return "discovery_door";
  }
  if (opportunity.category === "conversion" || opportunity.category === "pricing") {
    return "conversion";
  }
  if (opportunity.category === "operations") return "ops";
  return "organic_revenue";
}

function cooldownNotBefore(actionType: string | undefined, now: Date): string | null {
  if (!actionType) return null;
  const minutes = getRegistryEntry(actionType)?.cooldownMinutes ?? 0;
  if (minutes <= 0) return null;
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function enqueuePursuitsFromOpportunities(input: {
  siteId: string;
  opportunities: Opportunity[];
  hypotheses: Hypothesis[];
  existing: PursuitJob[];
  maxEnqueue?: number;
  now?: Date;
}): PursuitJob[] {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const maxEnqueue = input.maxEnqueue ?? 12;
  const existingKeys = new Set(
    input.existing
      .filter((job) => !["DONE", "FAILED"].includes(job.state))
      .map((job) => job.idempotencyKey),
  );
  const hypByOpp = new Map<string, Hypothesis>();
  for (const hypothesis of input.hypotheses) {
    hypByOpp.set(hypothesis.id, hypothesis);
    if (hypothesis.id.startsWith("hyp_")) {
      hypByOpp.set(hypothesis.id.slice(4), hypothesis);
    }
  }
  const created: PursuitJob[] = [];

  for (const opportunity of input.opportunities) {
    if (created.length >= maxEnqueue) break;
    if (!opportunity.safeActionType) continue;
    const key = pursuitIdempotencyKey(opportunity, now);
    if (existingKeys.has(key)) continue;

    const hypothesis: Hypothesis =
      hypByOpp.get(opportunity.id) ??
      ({
        id: opportunity.id,
        title: opportunity.title,
        metric: opportunity.metric,
        predictedDelta: `+$${opportunity.predicted?.expectedProfitUsd ?? 0}/mo`,
        confidence: opportunity.confidence,
        effort: opportunity.effort,
        expectedImpact: opportunity.expectedImpact,
        action: opportunity.action,
        safeActionType: opportunity.safeActionType,
        constraintsChecked: ["policy"],
        category: opportunity.category,
        precursorMetric: opportunity.precursorMetric,
        patternKey: opportunity.patternKey,
      } satisfies Hypothesis);

    const job: PursuitJob = {
      id: newId("pursuit"),
      siteId: input.siteId,
      state: "EXECUTE",
      kind: kindForOpportunity(opportunity),
      patternKey: opportunity.patternKey,
      actionType: opportunity.safeActionType,
      priority: opportunity.score,
      effort: opportunity.effort,
      opportunityId: opportunity.id,
      idempotencyKey: key,
      attempts: 0,
      maxAttempts: 3,
      title: opportunity.title,
      action: opportunity.action,
      workSummary: `Pursue: ${opportunity.title}`,
      hypothesis,
      predicted: opportunity.predicted,
      notBefore: null,
      createdAt: iso,
      updatedAt: iso,
    };
    created.push(job);
    existingKeys.add(key);
  }
  return created;
}

async function recordEvent(
  store: ExperimentStore,
  job: PursuitJob,
  eventType: PursuitEvent["eventType"],
  detail: Record<string, unknown> = {},
) {
  if (!store.appendPursuitEvent) return;
  const event: PursuitEvent = {
    id: newId("pevt"),
    pursuitId: job.id,
    siteId: job.siteId,
    eventType,
    detail,
    createdAt: new Date().toISOString(),
  };
  await store.appendPursuitEvent(event);
}

export async function advancePursuit(input: {
  job: PursuitJob;
  adapter: SiteAdapter;
  store: ExperimentStore;
  observation: Observation;
  now?: Date;
}): Promise<PursuitJob> {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  let job = { ...input.job, updatedAt: iso };
  const { adapter, store, observation } = input;

  if (
    job.notBefore &&
    Date.parse(job.notBefore) > now.getTime() &&
    job.state !== "WAITING_FOR_EVIDENCE"
  ) {
    return job;
  }

  if (job.state === "DISCOVER" || job.state === "QUALIFY") {
    job = { ...job, state: "EXECUTE", updatedAt: iso };
  }

  if (job.state === "EXECUTE") {
    job = { ...job, attempts: job.attempts + 1 };
    if (!job.actionType) {
      job = {
        ...job,
        state: "FAILED",
        lastError: "No executable actionType",
        leaseOwner: null,
        leaseUntil: null,
      };
      await store.savePursuit?.(job);
      await recordEvent(store, job, "failed", { reason: job.lastError });
      return job;
    }

    const available = filterAutonomousActions(await adapter.listSafeActions());
    const match = available.find((action) => action.type === job.actionType);
    if (!match) {
      job = {
        ...job,
        state: "FAILED",
        lastError: `Adapter missing ${job.actionType}`,
        leaseOwner: null,
        leaseUntil: null,
      };
      await store.savePursuit?.(job);
      await recordEvent(store, job, "failed", { reason: job.lastError });
      return job;
    }

    const action: SafeAction = {
      ...match,
      payload: {
        ...(match.payload ?? {}),
        pursuitId: job.id,
        ...(job.experimentId ? { experimentId: job.experimentId } : {}),
        ...(job.opportunityId ? { opportunityId: job.opportunityId } : {}),
      },
    };
    const allowed = policyAllows(action, {
      maxRisk: "safe",
      dailyCapUsd: (await adapter.getContext()).autonomousDailyCapUsd,
    });
    if (!allowed.ok) {
      job = {
        ...job,
        state: "FAILED",
        lastError: allowed.reason ?? "policy blocked",
        leaseOwner: null,
        leaseUntil: null,
      };
      await store.savePursuit?.(job);
      await recordEvent(store, job, "failed", { reason: job.lastError });
      return job;
    }

    let experiment = job.experimentId
      ? await store.getExperiment(job.experimentId)
      : null;
    if (!experiment && job.hypothesis) {
      experiment = createProposedExperiment(
        job.siteId,
        job.hypothesis,
        observation,
        now,
      );
      await store.saveExperiment(experiment);
      job = { ...job, experimentId: experiment.id };
    }

    const result = await adapter.execute(action);
    const { classifyExecutionActionClass } = await import("./action-class");
    await recordEvent(store, job, "executed", {
      ok: result.ok,
      detail: result.detail,
      actionType: action.type,
      patternKey: job.patternKey,
      actionClass: classifyExecutionActionClass(action.type),
    });

    if (store.saveExposure) {
      await store.saveExposure({
        id: newId("exp"),
        siteId: job.siteId,
        experimentId: experiment?.id,
        actionType: action.type,
        exposureKey: exposureKeyForAction(action),
        version: exposureVersion(now),
        startedAt: iso,
        endedAt: iso,
        metadata: action.payload
          ? (Object.fromEntries(
              Object.entries(action.payload).filter(
                ([, value]) =>
                  typeof value === "string" ||
                  typeof value === "number" ||
                  typeof value === "boolean",
              ),
            ) as Record<string, string | number | boolean>)
          : undefined,
      });
    }

    // Durable action cooldown so the next sibling of this type waits.
    const coolUntil = cooldownNotBefore(action.type, now);
    if (coolUntil && store.claimLease) {
      await store.claimLease({
        id: `cooldown:${job.siteId}:${action.type}`,
        siteId: job.siteId,
        kind: "action_cooldown",
        leaseUntil: coolUntil,
      });
    }

    if (experiment) {
      experiment = {
        ...experiment,
        status: result.ok ? "running" : "blocked",
        actions: [
          ...experiment.actions,
          { type: action.type, at: iso, result },
        ],
        updatedAt: iso,
      };
      await store.saveExperiment(experiment);
    }

    if (!result.ok) {
      if (job.attempts >= job.maxAttempts) {
        job = {
          ...job,
          state: "FAILED",
          lastError: result.detail,
          leaseOwner: null,
          leaseUntil: null,
        };
      } else {
        job = {
          ...job,
          state: "EXECUTE",
          lastError: result.detail,
          notBefore: new Date(now.getTime() + 5 * 60_000).toISOString(),
          leaseOwner: null,
          leaseUntil: null,
        };
      }
      await store.savePursuit?.(job);
      return job;
    }

    const waitMs = measureWaitMs(action.type);
    const waitUntil =
      waitMs <= 60 * 60_000
        ? new Date(now.getTime() + waitMs).toISOString()
        : (experiment?.measurement?.scheduledCheckAt ??
          new Date(now.getTime() + waitMs).toISOString());
    job = {
      ...job,
      state: "WAITING_FOR_EVIDENCE",
      notBefore: waitUntil,
      workSummary: `Executed ${action.type}; measuring until ${waitUntil.slice(0, 16)}`,
      leaseOwner: null,
      leaseUntil: null,
    };
    await store.savePursuit?.(job);
    await recordEvent(store, job, "wait", { until: waitUntil });
    return job;
  }

  if (job.state === "WAITING_FOR_EVIDENCE") {
    if (job.notBefore && Date.parse(job.notBefore) > now.getTime()) {
      return { ...job, leaseOwner: null, leaseUntil: null };
    }
    job = { ...job, state: "ATTRIBUTE", leaseOwner: null, leaseUntil: null };
  }

  if (job.state === "ATTRIBUTE") {
    const experiment = job.experimentId
      ? await store.getExperiment(job.experimentId)
      : null;
    if (!experiment || !dueForAttribution(experiment, now.getTime())) {
      // No experiment to attribute — complete the pursuit.
      job = {
        ...job,
        state: "LEARN",
        workSummary: job.workSummary ?? "No experiment to attribute",
      };
    } else {
      const metric = experiment.measurement!.metric;
      const current =
        (adapter.getMeasurement
          ? await adapter.getMeasurement(metric)
          : null) ?? precursorValueFromObservation(metric, observation);
      const { attribution, experiment: updated } = attributeExperiment(
        experiment,
        current ?? 0,
        now,
      );
      await store.saveExperiment(updated);
      await store.saveAttribution(attribution);
      const context = await adapter.getContext();
      const lesson = lessonFromAttribution({
        experiment: updated,
        attribution,
        industry: context.industry,
        now,
      });
      await persistPortableLesson(store, {
        lesson,
        siteId: job.siteId,
        industry: context.industry,
        now,
      });
      await recordEvent(store, job, "attributed", {
        verdict: attribution.verdict,
        experimentId: experiment.id,
      });
      job = {
        ...job,
        state: "LEARN",
        workSummary: `Attributed ${attribution.verdict}: ${experiment.hypothesis.title}`,
      };
    }
  }

  if (job.state === "LEARN") {
    await recordEvent(store, job, "learned", {});
    job = { ...job, state: "REPLENISH" };
  }

  if (job.state === "REPLENISH") {
    await recordEvent(store, job, "replenished", {});
    job = {
      ...job,
      state: "DONE",
      leaseOwner: null,
      leaseUntil: null,
      workSummary: job.workSummary ?? "Pursuit complete",
    };
    await store.savePursuit?.(job);
    await recordEvent(store, job, "done", {});
    return job;
  }

  await store.savePursuit?.(job);
  return job;
}

export type DrainResult = {
  claimed: number;
  advanced: number;
  executed: number;
  stillWaiting: number;
  claimableRemaining: number;
  jobs: PursuitJob[];
};

/**
 * Work-conserving drain: claim and advance pursuits under a time/job budget.
 * WAITING_FOR_EVIDENCE jobs do not consume execution slots for other types.
 */
export async function drainPursuits(input: {
  adapter: SiteAdapter;
  store: ExperimentStore;
  observation: Observation;
  budgetMs?: number;
  maxJobs?: number;
  maxConcurrentExecutions?: number;
  owner?: string;
  leaseMs?: number;
  now?: Date;
}): Promise<DrainResult> {
  const now = input.now ?? new Date();
  const budgetMs = input.budgetMs ?? 45_000;
  const maxJobs = input.maxJobs ?? 8;
  const maxExec = input.maxConcurrentExecutions ?? 6;
  const owner = input.owner ?? newId("worker");
  const leaseMs = input.leaseMs ?? 55_000;
  const started = Date.now();

  if (!input.store.claimPursuits || !input.store.savePursuit) {
    return {
      claimed: 0,
      advanced: 0,
      executed: 0,
      stillWaiting: 0,
      claimableRemaining: 0,
      jobs: [],
    };
  }

  const waiting = (await input.store.listPursuits?.(input.adapter.id, {
    states: ["WAITING_FOR_EVIDENCE"],
  })) ?? [];
  const waitingActionTypes = waiting
    .filter((job) => job.notBefore && Date.parse(job.notBefore) > now.getTime())
    .map((job) => job.actionType)
    .filter((type): type is string => Boolean(type));

  // Prefer filling execution capacity; still claim due WAITING jobs for attribute.
  const claimed = await input.store.claimPursuits({
    siteId: input.adapter.id,
    limit: maxJobs,
    owner,
    leaseMs,
    now,
    excludeActionTypes: [],
  });

  let advanced = 0;
  let executed = 0;
  const results: PursuitJob[] = [];
  let execSlots = maxExec;

  for (const job of claimed) {
    if (Date.now() - started > budgetMs) break;
    const isExec = EXECUTION_STATES.has(job.state);
    if (isExec && execSlots <= 0) {
      // Release lease by clearing and saving
      const released = {
        ...job,
        leaseOwner: null,
        leaseUntil: null,
      };
      await input.store.savePursuit(released);
      continue;
    }
    // Skip independent EXECUTE if same actionType already waiting (optional soft)
    if (
      job.state === "EXECUTE" &&
      job.actionType &&
      waitingActionTypes.includes(job.actionType) &&
      job.notBefore &&
      Date.parse(job.notBefore) > now.getTime()
    ) {
      const released = { ...job, leaseOwner: null, leaseUntil: null };
      await input.store.savePursuit(released);
      continue;
    }

    await recordEvent(input.store, job, "claimed", { owner });
    const next = await advancePursuit({
      job,
      adapter: input.adapter,
      store: input.store,
      observation: input.observation,
      now,
    });
    advanced += 1;
    if (isExec) execSlots -= 1;
    if (next.state === "WAITING_FOR_EVIDENCE" || next.workSummary?.includes("Executed")) {
      executed += 1;
    }
    results.push(next);
  }

  const remaining =
    (await input.store.listPursuits?.(input.adapter.id, {
      states: ["DISCOVER", "QUALIFY", "EXECUTE", "ATTRIBUTE", "LEARN", "REPLENISH"],
    })) ?? [];
  const dueWaiting =
    (await input.store.listPursuits?.(input.adapter.id, {
      states: ["WAITING_FOR_EVIDENCE"],
    })) ?? [];

  return {
    claimed: claimed.length,
    advanced,
    executed,
    stillWaiting: dueWaiting.filter(
      (job) => job.notBefore && Date.parse(job.notBefore) > now.getTime(),
    ).length,
    claimableRemaining: remaining.length +
      dueWaiting.filter(
        (job) => !job.notBefore || Date.parse(job.notBefore) <= now.getTime(),
      ).length,
    jobs: results,
  };
}

export function buildOwnerReportSummary(input: {
  siteId: string;
  windowStart: string;
  windowEnd: string;
  events: PursuitEvent[];
  pursuits: PursuitJob[];
  hourRevenueUsd: number;
  hourPurchases: number;
  hourLandingViews: number;
  hourCheckouts?: number;
  hadExecutableCapacity: boolean;
  firstCustomerMode?: boolean;
  firstCustomerStage?: string;
  effortNext?: string[];
}): OwnerReportSummary {
  const events = input.events;
  const actionsAttempted = events.filter((e) => e.eventType === "claimed").length;
  const actionsCompleted = events.filter(
    (e) => e.eventType === "executed" && e.detail.ok === true,
  ).length;
  const experimentsLaunched = events.filter((e) => e.eventType === "wait").length;
  const attributionsClosed = events.filter((e) => e.eventType === "attributed").length;
  const lessonsLearned = events.filter((e) => e.eventType === "learned").length;
  const failed = events.filter((e) => e.eventType === "failed").length;

  const active = input.pursuits.filter((j) =>
    ["DISCOVER", "QUALIFY", "EXECUTE", "ATTRIBUTE", "LEARN", "REPLENISH"].includes(
      j.state,
    ),
  );
  const waiting = input.pursuits.filter((j) => j.state === "WAITING_FOR_EVIDENCE");
  const claimable = [
    ...active,
    ...waiting.filter((j) => !j.notBefore || Date.parse(j.notBefore) <= Date.now()),
  ];

  const workLines = events
    .filter((e) =>
      ["executed", "wait", "attributed", "failed", "enqueued"].includes(e.eventType),
    )
    .slice(0, 12)
    .map((e) => {
      const detail =
        typeof e.detail.detail === "string"
          ? e.detail.detail
          : typeof e.detail.actionType === "string"
            ? e.detail.actionType
            : e.eventType;
      return `${e.eventType}: ${detail}`;
    });

  const distributionLines = events
    .filter(
      (e) =>
        e.eventType === "executed" &&
        typeof e.detail.actionType === "string" &&
        [
          "publish_intent_page",
          "discovery_attack",
          "indexnow_submit",
          "sitemap_ping",
          "feature_product",
          "publish_bundle",
        ].includes(String(e.detail.actionType)),
    )
    .slice(0, 10)
    .map((e) => `${e.detail.actionType}: ${e.detail.detail ?? "ok"}`);

  const audiencesPursued = [
    ...new Set(
      input.pursuits
        .map((j) => j.persona || j.channel || j.patternKey || j.title)
        .filter(Boolean),
    ),
  ].slice(0, 8) as string[];

  const learningChanges = events
    .filter((e) => e.eventType === "attributed" || e.eventType === "learned")
    .slice(0, 8)
    .map((e) => {
      const verdict =
        typeof e.detail.verdict === "string" ? e.detail.verdict : e.eventType;
      return `${verdict}: pursuit ${e.pursuitId}`;
    });

  const nextQueue = claimable
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8)
    .map((j) => `${j.state} · ${j.title}`);

  const ownerAsks = input.pursuits
    .filter((j) => j.state === "FAILED" && j.lastError)
    .slice(0, 6)
    .map((j) => `${j.title}: ${j.lastError}`);

  const idle =
    actionsCompleted === 0 &&
    experimentsLaunched === 0 &&
    attributionsClosed === 0 &&
    distributionLines.length === 0;
  const operationalFailure =
    input.hourPurchases <= 0 && input.hadExecutableCapacity && idle;

  return {
    siteId: input.siteId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    actionsAttempted,
    actionsCompleted,
    experimentsLaunched,
    experimentsStillMeasuring: waiting.length,
    attributionsClosed,
    lessonsLearned,
    doorsKilled: 0,
    doorsExpanded: 0,
    activePursuits: active.length,
    waitingForEvidence: waiting.length,
    blockedOrFailed: failed,
    claimableBacklog: claimable.length,
    workLines,
    ownerAsks,
    nextQueue,
    audiencesPursued,
    distributionLines,
    learningChanges,
    effortNext: input.effortNext ?? nextQueue.slice(0, 3),
    firstCustomerMode: Boolean(input.firstCustomerMode),
    firstCustomerStage: input.firstCustomerStage,
    hourCheckouts: input.hourCheckouts ?? 0,
    operationalFailure,
    operationalFailureReason: operationalFailure
      ? "Zero sales this hour and RevenueOS only watched statistics — operator failure."
      : undefined,
    hourRevenueUsd: input.hourRevenueUsd,
    hourPurchases: input.hourPurchases,
    hourLandingViews: input.hourLandingViews,
  };
}

export function formatOwnerReport(summary: OwnerReportSummary): string {
  const lines = [
    `OWNER REPORT — ${summary.siteId}`,
    `Window: ${summary.windowStart.slice(0, 16)} → ${summary.windowEnd.slice(0, 16)} UTC`,
    summary.firstCustomerMode
      ? `Mode: FIRST_CUSTOMER (${summary.firstCustomerStage ?? "buyer_exposure"})`
      : "Mode: evidence-driven optimization",
    "",
    "WHAT REVENUEOS DID (not woke-and-decided)",
    `• Actions attempted: ${summary.actionsAttempted}`,
    `• Actions completed: ${summary.actionsCompleted}`,
    `• Experiments launched: ${summary.experimentsLaunched}`,
    `• Still measuring: ${summary.experimentsStillMeasuring}`,
    `• Attributions closed: ${summary.attributionsClosed}`,
    `• Lessons learned: ${summary.lessonsLearned}`,
    "",
    "BUYERS / AUDIENCES PURSUED",
    ...(summary.audiencesPursued.length
      ? summary.audiencesPursued.map((a) => `• ${a}`)
      : ["• (none logged this hour — failure if FIRST_CUSTOMER)"]),
    "",
    "PUBLISHED / DISTRIBUTED / TESTED",
    ...(summary.distributionLines.length
      ? summary.distributionLines.map((a) => `• ${a}`)
      : ["• (no distribution actions completed)"]),
    "",
    "FUNNEL THIS HOUR",
    `• Landing views: ${summary.hourLandingViews}`,
    `• Checkouts: ${summary.hourCheckouts}`,
    `• Purchases: ${summary.hourPurchases}`,
    `• Revenue: $${summary.hourRevenueUsd.toFixed(2)}`,
    "",
    "WHAT CHANGED BECAUSE OF LEARNING",
    ...(summary.learningChanges.length
      ? summary.learningChanges.map((a) => `• ${a}`)
      : ["• (no attribution closed this hour)"]),
    "",
    "ACTIVE WORK",
    `• Active pursuits: ${summary.activePursuits}`,
    `• Waiting for evidence: ${summary.waitingForEvidence}`,
    `• Claimable backlog: ${summary.claimableBacklog}`,
    `• Blocked/failed: ${summary.blockedOrFailed}`,
  ];
  if (summary.workLines.length) {
    lines.push("", "WORK LOG");
    for (const line of summary.workLines) lines.push(`• ${line}`);
  }
  if (summary.effortNext.length) {
    lines.push("", "PORTFOLIO EFFORT NEXT");
    for (const item of summary.effortNext) lines.push(`• ${item}`);
  }
  if (summary.nextQueue.length) {
    lines.push("", "NEXT PURSUIT QUEUE");
    for (const item of summary.nextQueue) lines.push(`• ${item}`);
  }
  if (summary.ownerAsks.length) {
    lines.push("", "OWNER ACTIONS REQUIRED (credentials/money/legal only)");
    for (const ask of summary.ownerAsks) lines.push(`• ${ask}`);
  }
  if (summary.operationalFailure) {
    lines.push("", `OPERATIONAL FAILURE: ${summary.operationalFailureReason}`);
  }
  return lines.join("\n");
}
