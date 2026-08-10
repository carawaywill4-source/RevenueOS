import pg from "pg";
import type { RevenueOSData } from "../interface.js";
import {
  type DbHealthReport,
  DEFAULT_RETRY,
  nextBackoffMs,
  withRetry,
} from "../health.js";

/**
 * Read adapter over Stage-2 restored Supabase table names (`revenueos_*`).
 * Temporary bridge until Stage 3 maps domains onto native `ros_*` schema.
 * Writes to migrated tables are disabled (except explicit local ros_* probe elsewhere).
 */
export function createLegacyCopyData(connectionString: string): RevenueOSData {
  const pool = new pg.Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 8_000,
  });
  let consecutiveFailures = 0;
  let recoveringUntil = 0;

  const q = async <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => withRetry("legacy_copy_query", () => pool.query<T>(text, params));

  const unsupported =
    (name: string) =>
    async (..._args: never[]) => {
      throw new Error(`legacy_copy_read_only:${name}`);
    };

  const api: RevenueOSData = {
    provider: "postgres",

    async health(): Promise<DbHealthReport> {
      const started = Date.now();
      if (Date.now() < recoveringUntil) {
        return {
          state: "DB_RECOVERING",
          provider: "postgres",
          checkedAt: new Date().toISOString(),
          latencyMs: null,
          consecutiveFailures,
          detail: "backoff_window",
        };
      }
      try {
        await q("select 1");
        consecutiveFailures = 0;
        const latencyMs = Date.now() - started;
        return {
          state: latencyMs > 2_000 ? "DB_DEGRADED" : "DB_HEALTHY",
          provider: "postgres",
          checkedAt: new Date().toISOString(),
          latencyMs,
          consecutiveFailures: 0,
        };
      } catch (err) {
        consecutiveFailures += 1;
        recoveringUntil =
          Date.now() + nextBackoffMs(consecutiveFailures, DEFAULT_RETRY);
        return {
          state: consecutiveFailures >= 3 ? "DB_UNAVAILABLE" : "DB_DEGRADED",
          provider: "postgres",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - started,
          consecutiveFailures,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async withTransaction<T>(fn: (tx: RevenueOSData) => Promise<T>): Promise<T> {
      return fn(api);
    },

    async close() {
      await pool.end();
    },

    businesses: {
      upsert: unsupported("businesses.upsert"),
      async get(siteId) {
        const res = await q(
          `select site_id, count(*)::int as n
           from revenueos_experiments where site_id=$1 group by site_id`,
          [siteId],
        );
        const r = res.rows[0] as { site_id: string; n: number } | undefined;
        if (!r) return null;
        return {
          siteId: r.site_id,
          displayName: r.site_id,
          status: "active" as const,
          appUrl: null,
          metadata: { experimentRows: r.n, source: "legacy_copy" },
          updatedAt: new Date().toISOString(),
        };
      },
      async list() {
        const res = await q(
          `select site_id, count(*)::int as n from revenueos_experiments
           where site_id is not null group by site_id order by site_id limit 200`,
        );
        return res.rows.map((r: any) => ({
          siteId: String(r.site_id),
          displayName: String(r.site_id),
          status: "active" as const,
          appUrl: null,
          metadata: { experimentRows: Number(r.n), source: "legacy_copy" },
          updatedAt: new Date().toISOString(),
        }));
      },
    },

    pursuits: {
      upsert: unsupported("pursuits.upsert"),
      async get(id) {
        const res = await q(
          `select * from revenueos_experiments where id=$1 limit 1`,
          [id],
        );
        const r = res.rows[0] as any;
        if (!r) return null;
        return {
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          state: String(r.status ?? "unknown"),
          patternKey: r.pattern_key ?? null,
          actionType: r.action_type ?? null,
          document: r.document ?? r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        };
      },
      async listBySite(siteId, limit = 50) {
        const res = await q(
          `select * from revenueos_experiments where site_id=$1
           order by updated_at desc nulls last limit $2`,
          [siteId, limit],
        );
        return res.rows.map((r: any) => ({
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          state: String(r.status ?? "unknown"),
          patternKey: r.pattern_key ?? null,
          actionType: r.action_type ?? null,
          document: r.document ?? r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        }));
      },
    },

    events: {
      append: unsupported("events.append"),
      async listBySite(siteId, opts) {
        // No pursuit_events table on this source — surface recent experiment updates.
        const limit = opts?.limit ?? 50;
        const res = await q(
          `select id, site_id, status, updated_at, document from revenueos_experiments
           where site_id=$1 order by updated_at desc nulls last limit $2`,
          [siteId, limit],
        );
        return res.rows.map((r: any) => ({
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          eventType: `experiment.${r.status ?? "update"}`,
          detail: r.document ?? {},
          createdAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        }));
      },
    },

    lessons: {
      upsert: unsupported("lessons.upsert"),
      async listBySite(siteId, limit = 50) {
        const res = await q(
          `select * from revenueos_lessons where site_id=$1
           order by updated_at desc nulls last limit $2`,
          [siteId, limit],
        );
        return res.rows.map((r: any) => ({
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          summary: String(r.summary ?? r.document?.summary ?? r.id),
          document: r.document ?? r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        }));
      },
    },

    experiments: {
      upsert: unsupported("experiments.upsert"),
      async get(id) {
        const res = await q(
          `select * from revenueos_experiments where id=$1 limit 1`,
          [id],
        );
        const r = res.rows[0] as any;
        if (!r) return null;
        return {
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          category: String(r.category ?? "unknown"),
          status: String(r.status ?? "unknown"),
          document: r.document ?? r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        };
      },
      async listByCategory(category, limit = 50) {
        const res = await q(
          `select * from revenueos_experiments where category=$1
           order by updated_at desc nulls last limit $2`,
          [category, limit],
        );
        return res.rows.map((r: any) => ({
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          category: String(r.category ?? "unknown"),
          status: String(r.status ?? "unknown"),
          document: r.document ?? r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        }));
      },
    },

    claims: {
      upsert: unsupported("claims.upsert"),
      async get(siteId) {
        const res = await q(
          `select * from revenueos_experiments
           where id = $1 or id = $2
           limit 1`,
          [`ros:opclaim:${siteId}`, `operator_claim:${siteId}`],
        );
        const r = res.rows[0] as any;
        if (!r) return null;
        const doc = r.document ?? {};
        return {
          siteId,
          owner: String(doc.owner ?? r.status ?? "unknown"),
          leaseUntil: String(doc.leaseUntil ?? doc.lease_until ?? new Date().toISOString()),
          claimedAt: String(doc.claimedAt ?? r.updated_at ?? new Date().toISOString()),
        };
      },
      delete: unsupported("claims.delete"),
    },

    leases: {
      upsert: unsupported("leases.upsert"),
      get: unsupported("leases.get"),
    },

    scorecards: {
      upsert: unsupported("scorecards.upsert"),
      async listBySite(siteId, limit = 50) {
        const res = await q(
          `select * from revenueos_scorecards where site_id=$1
           order by created_at desc nulls last limit $2`,
          [siteId, limit],
        );
        return res.rows.map((r: any) => ({
          id: String(r.id),
          siteId: String(r.site_id ?? ""),
          document: r.document ?? r,
          updatedAt: r.created_at
            ? new Date(r.created_at).toISOString()
            : new Date().toISOString(),
        }));
      },
    },

    portfolio: {
      upsert: unsupported("portfolio.upsert"),
      async get(id) {
        const res = await q(
          `select * from revenueos_experiments where id=$1 limit 1`,
          [id],
        );
        const r = res.rows[0] as any;
        if (!r) return null;
        return {
          id: String(r.id),
          document: r.document ?? r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
        };
      },
    },

    jobs: {
      enqueue: unsupported("jobs.enqueue"),
      get: unsupported("jobs.get"),
      claimNext: unsupported("jobs.claimNext"),
      heartbeat: unsupported("jobs.heartbeat"),
      complete: unsupported("jobs.complete"),
      fail: unsupported("jobs.fail"),
    },

    activity: {
      append: unsupported("activity.append"),
      async listRecent(limit = 40) {
        const res = await q(
          `select id, site_id, status, updated_at, document from revenueos_experiments
           order by updated_at desc nulls last limit $1`,
          [limit],
        );
        return res.rows.map((r: any) => ({
          id: String(r.id),
          siteId: r.site_id ? String(r.site_id) : undefined,
          at: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : new Date().toISOString(),
          summary: `experiment ${r.status ?? "update"}`,
          detail: r.document ?? {},
        }));
      },
    },

    releases: {
      upsert: unsupported("releases.upsert"),
      listBySite: unsupported("releases.listBySite"),
    },

    healthRecords: {
      upsert: unsupported("healthRecords.upsert"),
      latest: unsupported("healthRecords.latest"),
    },

    configMeta: {
      upsert: unsupported("configMeta.upsert"),
      get: unsupported("configMeta.get"),
    },
  };

  return api;
}
