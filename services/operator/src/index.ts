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
  createOperatorAdapter,
  type OperatorLoopLogger,
} from "@revenueos/core";
import { hydrateEnvFromFiles, loadEnv } from "./env.js";
import { PORTFOLIO } from "./portfolio.js";
import {
  createSupabaseStore,
  type OperatorLedgerMode,
} from "./lib/supabase-store.js";
import { claimBusiness, releaseBusiness } from "./lib/claims.js";
import {
  executeThroughSidecar,
  isSidecarAction,
} from "./lib/sidecar-executor.js";
import { listOperatorSafeActions } from "./lib/safe-actions.js";
import { PortfolioScheduler } from "./lib/scheduler.js";
import { createHealthServer } from "./lib/health-server.js";

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
  logger("info", "operator.boot.start", {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    operator: env.OPERATOR_NAME,
    maxConcurrency: env.MAX_CONCURRENCY,
    tickBudgetMs: env.TICK_BUDGET_MS,
    shadowMode: shadow,
    claimEnabled,
  });

  const { store, mode, client } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  let ledgerMode: OperatorLedgerMode | null = null;
  try {
    ledgerMode = await mode();
    logger("info", "operator.boot.ledger_mode", { ledgerMode });
  } catch (error) {
    logger("warn", "operator.boot.ledger_probe_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (ledgerMode === "unavailable") {
    logger("error", "operator.boot.abort", {
      reason: "supabase_unavailable",
      hint: "check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    });
    process.exit(1);
  }

  const wanted =
    env.BUSINESSES?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const businesses = wanted.length
    ? PORTFOLIO.filter((b) => wanted.includes(b.siteId))
    : PORTFOLIO;
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

  const scheduler = new PortfolioScheduler({
    businesses,
    createAdapter: async (business) =>
      createOperatorAdapter({
        manifest: business,
        store,
        safeActionSource: listOperatorSafeActions,
        executor: async (action) => {
          if (shadow) {
            return {
              ok: true,
              detail: `shadow_mode: would execute ${action.type}`,
            };
          }
          if (!env.SIDECAR_URL || !env.SIDECAR_TOKEN) {
            return {
              ok: false,
              detail: `sidecar not configured — cannot execute ${action.type}`,
            };
          }
          if (!isSidecarAction(action)) {
            return {
              ok: false,
              detail: `operator has no local executor for ${action.type}`,
            };
          }
          return executeThroughSidecar({
            action,
            config: {
              baseUrl: env.SIDECAR_URL,
              token: env.SIDECAR_TOKEN,
              dryRun: env.SIDECAR_DRY_RUN === true,
            },
          });
        },
      }),
    createClaim: async (business) => {
      if (!claimEnabled) {
        // Synthetic lease so the scheduler still ticks; Vercel remains owner.
        return new Date(Date.now() + env.CLAIM_LEASE_MS).toISOString();
      }
      const claim = await claimBusiness(client, {
        siteId: business.siteId,
        owner: env.OPERATOR_NAME,
        leaseMs: env.CLAIM_LEASE_MS,
      });
      return claim?.leaseUntil ?? null;
    },
    releaseClaim: async (business) => {
      if (!claimEnabled) return;
      await releaseBusiness(client, {
        siteId: business.siteId,
        owner: env.OPERATOR_NAME,
      });
    },
    maxConcurrency: env.MAX_CONCURRENCY,
    perBusinessMinIntervalMs: env.PER_BUSINESS_MIN_INTERVAL_MS,
    tickBudgetMs: env.TICK_BUDGET_MS,
    maxJobsPerTick: env.MAX_JOBS_PER_TICK,
    skipEnqueue: shadow,
    logger,
    signal: abortController.signal,
  });

  const health = createHealthServer({
    port: env.PORT,
    logger: (msg, meta) => logger("info", msg, meta ?? {}),
    snapshot: () => ({
      service: {
        name: SERVICE_NAME,
        version: SERVICE_VERSION,
        startedAt,
        uptimeSec: Math.round(
          (Date.now() - Date.parse(startedAt)) / 1000,
        ),
        ledgerMode,
      },
      businesses: scheduler.getStatuses(),
      cutover: {
        shadowMode: shadow,
        claimEnabled,
        operator: env.OPERATOR_NAME,
      },
    }),
  });

  await scheduler.start();
  logger("info", "operator.boot.ready", {
    at: new Date().toISOString(),
    shadowMode: shadow,
    claimEnabled,
  });

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
