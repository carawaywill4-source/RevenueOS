/**
 * Hardcore watchdog v2 — heartbeats for commercial lanes.
 * Silent hangs are recorded and the acquisition lane self-continues.
 */

import type pg from "pg";
import { ensureCommercialExecutionSchema } from "./schema.js";

const STALL_MS: Record<string, number> = {
  APEX: 180_000,
  Titan: 240_000,
  Forge: 300_000,
  AcquisitionExecutor: 120_000,
  Hardcore: 90_000,
  email: 300_000,
  surface_hunter: 180_000,
  checkout: 600_000,
  self_repair: 300_000,
};

export async function beat(
  pool: pg.Pool,
  lane: string,
  ok = true,
  error = "",
  meta: Record<string, unknown> = {},
): Promise<void> {
  await ensureCommercialExecutionSchema(pool);
  await pool.query(
    `insert into ros_lane_heartbeats (lane, last_beat_at, last_ok, last_error, meta)
     values ($1, now(), $2, $3, $4::jsonb)
     on conflict (lane) do update set
       last_beat_at=now(),
       last_ok=excluded.last_ok,
       last_error=excluded.last_error,
       meta=excluded.meta,
       recoveries = ros_lane_heartbeats.recoveries + case
         when ros_lane_heartbeats.last_ok=false and excluded.last_ok=true then 1 else 0 end`,
    [lane, ok, error.slice(0, 240), JSON.stringify(meta)],
  );
}

export async function detectStalls(
  pool: pg.Pool,
): Promise<Array<{ lane: string; stalledMs: number; recovered: boolean }>> {
  await ensureCommercialExecutionSchema(pool);
  const rows = await pool.query(`select lane, last_beat_at, last_ok, stalls from ros_lane_heartbeats`);
  const out: Array<{ lane: string; stalledMs: number; recovered: boolean }> = [];
  const now = Date.now();
  for (const row of rows.rows) {
    const lane = String(row.lane);
    const last = new Date(row.last_beat_at).getTime();
    const limit = STALL_MS[lane] ?? 180_000;
    const stalledMs = now - last;
    if (stalledMs > limit) {
      await pool.query(
        `update ros_lane_heartbeats
            set stalls=stalls+1, last_ok=false, last_error='stalled'
          where lane=$1`,
        [lane],
      );
      out.push({ lane, stalledMs, recovered: false });
    }
  }
  return out;
}
