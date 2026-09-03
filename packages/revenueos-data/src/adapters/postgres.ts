import pg from "pg";
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

type Q = {
  query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<pg.QueryResult<T>>;
};

function nowIso() {
  return new Date().toISOString();
}

export function createPostgresData(connectionString: string): RevenueOSData {
  const pool = new pg.Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
  let consecutiveFailures = 0;
  let recoveringUntil = 0;

  const root: Q = {
    async query(text, params) {
      return withRetry("postgres_query", () => pool.query(text, params));
    },
  };

  function build(q: Q): RevenueOSData {
    return {
      provider: "postgres",

      async health(): Promise<DbHealthReport> {
        const started = Date.now();
        if (Date.now() < recoveringUntil) {
          return {
            state: "DB_RECOVERING",
            provider: "postgres",
            checkedAt: nowIso(),
            latencyMs: null,
            consecutiveFailures,
            detail: "backoff_window",
          };
        }
        try {
          await q.query("select 1 as ok");
          const latencyMs = Date.now() - started;
          consecutiveFailures = 0;
          return {
            state: latencyMs > 2_000 ? "DB_DEGRADED" : "DB_HEALTHY",
            provider: "postgres",
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
            provider: "postgres",
            checkedAt: nowIso(),
            latencyMs: Date.now() - started,
            consecutiveFailures,
            detail: err instanceof Error ? err.message : String(err),
          };
        }
      },

      async withTransaction<T>(fn: (tx: RevenueOSData) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const tx = build({
            query: (text, params) => client.query(text, params),
          });
          const result = await fn(tx);
          await client.query("commit");
          return result;
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
      },

      async close() {
        await pool.end();
      },

      businesses: {
        async upsert(row: BusinessRecord) {
          await q.query(
            `insert into ros_businesses (site_id, display_name, industry, app_url, status, metadata, updated_at)
             values ($1,$2,$3,$4,$5,$6::jsonb,$7)
             on conflict (site_id) do update set
               display_name=excluded.display_name, industry=excluded.industry,
               app_url=excluded.app_url, status=excluded.status,
               metadata=excluded.metadata, updated_at=excluded.updated_at`,
            [
              row.siteId,
              row.displayName,
              row.industry ?? null,
              row.appUrl ?? null,
              row.status,
              JSON.stringify(row.metadata ?? {}),
              row.updatedAt,
            ],
          );
        },
        async get(siteId: string) {
          const res = await q.query(`select * from ros_businesses where site_id=$1`, [
            siteId,
          ]);
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            siteId: r.site_id,
            displayName: r.display_name,
            industry: r.industry ?? undefined,
            appUrl: r.app_url,
            status: r.status,
            metadata: r.metadata,
            updatedAt: new Date(r.updated_at).toISOString(),
          } satisfies BusinessRecord;
        },
        async list(status?: BusinessRecord["status"]) {
          const res = status
            ? await q.query(
                `select * from ros_businesses where status=$1 order by site_id`,
                [status],
              )
            : await q.query(`select * from ros_businesses order by site_id`);
          return res.rows.map((r: any) => ({
            siteId: r.site_id,
            displayName: r.display_name,
            industry: r.industry ?? undefined,
            appUrl: r.app_url,
            status: r.status,
            metadata: r.metadata,
            updatedAt: new Date(r.updated_at).toISOString(),
          }));
        },
      },

      pursuits: {
        async upsert(row: PursuitRecord) {
          await q.query(
            `insert into ros_pursuits (id, site_id, state, pattern_key, action_type, document, updated_at)
             values ($1,$2,$3,$4,$5,$6::jsonb,$7)
             on conflict (id) do update set
               state=excluded.state, document=excluded.document, updated_at=excluded.updated_at`,
            [
              row.id,
              row.siteId,
              row.state,
              row.patternKey ?? null,
              row.actionType ?? null,
              JSON.stringify(row.document),
              row.updatedAt,
            ],
          );
        },
        async get(id: string) {
          const res = await q.query(`select * from ros_pursuits where id=$1`, [id]);
          return res.rows[0] ? mapPursuit(res.rows[0]) : null;
        },
        async listBySite(siteId: string, limit = 50) {
          const res = await q.query(
            `select * from ros_pursuits where site_id=$1 order by updated_at desc limit $2`,
            [siteId, limit],
          );
          return res.rows.map(mapPursuit);
        },
      },

      events: {
        async append(row: EventRecord) {
          await q.query(
            `insert into ros_events (id, site_id, event_type, detail, created_at)
             values ($1,$2,$3,$4::jsonb,$5) on conflict (id) do nothing`,
            [
              row.id,
              row.siteId,
              row.eventType,
              JSON.stringify(row.detail),
              row.createdAt,
            ],
          );
        },
        async listBySite(siteId: string, opts?: { since?: string; limit?: number }) {
          const limit = opts?.limit ?? 50;
          const res = opts?.since
            ? await q.query(
                `select * from ros_events where site_id=$1 and created_at >= $2::timestamptz
                 order by created_at desc limit $3`,
                [siteId, opts.since, limit],
              )
            : await q.query(
                `select * from ros_events where site_id=$1 order by created_at desc limit $2`,
                [siteId, limit],
              );
          return res.rows.map(mapEvent);
        },
      },

      lessons: {
        async upsert(row) {
          await q.query(
            `insert into ros_lessons (id, site_id, summary, document, updated_at)
             values ($1,$2,$3,$4::jsonb,$5)
             on conflict (id) do update set summary=excluded.summary, document=excluded.document, updated_at=excluded.updated_at`,
            [
              row.id,
              row.siteId,
              row.summary,
              JSON.stringify(row.document),
              row.updatedAt,
            ],
          );
        },
        async listBySite(siteId, limit = 50) {
          const res = await q.query(
            `select * from ros_lessons where site_id=$1 order by updated_at desc limit $2`,
            [siteId, limit],
          );
          return res.rows.map((r: any) => ({
            id: r.id,
            siteId: r.site_id,
            summary: r.summary,
            document: r.document,
            updatedAt: new Date(r.updated_at).toISOString(),
          }));
        },
      },

      experiments: {
        async upsert(row) {
          await q.query(
            `insert into ros_experiments (id, site_id, category, status, document, updated_at)
             values ($1,$2,$3,$4,$5::jsonb,$6)
             on conflict (id) do update set
               category=excluded.category, status=excluded.status,
               document=excluded.document, updated_at=excluded.updated_at`,
            [
              row.id,
              row.siteId,
              row.category,
              row.status,
              JSON.stringify(row.document),
              row.updatedAt,
            ],
          );
        },
        async get(id) {
          const res = await q.query(`select * from ros_experiments where id=$1`, [id]);
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            id: r.id,
            siteId: r.site_id,
            category: r.category,
            status: r.status,
            document: r.document,
            updatedAt: new Date(r.updated_at).toISOString(),
          };
        },
        async listByCategory(category, limit = 50) {
          const res = await q.query(
            `select * from ros_experiments where category=$1 order by updated_at desc limit $2`,
            [category, limit],
          );
          return res.rows.map((r: any) => ({
            id: r.id,
            siteId: r.site_id,
            category: r.category,
            status: r.status,
            document: r.document,
            updatedAt: new Date(r.updated_at).toISOString(),
          }));
        },
      },

      claims: {
        async upsert(row) {
          await q.query(
            `insert into ros_claims (site_id, owner, lease_until, claimed_at)
             values ($1,$2,$3::timestamptz,$4::timestamptz)
             on conflict (site_id) do update set
               owner=excluded.owner, lease_until=excluded.lease_until, claimed_at=excluded.claimed_at`,
            [row.siteId, row.owner, row.leaseUntil, row.claimedAt],
          );
        },
        async get(siteId) {
          const res = await q.query(`select * from ros_claims where site_id=$1`, [
            siteId,
          ]);
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            siteId: r.site_id,
            owner: r.owner,
            leaseUntil: new Date(r.lease_until).toISOString(),
            claimedAt: new Date(r.claimed_at).toISOString(),
          };
        },
        async delete(siteId, owner) {
          await q.query(`delete from ros_claims where site_id=$1 and owner=$2`, [
            siteId,
            owner,
          ]);
        },
      },

      leases: {
        async upsert(row) {
          await q.query(
            `insert into ros_leases (id, site_id, owner, lease_until, document)
             values ($1,$2,$3,$4::timestamptz,$5::jsonb)
             on conflict (id) do update set
               owner=excluded.owner, lease_until=excluded.lease_until, document=excluded.document`,
            [
              row.id,
              row.siteId,
              row.owner,
              row.leaseUntil,
              JSON.stringify(row.document ?? {}),
            ],
          );
        },
        async get(id) {
          const res = await q.query(`select * from ros_leases where id=$1`, [id]);
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            id: r.id,
            siteId: r.site_id,
            owner: r.owner,
            leaseUntil: new Date(r.lease_until).toISOString(),
            document: r.document,
          };
        },
      },

      scorecards: {
        async upsert(row) {
          await q.query(
            `insert into ros_scorecards (id, site_id, document, updated_at)
             values ($1,$2,$3::jsonb,$4)
             on conflict (id) do update set document=excluded.document, updated_at=excluded.updated_at`,
            [row.id, row.siteId, JSON.stringify(row.document), row.updatedAt],
          );
        },
        async listBySite(siteId, limit = 50) {
          const res = await q.query(
            `select * from ros_scorecards where site_id=$1 order by updated_at desc limit $2`,
            [siteId, limit],
          );
          return res.rows.map((r: any) => ({
            id: r.id,
            siteId: r.site_id,
            document: r.document,
            updatedAt: new Date(r.updated_at).toISOString(),
          }));
        },
      },

      portfolio: {
        async upsert(row) {
          await q.query(
            `insert into ros_portfolio_state (id, document, updated_at)
             values ($1,$2::jsonb,$3)
             on conflict (id) do update set document=excluded.document, updated_at=excluded.updated_at`,
            [row.id, JSON.stringify(row.document), row.updatedAt],
          );
        },
        async get(id) {
          const res = await q.query(`select * from ros_portfolio_state where id=$1`, [
            id,
          ]);
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            id: r.id,
            document: r.document,
            updatedAt: new Date(r.updated_at).toISOString(),
          };
        },
      },

      jobs: {
        async enqueue(row) {
          const full: JobRecord = {
            ...row,
            attempts: row.attempts ?? 0,
            createdAt: nowIso(),
          };
          await q.query(
            `insert into ros_jobs (
               job_id, business_id, job_type, priority, payload, status, attempts,
               created_at, scheduled_at
             ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz,$9::timestamptz)`,
            [
              full.jobId,
              full.businessId,
              full.jobType,
              full.priority,
              JSON.stringify(full.payload),
              full.status,
              full.attempts,
              full.createdAt,
              full.scheduledAt,
            ],
          );
          return full;
        },
        async get(jobId) {
          const res = await q.query(`select * from ros_jobs where job_id=$1`, [jobId]);
          return res.rows[0] ? mapJob(res.rows[0]) : null;
        },
        async claimNext(input) {
          const client = await pool.connect();
          try {
            await client.query("begin");
            const res = await client.query(
              `select * from ros_jobs
               where status in ('QUEUED','RETRY_WAIT')
                 and scheduled_at <= now()
                 and ($1::text[] is null or job_type = any($1))
               order by priority asc, scheduled_at asc
               for update skip locked
               limit 1`,
              [input.jobTypes ?? null],
            );
            const row = res.rows[0];
            if (!row) {
              await client.query("commit");
              return null;
            }
            const leaseExp = new Date(Date.now() + input.leaseMs).toISOString();
            const started = nowIso();
            await client.query(
              `update ros_jobs set
                 status='RUNNING', attempts=attempts+1, started_at=$2::timestamptz,
                 heartbeat_at=$2::timestamptz, lease_owner=$3, lease_expiration=$4::timestamptz
               where job_id=$1`,
              [row.job_id, started, input.owner, leaseExp],
            );
            await client.query("commit");
            return {
              ...mapJob(row),
              status: "RUNNING" as const,
              attempts: Number(row.attempts) + 1,
              startedAt: started,
              heartbeatAt: started,
              leaseOwner: input.owner,
              leaseExpiration: leaseExp,
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
        },
        async heartbeat(jobId, owner) {
          await q.query(
            `update ros_jobs set heartbeat_at=now()
             where job_id=$1 and lease_owner=$2 and status='RUNNING'`,
            [jobId, owner],
          );
        },
        async complete(jobId, owner, result) {
          await q.query(
            `update ros_jobs set status='COMPLETE', completed_at=now(), result=$3::jsonb,
               lease_owner=null, lease_expiration=null
             where job_id=$1 and lease_owner=$2`,
            [jobId, owner, JSON.stringify(result ?? {})],
          );
        },
        async fail(jobId, owner, error) {
          await q.query(
            `update ros_jobs set status='FAILED', error=$3, completed_at=now(),
               lease_owner=null, lease_expiration=null
             where job_id=$1 and lease_owner=$2`,
            [jobId, owner, error],
          );
        },
      },

      activity: {
        async append(row: ActivityRecord) {
          await q.query(
            `insert into ros_activity (id, site_id, at, summary, quality, detail)
             values ($1,$2,$3::timestamptz,$4,$5,$6::jsonb)
             on conflict (id) do nothing`,
            [
              row.id,
              row.siteId ?? null,
              row.at,
              row.summary,
              row.quality ?? null,
              JSON.stringify(row.detail ?? {}),
            ],
          );
        },
        async listRecent(limit = 40) {
          const res = await q.query(
            `select * from ros_activity order by at desc limit $1`,
            [limit],
          );
          return res.rows.map((r: any) => ({
            id: r.id,
            siteId: r.site_id,
            at: new Date(r.at).toISOString(),
            summary: r.summary,
            quality: r.quality ?? undefined,
            detail: r.detail,
          }));
        },
      },

      releases: {
        async upsert(row) {
          await q.query(
            `insert into ros_releases (id, site_id, version, path, status, health, created_at)
             values ($1,$2,$3,$4,$5,$6,$7::timestamptz)
             on conflict (id) do update set status=excluded.status, health=excluded.health, path=excluded.path`,
            [
              row.id,
              row.siteId,
              row.version,
              row.path,
              row.status,
              row.health ?? null,
              row.createdAt,
            ],
          );
        },
        async listBySite(siteId) {
          const res = await q.query(
            `select * from ros_releases where site_id=$1 order by created_at desc`,
            [siteId],
          );
          return res.rows.map((r: any) => ({
            id: r.id,
            siteId: r.site_id,
            version: r.version,
            path: r.path,
            status: r.status,
            health: r.health,
            createdAt: new Date(r.created_at).toISOString(),
          }));
        },
      },

      healthRecords: {
        async upsert(row) {
          await q.query(
            `insert into ros_health (id, subject_type, subject_id, state, detail, checked_at)
             values ($1,$2,$3,$4,$5::jsonb,$6::timestamptz)
             on conflict (subject_type, subject_id) do update set
               id=excluded.id, state=excluded.state, detail=excluded.detail, checked_at=excluded.checked_at`,
            [
              row.id,
              row.subjectType,
              row.subjectId,
              row.state,
              JSON.stringify(row.detail ?? {}),
              row.checkedAt,
            ],
          );
        },
        async latest(subjectType, subjectId) {
          const res = await q.query(
            `select * from ros_health where subject_type=$1 and subject_id=$2`,
            [subjectType, subjectId],
          );
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            id: r.id,
            subjectType: r.subject_type,
            subjectId: r.subject_id,
            state: r.state,
            detail: r.detail,
            checkedAt: new Date(r.checked_at).toISOString(),
          };
        },
      },

      configMeta: {
        async upsert(row) {
          await q.query(
            `insert into ros_config_meta (key, value, updated_at)
             values ($1,$2::jsonb,$3)
             on conflict (key) do update set value=excluded.value, updated_at=excluded.updated_at`,
            [row.key, JSON.stringify(row.value), row.updatedAt],
          );
        },
        async get(key) {
          const res = await q.query(`select * from ros_config_meta where key=$1`, [
            key,
          ]);
          const r = res.rows[0] as any;
          if (!r) return null;
          return {
            key: r.key,
            value: r.value,
            updatedAt: new Date(r.updated_at).toISOString(),
          };
        },
      },
    };
  }

  return build(root);
}

function mapPursuit(r: any): PursuitRecord {
  return {
    id: r.id,
    siteId: r.site_id,
    state: r.state,
    patternKey: r.pattern_key,
    actionType: r.action_type,
    document: r.document,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

function mapEvent(r: any): EventRecord {
  return {
    id: r.id,
    siteId: r.site_id,
    eventType: r.event_type,
    detail: r.detail,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function mapJob(r: any): JobRecord {
  return {
    jobId: r.job_id,
    businessId: r.business_id,
    jobType: r.job_type,
    priority: Number(r.priority),
    payload: r.payload ?? {},
    status: r.status,
    attempts: Number(r.attempts),
    createdAt: new Date(r.created_at).toISOString(),
    scheduledAt: new Date(r.scheduled_at).toISOString(),
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    heartbeatAt: r.heartbeat_at ? new Date(r.heartbeat_at).toISOString() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    leaseOwner: r.lease_owner,
    leaseExpiration: r.lease_expiration
      ? new Date(r.lease_expiration).toISOString()
      : null,
    error: r.error,
    checkpoint: r.checkpoint,
    result: r.result,
  };
}
