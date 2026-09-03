/**
 * Parallel Titan World Intelligence lane.
 * Non-blocking: never awaits inside admit/revenue critical path.
 */

import type pg from "pg";
import { loadAdmitCheckpoint } from "./portfolio-admit-controller.js";
import { buildEvidencePack } from "./titan-evidence-pack.js";
import {
  FIRST_HUMAN_PRIORITY,
  runAcquisitionExperiment,
} from "./titan-acquisition.js";
import {
  createReworkDecisionExperiment,
  ensureDecisionLifecycleTables,
  measurePendingDecisionExperiments,
  verifyPriorityClaims,
} from "./titan-decision-lifecycle.js";
import {
  ensureTitanWorldTables,
  loadLatestEvidencePack,
  loadLatestAcquisitionExperiment,
  worldModelStats,
} from "./titan-world-store.js";
import {
  ensureTrafficTables,
  ingestCaddyAccessLog,
} from "./traffic-ingest.js";
import { runAcquisitionOsTick } from "./acquisitionos/index.js";

export const TITAN_WORLD_LANE_VERSION = "titan-world-lane-v1";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

export async function runTitanWorldIntelligenceLane(input: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
  getManagedSiteIds?: () => string[];
}): Promise<void> {
  const interval = input.intervalMs ?? 90_000;
  await ensureTitanWorldTables(input.pool);
  await ensureDecisionLifecycleTables(input.pool);
  await ensureTrafficTables(input.pool);
  input.logger("info", "titan.world.lane.start", {
    version: TITAN_WORLD_LANE_VERSION,
  });

  let acquisitionCursor = 0;

  while (!input.signal.aborted) {
    try {
      // MEASUREMENT: ingest edge access logs → classify INTERNAL/BOT/LIKELY_HUMAN.
      try {
        await ingestCaddyAccessLog({
          pool: input.pool,
          logger: input.logger,
        });
      } catch {
        /* non-blocking */
      }

      const cp = await loadAdmitCheckpoint(input.pool, 50, 15);

      // Close admission/rework loops: ensure decision records + measure outcomes.
      for (const siteId of (cp.reworkQueue ?? []).slice(0, 3)) {
        try {
          await createReworkDecisionExperiment({
            pool: input.pool,
            businessId: siteId,
            decisionType: "REWORK_BEFORE_ADMISSION",
            mutationRequested: "RESTORE_PUBLIC_STOREFRONT",
            mutationAuthorization: "backfill:rework_queue",
            baseline: { source: "world_lane_backfill" },
            logger: input.logger,
          });
        } catch {
          /* non-blocking */
        }
      }
      const measured = await measurePendingDecisionExperiments({
        pool: input.pool,
        limit: 2,
        logger: input.logger,
      });
      if (measured > 0) {
        input.logger("info", "titan.world.decisions_measured", { measured });
      }

      // Bounded claim verification (quality over volume).
      await verifyPriorityClaims({
        pool: input.pool,
        limit: 6,
        logger: input.logger,
      });
      const candidate = cp.currentCandidate;
      if (candidate && !cp.pauseNewAdmissions) {
        const existing = await loadLatestEvidencePack(
          input.pool,
          candidate,
          "ADMISSION",
        );
        const ageMs = existing?.createdAt
          ? Date.now() - Date.parse(String(existing.createdAt))
          : Number.POSITIVE_INFINITY;
        // Reuse fresh packs; force refresh only when stale (>45m).
        if (!existing || ageMs > 45 * 60_000) {
          await buildEvidencePack({
            pool: input.pool,
            businessId: candidate,
            purpose: "ADMISSION",
            forceRefresh: Boolean(existing),
            logger: input.logger,
          });
        }
      }

      // AcquisitionOS — primary customer-reach lane (discover/execute/measure).
      const managedForAcq = cp.titanManaged ?? [];
      if (managedForAcq.length > 0) {
        try {
          await runAcquisitionOsTick({
            pool: input.pool,
            logger: input.logger,
            managedSiteIds: managedForAcq,
          });
        } catch (e) {
          input.logger("warn", "acquisitionos.tick_error", {
            error: e instanceof Error ? e.message : String(e),
          });
        }

        // Legacy IndexNow probe — rare heartbeat only (not counted as distribution).
        const prefer = [
          ...FIRST_HUMAN_PRIORITY,
          "merchantbrain",
          "resumestrike",
          "menumoney",
          "launchcopy",
        ];
        const ordered = [
          ...prefer.filter((s) => managedForAcq.includes(s)),
          ...managedForAcq.filter((s) => !prefer.includes(s)),
        ];
        for (let i = 0; i < ordered.length; i++) {
          const site = ordered[(acquisitionCursor + i) % ordered.length]!;
          const prior = await loadLatestAcquisitionExperiment(input.pool, site);
          const priorAge = prior?.createdAt
            ? Date.now() - Date.parse(String(prior.createdAt))
            : Number.POSITIVE_INFINITY;
          // Much slower than AcquisitionOS — avoid empty-activity loops.
          const minGap = 12 * 60 * 60_000;
          if (prior && priorAge < minGap) continue;
          await runAcquisitionExperiment({
            pool: input.pool,
            businessId: site,
            logger: input.logger,
          });
          acquisitionCursor =
            (ordered.indexOf(site) + 1) % Math.max(1, ordered.length);
          break;
        }
      }

      // Refresh evidence for a rotating managed business (curiosity / bottleneck).
      const managed = input.getManagedSiteIds?.() ?? cp.titanManaged ?? [];
      if (managed.length) {
        const idx = Math.floor(Date.now() / interval) % managed.length;
        const siteId = managed[idx]!;
        const existing = await loadLatestEvidencePack(
          input.pool,
          siteId,
          "BOTTLENECK",
        );
        const ageMs = existing?.createdAt
          ? Date.now() - Date.parse(String(existing.createdAt))
          : Number.POSITIVE_INFINITY;
        if (!existing || ageMs > 3 * 60 * 60_000) {
          await buildEvidencePack({
            pool: input.pool,
            businessId: siteId,
            purpose: "BOTTLENECK",
            forceRefresh: Boolean(existing),
            logger: input.logger,
          });
        }
      }

      // Open-world opportunity discovery → Opportunity Bench (not prior-capped).
      // FROZEN under CUSTOMER_ACQUISITION_EVOLUTION — prove existing portfolio first.
      try {
        const cae = await input.pool.query(
          `select value->>'enabled' as en, value->>'freezeNetNewBusinesses' as fr
           from ros_config_meta where key='customer_acquisition_evolution_mode'`,
        );
        const frozen =
          cae.rows[0]?.en === "true" || cae.rows[0]?.fr === "true";
        if (frozen) {
          input.logger("info", "titan.world.open_opportunity.frozen_cae", {
            reason: "acquire_customers_for_existing_portfolio",
          });
        } else {
          const { runOpenWorldOpportunityDiscovery } = await import(
            "./open-world-opportunity.js"
          );
          const { listOpportunityBench } = await import(
            "./opportunity-bench-pg.js"
          );
          const benchSize = (await listOpportunityBench(input.pool)).length;
          const due =
            benchSize === 0 || Math.floor(Date.now() / interval) % 3 === 0;
          if (due) {
            const found = await runOpenWorldOpportunityDiscovery({
              pool: input.pool,
              logger: input.logger,
            });
            if (found) {
              input.logger("info", "titan.world.open_opportunity", {
                siteId: found.siteId,
                origin: found.origin,
                score: found.expected_value,
                offer: found.offer,
              });
            }
          }
        }
      } catch (owErr) {
        input.logger("warn", "titan.world.open_opportunity_failed", {
          message: owErr instanceof Error ? owErr.message : String(owErr),
        });
      }

      const stats = await worldModelStats(input.pool);
      input.logger("info", "titan.world.lane.tick", {
        version: TITAN_WORLD_LANE_VERSION,
        candidate,
        stats,
      });
    } catch (err) {
      input.logger("warn", "titan.world.lane.tick_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(interval, input.signal);
  }
}
