import type { RevenueOSData } from "../interface.js";
import {
  type DbHealthReport,
  DEFAULT_RETRY,
  nextBackoffMs,
  withRetry,
} from "../health.js";
import type {
  ActivityRecord,
  BusinessRecord,
  JobRecord,
  PursuitRecord,
  EventRecord,
} from "../types.js";

/**
 * Supabase REST adapter implementing RevenueOS.Data.
 * Temporary bridge — production remains on this path until verified cutover.
 * Does NOT define the interface; it implements it.
 */

type FetchLike = typeof fetch;

export type SupabaseDataConfig = {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: FetchLike;
  /** Table name overrides for gradual mapping; defaults match existing schema. */
  tables?: Partial<{
    businesses: string;
    pursuits: string;
    events: string;
    lessons: string;
    experiments: string;
    claims: string;
    jobs: string;
    activity: string;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

export function createSupabaseData(config: SupabaseDataConfig): RevenueOSData {
  const base = config.url.replace(/\/$/, "");
  const key = config.serviceRoleKey;
  const fetchImpl = config.fetchImpl ?? fetch;
  const t = {
    // Defaults match production Supabase table names (see RECOVERY.md B1).
    businesses: config.tables?.businesses ?? "sites",
    pursuits: config.tables?.pursuits ?? "revenueos_pursuits",
    events: config.tables?.events ?? "revenueos_pursuit_events",
    lessons: config.tables?.lessons ?? "revenueos_lessons",
    experiments: config.tables?.experiments ?? "revenueos_experiments",
    claims: config.tables?.claims ?? "revenueos_operator_claims",
    jobs: config.tables?.jobs ?? "revenueos_pursuits",
    activity: config.tables?.activity ?? "revenueos_pursuit_events",
  };

  let consecutiveFailures = 0;
  let recoveringUntil = 0;

  async function rest(
    path: string,
    init: RequestInit & { prefer?: string } = {},
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("apikey", key);
    headers.set("Authorization", `Bearer ${key}`);
    headers.set("Content-Type", "application/json");
    if (init.prefer) headers.set("Prefer", init.prefer);
    return withRetry("supabase_rest", () =>
      fetchImpl(`${base}/rest/v1/${path}`, { ...init, headers }),
    );
  }

  async function jsonOrNull<T>(res: Response): Promise<T | null> {
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`supabase ${res.status}: ${body.slice(0, 200)}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  }

  const unsupported = (name: string) => async () => {
    throw new Error(
      `supabase_adapter_unsupported:${name} — native postgres owns this domain; use provider=postgres for Stage1 local tables`,
    );
  };

  const api: RevenueOSData = {
    provider: "supabase",

    async health(): Promise<DbHealthReport> {
      const started = Date.now();
      if (Date.now() < recoveringUntil) {
        return {
          state: "DB_RECOVERING",
          provider: "supabase",
          checkedAt: nowIso(),
          latencyMs: null,
          consecutiveFailures,
          detail: "backoff_window",
        };
      }
      try {
        // Probe a table that always exists in production (claims may be document-mode).
        const res = await rest(`${t.experiments}?select=id&limit=1`);
        if (!res.ok) throw new Error(`status_${res.status}`);
        consecutiveFailures = 0;
        const latencyMs = Date.now() - started;
        return {
          state: latencyMs > 2_000 ? "DB_DEGRADED" : "DB_HEALTHY",
          provider: "supabase",
          checkedAt: nowIso(),
          latencyMs,
          consecutiveFailures: 0,
        };
      } catch (err) {
        consecutiveFailures += 1;
        recoveringUntil =
          Date.now() + nextBackoffMs(consecutiveFailures, DEFAULT_RETRY);
        return {
          state: consecutiveFailures >= 3 ? "DB_UNAVAILABLE" : "DB_DEGRADED",
          provider: "supabase",
          checkedAt: nowIso(),
          latencyMs: Date.now() - started,
          consecutiveFailures,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async withTransaction<T>(fn: (tx: RevenueOSData) => Promise<T>): Promise<T> {
      // REST has no multi-statement transactions; best-effort single-connection semantics.
      return fn(api);
    },

    async close() {
      /* no-op */
    },

    businesses: {
      async upsert(row: BusinessRecord) {
        const res = await rest(`${t.businesses}?on_conflict=id`, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: JSON.stringify({
            id: row.siteId,
            name: row.displayName,
            industry: row.industry ?? null,
            app_url: row.appUrl ?? null,
            status: row.status,
            updated_at: row.updatedAt,
          }),
        });
        await jsonOrNull(res);
      },
      async get(siteId: string) {
        const res = await rest(
          `${t.businesses}?id=eq.${encodeURIComponent(siteId)}&select=*&limit=1`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        const r = rows[0];
        if (!r) return null;
        return {
          siteId: String(r.id),
          displayName: String(r.name ?? r.display_name ?? r.id),
          industry: r.industry ?? undefined,
          appUrl: r.app_url ?? null,
          status: (r.status as BusinessRecord["status"]) ?? "active",
          metadata: {},
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : nowIso(),
        };
      },
      async list(status?: BusinessRecord["status"]) {
        const filter = status ? `&status=eq.${encodeURIComponent(status)}` : "";
        const res = await rest(
          `${t.businesses}?select=*&order=id.asc${filter}`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows.map((r) => ({
          siteId: String(r.id),
          displayName: String(r.name ?? r.display_name ?? r.id),
          industry: r.industry ?? undefined,
          appUrl: r.app_url ?? null,
          status: (r.status as BusinessRecord["status"]) ?? "active",
          metadata: {},
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : nowIso(),
        }));
      },
    },

    pursuits: {
      async upsert(row: PursuitRecord) {
        const res = await rest(`${t.pursuits}?on_conflict=id`, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: JSON.stringify({
            id: row.id,
            site_id: row.siteId,
            state: row.state,
            pattern_key: row.patternKey,
            action_type: row.actionType,
            ...row.document,
            updated_at: row.updatedAt,
          }),
        });
        await jsonOrNull(res);
      },
      async get(id: string) {
        const res = await rest(
          `${t.pursuits}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows[0] ? mapPursuit(rows[0]) : null;
      },
      async listBySite(siteId: string, limit = 50) {
        const res = await rest(
          `${t.pursuits}?site_id=eq.${encodeURIComponent(siteId)}&select=*&order=updated_at.desc&limit=${limit}`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows.map(mapPursuit);
      },
    },

    events: {
      async append(row: EventRecord) {
        const res = await rest(t.events, {
          method: "POST",
          prefer: "return=minimal",
          body: JSON.stringify({
            id: row.id,
            site_id: row.siteId,
            event_type: row.eventType,
            detail: row.detail,
            created_at: row.createdAt,
          }),
        });
        await jsonOrNull(res);
      },
      async listBySite(siteId: string, opts?: { since?: string; limit?: number }) {
        const limit = opts?.limit ?? 50;
        let path = `${t.events}?site_id=eq.${encodeURIComponent(siteId)}&select=*&order=created_at.desc&limit=${limit}`;
        if (opts?.since) {
          path += `&created_at=gte.${encodeURIComponent(opts.since)}`;
        }
        const res = await rest(path);
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows.map(mapEvent);
      },
    },

    lessons: {
      async upsert(row) {
        const res = await rest(`${t.lessons}?on_conflict=id`, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: JSON.stringify({
            id: row.id,
            site_id: row.siteId,
            summary: row.summary,
            ...row.document,
            updated_at: row.updatedAt,
          }),
        });
        await jsonOrNull(res);
      },
      async listBySite(siteId, limit = 50) {
        const res = await rest(
          `${t.lessons}?site_id=eq.${encodeURIComponent(siteId)}&select=*&order=updated_at.desc&limit=${limit}`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows.map((r) => ({
          id: String(r.id),
          siteId: String(r.site_id),
          summary: String(r.summary ?? ""),
          document: r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : nowIso(),
        }));
      },
    },

    experiments: {
      async upsert(row) {
        const res = await rest(`${t.experiments}?on_conflict=id`, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: JSON.stringify({
            id: row.id,
            site_id: row.siteId,
            category: row.category,
            status: row.status,
            ...row.document,
            updated_at: row.updatedAt,
          }),
        });
        await jsonOrNull(res);
      },
      async get(id) {
        const res = await rest(
          `${t.experiments}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        const r = rows[0];
        if (!r) return null;
        return {
          id: String(r.id),
          siteId: String(r.site_id),
          category: String(r.category ?? "unknown"),
          status: String(r.status ?? "unknown"),
          document: r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : nowIso(),
        };
      },
      async listByCategory(category, limit = 50) {
        const res = await rest(
          `${t.experiments}?category=eq.${encodeURIComponent(category)}&select=*&order=updated_at.desc&limit=${limit}`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows.map((r) => ({
          id: String(r.id),
          siteId: String(r.site_id),
          category: String(r.category ?? "unknown"),
          status: String(r.status ?? "unknown"),
          document: r,
          updatedAt: r.updated_at
            ? new Date(r.updated_at).toISOString()
            : nowIso(),
        }));
      },
    },

    claims: {
      async upsert(row) {
        const res = await rest(`${t.claims}?on_conflict=site_id`, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: JSON.stringify({
            site_id: row.siteId,
            owner: row.owner,
            lease_until: row.leaseUntil,
            claimed_at: row.claimedAt,
          }),
        });
        // Native claims table may be absent (document-mode fallback in operator).
        if (res.status === 404) return;
        await jsonOrNull(res);
      },
      async get(siteId) {
        const res = await rest(
          `${t.claims}?site_id=eq.${encodeURIComponent(siteId)}&select=*&limit=1`,
        );
        if (res.status === 404) return null;
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        const r = rows[0];
        if (!r) return null;
        return {
          siteId: String(r.site_id),
          owner: String(r.owner),
          leaseUntil: new Date(r.lease_until).toISOString(),
          claimedAt: new Date(r.claimed_at).toISOString(),
        };
      },
      async delete(siteId, owner) {
        const res = await rest(
          `${t.claims}?site_id=eq.${encodeURIComponent(siteId)}&owner=eq.${encodeURIComponent(owner)}`,
          { method: "DELETE", prefer: "return=minimal" },
        );
        if (res.status === 404) return;
        await jsonOrNull(res);
      },
    },

    leases: {
      upsert: unsupported("leases.upsert"),
      get: unsupported("leases.get"),
    },

    scorecards: {
      upsert: unsupported("scorecards.upsert"),
      listBySite: unsupported("scorecards.listBySite"),
    },

    portfolio: {
      upsert: unsupported("portfolio.upsert"),
      get: unsupported("portfolio.get"),
    },

    jobs: {
      async enqueue(row) {
        const full: JobRecord = {
          ...row,
          attempts: row.attempts ?? 0,
          createdAt: nowIso(),
        };
        const res = await rest(t.jobs, {
          method: "POST",
          prefer: "return=minimal",
          body: JSON.stringify({
            job_id: full.jobId,
            business_id: full.businessId,
            job_type: full.jobType,
            priority: full.priority,
            payload: full.payload,
            status: full.status,
            attempts: full.attempts,
            created_at: full.createdAt,
            scheduled_at: full.scheduledAt,
          }),
        });
        await jsonOrNull(res);
        return full;
      },
      async get(jobId) {
        const res = await rest(
          `${t.jobs}?job_id=eq.${encodeURIComponent(jobId)}&select=*&limit=1`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows[0] ? mapJob(rows[0]) : null;
      },
      claimNext: unsupported("jobs.claimNext"),
      heartbeat: unsupported("jobs.heartbeat"),
      complete: unsupported("jobs.complete"),
      fail: unsupported("jobs.fail"),
    },

    activity: {
      async append(row: ActivityRecord) {
        const res = await rest(t.activity, {
          method: "POST",
          prefer: "return=minimal",
          body: JSON.stringify({
            id: row.id,
            site_id: row.siteId,
            at: row.at,
            summary: row.summary,
            quality: row.quality,
            detail: row.detail ?? {},
          }),
        });
        await jsonOrNull(res);
      },
      async listRecent(limit = 40) {
        const res = await rest(
          `${t.activity}?select=*&order=at.desc&limit=${limit}`,
        );
        const rows = (await jsonOrNull<any[]>(res)) ?? [];
        return rows.map((r) => ({
          id: String(r.id),
          siteId: r.site_id ?? undefined,
          at: new Date(r.at).toISOString(),
          summary: String(r.summary ?? ""),
          quality: r.quality ?? undefined,
          detail: r.detail,
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

function mapPursuit(r: any): PursuitRecord {
  return {
    id: String(r.id),
    siteId: String(r.site_id),
    state: String(r.state ?? "unknown"),
    patternKey: r.pattern_key ?? null,
    actionType: r.action_type ?? null,
    document: r,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : nowIso(),
  };
}

function mapEvent(r: any): EventRecord {
  return {
    id: String(r.id),
    siteId: String(r.site_id),
    eventType: String(r.event_type ?? "unknown"),
    detail: r.detail ?? r,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : nowIso(),
  };
}

function mapJob(r: any): JobRecord {
  return {
    jobId: String(r.job_id),
    businessId: String(r.business_id),
    jobType: String(r.job_type),
    priority: Number(r.priority ?? 100),
    payload: r.payload ?? {},
    status: r.status,
    attempts: Number(r.attempts ?? 0),
    createdAt: new Date(r.created_at).toISOString(),
    scheduledAt: new Date(r.scheduled_at).toISOString(),
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    heartbeatAt: r.heartbeat_at ? new Date(r.heartbeat_at).toISOString() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    leaseOwner: r.lease_owner ?? null,
    leaseExpiration: r.lease_expiration
      ? new Date(r.lease_expiration).toISOString()
      : null,
    error: r.error ?? null,
    checkpoint: r.checkpoint ?? null,
    result: r.result ?? null,
  };
}
