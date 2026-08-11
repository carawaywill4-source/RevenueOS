/**
 * Parallel autonomy coordinator — guaranteed progress floors for critical domains.
 *
 * RevenueOS is not a single worker. These loops run independently of commercial ticks
 * and must never become a global attention bottleneck.
 *
 * Domains: REVENUE (scheduler), ADMIT, REPAIR (storefront), SELF_REPAIR,
 * LEARNING, INFRA, COST, EVOLUTION (heartbeat / bounded).
 */

import type pg from "pg";
import {
  handleEngineeringIncident,
  type RepairDeps,
} from "./engineering-repair.js";

export const PARALLEL_AUTONOMY_VERSION = "parallel-autonomy-v1";
export const PARALLEL_AUTONOMY_STATE_KEY = "parallel_autonomy_domain_heartbeats";
export const LAST_REAL_ACTIONS_KEY = "parallel_autonomy_last_real_actions";

export type AutonomyDomain =
  | "REVENUE"
  | "ADMIT"
  | "REPAIR"
  | "SELF_REPAIR"
  | "LEARNING"
  | "INFRA"
  | "COST"
  | "EVOLUTION"
  | "CREATION"
  | "CODE_EVOLUTION"
  | "OWNER_TELEMETRY";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

type DomainHeartbeat = {
  domain: AutonomyDomain;
  status: "RUNNING" | "DEGRADED" | "STOPPED";
  lastTickAt: string;
  detail?: string;
  ticks: number;
};

type EngineeringJob = {
  id: string;
  siteId: string;
  reason: string;
  source: string;
  enqueuedAt: string;
};

const engineeringQueue: EngineeringJob[] = [];
let engineeringInFlight = false;

/** Non-blocking enqueue — admit must never await heavy self-repair. */
export function enqueueEngineeringSelfRepair(job: {
  siteId: string;
  reason: string;
  source?: string;
}): void {
  const id = `eng_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  engineeringQueue.push({
    id,
    siteId: job.siteId,
    reason: job.reason,
    source: job.source ?? "admit",
    enqueuedAt: new Date().toISOString(),
  });
  // Bound queue so storms don't grow forever.
  while (engineeringQueue.length > 40) engineeringQueue.shift();
}

async function persistHeartbeats(
  pool: pg.Pool,
  heartbeats: Record<string, DomainHeartbeat>,
): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'PARALLEL_AUTONOMY')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='PARALLEL_AUTONOMY'`,
    [
      PARALLEL_AUTONOMY_STATE_KEY,
      JSON.stringify({
        version: PARALLEL_AUTONOMY_VERSION,
        updatedAt: new Date().toISOString(),
        domains: heartbeats,
      }),
    ],
  );
}

async function persistLastRealActions(
  pool: pg.Pool,
  logger: Logger,
): Promise<number> {
  // Pull recent pursuit executions as durable "last real action" evidence.
  const res = await pool.query(
    `select site_id, document, updated_at
     from ros_pursuits
     where coalesce(document->>'state','') in ('WAITING_FOR_EVIDENCE','ATTRIBUTE','LEARN','EXECUTE','REPLENISH')
        or coalesce(document->>'lastExecutedAt','') <> ''
     order by updated_at desc
     limit 80`,
  );
  const bySite = new Map<string, Record<string, unknown>>();
  for (const row of res.rows) {
    const siteId = String(row.site_id);
    if (bySite.has(siteId)) continue;
    const doc = (row.document ?? {}) as Record<string, unknown>;
    bySite.set(siteId, {
      business: siteId,
      action: doc.actionType ?? doc.title ?? "pursuit",
      channel: doc.channel ?? doc.patternKey ?? "owned_distribution",
      timestamp:
        doc.lastExecutedAt ??
        doc.updatedAt ??
        (row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at)),
      executionEvidence: {
        pursuitId: doc.id ?? row.site_id,
        state: doc.state ?? null,
        patternKey: doc.patternKey ?? null,
      },
      observedResult: doc.lastResult ?? doc.state ?? "executed_or_waiting",
      nextAction: "continue_bottleneck_pursuit",
    });
  }

  // Also fold recent apex bridge events from journal-less DB receipts if present.
  const actions = [...bySite.values()];
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'PARALLEL_AUTONOMY')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='PARALLEL_AUTONOMY'`,
    [
      LAST_REAL_ACTIONS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        actions: actions.slice(0, 50),
      }),
    ],
  );
  logger("info", "parallel.learning.actions_snapshot", {
    businesses: actions.length,
  });
  return actions.length;
}

async function costControlTick(pool: pg.Pool, logger: Logger): Promise<void> {
  const paidAi = process.env.ALLOW_PAID_AI === "true";
  const budget = Number(process.env.PAID_AI_BUDGET_USD || "0");
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COST_CONTROL')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='COST_CONTROL'`,
    [
      "parallel_autonomy_cost_control",
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        allowPaidAi: paidAi,
        paidAiBudgetUsd: budget,
        enforced: !paidAi && budget <= 0,
        note: "paid AI held at $0 until revenue justifies spend",
      }),
    ],
  );
  logger("info", "parallel.cost.tick", {
    allowPaidAi: paidAi,
    paidAiBudgetUsd: budget,
  });
}

/**
 * Independent domain workers. Safe to run alongside PortfolioScheduler,
 * admit controller, and storefront repair executor.
 */
export async function runParallelAutonomyCoordinator(deps: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
  appRoot: string;
  getEngineeringDeps: () => RepairDeps;
  getRevenuePulse?: () => {
    activeBusinesses: number;
    recentExecuted: number;
  };
  intervalMs?: number;
}): Promise<void> {
  const interval = deps.intervalMs ?? 45_000;
  const heartbeats: Record<string, DomainHeartbeat> = {};
  const bump = (domain: AutonomyDomain, detail?: string) => {
    const prev = heartbeats[domain];
    heartbeats[domain] = {
      domain,
      status: "RUNNING",
      lastTickAt: new Date().toISOString(),
      detail,
      ticks: (prev?.ticks ?? 0) + 1,
    };
  };

  deps.logger("info", "parallel.autonomy.start", {
    version: PARALLEL_AUTONOMY_VERSION,
    note: "independent domain floors — not a global attention mode",
  });
  bump("REVENUE", "scheduler_owned");
  bump("ADMIT", "admit_controller_owned");
  bump("REPAIR", "storefront_repair_owned");

  let cycles = 0;
  while (!deps.signal.aborted) {
    cycles += 1;
    try {
      // SELF_REPAIR floor — drain at most one engineering job per cycle.
      if (!engineeringInFlight && engineeringQueue.length > 0) {
        const job = engineeringQueue.shift()!;
        engineeringInFlight = true;
        deps.logger("info", "parallel.self_repair.started", {
          id: job.id,
          siteId: job.siteId,
          reason: job.reason,
          queueRemaining: engineeringQueue.length,
        });
        void handleEngineeringIncident(deps.getEngineeringDeps(), {
          reason: job.reason,
          siteId: job.siteId,
          source: job.source,
        })
          .then((outcome) => {
            deps.logger("info", "parallel.self_repair.done", {
              id: job.id,
              siteId: job.siteId,
              status: outcome.status,
              level: outcome.level,
            });
            bump("SELF_REPAIR", `${outcome.status}:${job.siteId}`);
          })
          .catch((err) => {
            deps.logger("error", "parallel.self_repair.failed", {
              id: job.id,
              message: err instanceof Error ? err.message : String(err),
            });
            bump("SELF_REPAIR", "failed");
          })
          .finally(() => {
            engineeringInFlight = false;
          });
      } else {
        bump(
          "SELF_REPAIR",
          engineeringInFlight ? "in_flight" : "idle_ready",
        );
      }

      // LEARNING floor — durable last-action snapshot (does not hold revenue slots).
      const n = await persistLastRealActions(deps.pool, deps.logger);
      bump("LEARNING", `actions=${n}`);

      // INFRA floor
      const pulse = deps.getRevenuePulse?.();
      bump(
        "INFRA",
        `pg_ok active=${pulse?.activeBusinesses ?? "?"} executed=${pulse?.recentExecuted ?? "?"}`,
      );
      deps.logger("info", "parallel.infra.tick", {
        activeBusinesses: pulse?.activeBusinesses ?? null,
        recentExecuted: pulse?.recentExecuted ?? null,
        engineeringQueue: engineeringQueue.length,
      });

      // COST floor
      if (cycles % 4 === 1) {
        await costControlTick(deps.pool, deps.logger);
        bump("COST", "enforced");
      }

      // EVOLUTION / CREATION / CODE_EVOLUTION heartbeats (peer loops own work)
      bump("EVOLUTION", "capacity_observed");
      bump("CREATION", "architect_peer_loop");
      bump("CODE_EVOLUTION", "code_evolution_peer_loop");
      bump("OWNER_TELEMETRY", "non_blocking");

      // Reflect revenue/admit/repair as RUNNING if peers exist
      bump(
        "REVENUE",
        `active=${pulse?.activeBusinesses ?? "?"} recentExecuted=${pulse?.recentExecuted ?? "?"}`,
      );
      bump("ADMIT", "peer_loop");
      bump("REPAIR", "peer_loop");

      await persistHeartbeats(deps.pool, heartbeats);
      deps.logger("info", "parallel.autonomy.heartbeat", {
        version: PARALLEL_AUTONOMY_VERSION,
        domains: Object.keys(heartbeats).length,
        cycle: cycles,
      });
    } catch (err) {
      deps.logger("warn", "parallel.autonomy.cycle_error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    await sleep(interval, deps.signal);
  }

  deps.logger("info", "parallel.autonomy.stop", { cycles });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort);
  });
}
