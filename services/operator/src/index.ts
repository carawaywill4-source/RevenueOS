/**
 * Persistent RevenueOS operator service.
 *
 * The serverless form runs each business's brain in a 60-second Vercel
 * cron burst, once per hour. This service runs the same brain in a
 * long-lived Node process — real event loop, sub-minute tick cadence,
 * no cold-start.
 *
 * Boot sequence:
 *   1. Parse env (fails fast if Supabase creds are missing).
 *   2. Wire the Supabase-backed ExperimentStore.
 *   3. Register a fly.io-friendly SIGTERM handler that flips an AbortController.
 *   4. Start the HTTP health/status server on :8080.
 *   5. For each business in the manifest, spawn a scheduler task that:
 *        - claims the business (revenueos_operator_claims)
 *        - constructs the portable adapter with the sidecar-backed executor
 *        - runs runOperatorTick under the shared concurrency semaphore
 *   6. On SIGTERM, release claims and stop the loop within grace period.
 */

import {
  createFileExperimentStore,
  createOperatorAdapter,
  type OperatorLoopLogger,
} from "@revenueos/core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

  logger("info", "operator.boot.start", {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    operator: env.OPERATOR_NAME,
    maxConcurrency: env.MAX_CONCURRENCY,
    tickBudgetMs: env.TICK_BUDGET_MS,
    shadowMode: shadow,
    claimEnabled,
    authority: "mac",
    macBrain: process.env.REVENUEOS_MAC_BRAIN === "1",
  });

  const { store, mode, client, invalidateModeCache } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const localLedgerRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../.data/operator-local-ledger",
  );

  let ledgerMode: OperatorLedgerMode | null = null;
  /** When Supabase REST hangs/fails, keep Mac Core ticking on local file ledgers. */
  let degradedLocal = false;
  try {
    ledgerMode = await mode();
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
      note: "ticks continue on file ledger until Supabase responds",
    });
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
    controlState = await Promise.race([
      loadOwnerControls(client),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("owner_controls_timeout")), 8_000),
      ),
    ]);
  } catch (error) {
    degradedLocal = true;
    controlState = {
      portfolioPaused: false,
      pausedBusinesses: [],
      prioritizedBusinesses: [],
      updatedAt: new Date().toISOString(),
      updatedBy: "degraded_local",
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
  });

  const scheduler = new PortfolioScheduler({
    businesses,
    createAdapter: async (business) => {
      const tickStore = degradedLocal
        ? (() => {
            const dir = path.join(localLedgerRoot, business.siteId);
            mkdirSync(dir, { recursive: true });
            return createFileExperimentStore(dir);
          })()
        : store;
      if (degradedLocal) {
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
          if (degradedLocal) {
            // Do not pretend commerce happened — defer until Supabase/coordination recovers.
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
      if (!claimEnabled || degradedLocal) {
        // Synthetic lease so Mac scheduler keeps ticking when claims table
        // is unavailable; Vercel routes hard-refuse the brain (Phase 2).
        return new Date(Date.now() + env.CLAIM_LEASE_MS).toISOString();
      }
      try {
        const claim = await Promise.race([
          claimBusiness(client, {
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
      if (!claimEnabled || degradedLocal) return;
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
  });

  const health = createHealthServer({
    port: env.PORT,
    logger: (msg, meta) => logger("info", msg, meta ?? {}),
    client,
    getOwnerControls: () => controlState,
    onOwnerControl: async (command, siteId) => {
      const result = await applyOwnerControl({
        client,
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
      },
      engine: {
        authority: "mac" as const,
        macBrain: process.env.REVENUEOS_MAC_BRAIN === "1",
        vercelBrainAllowed: process.env.REVENUEOS_VERCEL_BRAIN === "1",
        checkpointPath,
        checkpointSavedAt: loadEngineCheckpoint(checkpointPath)?.savedAt ?? null,
        maxConcurrency: env.MAX_CONCURRENCY,
        tickBudgetMs: env.TICK_BUDGET_MS,
        perBusinessMinIntervalMs: env.PER_BUSINESS_MIN_INTERVAL_MS,
        supervision: "launchd_keepalive",
      },
      businesses: scheduler.getStatuses(),
      cutover: {
        shadowMode: shadow,
        claimEnabled,
        operator: env.OPERATOR_NAME,
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

  // PortfolioArchitect evolution — slow cadence; does not interrupt commercial ticks.
  // Owner-authorized 50-business reset raises throughput; otherwise suppress auto-spawn.
  // Skip while Supabase is unreachable — evolution cannot persist and would only hang.
  if (degradedLocal) {
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
