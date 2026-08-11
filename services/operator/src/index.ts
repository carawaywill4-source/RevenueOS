/**
 * Persistent RevenueOS operator service.
 *
 * Boot sequence:
 *   1. Parse env (native Postgres OR legacy Supabase).
 *   2. Wire ExperimentStore (ros_* Postgres is LIVE authority after cutover).
 *   3. SIGTERM → AbortController.
 *   4. HTTP health/status server.
 *   5. Per-business scheduler ticks.
 */

import {
  createFileExperimentStore,
  createOperatorAdapter,
  type ExperimentStore,
  type OperatorLoopLogger,
} from "@revenueos/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { hydrateEnvFromFiles, loadEnv } from "./env.js";
import { PORTFOLIO, findBusiness, getPortfolio } from "./portfolio.js";

// Node 20 + supabase-js realtime constructor requires a WebSocket global.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error minimal stub for client construction; REST does not use it
  globalThis.WebSocket = class {
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
import {
  createSupabaseStore,
  type OperatorLedgerMode,
} from "./lib/supabase-store.js";
import { createPostgresExperimentStore } from "./lib/postgres-store.js";
import {
  applyOwnerControlPg,
  claimBusinessPg,
  listRecentNativeActivity,
  loadOwnerControlsPg,
  persistSchedulerCheckpointPg,
  releaseBusinessPg,
} from "./lib/postgres-platform.js";
import {
  defaultCheckpointPath,
  loadEngineCheckpoint,
  saveEngineCheckpoint,
} from "./lib/engine-checkpoint.js";
import { claimBusiness, releaseBusiness } from "./lib/claims.js";
import {
  executeThroughSidecar,
  isSidecarAction,
} from "./lib/sidecar-executor.js";
import {
  executeOperatorCommercialAction,
  listCutoverSafeActions,
} from "./lib/agent-executor.js";
import { PortfolioScheduler } from "./lib/scheduler.js";
import { createHealthServer } from "./lib/health-server.js";
import { buildOwnerDashboardNative } from "./lib/owner-api.js";
import {
  applyOwnerControl,
  isBusinessCommerciallyPaused,
  loadOwnerControls,
  prioritizeBoostMs,
  type ControlCommand,
  type OwnerControlState,
} from "./lib/owner-controls.js";

const SERVICE_NAME = "@revenueos/operator-service";
const SERVICE_VERSION = "0.1.0";

const logger: OperatorLoopLogger = (level, event, fields) => {
  const line = { at: new Date().toISOString(), level, event, ...fields };
  const target = level === "error" ? console.error : console.log;
  try {
    target(JSON.stringify(line));
  } catch {
    target(`[operator] ${level} ${event}`);
  }
};

async function main() {
  hydrateEnvFromFiles();
  const env = loadEnv();
  const shadow = env.SHADOW_MODE === true;
  const claimEnabled = env.CLAIM_ENABLED === true && !shadow;
  // Phase 3 — Mac is the sole autonomous brain unless explicitly overridden.
  if (process.env.REVENUEOS_MAC_BRAIN !== "0") {
    process.env.REVENUEOS_MAC_BRAIN = "1";
  }
  process.env.REVENUEOS_MODE = process.env.REVENUEOS_MODE || "LIVE";

  // One failed tick/business must not take down the LaunchAgent worker.
  process.on("uncaughtException", (error) => {
    logger("error", "operator.process.uncaught_exception", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
  process.on("unhandledRejection", (reason) => {
    logger("error", "operator.process.unhandled_rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });

  const nativePostgres = env.dataProvider === "postgres";
  logger("info", "operator.boot.start", {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    operator: env.OPERATOR_NAME,
    maxConcurrency: env.MAX_CONCURRENCY,
    tickBudgetMs: env.TICK_BUDGET_MS,
    shadowMode: shadow,
    claimEnabled,
    authority: nativePostgres ? "azure/native" : "azure",
    dataProvider: env.dataProvider,
    macBrain: process.env.REVENUEOS_MAC_BRAIN === "1",
  });

  const localLedgerRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.data/operator-local-ledger",
  );

  let store: ExperimentStore;
  let client: SupabaseClient | undefined;
  let pgPool: pg.Pool | undefined;
  let ledgerMode: OperatorLedgerMode | "native_postgres" | null = null;
  /** Legacy Supabase-only degrade path — never used in native Postgres mode. */
  let degradedLocal = false;
  let invalidateModeCache: () => void = () => {};

  if (nativePostgres) {
    const handle = createPostgresExperimentStore(env.REVENUEOS_DATABASE_URL!);
    store = handle.store;
    pgPool = handle.pool;
    ledgerMode = await handle.mode();
    // Health probe
    await pgPool.query("select 1");
    logger("info", "operator.boot.ledger_mode", {
      ledgerMode,
      provider: "postgres",
      supabase: "DISABLED",
    });
  } else {
    const sb = createSupabaseStore({
      url: env.SUPABASE_URL!,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY!,
    });
    store = sb.store;
    client = sb.client;
    invalidateModeCache = sb.invalidateModeCache;
    try {
      ledgerMode = await sb.mode();
      logger("info", "operator.boot.ledger_mode", { ledgerMode });
    } catch (error) {
      logger("warn", "operator.boot.ledger_probe_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    if (ledgerMode === "unavailable" || ledgerMode === null) {
      degradedLocal = true;
      ledgerMode = "unavailable";
      invalidateModeCache();
      logger("warn", "operator.boot.degraded_local_ledger", {
        reason: "supabase_unavailable",
        ledgerRoot: localLedgerRoot,
        note: "legacy path only — native Postgres mode does not use this",
      });
    }
  }

  const wanted =
    env.BUSINESSES?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const catalog = getPortfolio();
  const businesses = wanted.length
    ? catalog.filter((b) => wanted.includes(b.siteId))
    : catalog;
  if (businesses.length === 0) {
    logger("error", "operator.boot.abort", { reason: "no_businesses_matched" });
    process.exit(1);
  }
  logger("info", "operator.boot.portfolio", {
    count: businesses.length,
    siteIds: businesses.map((b) => b.siteId),
  });

  const startedAt = new Date().toISOString();
  const abortController = new AbortController();

  let controlState: OwnerControlState;
  try {
    if (nativePostgres && pgPool) {
      controlState = await loadOwnerControlsPg(pgPool);
    } else {
      controlState = await Promise.race([
        loadOwnerControls(client!),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("owner_controls_timeout")), 8_000),
        ),
      ]);
    }
  } catch (error) {
    if (!nativePostgres) degradedLocal = true;
    controlState = {
      portfolioPaused: false,
      pausedBusinesses: [],
      prioritizedBusinesses: [],
      updatedAt: new Date().toISOString(),
      updatedBy: nativePostgres ? "native_default" : "degraded_local",
    };
    logger("warn", "operator.boot.owner_controls_degraded", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  logger("info", "operator.boot.owner_controls", {
    portfolioPaused: controlState.portfolioPaused,
    pausedBusinesses: controlState.pausedBusinesses,
    prioritizedBusinesses: controlState.prioritizedBusinesses,
    degradedLocal,
    dataProvider: env.dataProvider,
  });

  const scheduler = new PortfolioScheduler({
    businesses,
    createAdapter: async (business) => {
      const tickStore =
        nativePostgres
          ? store
          : degradedLocal
            ? (() => {
                const dir = path.join(localLedgerRoot, business.siteId);
                mkdirSync(dir, { recursive: true });
                return createFileExperimentStore(dir);
              })()
            : store;
      if (!nativePostgres && degradedLocal) {
        logger("info", "operator.tick.local_ledger", {
          siteId: business.siteId,
        });
      }
      return createOperatorAdapter({
        manifest: business,
        store: tickStore,
        safeActionSource: listCutoverSafeActions,
        executor: async (action) => {
          if (shadow) {
            return {
              ok: true,
              detail: `shadow_mode: would execute ${action.type}`,
            };
          }
          if (!nativePostgres && degradedLocal) {
            return {
              ok: false,
              detail: `degraded_local_deferred:${action.type}`,
            };
          }
          const cronSecret =
            process.env.CRON_SECRET || process.env.PORTFOLIO_PULSE_TOKEN;
          const commercial = await executeOperatorCommercialAction({
            action,
            manifest: business,
            store: tickStore,
            cronSecret,
          });
          if (commercial.ok) return commercial;
          if (env.SIDECAR_URL && env.SIDECAR_TOKEN && isSidecarAction(action)) {
            return executeThroughSidecar({
              action,
              config: {
                baseUrl: env.SIDECAR_URL,
                token: env.SIDECAR_TOKEN,
                dryRun: env.SIDECAR_DRY_RUN === true,
              },
            });
          }
          return commercial;
        },
      });
    },
    createClaim: async (business) => {
      if (!claimEnabled) {
        return new Date(Date.now() + env.CLAIM_LEASE_MS).toISOString();
      }
      if (nativePostgres && pgPool) {
        try {
          const claim = await claimBusinessPg(pgPool, {
            siteId: business.siteId,
            owner: env.OPERATOR_NAME,
            leaseMs: env.CLAIM_LEASE_MS,
          });
          if (claim?.leaseUntil) return claim.leaseUntil;
        } catch (error) {
          logger("warn", "operator.claim.pg_error", {
            siteId: business.siteId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        return new Date(Date.now() + env.CLAIM_LEASE_MS).toISOString();
      }
      if (degradedLocal) {
        return new Date(Date.now() + env.CLAIM_LEASE_MS).toISOString();
      }
      try {
        const claim = await Promise.race([
          claimBusiness(client!, {
            siteId: business.siteId,
            owner: env.OPERATOR_NAME,
            leaseMs: env.CLAIM_LEASE_MS,
          }),
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 8_000),
          ),
        ]);
        if (claim?.leaseUntil) return claim.leaseUntil;
      } catch (error) {
        logger("warn", "operator.claim.error", {
          siteId: business.siteId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      degradedLocal = true;
      invalidateModeCache();
      logger("warn", "operator.claim.degraded_synthetic", {
        siteId: business.siteId,
      });
      return new Date(Date.now() + env.CLAIM_LEASE_MS).toISOString();
    },
    releaseClaim: async (business) => {
      if (!claimEnabled) return;
      if (nativePostgres && pgPool) {
        await releaseBusinessPg(pgPool, {
          siteId: business.siteId,
          owner: env.OPERATOR_NAME,
        });
        return;
      }
      if (degradedLocal || !client) return;
      await releaseBusiness(client, {
        siteId: business.siteId,
        owner: env.OPERATOR_NAME,
      });
    },
    isCommerciallyPaused: (siteId) =>
      isBusinessCommerciallyPaused(controlState, siteId),
    prioritizeIntervalBoostMs: (siteId) =>
      prioritizeBoostMs(controlState, siteId),
    maxConcurrency: env.MAX_CONCURRENCY,
    perBusinessMinIntervalMs: env.PER_BUSINESS_MIN_INTERVAL_MS,
    tickBudgetMs: env.TICK_BUDGET_MS,
    maxJobsPerTick: env.MAX_JOBS_PER_TICK,
    skipEnqueue: shadow,
    logger,
    signal: abortController.signal,
  });

  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const checkpointPath = defaultCheckpointPath(repoRoot);
  const prior = loadEngineCheckpoint(checkpointPath);
  if (prior) {
    const restored = scheduler.hydrateFromStatuses(prior.businesses);
    logger("info", "operator.boot.checkpoint_restored", {
      path: checkpointPath,
      savedAt: prior.savedAt,
      restored,
    });
  }
  scheduler.setStatusPersist((businesses) => {
    saveEngineCheckpoint(checkpointPath, {
      mode: process.env.REVENUEOS_MODE || "LIVE",
      businesses,
    });
    if (nativePostgres && pgPool) {
      const doc = {
        version: 1,
        savedAt: new Date().toISOString(),
        authority: "mac",
        mode: process.env.REVENUEOS_MODE || "LIVE",
        businesses,
      };
      void persistSchedulerCheckpointPg(pgPool, doc).catch((err) => {
        logger("warn", "operator.checkpoint.pg_persist_failed", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
    }
  });

  const health = createHealthServer({
    port: env.PORT,
    logger: (msg, meta) => logger("info", msg, meta ?? {}),
    client,
    buildNativeDashboard: nativePostgres
      ? async (snap) => {
          const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
          const recentEvents = pgPool
            ? await listRecentNativeActivity(
                pgPool,
                snap.businesses.map((b) => b.siteId),
                since,
                40,
              )
            : [];
          return buildOwnerDashboardNative({
            businesses: snap.businesses,
            uptimeSec: snap.service.uptimeSec,
            startedAt: snap.service.startedAt,
            ownerControls: controlState,
            recentEvents,
            dataProvider: "postgres",
          });
        }
      : undefined,
    getOwnerControls: () => controlState,
    onOwnerControl: async (command, siteId) => {
      if (nativePostgres && pgPool) {
        const result = await applyOwnerControlPg({
          pool: pgPool,
          command: command as ControlCommand,
          siteId,
          actor: "owner-ui",
        });
        if (result.ok) controlState = result.state;
        return result;
      }
      const result = await applyOwnerControl({
        client: client!,
        command: command as ControlCommand,
        siteId,
        actor: "owner-ui",
      });
      if (result.ok) controlState = result.state;
      return result;
    },
    onAddBusiness: (siteId) => {
      const biz = findBusiness(siteId);
      if (!biz) return { ok: false, detail: `unknown business ${siteId}` };
      const added = scheduler.addBusiness(biz);
      return {
        ok: true,
        detail: added
          ? `started loop for ${siteId}`
          : `${siteId} already operating`,
      };
    },
    snapshot: () => ({
      service: {
        name: SERVICE_NAME,
        version: SERVICE_VERSION,
        startedAt,
        uptimeSec: Math.round(
          (Date.now() - Date.parse(startedAt)) / 1000,
        ),
        ledgerMode,
        degradedLocal,
        dataProvider: env.dataProvider,
        dbHealth: nativePostgres ? "DB_HEALTHY" : undefined,
      },
      engine: {
        authority: (nativePostgres ? "azure/native" : "azure") as "mac",
        macBrain: process.env.REVENUEOS_MAC_BRAIN === "1",
        vercelBrainAllowed: process.env.REVENUEOS_VERCEL_BRAIN === "1",
        checkpointPath,
        checkpointSavedAt: loadEngineCheckpoint(checkpointPath)?.savedAt ?? null,
        maxConcurrency: env.MAX_CONCURRENCY,
        tickBudgetMs: env.TICK_BUDGET_MS,
        perBusinessMinIntervalMs: env.PER_BUSINESS_MIN_INTERVAL_MS,
        supervision:
          process.env.REVENUEOS_MAC_BRAIN === "1"
            ? "launchd_keepalive"
            : "systemd_keepalive",
        dataProvider: env.dataProvider,
      },
      businesses: scheduler.getStatuses(),
      cutover: {
        shadowMode: shadow,
        claimEnabled,
        operator: env.OPERATOR_NAME,
        supabaseDisabled: nativePostgres,
      },
      ownerControls: {
        portfolioPaused: controlState.portfolioPaused,
        pausedBusinesses: controlState.pausedBusinesses,
        prioritizedBusinesses: controlState.prioritizedBusinesses,
      },
    }),
  });

  await scheduler.start();
  logger("info", "operator.boot.ready", {
    at: new Date().toISOString(),
    shadowMode: shadow,
    claimEnabled,
  });

  // Azure-owned serial 50-business admission (15-minute healthy probation).
  // Continues without Cursor; checkpointed in ros_config_meta.
  if (
    nativePostgres &&
    pgPool &&
    (process.env.ADMIT_ROLLOUT === "1" || process.env.ADMIT_ROLLOUT === "true")
  ) {
    try {
      const { runPortfolioAdmitController } = await import(
        "./lib/portfolio-admit-controller.js"
      );
      const probationMinutes = Number(
        process.env.ADMIT_PROBATION_MINUTES || "15",
      );
      const targetPortfolio = Number(process.env.ADMIT_TARGET_PORTFOLIO || "50");
      void runPortfolioAdmitController({
        pool: pgPool,
        logger,
        getBusinessStatuses: () => scheduler.getStatuses(),
        getControlState: () => controlState,
        setControlState: (state) => {
          controlState = state;
        },
        platformHealthy: () => {
          try {
            const statuses = scheduler.getStatuses();
            const operating = statuses.filter((s) => !s.commerciallyPaused);
            if (operating.length === 0) return true;
            const recentOk = operating.filter((s) => s.lastOk !== false);
            return recentOk.length / operating.length >= 0.5;
          } catch {
            return true;
          }
        },
        appRoot: repoRoot,
        signal: abortController.signal,
        targetPortfolio,
        probationMinutes,
        tickIntervalMs: Number(process.env.ADMIT_TICK_MS || "30000"),
      }).catch((err) => {
        logger("error", "admit.controller.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "admit.controller.wired", {
        targetPortfolio,
        probationMinutes,
      });

      // Deterministic storefront repair plane (source → vercel --prod → public verify).
      // Does not interrupt probation timers; one repair at a time.
      try {
        const { runStorefrontRepairExecutor } = await import(
          "./lib/storefront-repair-executor.js"
        );
        const { loadAdmitCheckpoint } = await import(
          "./lib/portfolio-admit-controller.js"
        );
        void runStorefrontRepairExecutor({
          pool: pgPool,
          appRoot: repoRoot,
          logger,
          signal: abortController.signal,
          getTitanManaged: () => {
            /* refreshed inside executor via sync; placeholder until first PG read */
            return [];
          },
          getCurrentProbation: () => null,
          intervalMs: Number(process.env.STOREFRONT_REPAIR_INTERVAL_MS || "90000"),
        }).catch((err) => {
          logger("error", "storefront.repair.executor.crash", {
            message: err instanceof Error ? err.message : String(err),
          });
        });
        // Hot-wire accurate getters from admit checkpoint (no probation reset).
        void (async () => {
          const bind = async () => {
            const cp = await loadAdmitCheckpoint(
              pgPool,
              targetPortfolio,
              probationMinutes,
            );
            return cp;
          };
          // Monkey-patch by restarting executor deps is awkward; instead the
          // executor loop reloads titanManaged from checkpoint each cycle below.
          const cp = await bind();
          logger("info", "storefront.repair.executor.wired", {
            version: "storefront-repair-v1",
            titanManaged: cp.titanManaged.length,
            current: cp.currentCandidate,
            deploymentMethod: "vercel_cli_prod",
            ownerExecuteDependency: false,
          });
        })();
      } catch (e) {
        logger("error", "storefront.repair.executor.wire_failed", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    } catch (e) {
      logger("error", "admit.controller.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // PortfolioArchitect evolution — slow cadence; does not interrupt commercial ticks.
  // Skip in native Postgres until architect state is ported off Supabase client.
  // Skip while legacy Supabase is unreachable.
  if (nativePostgres) {
    logger("info", "operator.architect.skipped_native_postgres", {
      note: "architect persistence still Supabase-shaped; commercial ticks unaffected",
    });
  } else if (degradedLocal) {
    logger("warn", "operator.architect.skipped_degraded_local", {});
  } else {
    try {
      const { runEvolutionCycle, loadArchitectState } = await import(
        "./lib/portfolio-evolution.js"
      );
      const evolve = async () => {
        try {
          if (degradedLocal) return;
          const activeSiteIds = scheduler.getStatuses().map((b) => b.siteId);
          const arch = await loadArchitectState(client);
          const ownerRaised =
            arch.ownerPolicy.stopCreatingNewBusinesses === false &&
            (arch.ownerPolicy.maxActiveBusinesses ?? 0) >= 50;
          const result = await runEvolutionCycle({
            client,
            activeSiteIds,
            suppressLaunchSelection: !ownerRaised,
            safetyOverride: ownerRaised
              ? {
                  stopCreatingNewBusinesses: false,
                  maxActiveBusinesses: 50,
                  prioritizeExistingOverNew: true,
                }
              : undefined,
          });
          logger("info", "operator.architect.cycle", {
            opportunities: result.state.opportunities.length,
            launches: result.state.launches.length,
            stopCreating: result.state.safety.stopCreatingNewBusinesses,
            ownerRaised,
            activeCount: activeSiteIds.length,
          });
        } catch (e) {
          logger("warn", "operator.architect.cycle_failed", {
            message: e instanceof Error ? e.message : String(e),
          });
        }
      };
      void evolve();
      const architectTimer = setInterval(() => void evolve(), 30 * 60_000);
      abortController.signal.addEventListener("abort", () =>
        clearInterval(architectTimer),
      );
    } catch (e) {
      logger("warn", "operator.architect.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const shutdown = async (signal: string) => {
    logger("info", "operator.shutdown.start", { signal });
    abortController.abort();
    await Promise.race([
      scheduler.stop(),
      new Promise((resolve) => setTimeout(resolve, 25_000)),
    ]);
    await health.close();
    logger("info", "operator.shutdown.done", {});
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  logger("error", "operator.crash", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
