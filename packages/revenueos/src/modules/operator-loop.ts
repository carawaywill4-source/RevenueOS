/**
 * Persistent operator loop.
 *
 * The serverless form fragments the brain into 60-second cron bursts and
 * hourly latency. The persistent operator form runs the same pursuit tick
 * back-to-back inside a supervised process — the brain stays in one place,
 * only the scheduler changes.
 *
 * This module is intentionally thin: it wraps `runPursuitTick` from
 * `./pursuit-plan` with a supervised loop, structured logging, per-business
 * rate limits, and a portfolio-shared bandwidth budget. It never
 * re-implements planning or selection — those live in the modules the
 * planner/selection worker owns.
 */

import type { SiteAdapter } from "../adapters/types";
import { runApexCycle } from "../apex/cycle";
import { inferRiskClass } from "../apex/governor";
import type { ApexCycleResult } from "../apex/types";
import { newId } from "../ledger/store";
import { runNexusCycle } from "../nexus/organism";
import type { NexusCycleResult } from "../nexus/organism";
import { filterAutonomousActions } from "../policy";
import { runTitanCycle } from "../titan/executive-loop";
import type { TitanCycleResult } from "../titan/types";
import type { Opportunity, PursuitJob } from "../types";
import {
  drainPursuits,
  enqueuePursuitsFromOpportunities,
  type DrainResult,
} from "./pursuit-engine";
import { runPursuitTick } from "./pursuit-plan";
import type { PortfolioSignal } from "./revenue-priority";
import type { PlanAndEnqueueResult } from "./pursuit-plan";

/**
 * APEX previously authorized actions (e.g. distribute_owned_urls) but never
 * fed the pursuit queue — plan/drain ran before APEX, and NEXUS only logged
 * apex.action.proposed. Bridge R0/R1 authorized limbs into durable pursuits
 * and drain them in the same tick (deterministic; no paid AI).
 */
async function enqueueAndDrainAuthorizedApexAction(input: {
  adapter: SiteAdapter;
  apex: ApexCycleResult;
  observation: PlanAndEnqueueResult["observation"];
  skipEnqueue?: boolean;
  logger: OperatorLoopLogger;
}): Promise<{ jobs: PursuitJob[]; drain: DrainResult | null }> {
  const empty = { jobs: [] as PursuitJob[], drain: null as DrainResult | null };
  if (input.skipEnqueue) return empty;
  const decision = input.apex.decision;
  if (!decision?.authorized || !decision.selected_action) return empty;

  const risk = decision.risk_class ?? inferRiskClass(decision.selected_action);
  // Only auto-bridge owned/safe classes. R2+ already need separate policy paths.
  if (risk !== "R0" && risk !== "R1") {
    input.logger("info", "apex.authorize.skip_bridge", {
      businessId: input.adapter.id,
      action: decision.selected_action,
      risk,
      reason: "risk_class_not_auto_bridged",
    });
    return empty;
  }

  const available = filterAutonomousActions(await input.adapter.listSafeActions());
  if (!available.some((a) => a.type === decision.selected_action)) {
    input.logger("warn", "apex.authorize.skip_bridge", {
      businessId: input.adapter.id,
      action: decision.selected_action,
      reason: "adapter_missing_safe_action",
    });
    return empty;
  }

  const store = input.adapter.getExperimentStore();
  if (!store.savePursuit || !store.claimPursuits) return empty;

  const existing =
    (await store.listPursuits?.(input.adapter.id, {
      states: [
        "DISCOVER",
        "QUALIFY",
        "EXECUTE",
        "WAITING_FOR_EVIDENCE",
        "ATTRIBUTE",
        "LEARN",
        "REPLENISH",
      ],
    })) ?? [];

  const now = new Date();
  const opportunity: Opportunity = {
    id: `apex-${decision.selected_action}`,
    title: `APEX authorized: ${decision.selected_action}`,
    metric: "qualified visits",
    category: "acquisition",
    action: decision.why_this_action || decision.selected_action,
    expectedImpact: 8,
    confidence: decision.confidence ?? 0.5,
    effort: 1,
    score: 99,
    safeActionType: decision.selected_action,
    patternKey: `apex-authorized:${decision.selected_action}`,
  };

  const created = enqueuePursuitsFromOpportunities({
    siteId: input.adapter.id,
    opportunities: [opportunity],
    hypotheses: [],
    existing,
    maxEnqueue: 1,
    now,
  });

  for (const job of created) {
    await store.savePursuit(job);
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
          source: "apex_authorized_bridge",
          apexDecisionId: decision.decision_id,
          apexTraceId: decision.trace_id,
        },
        createdAt: now.toISOString(),
      });
    }
  }

  if (created.length === 0) {
    input.logger("info", "apex.authorize.bridge_noop", {
      businessId: input.adapter.id,
      action: decision.selected_action,
      reason: "idempotent_or_already_queued",
    });
    return empty;
  }

  const drain = await drainPursuits({
    adapter: input.adapter,
    store,
    observation: input.observation,
    budgetMs: 60_000,
    maxJobs: 4,
    maxConcurrentExecutions: 2,
    now,
  });

  input.logger("info", "apex.authorize.bridged", {
    businessId: input.adapter.id,
    action: decision.selected_action,
    enqueued: created.length,
    executed: drain.executed,
    claimed: drain.claimed,
  });

  return { jobs: created, drain };
}

function mergeDrain(a: DrainResult, b: DrainResult | null): DrainResult {
  if (!b) return a;
  return {
    claimed: a.claimed + b.claimed,
    advanced: a.advanced + b.advanced,
    executed: a.executed + b.executed,
    stillWaiting: b.stillWaiting,
    claimableRemaining: b.claimableRemaining,
    jobs: [...a.jobs, ...b.jobs],
  };
}

export type OperatorLoopLogger = (
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>,
) => void;

const defaultLogger: OperatorLoopLogger = (level, event, fields) => {
  const line = {
    at: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const target = level === "error" ? console.error : console.log;
  try {
    target(JSON.stringify(line));
  } catch {
    target(`[operator] ${level} ${event}`);
  }
};

export type OperatorTickResult = {
  ok: boolean;
  businessId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  plan: PlanAndEnqueueResult;
  drain: DrainResult;
  /** APEX acquisition intelligence for this tick (optional if cycle errors). */
  apex?: ApexCycleResult;
  /** TITAN executive truth / recommendation (Phase 1 — no high-impact execution). */
  titan?: TitanCycleResult;
  /** NEXUS coordination / governance for this tick. */
  nexus?: NexusCycleResult;
  errorMessage?: string;
};

export type OperatorLoopOptions = {
  businessId: string;
  /** When true, run exactly one tick and return. */
  once?: boolean;
  /** Adapter factory — the operator service supplies a Supabase-backed adapter. */
  createAdapter: (input: { businessId: string }) => Promise<SiteAdapter> | SiteAdapter;
  /** Portfolio signal aggregated across sites for revenue-priority transfer. */
  portfolioSignal?: PortfolioSignal;
  /**
   * Milliseconds to spend inside a single pursuit tick. Persistent operators
   * can afford larger budgets than serverless (no 60s ceiling).
   */
  tickBudgetMs?: number;
  /** Max jobs drained per tick. */
  maxJobsPerTick?: number;
  /** Max opportunities enqueued per tick. */
  maxEnqueuePerTick?: number;
  /** Idle sleep between ticks when nothing executable happened. */
  idleSleepMs?: number;
  /** Busy sleep between ticks when the last tick did work. */
  busySleepMs?: number;
  /** Optional AbortSignal for graceful shutdown. */
  signal?: AbortSignal;
  /** Structured logger. Defaults to JSON on stdout. */
  logger?: OperatorLoopLogger;
  /** Called with the result of every tick — used for status endpoints. */
  onTick?: (result: OperatorTickResult) => void;
};

async function sleepInterruptible(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    signal?.addEventListener("abort", onAbort);
  });
}

function tickDidWork(result: OperatorTickResult): boolean {
  return (
    (result.drain?.executed ?? 0) > 0 ||
    (result.plan?.enqueuedCount ?? 0) > 0 ||
    (result.drain?.claimableRemaining ?? 0) > 0
  );
}

/**
 * Run one pursuit tick against a business. Never re-implements the brain —
 * this is a thin wrapper around runPursuitTick with structured logging.
 */
export async function runOperatorTick(input: {
  businessId: string;
  adapter: SiteAdapter;
  portfolioSignal?: PortfolioSignal;
  tickBudgetMs?: number;
  maxJobsPerTick?: number;
  maxEnqueuePerTick?: number;
  /** Observe only — do not enqueue or drain durable pursuits. */
  skipEnqueue?: boolean;
  logger?: OperatorLoopLogger;
}): Promise<OperatorTickResult> {
  const log = input.logger ?? defaultLogger;
  const startedAt = new Date();
  try {
    log("info", "operator.tick.start", {
      businessId: input.businessId,
      skipEnqueue: input.skipEnqueue === true,
    });
    let { plan, drain } = await runPursuitTick(input.adapter, {
      budgetMs: input.tickBudgetMs ?? 180_000,
      maxJobs: input.skipEnqueue ? 0 : (input.maxJobsPerTick ?? 24),
      maxEnqueue: input.maxEnqueuePerTick,
      skipEnqueue: input.skipEnqueue,
      portfolioSignal: input.portfolioSignal,
      now: startedAt,
    });
    // APEX wraps the tick with acquisition intelligence — never replaces planner.
    let apex: ApexCycleResult | undefined;
    try {
      apex = await runApexCycle({
        adapter: input.adapter,
        observation: plan.observation,
      });
      log("info", "apex.cycle.done", {
        businessId: input.businessId,
        bottleneck: apex.bottleneck,
        authorized: apex.decision?.authorized,
        action: apex.decision?.selected_action,
        traceId: apex.trace_id,
      });
    } catch (apexErr) {
      log("warn", "apex.cycle.error", {
        businessId: input.businessId,
        message:
          apexErr instanceof Error ? apexErr.message : String(apexErr),
      });
    }
    // Close the auth→queue gap: authorized R0/R1 actions become pursuits now.
    if (apex) {
      try {
        const bridged = await enqueueAndDrainAuthorizedApexAction({
          adapter: input.adapter,
          apex,
          observation: plan.observation,
          skipEnqueue: input.skipEnqueue,
          logger: log,
        });
        if (bridged.jobs.length > 0) {
          plan = {
            ...plan,
            enqueued: [...plan.enqueued, ...bridged.jobs],
            enqueuedCount: plan.enqueuedCount + bridged.jobs.length,
          };
          drain = mergeDrain(drain, bridged.drain);
        }
      } catch (bridgeErr) {
        log("warn", "apex.authorize.bridge_error", {
          businessId: input.businessId,
          message:
            bridgeErr instanceof Error
              ? bridgeErr.message
              : String(bridgeErr),
        });
      }
    }
    // TITAN consumes APEX + FORGE truth; Phase 1 recommends only.
    // execution_authority is intentionally hard-coded NONE (not a failed auth).
    let titan: TitanCycleResult | undefined;
    try {
      titan = await runTitanCycle({
        adapter: input.adapter,
        apex: apex ?? null,
        persist: true,
      });
      log("info", "titan.cycle.done", {
        businessId: input.businessId,
        constraint: titan.constraints.primary,
        favor: titan.decision.resource_allocation,
        decision: titan.decision.decision,
        confidence: titan.decision.confidence,
        executionAuthority: titan.execution_authority,
      });
    } catch (titanErr) {
      log("warn", "titan.cycle.error", {
        businessId: input.businessId,
        message:
          titanErr instanceof Error ? titanErr.message : String(titanErr),
      });
    }
    // NEXUS coordinates — does not replace TITAN/APEX/FORGE intelligence.
    let nexus: NexusCycleResult | undefined;
    try {
      const hourPulse = plan.observation?.hourPulse;
      nexus = await runNexusCycle({
        adapter: input.adapter,
        apex: apex ?? null,
        titan: titan ?? null,
        hourRevenueUsd: hourPulse?.revenueUsd ?? 0,
        hourVisitors: hourPulse?.landingViews ?? 0,
        persist: true,
      });
      log("info", "nexus.cycle.done", {
        businessId: input.businessId,
        mode: nexus.mode,
        objective: nexus.portfolio_objective,
        constraint: nexus.binding_constraint,
        favor: nexus.resource_favor,
        revenueUsd: nexus.hourly_check.revenue_usd,
        visitors: nexus.hourly_check.visitors,
      });
    } catch (nexusErr) {
      log("warn", "nexus.cycle.error", {
        businessId: input.businessId,
        message:
          nexusErr instanceof Error ? nexusErr.message : String(nexusErr),
      });
    }
    const finishedAt = new Date();
    const result: OperatorTickResult = {
      ok: true,
      businessId: input.businessId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      plan,
      drain,
      apex,
      titan,
      nexus,
    };
    log("info", "operator.tick.done", {
      businessId: input.businessId,
      durationMs: result.durationMs,
      enqueued: plan.enqueuedCount,
      executed: drain.executed,
      claimableRemaining: drain.claimableRemaining,
      stillWaiting: drain.stillWaiting,
      firstCustomerMode: plan.firstCustomerMode?.active,
      suspended: plan.suspension?.suspended ?? false,
      apexBottleneck: apex?.bottleneck,
      apexAuthorized: apex?.decision?.authorized ?? false,
      apexAction: apex?.decision?.selected_action ?? null,
      titanConstraint: titan?.constraints.primary,
      titanFavor: titan?.decision.resource_allocation,
      nexusConstraint: nexus?.binding_constraint,
    });
    return result;
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    log("error", "operator.tick.error", {
      businessId: input.businessId,
      message,
    });
    return {
      ok: false,
      businessId: input.businessId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      plan: {
        observation: {} as PlanAndEnqueueResult["observation"],
        opportunities: [],
        enqueued: [],
        enqueuedCount: 0,
        concurrentSlots: 0,
        firstCustomerMode: {
          active: false,
          reason: "operator error path",
          stage: "buyer_exposure",
          priority: "buyer_exposure",
          preferredActionTypes: [],
        },
        replenishedEmptyQueue: false,
      },
      drain: {
        claimed: 0,
        advanced: 0,
        executed: 0,
        stillWaiting: 0,
        claimableRemaining: 0,
        jobs: [],
      } satisfies DrainResult,
      errorMessage: message,
    };
  }
}

/**
 * Persistent supervised loop. Ticks the pursuit engine back-to-back with a
 * short busy sleep and a longer idle sleep. Honors AbortSignal so a SIGTERM
 * handler can flip it off gracefully.
 */
export async function runOperatorLoop(
  options: OperatorLoopOptions,
): Promise<OperatorTickResult[]> {
  const log = options.logger ?? defaultLogger;
  const busySleepMs = options.busySleepMs ?? 2_000;
  const idleSleepMs = options.idleSleepMs ?? 15_000;
  const results: OperatorTickResult[] = [];
  const start = Date.now();
  log("info", "operator.loop.start", {
    businessId: options.businessId,
    once: options.once === true,
  });

  let round = 0;
  while (true) {
    if (options.signal?.aborted) {
      log("info", "operator.loop.aborted", {
        businessId: options.businessId,
        completedRounds: round,
      });
      break;
    }
    round += 1;

    let adapter: SiteAdapter;
    try {
      adapter = await options.createAdapter({ businessId: options.businessId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "operator.loop.adapter_error", {
        businessId: options.businessId,
        message,
      });
      if (options.once) break;
      await sleepInterruptible(idleSleepMs, options.signal);
      continue;
    }

    const result = await runOperatorTick({
      businessId: options.businessId,
      adapter,
      portfolioSignal: options.portfolioSignal,
      tickBudgetMs: options.tickBudgetMs,
      maxJobsPerTick: options.maxJobsPerTick,
      maxEnqueuePerTick: options.maxEnqueuePerTick,
      logger: log,
    });
    results.push(result);
    options.onTick?.(result);

    if (options.once) break;

    const sleepMs = tickDidWork(result) ? busySleepMs : idleSleepMs;
    await sleepInterruptible(sleepMs, options.signal);
  }

  log("info", "operator.loop.stop", {
    businessId: options.businessId,
    rounds: round,
    totalDurationMs: Date.now() - start,
  });
  return results;
}
