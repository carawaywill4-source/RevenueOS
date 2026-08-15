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
  discoverOpportunities,
  opportunityToManifest,
  type ExperimentStore,
  type OperatorLoopLogger,
} from "@revenueos/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { hydrateEnvFromFiles, loadEnv } from "./env.js";
import {
  PORTFOLIO,
  findBusiness,
  getPortfolio,
  registerDynamicBusiness,
} from "./portfolio.js";

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
import { buildOwnerDashboardNative, buildBusinessDetailNative } from "./lib/owner-api.js";
import {
  loadAdmitCheckpoint,
  TARGET_PORTFOLIO_DEFAULT,
} from "./lib/portfolio-admit-controller.js";
import { PARALLEL_AUTONOMY_STATE_KEY } from "./lib/parallel-autonomy.js";
import {
  loadLatestJudgment,
  loadPortfolioOriginSummary,
} from "./lib/titan-admission-gate.js";
import {
  worldModelStats,
  loadLatestEvidencePack,
  loadCustomerModel,
  loadMoneyModel,
  loadLatestAcquisitionExperiment,
} from "./lib/titan-world-store.js";
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

  // MissionController — the ONE authority for the commercial mission
  // lifecycle. Boots deterministic status machine + External Progress Clock,
  // initializes xAI as a strategic advisor (never called on hot ticks),
  // and runs a slow tick that detects starvation and enqueues materially
  // different experiments from the seed catalog. Independent of but
  // complementary to the external revenueos-mission-watchdog systemd unit.
  if (nativePostgres && pgPool) {
    try {
      const { startMissionLane } = await import("./lib/mission/lane.js");
      const missionHandle = await startMissionLane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
      });
      logger("info", "mission.lane.wired", {
        missionId: missionHandle.mission.id,
        status: missionHandle.mission.status,
        objective: missionHandle.mission.objective,
      });
    } catch (err) {
      logger("error", "mission.lane.wire_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Shared lane routing state — refreshed from admit checkpoint (no global freeze).
  const admitLaneState = {
    currentCandidate: null as string | null,
    titanManaged: new Set<string>(),
  };

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
    laneReservedRevenue: Number(process.env.LANE_RESERVED_REVENUE || env.LANE_RESERVED_REVENUE || 2),
    laneReservedAdmit: Number(process.env.LANE_RESERVED_ADMIT || env.LANE_RESERVED_ADMIT || 1),
    laneForSite: (siteId) => {
      if (admitLaneState.currentCandidate === siteId) return "admit";
      if (admitLaneState.titanManaged.has(siteId)) return "revenue";
      return "general";
    },
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
    pgPool: pgPool ?? undefined,
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
          let portfolioExtra: Record<string, unknown> = {};
          let lanes: Record<string, string> | undefined;
          let postgresStatus = "unknown";
          let titanJudgment: Record<string, unknown> | null = null;
          let portfolioOrigins: Record<string, number> | null = null;
          let titanIntelligence: Record<string, unknown> | null = null;
          if (pgPool) {
            try {
              await pgPool.query("select 1");
              postgresStatus = "DB_HEALTHY";
            } catch {
              postgresStatus = "DB_UNHEALTHY";
            }
            try {
              const cp = await loadAdmitCheckpoint(
                pgPool,
                TARGET_PORTFOLIO_DEFAULT,
                15,
              );
              const accepted = cp.accepted?.length ?? 0;
              const titan = cp.titanManaged?.length ?? 0;
              const repair = cp.underRepair?.length ?? 0;
              portfolioExtra = {
                accepted: Math.max(accepted, titan),
                active: Math.max(accepted, titan),
                probation: cp.phase === "LIVE_PROBATION" ? 1 : 0,
                repair,
                building: cp.phase === "PREPARING" ? 1 : 0,
                retired: cp.rejected?.length ?? 0,
                rejected: cp.rejected?.length ?? 0,
                currentCandidate: cp.currentCandidate ?? null,
                nextCandidate: cp.candidateQueue?.[0] ?? null,
                admitPhase: cp.phase,
                reworkQueue: cp.reworkQueue ?? [],
                replacementQueue: cp.replacementQueue ?? [],
              };
              titanJudgment =
                (cp.lastTitanJudgment as Record<string, unknown> | null) ??
                ((await loadLatestJudgment(
                  pgPool,
                  cp.currentCandidate,
                )) as Record<string, unknown> | null);
              portfolioOrigins = await loadPortfolioOriginSummary(pgPool);
              try {
                const stats = await worldModelStats(pgPool);
                const pack = cp.currentCandidate
                  ? await loadLatestEvidencePack(
                      pgPool,
                      cp.currentCandidate,
                      "ADMISSION",
                    )
                  : null;
                titanIntelligence = {
                  ...stats,
                  currentEvidencePack: pack
                    ? {
                        businessId: cp.currentCandidate,
                        decisionHint: pack.decisionHint,
                        usefulSources: pack.usefulSources,
                        facts: pack.facts,
                        tenKPath: pack.tenKPath,
                        researchSummary: pack.researchSummary,
                      }
                    : null,
                };
              } catch {
                titanIntelligence = null;
              }
            } catch {
              /* leave empty */
            }
            try {
              const hb = await pgPool.query(
                `select value from ros_config_meta where key=$1`,
                [PARALLEL_AUTONOMY_STATE_KEY],
              );
              const domains = (hb.rows[0]?.value as { domains?: Record<string, { status?: string; lastTickAt?: string; detail?: string }> })
                ?.domains;
              if (domains) {
                const label = (d: string, fallback: string) => {
                  const row = domains[d];
                  if (!row) return fallback;
                  return `${row.status ?? "UNKNOWN"}${row.lastTickAt ? ` · ${row.lastTickAt}` : ""}`;
                };
                lanes = {
                  revenuePursuit: label("REVENUE", "scheduler"),
                  stagedAdmission: label("ADMIT", "admit"),
                  businessRepair: label("REPAIR", "repair"),
                  selfRepair: label("SELF_REPAIR", "self-repair"),
                  learning: label("LEARNING", "learning"),
                  businessEvolution: label("EVOLUTION", "evolution"),
                  codeEvolution: label("CODE_EVOLUTION", "code-evolution"),
                  businessCreation: label("CREATION", "creation"),
                  infrastructure: label("INFRA", "infra"),
                  costControl: label("COST", "cost"),
                };
              }
            } catch {
              /* leave empty */
            }
          }
          return buildOwnerDashboardNative({
            businesses: snap.businesses,
            uptimeSec: snap.service.uptimeSec,
            startedAt: snap.service.startedAt,
            ownerControls: controlState,
            recentEvents,
            dataProvider: "postgres",
            portfolioExtra,
            lanes,
            azureOperator: "azure-revenueos-core",
            postgresStatus,
            titanJudgment: titanJudgment ?? undefined,
            portfolioOrigins: portfolioOrigins ?? undefined,
            titanIntelligence: titanIntelligence ?? undefined,
          });
        }
      : undefined,
    buildNativeBusinessDetail: nativePostgres
      ? async (siteId, runtime) => {
          const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
          const recentEvents = pgPool
            ? await listRecentNativeActivity(pgPool, [siteId], since, 40)
            : [];
          let titanIntel:
            | {
                customer?: Record<string, unknown> | null;
                money?: Record<string, unknown> | null;
                latestAcquisition?: Record<string, unknown> | null;
                evidenceHint?: string | null;
              }
            | undefined;
          if (pgPool) {
            try {
              const [customer, money, latestAcquisition, pack] =
                await Promise.all([
                  loadCustomerModel(pgPool, siteId),
                  loadMoneyModel(pgPool, siteId),
                  loadLatestAcquisitionExperiment(pgPool, siteId),
                  loadLatestEvidencePack(pgPool, siteId),
                ]);
              titanIntel = {
                customer,
                money,
                latestAcquisition,
                evidenceHint: pack
                  ? String(
                      pack.decisionHint ??
                        pack.researchSummary ??
                        "",
                    ) || null
                  : null,
              };
            } catch {
              titanIntel = undefined;
            }
          }
          return buildBusinessDetailNative({
            siteId,
            runtime,
            recentEvents,
            ownerControls: controlState,
            titanIntel,
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
    onInboundEmail: nativePostgres && pgPool
      ? async (req, res) => {
          const mod = await import("./lib/ultron-external/inbound-email.js");
          await mod.handleInboundEmailRequest(
            pgPool,
            (level, event, meta) => logger(level, event, meta ?? {}),
            req,
            res,
          );
        }
      : undefined,
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

  // CUSTOMER ACQUISITION EVOLUTION — freeze net-new; prove existing portfolio
  if (nativePostgres && pgPool) {
    try {
      const { ensureCustomerAcquisitionEvolutionMode } = await import(
        "./lib/titan-commercial-executive/customer-acquisition-evolution.js"
      );
      const cae = await ensureCustomerAcquisitionEvolutionMode(pgPool, logger);
      logger("info", "cae.mode.boot", {
        version: cae.version,
        freezeNetNew: cae.freezeNetNewBusinesses,
        objective: cae.objective,
      });
      const { ensureZeroTrafficWarRoom } = await import(
        "./lib/titan-commercial-executive/zero-traffic-war-room.js"
      );
      const zt = await ensureZeroTrafficWarRoom(pgPool, logger);
      logger("info", "zero_traffic.boot", {
        status: zt.status,
        frontier: zt.frontier,
        thirdPartyAuto: zt.channelReality.thirdPartyAutoExecutable,
        ownedAuto: zt.channelReality.ownedAutoExecutable,
      });
      const { bootCapabilityReality } = await import(
        "./lib/capability-reality/index.js"
      );
      const cap = await bootCapabilityReality(pgPool, logger);
      logger("info", "capability_reality.boot_summary", {
        auto3p: cap.executable.autonomousThirdParty,
        authExec: cap.executable.authenticatedExecutable,
        launchfree: cap.launchfree.status,
        states: cap.audit.counts,
      });
    } catch (e) {
      logger("error", "cae.mode.boot_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

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
        ensureRuntimeBusiness: async (siteId) => {
          let biz = findBusiness(siteId);
          if (!biz) {
            const discovered = discoverOpportunities({
              activeSiteIds: scheduler.getStatuses().map((b) => b.siteId),
              activeIndustries: [],
              telemetry: [],
              maxNewOpportunities: 30,
              ownerPolicy: {
                bannedMarkets: [],
                requestedMarkets: [],
                lockedSiteIds: [],
                stopCreatingNewBusinesses: false,
                maxActiveBusinesses: 50,
                updatedAt: new Date().toISOString(),
              },
              safety: {
                maxActiveBusinesses: 50,
                autonomousBusinessDiscovery: true,
                autonomousIncubation: true,
                autonomousZeroCostLaunch: true,
                autonomousSiteImprovement: true,
                autonomousSoftRetirement: true,
                autonomousPermanentSourceDeletion: false,
                autonomousSpending: false,
                autonomousPaidAds: false,
                autonomousDomainPurchase: false,
                preserveAllLearning: true,
                prioritizeExistingOverNew: false,
                stopCreatingNewBusinesses: false,
              },
              referenceProof: {
                premium_bar_passed: true,
                independent_company_test: true,
                stranger_purchases: 1,
              },
            });
            const opp = discovered.find((o) => o.siteId === siteId);
            if (!opp) {
              return {
                ok: false,
                detail: `no_manifest_or_discovery_prior:${siteId}`,
              };
            }
            biz = opportunityToManifest(
              opp,
              `https://${siteId}.${process.env.HOSTING_PUBLIC_BASE_HOST || process.env.REVENUEOS_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"}`,
              300 + scheduler.getStatuses().length,
            );
            registerDynamicBusiness(biz);
            logger("info", "admit.runtime.registered_dynamic", {
              siteId,
              displayName: biz.displayName,
            });
          }
          const added = scheduler.addBusiness(biz);
          return {
            ok: true,
            detail: added
              ? `hot_added:${siteId}`
              : `already_in_scheduler:${siteId}`,
          };
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
          intervalMs: Number(process.env.STOREFRONT_REPAIR_INTERVAL_MS || "30000"),
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
          admitLaneState.currentCandidate = cp.currentCandidate;
          admitLaneState.titanManaged = new Set(cp.titanManaged);
          logger("info", "storefront.repair.executor.wired", {
            version: "storefront-repair-v2",
            titanManaged: cp.titanManaged.length,
            current: cp.currentCandidate,
            deploymentMethod: "native_azure_hosting_plane",
            ownerExecuteDependency: false,
          });
          // Keep lanes fresh without blocking any worker.
          const refreshLanes = async () => {
            try {
              const latest = await bind();
              admitLaneState.currentCandidate = latest.currentCandidate;
              admitLaneState.titanManaged = new Set(latest.titanManaged);
            } catch {
              /* ignore */
            }
          };
          const laneTimer = setInterval(() => {
            void refreshLanes();
          }, 30_000);
          abortController.signal.addEventListener("abort", () =>
            clearInterval(laneTimer),
          );
        })();
      } catch (e) {
        logger("error", "storefront.repair.executor.wire_failed", {
          message: e instanceof Error ? e.message : String(e),
        });
      }

      // Parallel autonomy domain floors (learning/infra/cost/self-repair).
      try {
        const { runParallelAutonomyCoordinator } = await import(
          "./lib/parallel-autonomy.js"
        );
        const { loadAdmitCheckpoint } = await import(
          "./lib/portfolio-admit-controller.js"
        );
        void runParallelAutonomyCoordinator({
          pool: pgPool,
          logger,
          signal: abortController.signal,
          appRoot: repoRoot,
          getEngineeringDeps: () => ({
            pool: pgPool,
            logger,
            appRoot: repoRoot,
            pauseNewAdmissions: async (reason: string) => {
              const cp = await loadAdmitCheckpoint(
                pgPool,
                targetPortfolio,
                probationMinutes,
              );
              cp.pauseNewAdmissions = true;
              cp.pauseNewAdmissionsReason = reason;
              const { saveAdmitCheckpoint } = await import(
                "./lib/portfolio-admit-controller.js"
              );
              await saveAdmitCheckpoint(pgPool, cp);
            },
            resumeNewAdmissions: async () => {
              const cp = await loadAdmitCheckpoint(
                pgPool,
                targetPortfolio,
                probationMinutes,
              );
              cp.pauseNewAdmissions = false;
              cp.pauseNewAdmissionsReason = null;
              const { saveAdmitCheckpoint } = await import(
                "./lib/portfolio-admit-controller.js"
              );
              await saveAdmitCheckpoint(pgPool, cp);
            },
            pauseBusiness: async (siteId: string) => {
              const r = await applyOwnerControlPg({
                pool: pgPool,
                command: "pause_business",
                siteId,
                actor: "engineering-repair",
              });
              if (r.ok) controlState = r.state;
            },
            resumeBusiness: async (siteId: string) => {
              const r = await applyOwnerControlPg({
                pool: pgPool,
                command: "resume_business",
                siteId,
                actor: "engineering-repair",
              });
              if (r.ok) controlState = r.state;
            },
            markEngineeringBlocked: async () => {
              /* lifecycle updates optional for detached worker */
            },
            getRolloutBusinessNumber: () =>
              admitLaneState.titanManaged.size +
              (admitLaneState.currentCandidate ? 1 : 0),
          }),
          getRevenuePulse: () => {
            const statuses = scheduler
              .getStatuses()
              .filter((s) => !s.commerciallyPaused);
            const recentExecuted = statuses.reduce(
              (n, s) => n + (s.lastExecuted ?? 0),
              0,
            );
            return {
              activeBusinesses: statuses.length,
              recentExecuted,
            };
          },
          intervalMs: Number(process.env.PARALLEL_AUTONOMY_INTERVAL_MS || "45000"),
        }).catch((err) => {
          logger("error", "parallel.autonomy.crash", {
            message: err instanceof Error ? err.message : String(err),
          });
        });
        logger("info", "parallel.autonomy.wired", {
          version: "parallel-autonomy-v1",
        });
      } catch (e) {
        logger("error", "parallel.autonomy.wire_failed", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    } catch (e) {
      logger("error", "admit.controller.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // PortfolioArchitect + CODE_EVOLUTION — Postgres-durable, non-blocking lanes.
  if (nativePostgres && pgPool) {
    try {
      const { runBusinessArchitectLoop } = await import(
        "./lib/business-architect-loop.js"
      );
      void runBusinessArchitectLoop({
        pool: pgPool,
        appRoot: repoRoot,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.BUSINESS_ARCHITECT_INTERVAL_MS || "60000"),
      }).catch((err) => {
        logger("error", "architect.loop.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "architect.loop.wired", {
        version: "business-architect-pg-v1",
        persistence: "ros_portfolio_state + ros_config_meta",
      });
    } catch (e) {
      logger("error", "architect.loop.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const { runCodeEvolutionLoop } = await import(
        "./lib/code-evolution-executor.js"
      );
      void runCodeEvolutionLoop({
        pool: pgPool,
        appRoot: repoRoot,
        logger,
        signal: abortController.signal,
        preferSiteId: "storelift",
        getManagedSiteIds: () => {
          if (admitLaneState.titanManaged.size > 0) {
            return [...admitLaneState.titanManaged];
          }
          // Boot race: lane refresh may lag first code-evolution tick.
          return scheduler
            .getStatuses()
            .filter((s) => !s.commerciallyPaused)
            .map((s) => s.siteId);
        },
        intervalMs: Number(process.env.CODE_EVOLUTION_INTERVAL_MS || "120000"),
      }).catch((err) => {
        logger("error", "code_evolution.loop.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "code_evolution.loop.wired", {
        version: "code-evolution-v1",
        preferSiteId: "storelift",
      });
    } catch (e) {
      logger("error", "code_evolution.loop.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const { runTitanCommercialExecutiveLane } = await import(
        "./lib/titan-commercial-executive/index.js"
      );
      void runTitanCommercialExecutiveLane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
        intervalMs: Number(
          process.env.COMMERCIAL_EXECUTIVE_INTERVAL_MS || "120000",
        ),
        getManagedSiteIds: () => {
          if (admitLaneState.titanManaged.size > 0) {
            return [...admitLaneState.titanManaged];
          }
          return scheduler
            .getStatuses()
            .filter((s) => !s.commerciallyPaused)
            .map((s) => s.siteId);
        },
      }).catch((err) => {
        logger("error", "commercial.executive.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "commercial.executive.lane.wired", {
        version: "titan-commercial-executive-v5.3-zero-traffic",
        unattendedOwnerOffline: true,
        customerAcquisitionEvolution: true,
        freezeNetNewBusinesses: true,
        zeroTrafficWarRoom: true,
      });
    } catch (e) {
      logger("error", "commercial.executive.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const { runTitanWorldIntelligenceLane } = await import(
        "./lib/titan-world-lane.js"
      );
      void runTitanWorldIntelligenceLane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.TITAN_WORLD_INTERVAL_MS || "90000"),
        getManagedSiteIds: () => {
          if (admitLaneState.titanManaged.size > 0) {
            return [...admitLaneState.titanManaged];
          }
          return scheduler
            .getStatuses()
            .filter((s) => !s.commerciallyPaused)
            .map((s) => s.siteId);
        },
      }).catch((err) => {
        logger("error", "titan.world.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "titan.world.lane.wired", {
        version: "titan-world-lane-v1",
      });
    } catch (e) {
      logger("error", "titan.world.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const { runAcceptedBusinessChallengeLane } = await import(
        "./lib/accepted-business-challenge.js"
      );
      void runAcceptedBusinessChallengeLane({
        pool: pgPool,
        appRoot: repoRoot,
        logger,
        signal: abortController.signal,
        intervalMs: Number(
          process.env.ACCEPTED_CHALLENGE_INTERVAL_MS || "180000",
        ),
      }).catch((err) => {
        logger("error", "accepted_challenge.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "accepted_challenge.lane.wired", {
        version: "accepted-challenge-v1",
      });
    } catch (e) {
      logger("error", "accepted_challenge.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    try {
      const { runCoreEvolutionLane } = await import(
        "./lib/core-evolution-executor.js"
      );
      void runCoreEvolutionLane({
        pool: pgPool,
        appRoot: repoRoot,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.CORE_EVOLUTION_INTERVAL_MS || "600000"),
      }).catch((err) => {
        logger("error", "core_evolution.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "core_evolution.lane.wired", {
        version: "core-evolution-v1",
      });
    } catch (e) {
      logger("error", "core_evolution.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    // AUTONOMOUS ENGINEERING BRAIN — observe→patch→test→deploy→measure
    try {
      const {
        runAutonomousEngineeringLane,
        AE_VERSION,
        NOVEL_VERSION,
        NOVEL_PROJECT_DISTRIBUTION,
      } = await import("./lib/autonomous-engineering/index.js");
      void runAutonomousEngineeringLane({
        pool: pgPool,
        appRoot: repoRoot,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.AE_INTERVAL_MS || "180000"),
      }).catch((err) => {
        logger("error", "ae.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "ae.lane.wired", {
        version: AE_VERSION,
        novel: NOVEL_VERSION,
        novelProject: NOVEL_PROJECT_DISTRIBUTION,
        aeV3: "AE_NOVEL_EXTERNAL_ACTION_002",
      });
    } catch (e) {
      logger("error", "ae.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    // ULTRON ECONOMIC CORE — cognitive substrate + first-task loop.
    try {
      const { runUltronCoreLane, ULTRON_VERSION } = await import(
        "./lib/ultron-core/index.js"
      );
      void runUltronCoreLane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.ULTRON_INTERVAL_MS || "300000"),
      }).catch((err) => {
        logger("error", "ultron.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "ultron.lane.wired", {
        version: ULTRON_VERSION,
        firstTask: "ULTRON_FIRST_EXTERNAL_EXPOSURE_001",
      });
    } catch (e) {
      logger("error", "ultron.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }

    // ULTRON EXTERNAL AGENCY — browser operator, attribution, verification,
    // inbound email, identity OS, skill promotion, Cursor-teacher primitives.
    try {
      const { runUltronExternalLane, ULTRON_EXTERNAL_VERSION } = await import(
        "./lib/ultron-external/lane.js"
      );
      void runUltronExternalLane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.ULTRON_EXTERNAL_INTERVAL_MS || "300000"),
      }).catch((err) => {
        logger("error", "ultron.external.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "ultron.external.lane.wired", {
        version: ULTRON_EXTERNAL_VERSION,
      });
      const { runHardcoreLane } = await import("./lib/ultron-external/hardcore-mode.js");
      void runHardcoreLane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
      }).catch((err) => {
        logger("error", "ultron.hardcore.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "ultron.hardcore.lane.wired", { windowHours: 8 });
      const { runCommercialExecutionV4Lane, CEE_VERSION } = await import(
        "./lib/commercial-execution-v4/index.js"
      );
      void runCommercialExecutionV4Lane({
        pool: pgPool,
        logger,
        signal: abortController.signal,
        intervalMs: Number(process.env.CEE_V4_INTERVAL_MS || "45000"),
      }).catch((err) => {
        logger("error", "cee.v4.lane.crash", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      logger("info", "cee.v4.lane.wired", { version: CEE_VERSION });
    } catch (e) {
      logger("error", "ultron.external.lane.wire_failed", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
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
