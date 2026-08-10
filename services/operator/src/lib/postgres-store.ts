/**
 * Native Postgres ExperimentStore — RevenueOS platform authority.
 * Writes/reads ros_* only. No Supabase.
 */
import pg from "pg";
import type {
  Attribution,
  CapabilityGap,
  ChannelRecord,
  CycleReportRecord,
  DiscoveryDoor,
  Experiment,
  ExperimentStore,
  ExposureRecord,
  Lesson,
  PlannerRunRecord,
  PursuitEvent,
  PursuitJob,
  Scorecard,
} from "@revenueos/core";

const CLAIMABLE_STATES = new Set([
  "DISCOVER",
  "QUALIFY",
  "EXECUTE",
  "WAITING_FOR_EVIDENCE",
  "ATTRIBUTE",
  "LEARN",
  "REPLENISH",
]);

export type PostgresStoreHandle = {
  store: ExperimentStore;
  pool: pg.Pool;
  mode: () => Promise<"native_postgres">;
  close: () => Promise<void>;
};

function asDoc<T>(v: unknown): T {
  return v as T;
}

export function createPostgresExperimentStore(
  connectionString: string,
): PostgresStoreHandle {
  const pool = new pg.Pool({
    connectionString,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });

  const store: ExperimentStore = {
    async listExperiments(siteId) {
      const res = await pool.query(
        `select document from ros_experiments
         where site_id=$1
           and coalesce(category,'') not in ('__ros_pursuit__','__ros_pursuit_event__','__ros_lease__')
           and id not like 'ros:%'
         order by updated_at desc
         limit 500`,
        [siteId],
      );
      return res.rows.map((r) => asDoc<Experiment>(r.document));
    },
    async getExperiment(id) {
      const res = await pool.query(
        `select document from ros_experiments where id=$1`,
        [id],
      );
      return res.rows[0] ? asDoc<Experiment>(res.rows[0].document) : null;
    },
    async saveExperiment(experiment) {
      await pool.query(
        `insert into ros_experiments (id, site_id, category, status, document, updated_at, provenance)
         values ($1,$2,$3,$4,$5::jsonb,$6::timestamptz,'LOCAL_LEDGER')
         on conflict (id) do update set
           category=excluded.category, status=excluded.status,
           document=excluded.document, updated_at=excluded.updated_at,
           provenance='LOCAL_LEDGER'`,
        [
          experiment.id,
          experiment.siteId,
          experiment.category ?? "experiment",
          experiment.status,
          JSON.stringify(experiment),
          experiment.updatedAt ?? new Date().toISOString(),
        ],
      );
    },
    async listLessons({ siteId, industry }) {
      const res = await pool.query(
        `select document from ros_lessons order by updated_at desc limit 2000`,
      );
      const midScopes = new Set([
        "business_model",
        "audience",
        "price_band",
        "consideration",
        "channel",
        "product",
      ]);
      return res.rows
        .map((r) => asDoc<Lesson>(r.document))
        .filter((lesson) => {
          if (lesson.scope === "global") return true;
          if (
            (lesson.scope === "industry" || midScopes.has(lesson.scope)) &&
            industry &&
            lesson.industry === industry
          ) {
            return true;
          }
          if (
            (lesson.scope === "site" || lesson.scope === "business") &&
            lesson.siteId === siteId
          ) {
            return true;
          }
          if (midScopes.has(lesson.scope) && !lesson.industry) return true;
          return false;
        });
    },
    async listAllLessons() {
      const res = await pool.query(
        `select document from ros_lessons order by updated_at desc limit 5000`,
      );
      return res.rows.map((r) => asDoc<Lesson>(r.document));
    },
    async saveLesson(lesson) {
      await pool.query(
        `insert into ros_lessons (id, site_id, summary, document, updated_at, provenance)
         values ($1,$2,$3,$4::jsonb,$5::timestamptz,'LOCAL_LEDGER')
         on conflict (id) do update set
           summary=excluded.summary, document=excluded.document,
           updated_at=excluded.updated_at, provenance='LOCAL_LEDGER'`,
        [
          lesson.id,
          lesson.siteId ?? "platform",
          String(lesson.summary ?? "lesson"),
          JSON.stringify(lesson),
          lesson.updatedAt ?? new Date().toISOString(),
        ],
      );
    },
    async saveScorecard(scorecard) {
      const id = `scorecard:${scorecard.siteId}:${scorecard.generatedAt}`;
      await pool.query(
        `insert into ros_scorecards (id, site_id, document, updated_at, provenance)
         values ($1,$2,$3::jsonb,$4::timestamptz,'LOCAL_LEDGER')
         on conflict (id) do update set
           document=excluded.document, updated_at=excluded.updated_at,
           provenance='LOCAL_LEDGER'`,
        [
          id,
          scorecard.siteId,
          JSON.stringify(scorecard),
          scorecard.generatedAt ?? new Date().toISOString(),
        ],
      );
    },
    async listScorecards(siteId, limit = 14) {
      const res = await pool.query(
        `select document from ros_scorecards where site_id=$1
         order by updated_at desc limit $2`,
        [siteId, limit],
      );
      return res.rows.map((r) => asDoc<Scorecard>(r.document));
    },
    async saveAttribution(attribution) {
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,$3::timestamptz,$4,$5,$6::jsonb,'LOCAL_LEDGER')
         on conflict (id) do update set detail=excluded.detail, provenance='LOCAL_LEDGER'`,
        [
          attribution.id,
          attribution.siteId,
          attribution.createdAt ?? new Date().toISOString(),
          "attribution",
          null,
          JSON.stringify({ kind: "attribution", ...attribution }),
        ],
      );
    },
    async listAttributions(siteId) {
      const res = await pool.query(
        `select detail from ros_activity
         where site_id=$1 and detail->>'kind'='attribution'
         order by at desc limit 200`,
        [siteId],
      );
      return res.rows.map((r) => {
        const d = r.detail as Attribution & { kind?: string };
        const { kind: _k, ...rest } = d;
        return rest as Attribution;
      });
    },
    async listPlannerRuns(siteId, limit = 48) {
      const res = await pool.query(
        `select detail from ros_activity
         where site_id=$1 and detail->>'kind'='plannerRun'
         order by at desc limit $2`,
        [siteId, limit],
      );
      return res.rows.map((r) => asDoc<PlannerRunRecord>(r.detail));
    },
    async savePlannerRun(record) {
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,$3::timestamptz,$4,null,$5::jsonb,'LOCAL_LEDGER')
         on conflict (id) do update set detail=excluded.detail`,
        [
          record.id,
          record.siteId,
          record.createdAt ?? new Date().toISOString(),
          "planner_run",
          JSON.stringify({ kind: "plannerRun", ...record }),
        ],
      );
    },
    async listCycleReports(siteId, limit = 30) {
      const res = await pool.query(
        `select detail from ros_activity
         where site_id=$1 and detail->>'kind'='cycleReport'
         order by at desc limit $2`,
        [siteId, limit],
      );
      return res.rows.map((r) => asDoc<CycleReportRecord>(r.detail));
    },
    async saveCycleReport(record) {
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,$3::timestamptz,$4,null,$5::jsonb,'LOCAL_LEDGER')
         on conflict (id) do update set detail=excluded.detail`,
        [
          record.id,
          record.siteId,
          record.createdAt ?? new Date().toISOString(),
          "cycle_report",
          JSON.stringify({ kind: "cycleReport", ...record }),
        ],
      );
    },
    async listExposures(siteId, limit = 100) {
      const res = await pool.query(
        `select detail from ros_activity
         where site_id=$1 and (detail->>'kind'='exposure' or summary='exposures')
         order by at desc limit $2`,
        [siteId, limit],
      );
      return res.rows.map((r) => asDoc<ExposureRecord>(r.detail));
    },
    async saveExposure(record) {
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,$3::timestamptz,'exposures',null,$4::jsonb,'LOCAL_LEDGER')
         on conflict (id) do update set detail=excluded.detail`,
        [
          record.id,
          record.siteId,
          record.createdAt ?? new Date().toISOString(),
          JSON.stringify({ kind: "exposure", ...record }),
        ],
      );
    },
    async listDiscoveryDoors(siteId) {
      const res = await pool.query(
        `select detail from ros_activity
         where site_id=$1 and detail->>'kind'='discoveryDoor'
         order by at desc limit 200`,
        [siteId],
      );
      return res.rows.map((r) => asDoc<DiscoveryDoor>(r.detail));
    },
    async saveDiscoveryDoor(door) {
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,now(),'discovery_door',null,$3::jsonb,'LOCAL_LEDGER')
         on conflict (id) do update set detail=excluded.detail`,
        [door.id, door.siteId, JSON.stringify({ kind: "discoveryDoor", ...door })],
      );
    },
    async listCapabilityGaps(siteId) {
      const res = siteId
        ? await pool.query(
            `select detail from ros_activity
             where site_id=$1 and detail->>'kind'='capabilityGap' limit 200`,
            [siteId],
          )
        : await pool.query(
            `select detail from ros_activity
             where detail->>'kind'='capabilityGap' limit 500`,
          );
      return res.rows.map((r) => asDoc<CapabilityGap>(r.detail));
    },
    async saveCapabilityGap(gap) {
      const id = `capgap:${gap.siteId}:${gap.missingCapability}:${gap.desiredAction}`;
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,now(),'capability_gap',null,$3::jsonb,'LOCAL_LEDGER')
         on conflict (id) do update set detail=excluded.detail`,
        [id, gap.siteId, JSON.stringify({ kind: "capabilityGap", ...gap })],
      );
    },
    async listChannels(siteId) {
      const res = await pool.query(
        `select document from ros_channels where site_id=$1 order by updated_at desc`,
        [siteId],
      );
      return res.rows.map((r) => asDoc<ChannelRecord>(r.document));
    },
    async saveChannel(channel) {
      await pool.query(
        `insert into ros_channels
         (id, site_id, platform, account, capability_id, status, document, provenance, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,'LOCAL_LEDGER',now())
         on conflict (id) do update set
           document=excluded.document, status=excluded.status,
           updated_at=now(), provenance='LOCAL_LEDGER'`,
        [
          channel.id,
          channel.siteId,
          channel.platform ?? "",
          channel.account ?? "default",
          channel.capabilityId ?? "",
          channel.status ?? "active",
          JSON.stringify(channel),
        ],
      );
    },
    async listPursuits(siteId, opts) {
      const limit = opts?.limit ?? 200;
      const res = await pool.query(
        `select document from ros_pursuits where site_id=$1
         order by updated_at desc limit $2`,
        [siteId, limit],
      );
      let jobs = res.rows.map((r) => asDoc<PursuitJob>(r.document));
      if (opts?.states?.length) {
        const states = new Set(opts.states);
        jobs = jobs.filter((j) => states.has(j.state));
      }
      return jobs.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    },
    async savePursuit(job) {
      await pool.query(
        `insert into ros_pursuits
         (id, site_id, state, pattern_key, action_type, document, updated_at, provenance)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::timestamptz,'LOCAL_LEDGER')
         on conflict (id) do update set
           state=excluded.state, pattern_key=excluded.pattern_key,
           action_type=excluded.action_type, document=excluded.document,
           updated_at=excluded.updated_at, provenance='LOCAL_LEDGER'`,
        [
          job.id,
          job.siteId,
          job.state,
          job.patternKey ?? null,
          job.actionType ?? null,
          JSON.stringify(job),
          job.updatedAt ?? new Date().toISOString(),
        ],
      );
    },
    async claimPursuits(input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const now = input.now ?? new Date();
        const nowIso = now.toISOString();
        const leaseUntil = new Date(now.getTime() + input.leaseMs).toISOString();
        const res = await client.query(
          `select id, document from ros_pursuits
           where site_id=$1
           for update`,
          [input.siteId],
        );
        const exclude = new Set(input.excludeActionTypes ?? []);
        const candidates = res.rows
          .map((r) => asDoc<PursuitJob>(r.document))
          .filter((job) => CLAIMABLE_STATES.has(job.state))
          .filter((job) => {
            if (job.notBefore && Date.parse(job.notBefore) > now.getTime()) {
              return false;
            }
            const leased =
              job.leaseUntil && Date.parse(job.leaseUntil) > now.getTime();
            if (leased && job.leaseOwner !== input.owner) return false;
            if (job.actionType && exclude.has(job.actionType)) return false;
            return true;
          })
          .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
          .slice(0, input.limit);

        const claimed: PursuitJob[] = [];
        for (const job of candidates) {
          const next: PursuitJob = {
            ...job,
            leaseOwner: input.owner,
            leaseUntil,
            updatedAt: nowIso,
          };
          await client.query(
            `update ros_pursuits set
               document=$2::jsonb, state=$3, updated_at=$4::timestamptz,
               provenance='LOCAL_LEDGER'
             where id=$1`,
            [job.id, JSON.stringify(next), next.state, nowIso],
          );
          claimed.push(next);
        }
        await client.query("commit");
        return claimed;
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
    async appendPursuitEvent(event) {
      await pool.query(
        `insert into ros_events (id, site_id, event_type, detail, created_at, provenance)
         values ($1,$2,$3,$4::jsonb,$5::timestamptz,'LOCAL_LEDGER')
         on conflict (id) do nothing`,
        [
          event.id,
          event.siteId,
          event.eventType ?? "pursuit_event",
          JSON.stringify(event),
          event.createdAt ?? new Date().toISOString(),
        ],
      );
      // Also record compact activity for owner dashboard
      await pool.query(
        `insert into ros_activity (id, site_id, at, summary, quality, detail, provenance)
         values ($1,$2,$3::timestamptz,$4,$5,$6::jsonb,'LOCAL_LEDGER')
         on conflict (id) do nothing`,
        [
          `act:${event.id}`,
          event.siteId,
          event.createdAt ?? new Date().toISOString(),
          String(event.eventType ?? "pursuit_event"),
          event.eventType === "executed" ? "commercial" : "operational",
          JSON.stringify(event),
        ],
      );
    },
    async listPursuitEvents(siteId, opts) {
      const limit = opts?.limit ?? 200;
      const since = opts?.since ?? "1970-01-01T00:00:00.000Z";
      const res = await pool.query(
        `select detail from ros_events
         where site_id=$1 and created_at >= $2::timestamptz
         order by created_at desc limit $3`,
        [siteId, since, limit],
      );
      return res.rows.map((r) => asDoc<PursuitEvent>(r.detail));
    },
    async claimLease(input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const existing = await client.query(
          `select document, lease_until from ros_leases where id=$1 for update`,
          [input.id],
        );
        const nowMs = Date.now();
        if (
          existing.rows[0] &&
          existing.rows[0].lease_until &&
          Date.parse(existing.rows[0].lease_until) > nowMs
        ) {
          await client.query("rollback");
          return false;
        }
        const document = {
          id: input.id,
          siteId: input.siteId,
          kind: input.kind,
          leaseUntil: input.leaseUntil,
          document: input.document,
          createdAt: new Date().toISOString(),
        };
        await client.query(
          `insert into ros_leases (id, site_id, owner, lease_until, document, provenance)
           values ($1,$2,$3,$4::timestamptz,$5::jsonb,'LOCAL_LEDGER')
           on conflict (id) do update set
             owner=excluded.owner, lease_until=excluded.lease_until,
             document=excluded.document, provenance='LOCAL_LEDGER'`,
          [
            input.id,
            input.siteId,
            input.kind,
            input.leaseUntil,
            JSON.stringify(document),
          ],
        );
        await client.query("commit");
        return true;
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
  };

  return {
    store,
    pool,
    mode: async () => "native_postgres",
    close: async () => {
      await pool.end();
    },
  };
}
