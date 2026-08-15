/**
 * Overnight unattended autonomy — owner/Cursor/Mac not required.
 */

import type pg from "pg";

export const UNATTENDED_MODE_KEY = "unattended_owner_offline_mode";
export const OVERNIGHT_LOG_KEY = "overnight_commercial_log";

export function isOwnerOfflineMode(): boolean {
  const v = String(process.env.UNATTENDED_OWNER_OFFLINE_MODE ?? "true").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function ensureUnattendedMode(pool: pg.Pool): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1, $2::jsonb, now(), 'COMMERCIAL_EXECUTIVE')
     on conflict (key) do update set
       value = excluded.value || ros_config_meta.value,
       updated_at = now()`,
    [
      UNATTENDED_MODE_KEY,
      JSON.stringify({
        enabled: true,
        cursorRequired: false,
        macAwakeRequired: false,
        ownerRequiredForNormalOperation: false,
        allowPaidAi: false,
        ownerActions: "QUEUED_FOR_OWNER_NONBLOCKING",
        azureAuthoritative: true,
        updatedAt: new Date().toISOString(),
        note: "Owner offline — Titan continues; blockers queue only",
      }),
    ],
  );
}

export async function appendOvernightLog(
  pool: pg.Pool,
  event: Record<string, unknown>,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [OVERNIGHT_LOG_KEY],
  );
  const doc = (res.rows[0]?.value ?? { events: [] }) as {
    events?: Array<Record<string, unknown>>;
  };
  const events = Array.isArray(doc.events) ? [...doc.events] : [];
  events.push({ ...event, at: new Date().toISOString() });
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COMMERCIAL_EXECUTIVE')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [
      OVERNIGHT_LOG_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        events: events.slice(-500),
      }),
    ],
  );
}

/** Detect ceremonial cycles: ticks up, meaningful work flat. */
export async function detectExecutiveStagnation(
  pool: pg.Pool,
): Promise<{ stagnant: boolean; detail: string }> {
  const cycles = await pool.query(
    `select count(*)::int as n from titan_commercial_executive_cycles
     where started_at > now() - interval '2 hours'`,
  );
  const progress = await pool.query(
    `select count(*)::int as n from titan_commercial_progress_events
     where created_at > now() - interval '2 hours'
       and event_kind in (
         'new_audience_distribution','exposure_verified','strategy_escalation',
         'economic_remodel','capability_gap_closed'
       )`,
  );
  const nCycles = Number(cycles.rows[0]?.n ?? 0);
  const nProg = Number(progress.rows[0]?.n ?? 0);
  if (nCycles >= 8 && nProg === 0) {
    return {
      stagnant: true,
      detail: `${nCycles} cycles / 2h with 0 meaningful progress events`,
    };
  }
  return { stagnant: false, detail: `cycles=${nCycles} progress=${nProg}` };
}

export async function openCriticalOvernightIfNeeded(
  pool: pg.Pool,
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void,
): Promise<string[]> {
  const opened: string[] = [];
  const hoursRunning = await pool.query(
    `select extract(epoch from (now() - min(started_at)))/3600.0 as h
     from titan_commercial_executive_cycles
     where started_at > now() - interval '12 hours'`,
  );
  const h = Number(hoursRunning.rows[0]?.h ?? 0);
  if (h < 3) return opened; // not overnight yet

  const exposed = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where status in ('EXPOSURE_CONFIRMED','EXPOSED','PUBLISHED')
       and is_new_audience=true
       and created_at > now() - interval '12 hours'`,
  );
  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'
       and created_at > now() - interval '12 hours'`,
  );

  async function open(kind: string, diagnosis: Record<string, unknown>) {
    const exists = await pool.query(
      `select 1 from titan_commercial_stagnation_incidents
       where kind=$1 and status='OPEN' and created_at > now() - interval '8 hours' limit 1`,
      [kind],
    );
    if (exists.rows[0]) return;
    await pool.query(
      `insert into titan_commercial_stagnation_incidents
       (id, business_id, kind, diagnosis, escalation, status)
       values ($1,'portfolio',$2,$3::jsonb,$4,'OPEN')`,
      [
        `csi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        kind,
        JSON.stringify({ ...diagnosis, ownerOffline: true }),
        "Deep diagnosis + channel/business/Forge systemic review without owner",
      ],
    );
    opened.push(kind);
    logger?.("warn", "overnight.critical", { kind, ...diagnosis });
  }

  if (Number(exposed.rows[0]?.n ?? 0) === 0) {
    await open("CRITICAL_OVERNIGHT_ZERO_EXPOSURE", {
      hours: h,
      exposed: 0,
    });
  }
  if (Number(humans.rows[0]?.n ?? 0) === 0) {
    await open("CRITICAL_OVERNIGHT_ZERO_HUMAN", {
      hours: h,
      humans: 0,
    });
  }
  return opened;
}
