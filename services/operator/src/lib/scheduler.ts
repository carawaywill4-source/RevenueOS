/**
 * Portfolio scheduler.
 *
 * Runs runOperatorLoop for each business concurrently, honoring:
 *   - per-business min-interval (rate limit floor)
 *   - shared portfolio bandwidth budget (max concurrent ticks)
 *   - graceful shutdown via AbortSignal
 *
 * Each business runs in its own async task; the scheduler is a semaphore
 * around them, not a queue. Businesses that finish a tick sleep until they
 * are eligible again — the semaphore only limits how many run at once.
 */

import { runOperatorTick } from "@revenueos/core";
import type {
  OperatorBusinessManifest,
  OperatorLoopLogger,
  OperatorTickResult,
  SiteAdapter,
} from "@revenueos/core";
import type { PortfolioSignal } from "@revenueos/core";
import { noteSubsystemTicks } from "./runtime-heartbeat.js";

export type BusinessRuntimeStatus = {
  siteId: string;
  displayName: string;
  ticks: number;
  lastTickAt: string | null;
  lastOk: boolean | null;
  lastDurationMs: number | null;
  lastExecuted: number | null;
  lastEnqueued: number | null;
  lastError: string | null;
  claimedUntil: string | null;
  nextEligibleAt: string | null;
  commerciallyPaused?: boolean;
};

export type SchedulerConfig = {
  businesses: OperatorBusinessManifest[];
  createAdapter: (business: OperatorBusinessManifest) => Promise<SiteAdapter>;
  createClaim: (business: OperatorBusinessManifest) => Promise<string | null>;
  releaseClaim: (business: OperatorBusinessManifest) => Promise<void>;
  portfolioSignal?: () => PortfolioSignal | undefined;
  /** When true, renew claim but skip commercial tick (queues/learning retained). */
  isCommerciallyPaused?: (siteId: string) => boolean;
  /** Reduce per-business interval for owner-prioritized businesses (ms). */
  prioritizeIntervalBoostMs?: (siteId: string) => number;
  /** Max concurrent business ticks in-flight. */
  maxConcurrency?: number;
  /** Minimum ms between two ticks for the same business. */
  perBusinessMinIntervalMs?: number;
  /** Tick budget in ms — persistent operator uses generous budgets. */
  tickBudgetMs?: number;
  maxJobsPerTick?: number;
  /** Observe-only ticks — no enqueue/drain (Mac shadow cutover). */
  skipEnqueue?: boolean;
  logger: OperatorLoopLogger;
  signal: AbortSignal;
};

class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];
  constructor(size: number) {
    this.available = size;
  }
  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw new Error("aborted");
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }
    return new Promise<() => void>((resolve, reject) => {
      const onAbort = () => reject(new Error("aborted"));
      signal?.addEventListener("abort", onAbort);
      this.queue.push(() => {
        signal?.removeEventListener("abort", onAbort);
        this.available -= 1;
        resolve(() => this.release());
      });
    });
  }
  private release() {
    this.available += 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

export class PortfolioScheduler {
  private readonly status = new Map<string, BusinessRuntimeStatus>();
  private readonly semaphore: Semaphore;
  private readonly tasks: Promise<void>[] = [];

  constructor(private readonly config: SchedulerConfig) {
    this.semaphore = new Semaphore(config.maxConcurrency ?? 3);
    for (const b of config.businesses) {
      this.status.set(b.siteId, {
        siteId: b.siteId,
        displayName: b.displayName,
        ticks: 0,
        lastTickAt: null,
        lastOk: null,
        lastDurationMs: null,
        lastExecuted: null,
        lastEnqueued: null,
        lastError: null,
        claimedUntil: null,
        nextEligibleAt: null,
      });
    }
  }

  getStatuses(): BusinessRuntimeStatus[] {
    return [...this.status.values()];
  }

  /** Hot-add a business without restarting already-running loops. */
  addBusiness(business: OperatorBusinessManifest): boolean {
    if (this.status.has(business.siteId)) return false;
    this.config.businesses.push(business);
    this.status.set(business.siteId, {
      siteId: business.siteId,
      displayName: business.displayName,
      ticks: 0,
      lastTickAt: null,
      lastOk: null,
      lastDurationMs: null,
      lastExecuted: null,
      lastEnqueued: null,
      lastError: null,
      claimedUntil: null,
      nextEligibleAt: null,
    });
    this.tasks.push(this.runBusiness(business));
    this.config.logger("info", "operator.scheduler.business_added", {
      siteId: business.siteId,
    });
    return true;
  }

  async start(): Promise<void> {
    for (const business of this.config.businesses) {
      this.tasks.push(this.runBusiness(business));
    }
  }

  async stop(): Promise<void> {
    await Promise.allSettled(this.tasks);
    for (const business of this.config.businesses) {
      try {
        await this.config.releaseClaim(business);
      } catch {
        // release is best-effort during shutdown
      }
    }
  }

  private async runBusiness(business: OperatorBusinessManifest): Promise<void> {
    const log = this.config.logger;
    const minInterval = this.config.perBusinessMinIntervalMs ?? 12_000;
    while (!this.config.signal.aborted) {
      let release: (() => void) | null = null;
      try {
        release = await this.semaphore.acquire(this.config.signal);
      } catch {
        break;
      }
      try {
        const claim = await this.config.createClaim(business);
        if (!claim) {
          log("warn", "operator.scheduler.claim_denied", {
            siteId: business.siteId,
          });
          this.updateStatus(business.siteId, {
            claimedUntil: null,
            lastError: "claim_denied",
          });
        } else {
          const paused =
            this.config.isCommerciallyPaused?.(business.siteId) === true;
          this.updateStatus(business.siteId, {
            claimedUntil: claim,
            commerciallyPaused: paused,
          });
          if (paused) {
            // Keep Mac ownership; do not erase queues or learning.
            log("info", "operator.scheduler.commercially_paused", {
              siteId: business.siteId,
            });
            this.updateStatus(business.siteId, {
              lastError: null,
              lastOk: true,
              lastExecuted: 0,
              lastEnqueued: 0,
            });
          } else {
            const adapter = await this.config.createAdapter(business);
            const tick = await runOperatorTick({
              businessId: business.siteId,
              adapter,
              portfolioSignal: this.config.portfolioSignal?.(),
              tickBudgetMs: this.config.tickBudgetMs,
              maxJobsPerTick: this.config.maxJobsPerTick,
              skipEnqueue: this.config.skipEnqueue === true,
              logger: log,
            });
            this.recordTick(business.siteId, tick);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", "operator.scheduler.tick_error", {
          siteId: business.siteId,
          message,
        });
        this.updateStatus(business.siteId, { lastError: message });
      } finally {
        release?.();
      }

      if (this.config.signal.aborted) break;
      const boost = this.config.prioritizeIntervalBoostMs?.(business.siteId) ?? 0;
      const wait = Math.max(5_000, minInterval - boost);
      const nextAt = new Date(Date.now() + wait).toISOString();
      this.updateStatus(business.siteId, { nextEligibleAt: nextAt });
      await sleepInterruptible(wait, this.config.signal);
    }
  }

  private recordTick(siteId: string, tick: OperatorTickResult) {
    this.updateStatus(siteId, {
      ticks: (this.status.get(siteId)?.ticks ?? 0) + 1,
      lastTickAt: tick.finishedAt,
      lastOk: tick.ok,
      lastDurationMs: tick.durationMs,
      lastExecuted: tick.drain.executed,
      lastEnqueued: tick.plan.enqueuedCount,
      lastError: tick.errorMessage ?? null,
    });
    noteSubsystemTicks({
      titan: tick.titan,
      apex: tick.apex,
      nexus: tick.nexus,
      drainExecuted: tick.drain.executed,
    });
  }

  private updateStatus(siteId: string, patch: Partial<BusinessRuntimeStatus>) {
    const existing = this.status.get(siteId);
    if (!existing) return;
    this.status.set(siteId, { ...existing, ...patch });
  }
}

async function sleepInterruptible(ms: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort);
  });
}
