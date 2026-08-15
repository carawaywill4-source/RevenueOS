/**
 * Operator-side mission lane.
 *
 * This is the in-process partner of the external mission-watchdog. It:
 *
 *   1. Instantiates a MissionController against the operator's pg pool.
 *   2. Ensures a default active mission exists at boot.
 *   3. Initializes the xAI provider (best-effort, non-fatal).
 *   4. Runs a slow tick every SLOW_TICK_MS that:
 *      - refreshes the External Progress Clock,
 *      - evaluates liveness deterministically,
 *      - on CRITICAL starvation, in-process recovery (redundant with the
 *        external watchdog but faster during normal operation),
 *      - promotes the mission's current ENQUEUED experiment to RUNNING,
 *      - accumulates signals into the running experiment from real DB facts
 *        (ros_commercial_actions, ros_traffic_events, ros_purchases).
 *
 * The mission lane never calls an LLM on the hot tick loop.
 */

import type pg from "pg";
import {
  MissionController,
  TIER1_DISTRIBUTION_FAMILIES,
  initializeXai,
  xaiHealth,
  type Mission,
  type MissionControllerLogger,
} from "@revenueos/core";
import { runExecutorBridgeTick } from "./executor-bridge.js";
import { canExecuteFamily } from "./executor-registry.js";

export type MissionLaneLogger = (
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>,
) => void;

const SLOW_TICK_MS = Number(process.env.MISSION_LANE_INTERVAL_MS ?? "60000");

const DEFAULT_OBJECTIVE = {
  primary: "REAL_REVENUE" as const,
  firstSaleTargetUsd: 1,
  longTermDailyRevenueTargetUsd: 100,
};

const HUMAN_TRAFFIC_EXCLUSION = ["SYNTHETIC_TEST", "INTERNAL", "BOT", "CRAWLER"];

export type MissionLaneHandle = {
  controller: MissionController;
  mission: Mission;
  stop: () => void;
};

export async function startMissionLane(opts: {
  pool: pg.Pool;
  logger: MissionLaneLogger;
  signal: AbortSignal;
}): Promise<MissionLaneHandle> {
  const missionLogger: MissionControllerLogger = (level, event, payload) =>
    opts.logger(level, event, payload ?? {});
  const controller = new MissionController(opts.pool, missionLogger);
  await controller.init();

  const mission = await controller.ensureActiveMission(DEFAULT_OBJECTIVE, null);
  opts.logger("info", "mission.lane.boot", {
    missionId: mission.id,
    status: mission.status,
    startedAt: mission.startedAt,
    deadlineAt: mission.deadlineAt,
    objective: mission.objective,
  });

  void initializeXai()
    .then((health) => {
      opts.logger("info", "mission.lane.xai.init", { xai: health as unknown as Record<string, unknown> });
    })
    .catch((err) =>
      opts.logger("warn", "mission.lane.xai.init_failed", {
        message: err instanceof Error ? err.message : String(err),
      }),
    );

  const timer = setInterval(() => {
    void runSlowTick(controller, mission.id, opts).catch((err) =>
      opts.logger("error", "mission.lane.tick_failed", {
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }, SLOW_TICK_MS);
  opts.signal.addEventListener("abort", () => clearInterval(timer));

  // Kick a first tick immediately so we don't wait 60s at boot.
  void runSlowTick(controller, mission.id, opts).catch((err) =>
    opts.logger("error", "mission.lane.tick_failed", {
      message: err instanceof Error ? err.message : String(err),
    }),
  );

  return {
    controller,
    mission,
    stop: () => clearInterval(timer),
  };
}

async function runSlowTick(
  controller: MissionController,
  missionId: string,
  opts: { pool: pg.Pool; logger: MissionLaneLogger },
): Promise<void> {
  const clock = await controller.refreshProgressClock(missionId);
  const verdict = await controller.evaluateLiveness(missionId);
  const current = await controller.currentExperiment(missionId);

  opts.logger("info", "mission.lane.tick", {
    missionId,
    verdict,
    currentExperimentId: current?.id ?? null,
    currentExperimentFamily: current?.family ?? null,
    currentExperimentExecutor: current?.executor ?? null,
    currentExperimentState: current?.state ?? null,
    lastVerifiedHumanAt: clock.lastVerifiedHumanAt,
    lastExternalExposureAt: clock.lastExternalExposureAt,
    lastPurchaseAt: clock.lastPurchaseAt,
    externalExposures1h: clock.externalExposures1h,
    verifiedHumans1h: clock.verifiedHumans1h,
    purchasesTotal: clock.purchasesTotal,
    xaiHealth: xaiHealth(),
  });

  // Step 1: run the executor bridge every tick — this is the missing limb
  // between "MissionController generated an experiment" and "RevenueOS
  // actually did something outside itself".
  try {
    const bridge = await runExecutorBridgeTick({
      controller,
      pool: opts.pool,
      missionId,
      logger: opts.logger,
    });
    opts.logger("info", "mission.lane.bridge", {
      missionId,
      claimedExperimentId: bridge.claimedExperimentId,
      outcome: bridge.outcome,
      detail: bridge.detail ?? null,
    });
  } catch (err) {
    opts.logger("error", "mission.lane.bridge_failed", {
      missionId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Step 2: accumulate signals for any currently-measuring experiment (so
  // it can naturally conclude to WIN/LOSS/INCONCLUSIVE).
  if (
    current &&
    (current.state === "MEASURING" ||
      current.state === "EXECUTING" ||
      current.state === "EXTERNAL_ACTION_VERIFIED" ||
      current.state === "RUNNING")
  ) {
    await accumulateSignalsForRunningExperiment(
      opts.pool,
      controller,
      current.id,
      current.startedAt ?? current.claimedAt ?? current.createdAt,
    );
  }

  // Step 3: recovery. Only enqueues a new experiment when there is no
  // primary active one AND SLA gates have been enforced. Cooldown only
  // starts after a real terminal outcome, not after mere enqueue.
  if (!verdict.ok && verdict.needsRecovery) {
    // Distribution-first ranking: when the mission has produced zero
    // proven humans, prefer channel families that create legitimate
    // distribution opportunities over conversion-support work.
    const provenHumans24h = await opts.pool
      .query<{ n: number }>(
        `select coalesce(proven_humans_24h, 0)::int as n
           from ros_mission_progress_clock where mission_id=$1`,
        [missionId],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0);
    const preferredFamilies = provenHumans24h === 0
      ? TIER1_DISTRIBUTION_FAMILIES
      : undefined;
    const recovery = await controller.recoverFromStarvation({
      missionId,
      canExecuteFamily: (family) => canExecuteFamily(family),
      preferredFamilies,
    });
    opts.logger(verdict.severity === "CRITICAL" ? "error" : "warn", "mission.lane.recovery", {
      missionId,
      verdict,
      enqueuedExperimentId: recovery.enqueued?.id ?? null,
      enqueuedFamily: recovery.enqueued?.family ?? null,
      enqueuedExecutor: recovery.enqueued?.executor ?? null,
      enqueuedBusinessId: recovery.enqueued?.businessId ?? null,
      exhaustedCatalog: recovery.exhaustedCatalog,
      incidentId: recovery.incidentId,
      skippedReason: recovery.skippedReason ?? null,
      swept: recovery.swept ?? null,
      concludedMeasuring: recovery.concludedMeasuring ?? null,
    });
  }
}

/**
 * Best-effort signal accumulation. Reads real DB facts produced since the
 * running experiment started and increments the experiment's counters. This
 * lets `completeExperiment` know whether the hypothesis produced anything.
 *
 * Signals are attributed by created_at window and business_id where possible.
 * This is deliberately naive; a proper attribution layer is a follow-on.
 */
async function accumulateSignalsForRunningExperiment(
  pool: pg.Pool,
  controller: MissionController,
  experimentId: string,
  startedAt: string | null,
): Promise<void> {
  if (!startedAt) return;
  const startIso = startedAt;
  const [external, humans, engagements, checkouts, purchases] = await Promise.all([
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_commercial_actions
          where external_or_internal='external' and executed=true and created_at >= $1`,
        [startIso],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_traffic_events
          where class NOT IN ('SYNTHETIC_TEST', 'INTERNAL', 'BOT', 'CRAWLER')
            and created_at >= $1`,
        [startIso],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_traffic_events
          where class NOT IN ('SYNTHETIC_TEST', 'INTERNAL', 'BOT', 'CRAWLER')
            and coalesce(path, '/') <> '/'
            and created_at >= $1`,
        [startIso],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_commercial_actions
          where (action_type='checkout_start' or checkout_created=true)
            and created_at >= $1`,
        [startIso],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
    pool
      .query<{ n: number }>(
        `select count(*)::int as n from ros_purchases
          where stripe_session_id not like 'cs_test_%'
            and coalesce(meta->>'payment_status','paid') <> 'unpaid'
            and created_at >= $1`,
        [startIso],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0),
  ]);
  // These are absolute since start; MissionController stores incremental,
  // so we overwrite the experiment counters via a direct SQL update rather
  // than call recordExperimentSignal (which increments).
  await pool.query(
    `update ros_commercial_experiments
        set external_exposures=$1,
            verified_humans=$2,
            engaged_humans=$3,
            checkout_starts=$4,
            purchases=$5,
            updated_at=now()
      where id=$6`,
    [external, humans, engagements, checkouts, purchases, experimentId],
  );
}
