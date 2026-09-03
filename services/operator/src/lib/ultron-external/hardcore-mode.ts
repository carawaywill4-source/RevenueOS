/**
 * Hardcore first-sale mode — 8 hour aggressive legitimate commerce window.
 * Does not weaken proof. Does not fabricate customers.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { scorePortfolio, latestFrontier } from "./commerce-intelligence.js";
import { enqueueFrontierWork, enqueueJob, drainJobs, enqueuePortfolioRedeploy } from "./durable-jobs.js";
import { huntE5 } from "./e5-hunter.js";
import { surfaceCensus } from "./surface-intelligence.js";

const HOURS = 8;

async function ensure(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_hardcore_mode_state (
      id text primary key default 'current',
      enabled boolean not null default false,
      started_at timestamptz,
      deadline_at timestamptz,
      objective text not null default 'FIRST_LEGITIMATE_SALE',
      current_business text,
      earliest_zero text not null default 'E5',
      strategy text,
      actions_attempted integer not null default 0,
      customers integer not null default 0,
      revenue numeric not null default 0,
      last_external_signal text,
      next_action text,
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    insert into ros_hardcore_mode_state (id) values ('current')
      on conflict (id) do nothing;
  `);
}

export async function startHardcoreMode(
  pool: pg.Pool,
  logger: Logger,
): Promise<Record<string, unknown>> {
  await ensure(pool);
  const existing = await pool.query(
    `select enabled, started_at, deadline_at from ros_hardcore_mode_state where id='current'`,
  );
  if (existing.rows[0]?.enabled && existing.rows[0]?.deadline_at) {
    return existing.rows[0];
  }
  const started = new Date();
  const deadline = new Date(started.getTime() + HOURS * 3600_000);
  await pool.query(
    `update ros_hardcore_mode_state set
       enabled=true, started_at=$1, deadline_at=$2, objective='FIRST_LEGITIMATE_SALE',
       strategy='repair_destination_then_legitimate_exposure', next_action='score_and_choose',
       updated_at=now()
     where id='current'`,
    [started.toISOString(), deadline.toISOString()],
  );
  logger("info", "ultron.hardcore.started", {
    startedAt: started.toISOString(),
    deadlineAt: deadline.toISOString(),
  });
  return { enabled: true, startedAt: started.toISOString(), deadlineAt: deadline.toISOString() };
}

let lastHunt = 0;

export async function runHardcoreTick(
  pool: pg.Pool,
  logger: Logger,
): Promise<Record<string, unknown>> {
  await ensure(pool);
  const st = await pool.query(`select * from ros_hardcore_mode_state where id='current'`);
  const row = st.rows[0];
  if (!row?.enabled) return { enabled: false };
  const deadline = row.deadline_at ? new Date(row.deadline_at).getTime() : 0;
  let remainingMs = deadline - Date.now();
  let windowEnded = remainingMs <= 0;
  if (windowEnded && Number(row.revenue ?? 0) === 0) {
    const newDeadline = new Date(Date.now() + HOURS * 3600_000);
    await pool.query(
      `update ros_hardcore_mode_state set deadline_at=$1, updated_at=now() where id='current'`,
      [newDeadline.toISOString()]
    );
    remainingMs = HOURS * 3600_000;
    windowEnded = false;
    logger("info", "ultron.hardcore.window_renewed", { deadlineAt: newDeadline.toISOString() });
  }

  const commerce = await scorePortfolio(pool, logger);
  const frontier = commerce.selected ?? (await latestFrontier(pool).then((r) => r ? String(r.business_id) : null));
  if (frontier) {
    await enqueueFrontierWork(pool, frontier);
  }
  const jobs = await drainJobs(pool, logger, { budgetMs: 75_000, limit: 6 });
  let e5: { attempted: boolean; e5: boolean; reason?: string } = { attempted: false, e5: false, reason: "deferred" };
  if (Date.now() - lastHunt > 240_000) {
    lastHunt = Date.now();
    e5 = await huntE5(pool, logger).catch((err) => ({ attempted: false, e5: false, reason: String(err) }));
  }
  const surfaces = await surfaceCensus(pool).catch(() => ({ permitted: 0 }));

  const purchases = await pool.query(
    `select count(*)::int as n, coalesce(sum(amount_usd),0) as rev
       from ros_customer_events where kind='PAYMENT_SUCCEEDED'`,
  ).catch(() => ({ rows: [{ n: 0, rev: 0 }] }));
  const customers = Number(purchases.rows[0]?.n ?? 0);
  const revenue = Number(purchases.rows[0]?.rev ?? 0);

  const next =
    customers > 0 ? "attempt_second_sale"
    : (surfaces as { permitted?: number }).permitted === 0 ? "research_permitted_publish_surface"
    : "execute_legitimate_exposure";

  await pool.query(
    `update ros_hardcore_mode_state set
       current_business=$1, actions_attempted=actions_attempted+1,
       customers=$2, revenue=$3, earliest_zero=$4, next_action=$5,
       last_external_signal=$6, updated_at=now()
     where id='current'`,
    [
      frontier,
      customers,
      revenue,
      customers > 0 ? "E10" : "E5",
      next,
      e5.reason ?? null,
    ],
  );
  logger("info", windowEnded ? "ultron.hardcore.post_window_tick" : "ultron.hardcore.tick", {
    frontier,
    remainingMs: Math.max(0, remainingMs),
    windowEnded,
    customers,
    revenue,
    jobs,
    e5: e5.e5,
    next,
  });
  void import("../commercial-execution-v4/watchdog.js")
    .then((m) => m.beat(pool, "Hardcore", true, "", { frontier, next }))
    .catch(() => undefined);
  return { frontier, remainingMs: Math.max(0, remainingMs), windowEnded, customers, revenue, jobs, e5, next };
}

export async function runHardcoreLane(input: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
}): Promise<void> {
  input.logger("info", "ultron.hardcore.lane.start", {});
  await startHardcoreMode(input.pool, input.logger);
  try {
    await enqueuePortfolioRedeploy(input.pool);
    const unknowns = await input.pool.query(
      `select url from ros_external_surfaces
        where policy_class in ('CONDITIONAL','UNKNOWN_NEEDS_RESEARCH')
        limit 16`,
    );
    for (const u of unknowns.rows) {
      await enqueueJob(input.pool, {
        kind: "RESEARCH_SURFACE",
        uniqueKey: `surf:${String(u.url).slice(0, 80)}`,
        payload: { url: u.url },
      });
    }
  } catch (e) {
    input.logger("warn", "ultron.hardcore.enqueue_failed", { e: String(e) });
  }
  while (!input.signal.aborted) {
    try {
      await Promise.race([
        runHardcoreTick(input.pool, input.logger),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("hardcore_tick_timeout_90s")), 90_000),
        ),
      ]);
      await new Promise((res) => setTimeout(res, 20_000));
    } catch (e) {
      input.logger("error", "ultron.hardcore.tick_error", {
        e: e instanceof Error ? e.message : String(e),
      });
      await new Promise((res) => setTimeout(res, 15_000));
    }
  }
}
