/**
 * Native Postgres platform helpers — claims, owner controls, activity feeds.
 * No Supabase client.
 */
import type pg from "pg";
import type { ClaimStatus } from "./claims.js";
import {
  DEFAULT_OWNER_CONTROL_STATE,
  type ControlCommand,
  type OwnerControlState,
} from "./owner-controls-types.js";

const OWNER_STATE_KEY = "owner_control_portfolio";

export async function claimBusinessPg(
  pool: pg.Pool,
  input: {
    siteId: string;
    owner: string;
    leaseMs: number;
    now?: Date;
  },
): Promise<ClaimStatus | null> {
  const now = input.now ?? new Date();
  const leaseUntil = new Date(now.getTime() + input.leaseMs).toISOString();
  const claimedAt = now.toISOString();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query(
      `select owner, lease_until, claimed_at from ros_claims where site_id=$1 for update`,
      [input.siteId],
    );
    const row = existing.rows[0];
    if (
      row &&
      row.owner &&
      row.owner !== input.owner &&
      row.lease_until &&
      Date.parse(row.lease_until) > now.getTime()
    ) {
      await client.query("rollback");
      return null;
    }
    await client.query(
      `insert into ros_claims (site_id, owner, lease_until, claimed_at, provenance)
       values ($1,$2,$3::timestamptz,$4::timestamptz,'LOCAL_LEDGER')
       on conflict (site_id) do update set
         owner=excluded.owner, lease_until=excluded.lease_until,
         claimed_at=excluded.claimed_at, provenance='LOCAL_LEDGER'`,
      [input.siteId, input.owner, leaseUntil, claimedAt],
    );
    await client.query("commit");
    return {
      siteId: input.siteId,
      owner: input.owner,
      leaseUntil,
      claimedAt,
      active: true,
      storage: "native",
    };
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function releaseBusinessPg(
  pool: pg.Pool,
  input: { siteId: string; owner: string },
): Promise<void> {
  const expired = new Date(0).toISOString();
  await pool.query(
    `update ros_claims set lease_until=$3::timestamptz
     where site_id=$1 and owner=$2`,
    [input.siteId, input.owner, expired],
  );
}

export async function loadOwnerControlsPg(
  pool: pg.Pool,
): Promise<OwnerControlState> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [OWNER_STATE_KEY],
  );
  const doc = res.rows[0]?.value as Partial<OwnerControlState> | undefined;
  if (!doc || typeof doc !== "object") {
    return { ...DEFAULT_OWNER_CONTROL_STATE };
  }
  return {
    portfolioPaused: Boolean(doc.portfolioPaused),
    pausedBusinesses: Array.isArray(doc.pausedBusinesses)
      ? doc.pausedBusinesses.map(String)
      : [],
    prioritizedBusinesses: Array.isArray(doc.prioritizedBusinesses)
      ? doc.prioritizedBusinesses.map(String)
      : [],
    updatedAt: String(
      doc.updatedAt ?? DEFAULT_OWNER_CONTROL_STATE.updatedAt,
    ),
    updatedBy: String(doc.updatedBy ?? "system"),
  };
}

export async function applyOwnerControlPg(input: {
  pool: pg.Pool;
  command: ControlCommand;
  siteId?: string;
  actor?: string;
}): Promise<{ ok: boolean; state: OwnerControlState; detail: string }> {
  const actor = input.actor ?? "owner";
  const at = new Date().toISOString();
  const state = await loadOwnerControlsPg(input.pool);
  const siteId = input.siteId?.trim() || null;

  switch (input.command) {
    case "pause_revenueos":
      state.portfolioPaused = true;
      break;
    case "resume_revenueos":
      state.portfolioPaused = false;
      break;
    case "pause_business":
      if (!siteId) return { ok: false, state, detail: "siteId required" };
      if (!state.pausedBusinesses.includes(siteId)) {
        state.pausedBusinesses.push(siteId);
      }
      break;
    case "resume_business":
      if (!siteId) return { ok: false, state, detail: "siteId required" };
      state.pausedBusinesses = state.pausedBusinesses.filter((s) => s !== siteId);
      break;
    case "prioritize_business":
      if (!siteId) return { ok: false, state, detail: "siteId required" };
      state.prioritizedBusinesses = [
        siteId,
        ...state.prioritizedBusinesses.filter((s) => s !== siteId),
      ].slice(0, 10);
      break;
    default:
      return { ok: false, state, detail: "unknown_command" };
  }
  state.updatedAt = at;
  state.updatedBy = actor;
  await input.pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,$3::timestamptz,'LOCAL_LEDGER')
     on conflict (key) do update set
       value=excluded.value, updated_at=excluded.updated_at,
       provenance='LOCAL_LEDGER'`,
    [OWNER_STATE_KEY, JSON.stringify(state), at],
  );
  return {
    ok: true,
    state,
    detail: `Applied ${input.command}${siteId ? ` for ${siteId}` : ""} — learning and queues retained`,
  };
}

export async function persistSchedulerCheckpointPg(
  pool: pg.Pool,
  doc: Record<string, unknown>,
): Promise<void> {
  const at = new Date().toISOString();
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('scheduler_checkpoint', $1::jsonb, $2::timestamptz, 'SCHEDULER_CHECKPOINT')
     on conflict (key) do update set
       value=excluded.value, updated_at=excluded.updated_at,
       provenance='SCHEDULER_CHECKPOINT'`,
    [JSON.stringify(doc), at],
  );
  await pool.query(
    `insert into ros_portfolio_state (id, document, updated_at, provenance)
     values ('portfolio:engine-checkpoint', $1::jsonb, $2::timestamptz, 'ENGINE_CHECKPOINT')
     on conflict (id) do update set
       document=excluded.document, updated_at=excluded.updated_at,
       provenance='ENGINE_CHECKPOINT'`,
    [JSON.stringify(doc), at],
  );
}

export async function listRecentNativeActivity(
  pool: pg.Pool,
  siteIds: string[],
  sinceIso: string,
  limit = 40,
): Promise<
  Array<{
    at: string;
    siteId: string;
    eventType?: string;
    actionType?: string;
    detail?: string;
    ok?: boolean;
  }>
> {
  if (!siteIds.length) return [];
  const res = await pool.query(
    `select site_id, created_at, event_type, detail
     from ros_events
     where site_id = any($1::text[])
       and created_at >= $2::timestamptz
     order by created_at desc
     limit $3`,
    [siteIds.slice(0, 50), sinceIso, limit],
  );
  return res.rows.map((row) => {
    const ev = (row.detail ?? {}) as {
      eventType?: string;
      detail?: { actionType?: string; detail?: string; ok?: boolean };
      createdAt?: string;
    };
    return {
      at: String(ev.createdAt ?? row.created_at),
      siteId: String(row.site_id),
      eventType: ev.eventType ?? row.event_type,
      actionType: ev.detail?.actionType,
      detail: ev.detail?.detail,
      ok: ev.detail?.ok,
    };
  });
}
