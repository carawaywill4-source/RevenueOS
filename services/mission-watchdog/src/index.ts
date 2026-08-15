/**
 * RevenueOS Mission Watchdog.
 *
 * A deterministic external process. Runs under its own systemd unit
 * (`revenueos-mission-watchdog`). Cannot be silenced by an operator crash.
 *
 * Every 60s:
 *   1. Load the active mission (if any).
 *   2. Ping the operator health endpoint. Record staleness.
 *   3. Refresh the External Progress Clock.
 *   4. Evaluate liveness deterministically.
 *   5. If liveness demands recovery, enqueue a materially-different next
 *      experiment from the seed catalog. Fingerprint dedup guarantees the
 *      renamed strategy trap is impossible.
 *   6. If the catalog is exhausted, open a CRITICAL incident so an
 *      asynchronous xAI stuck-state-advice run can be triggered by a
 *      separate slow-tick lane (that lane may live in the operator).
 *
 * No LLM in this loop. Determinism is the point.
 */

import pg from "pg";
import {
  MissionController,
  TIER1_DISTRIBUTION_FAMILIES,
  coreCanExecuteFamily,
} from "@revenueos/core";

const INTERVAL_MS = Number(process.env.MISSION_WATCHDOG_INTERVAL_MS ?? "60000");
const OPERATOR_HEALTH_URL =
  process.env.OPERATOR_HEALTH_URL ?? "http://127.0.0.1:8090/health";
const OPERATOR_STALE_MINUTES = Number(process.env.OPERATOR_STALE_MINUTES ?? "5");

type LogLevel = "info" | "warn" | "error";
const log = (level: LogLevel, event: string, fields: Record<string, unknown> = {}) => {
  const line = { at: new Date().toISOString(), level, event, service: "mission-watchdog", ...fields };
  const target = level === "error" ? console.error : console.log;
  try {
    target(JSON.stringify(line));
  } catch {
    target(`[mission-watchdog] ${level} ${event}`);
  }
};

async function checkOperatorHealth(): Promise<{ ok: boolean; ageSeconds: number | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(OPERATOR_HEALTH_URL, { signal: controller.signal });
    if (!res.ok) return { ok: false, ageSeconds: null, error: `http_${res.status}` };
    const body = (await res.json()) as { updatedAt?: string; at?: string; timestamp?: string };
    const ts = body.updatedAt || body.at || body.timestamp;
    if (!ts) return { ok: true, ageSeconds: null };
    const age = (Date.now() - Date.parse(ts)) / 1000;
    return { ok: true, ageSeconds: Number.isFinite(age) ? age : null };
  } catch (err) {
    return {
      ok: false,
      ageSeconds: null,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function tick(pool: pg.Pool, controller: MissionController): Promise<void> {
  const mission = await controller.loadActiveMission();
  if (!mission) {
    log("info", "watchdog.tick.no_active_mission", {});
    return;
  }

  const health = await checkOperatorHealth();
  const operatorStale =
    health.ok === false ||
    (health.ageSeconds !== null && health.ageSeconds > OPERATOR_STALE_MINUTES * 60);

  const clock = await controller.refreshProgressClock(mission.id);
  const verdict = await controller.evaluateLiveness(mission.id);

  log("info", "watchdog.tick.liveness", {
    missionId: mission.id,
    status: mission.status,
    verdict,
    operatorOk: health.ok,
    operatorAgeSeconds: health.ageSeconds,
    lastVerifiedHumanAt: clock.lastVerifiedHumanAt,
    lastExternalExposureAt: clock.lastExternalExposureAt,
    lastPurchaseAt: clock.lastPurchaseAt,
    verifiedHumans1h: clock.verifiedHumans1h,
    externalExposures1h: clock.externalExposures1h,
    purchasesTotal: clock.purchasesTotal,
  });

  if (operatorStale) {
    await controller.openIncident(mission.id, {
      kind: "OPERATOR_HEARTBEAT_STALE",
      severity: "CRITICAL",
      detail: `operator health check failed or is older than ${OPERATOR_STALE_MINUTES} min`,
      meta: { operatorAgeSeconds: health.ageSeconds, error: health.error },
    });
  }

  if (verdict.ok) return;

  if (!verdict.needsRecovery) {
    // First-15-minute soft warning; no action required yet.
    return;
  }

  // Distribution-first ranking mirrors the in-process lane: when the
  // mission still has zero proven humans, prefer channel families that
  // create real distribution opportunities instead of conversion-support
  // work that has nothing to convert.
  const provenHumans24h = await pool
    .query<{ n: number }>(
      `select coalesce(proven_humans_24h, 0)::int as n
         from ros_mission_progress_clock where mission_id=$1`,
      [mission.id],
    )
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => 0);
  const preferredFamilies =
    provenHumans24h === 0 ? TIER1_DISTRIBUTION_FAMILIES : undefined;

  const recovery = await controller.recoverFromStarvation({
    missionId: mission.id,
    preferredExecutors: undefined,
    canExecuteFamily: coreCanExecuteFamily,
    preferredFamilies,
  });

  log(operatorStale ? "error" : "warn", "watchdog.tick.recovery", {
    missionId: mission.id,
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

async function main(): Promise<void> {
  const url = process.env.REVENUEOS_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    log("error", "watchdog.boot.no_database_url", {});
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url, max: 3 });
  const controller = new MissionController(pool, (level, event, payload) =>
    log(level as LogLevel, event, payload ?? {}),
  );
  try {
    await controller.init();
    log("info", "watchdog.boot.ok", {
      intervalMs: INTERVAL_MS,
      operatorHealthUrl: OPERATOR_HEALTH_URL,
      operatorStaleMinutes: OPERATOR_STALE_MINUTES,
    });
  } catch (err) {
    log("error", "watchdog.boot.schema_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    // Keep running — the operator boot will create tables and the next tick will succeed.
  }

  const abort = new AbortController();
  const shutdown = (signal: string) => {
    log("info", "watchdog.shutdown", { signal });
    abort.abort();
    setTimeout(() => process.exit(0), 500);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  while (!abort.signal.aborted) {
    try {
      await tick(pool, controller);
    } catch (err) {
      log("error", "watchdog.tick.failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(INTERVAL_MS, abort.signal);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

void main().catch((err) => {
  log("error", "watchdog.fatal", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
