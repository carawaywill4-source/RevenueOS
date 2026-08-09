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
import { runPursuitTick } from "./pursuit-plan";
import type { PortfolioSignal } from "./revenue-priority";
import type { PlanAndEnqueueResult } from "./pursuit-plan";
import type { DrainResult } from "./pursuit-engine";

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
  logger?: OperatorLoopLogger;
}): Promise<OperatorTickResult> {
  const log = input.logger ?? defaultLogger;
  const startedAt = new Date();
  try {
    log("info", "operator.tick.start", { businessId: input.businessId });
    const { plan, drain } = await runPursuitTick(input.adapter, {
      budgetMs: input.tickBudgetMs ?? 180_000,
      maxJobs: input.maxJobsPerTick ?? 24,
      maxEnqueue: input.maxEnqueuePerTick,
      portfolioSignal: input.portfolioSignal,
      now: startedAt,
    });
    const finishedAt = new Date();
    const result: OperatorTickResult = {
      ok: true,
      businessId: input.businessId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      plan,
      drain,
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
