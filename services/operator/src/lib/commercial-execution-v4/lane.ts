/**
 * Commercial Execution Engine v4 lane.
 * Runs frequently. Hunt + email burst + directory climb per cycle.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { ensureCommercialExecutionSchema } from "./schema.js";
import { runAcquisitionTick } from "./executor.js";
import { evaluateRetireCandidates, recordOfferEconomics, countActiveBusinesses } from "./retirement.js";
import { beat, detectStalls } from "./watchdog.js";
import { CEE_VERSION } from "./schema.js";

export { CEE_VERSION };

export async function runCommercialExecutionV4Lane(input: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  input.logger("info", "cee.v4.lane.start", { version: CEE_VERSION });
  let retiredOnce = false;
  while (!input.signal.aborted) {
    try {
      await ensureCommercialExecutionSchema(input.pool);
      await beat(input.pool, "AcquisitionExecutor", true, "", { phase: "tick_start" });
      const stalls = await detectStalls(input.pool);
      if (stalls.length) {
        input.logger("warn", "cee.v4.watchdog.stalls", { stalls });
      }

      if (!retiredOnce) {
        const retired = await evaluateRetireCandidates(input.pool);
        if (retired.length) {
          input.logger("info", "cee.v4.darwinism", {
            retired: retired.filter((r) => r.retired).map((r) => r.siteId),
            kept: retired.filter((r) => !r.retired).map((r) => r.siteId),
            active: await countActiveBusinesses(input.pool),
          });
        }
        retiredOnce = true;
      }

      const tick = await Promise.race([
        runAcquisitionTick(input.pool, input.logger),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("cee_v4_tick_timeout_110s")), 110_000),
        ),
      ]);
      const frontier = String(tick.businessId ?? "buildgrid");
      await recordOfferEconomics(input.pool, frontier).catch(() => undefined);
      await beat(input.pool, "AcquisitionExecutor", true, "", { phase: "tick_done", ...tick });
      input.logger("info", "cee.v4.tick", {
        version: CEE_VERSION,
        ...tick,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      input.logger("error", "cee.v4.tick_error", { e: msg });
      await beat(input.pool, "AcquisitionExecutor", false, msg).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    const wait = input.intervalMs ?? 45_000;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, wait);
      const onAbort = () => {
        clearTimeout(t);
        resolve();
      };
      input.signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  input.logger("info", "cee.v4.lane.stop", {});
}
