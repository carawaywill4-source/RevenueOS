/**
 * ULTRON CORE — main lane.
 *
 * Runs at a modest cadence and drives the full loop:
 *   1. Refresh world model from live tables.
 *   2. Refresh capability graph (C0–C6) from live evidence.
 *   3. Seed / refresh skill library.
 *   4. Ingest external events (email/traffic/inbound).
 *   5. Refresh proof ledger.
 *   6. Refresh automatic curriculum.
 *   7. Run closed-loop sweep.
 *   8. Detect local maxima.
 *   9. Tick the first unknown task.
 *  10. Recompute the gap map so downstream lanes can consult it.
 *
 * Everything is idempotent + safe to run on top of the existing brains.
 */

import type pg from "pg";
import type { Logger } from "./types.js";
import { ULTRON_VERSION } from "./types.js";
import { ensureUltronCoreTables } from "./schema.js";
import { refreshWorldModel } from "./world-model.js";
import { refreshCapabilityGraph } from "./capability-graph.js";
import { seedSkillLibrary } from "./skill-library.js";
import { ingestExternalEvents } from "./event-bus.js";
import { refreshProofLedger } from "./proof-ledger.js";
import { refreshCurriculum } from "./curriculum.js";
import { runClosedLoopSweep } from "./closed-loop-watcher.js";
import { detectAndBreak } from "./local-max-breaker.js";
import { runFirstTaskTick } from "./first-task.js";
import { computeGapMap } from "./gap-map.js";

export async function runUltronCoreTick(
  pool: pg.Pool,
  logger: Logger,
): Promise<void> {
  await ensureUltronCoreTables(pool);

  const wm = await refreshWorldModel(pool, logger);
  const cg = await refreshCapabilityGraph(pool, logger);
  const sk = await seedSkillLibrary(pool, logger);
  const ev = await ingestExternalEvents(pool, logger);
  const pl = await refreshProofLedger(pool, logger);
  const cu = await refreshCurriculum(pool, logger);
  const cl = await runClosedLoopSweep(pool, logger);
  const lm = await detectAndBreak(pool, logger);
  const ft = await runFirstTaskTick(pool, logger);
  const gm = await computeGapMap(pool, logger);

  logger("info", "ultron.tick.summary", {
    version: ULTRON_VERSION,
    worldFactsRefreshed: wm.facts,
    capabilities: cg.capabilities,
    capabilityProof: cg.byProof,
    skillsSeeded: sk.seeded,
    skillsVerified: sk.verified,
    eventsIngested: ev.ingested,
    proofClaims: pl.claims,
    curriculumAchieved: cu.achieved,
    curriculumHighest: cu.highest,
    closedLoopDefects: cl.opened,
    localMaxTriggered: lm.triggered,
    firstTaskStatus: ft.status,
    firstTaskChosen: ft.chosen,
    gapMapEntries: gm.entries.length,
    gapMapMissing: gm.missingLinks.length,
  });
}

export async function runUltronCoreLane(input: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  const interval = input.intervalMs ?? 300_000; // 5m
  input.logger("info", "ultron.lane.start", {
    version: ULTRON_VERSION,
    intervalMs: interval,
  });
  while (!input.signal.aborted) {
    try {
      await runUltronCoreTick(input.pool, input.logger);
    } catch (e) {
      input.logger("error", "ultron.lane.error", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
    await new Promise<void>((resolve) => {
      if (input.signal.aborted) return resolve();
      const t = setTimeout(resolve, interval);
      input.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });
  }
}
