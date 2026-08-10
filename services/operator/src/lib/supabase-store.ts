/**
 * Portable Supabase-backed ExperimentStore for the persistent operator.
 *
 * This is a lean re-expression of the per-app durable store. Each app in
 * `apps/*` bakes its own copy tied to the app's Next.js env — the operator
 * runs outside any app runtime, so it needs its own version with the same
 * table shape.
 *
 * Modes:
 *   - native     — `revenueos_pursuits` / `revenueos_pursuit_events` exist
 *   - document   — encode pursuits into `revenueos_experiments` (document JSON)
 *   - unavailable — no Supabase; the operator refuses to tick and logs why
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

export type OperatorLedgerMode = "native" | "document" | "unavailable";

const PURSUIT_CAT = "__ros_pursuit__";
const PURSUIT_EVENT_CAT = "__ros_pursuit_event__";
const LEASE_CAT = "__ros_lease__";

function pursuitDocId(id: string) {
  return `ros:pursuit:${id}`;
}
function pursuitEventDocId(id: string) {
  return `ros:pevt:${id}`;
}
function leaseDocId(id: string) {
  return `ros:lease:${id}`;
}
function isRosDocId(id: string) {
  return id.startsWith("ros:");
}

export type SupabaseStoreHandle = {
  store: ExperimentStore;
  mode: () => Promise<OperatorLedgerMode>;
  invalidateModeCache: () => void;
  client: SupabaseClient;
};

const SUPABASE_FETCH_TIMEOUT_MS = 8_000;

/** Prevent hung REST from holding Mac Core ticks open for minutes. */
function timedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const timeout = AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  return fetch(input, { ...init, signal });
}

export function createSupabaseStore(input: {
  url: string;
  serviceRoleKey: string;
}): SupabaseStoreHandle {
  const sb = createClient(input.url, input.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timedFetch },
  });

  let modeCache: Promise<OperatorLedgerMode> | null = null;

  async function probeMode(): Promise<OperatorLedgerMode> {
    if (modeCache) return modeCache;
    modeCache = (async () => {
      try {
        const base = await sb.from("revenueos_experiments").select("id").limit(1);
        if (base.error) return "unavailable";
      } catch {
        return "unavailable";
      }
      try {
        const pursuits = await sb.from("revenueos_pursuits").select("id").limit(1);
        if (pursuits.error) return "document";
        const events = await sb
          .from("revenueos_pursuit_events")
          .select("id")
          .limit(1);
        if (events.error) return "document";
        return "native";
      } catch {
        return "document";
      }
    })();
    return modeCache;
  }

  /** Drop cached mode after outages so Core can re-enter degraded local ledger. */
  function invalidateModeCache() {
    modeCache = null;
  }

  async function savePursuitDocument(job: PursuitJob) {
    const { error } = await sb.from("revenueos_experiments").upsert({
      id: pursuitDocId(job.id),
      site_id: job.siteId,
      status: job.state,
      pattern_key: job.patternKey ?? job.idempotencyKey,
      category: PURSUIT_CAT,
      document: job,
      updated_at: job.updatedAt,
    });
    if (error) throw new Error(`Document pursuit save failed: ${error.message}`);
  }

  async function listPursuitDocuments(
    siteId: string,
    opts?: { states?: string[]; limit?: number },
  ): Promise<PursuitJob[]> {
    let query = sb
      .from("revenueos_experiments")
      .select("document")
      .eq("site_id", siteId)
      .eq("category", PURSUIT_CAT)
      .order("updated_at", { ascending: false });
    query = opts?.limit ? query.limit(opts.limit) : query.limit(200);
    const { data, error } = await query;
    if (error) throw new Error(`Document pursuit list failed: ${error.message}`);
    let jobs = (data ?? [])
      .map((row) => row.document as PursuitJob)
      .filter((j) => j && j.id);
    if (opts?.states?.length) {
      const states = new Set(opts.states);
      jobs = jobs.filter((j) => states.has(j.state));
    }
    return jobs.sort((a, b) => b.priority - a.priority);
  }

  async function appendPursuitEventDocument(event: PursuitEvent) {
    const { error } = await sb.from("revenueos_experiments").upsert({
      id: pursuitEventDocId(event.id),
      site_id: event.siteId,
      status: event.eventType,
      pattern_key: event.pursuitId,
      category: PURSUIT_EVENT_CAT,
      document: event,
      updated_at: event.createdAt,
      created_at: event.createdAt,
    });
    if (error) {
      throw new Error(`Document pursuit event save failed: ${error.message}`);
    }
  }

  async function listPursuitEventDocuments(
    siteId: string,
    opts?: { since?: string; limit?: number },
  ): Promise<PursuitEvent[]> {
    let query = sb
      .from("revenueos_experiments")
      .select("document")
      .eq("site_id", siteId)
      .eq("category", PURSUIT_EVENT_CAT)
      .order("created_at", { ascending: false });
    query = opts?.limit ? query.limit(opts.limit) : query.limit(200);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Document pursuit event list failed: ${error.message}`);
    }
    let events = (data ?? [])
      .map((row) => row.document as PursuitEvent)
      .filter((e) => e && e.id);
    if (opts?.since) {
      const sinceMs = Date.parse(opts.since);
      events = events.filter((e) => Date.parse(e.createdAt) >= sinceMs);
    }
    return events;
  }

  const store: ExperimentStore = {
    async listExperiments(siteId) {
      const { data, error } = await sb
        .from("revenueos_experiments")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? [])
        .map((row) => row.document as Experiment)
        .filter(
          (exp) =>
            exp &&
            exp.hypothesis?.patternKey != null &&
            !String(exp.id).startsWith("hourly-email:") &&
            !isRosDocId(String(exp.id)),
        );
    },

    async getExperiment(id) {
      const { data, error } = await sb
        .from("revenueos_experiments")
        .select("document")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return data.document as Experiment;
    },

    async saveExperiment(experiment: Experiment) {
      await sb.from("revenueos_experiments").upsert({
        id: experiment.id,
        site_id: experiment.siteId,
        status: experiment.status,
        pattern_key:
          experiment.hypothesis.patternKey ?? experiment.category ?? null,
        category: experiment.category ?? null,
        document: experiment,
        updated_at: experiment.updatedAt,
      });
    },

    async listLessons({ siteId, industry }) {
      const { data, error } = await sb
        .from("revenueos_lessons")
        .select("document,scope,site_id,industry");
      if (error) return [];
      return (data ?? [])
        .filter((row) => {
          if (row.scope === "global") return true;
          if (row.scope === "industry" && industry && row.industry === industry) {
            return true;
          }
          if (row.scope === "site" && row.site_id === siteId) return true;
          return false;
        })
        .map((row) => row.document as Lesson);
    },

    async listAllLessons() {
      const { data, error } = await sb
        .from("revenueos_lessons")
        .select("document");
      if (error) return [];
      return (data ?? []).map((row) => row.document as Lesson);
    },

    async saveLesson(lesson: Lesson) {
      await sb.from("revenueos_lessons").upsert({
        id: lesson.id,
        site_id: lesson.siteId ?? null,
        industry: lesson.industry ?? null,
        scope: lesson.scope,
        pattern_key: lesson.patternKey,
        document: lesson,
        updated_at: lesson.updatedAt,
      });
    },

    async saveScorecard(scorecard: Scorecard) {
      await sb
        .from("revenueos_scorecards")
        .insert({ site_id: scorecard.siteId, document: scorecard });
    },

    async listScorecards(siteId, limit = 14) {
      const { data, error } = await sb
        .from("revenueos_scorecards")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data ?? []).map((row) => row.document as Scorecard);
    },

    async saveAttribution(attribution: Attribution) {
      await sb.from("revenueos_attributions").upsert({
        id: attribution.id,
        site_id: attribution.siteId,
        experiment_id: attribution.experimentId,
        verdict: attribution.verdict,
        document: attribution,
      });
    },

    async listAttributions(siteId) {
      const { data, error } = await sb
        .from("revenueos_attributions")
        .select("document")
        .eq("site_id", siteId);
      if (error) return [];
      return (data ?? []).map((row) => row.document as Attribution);
    },

    async listPlannerRuns(siteId, limit = 48) {
      const { data, error } = await sb
        .from("revenueos_planner_runs")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data ?? []).map((row) => row.document as PlannerRunRecord);
    },

    async savePlannerRun(record: PlannerRunRecord) {
      await sb.from("revenueos_planner_runs").upsert({
        id: record.id,
        site_id: record.siteId,
        source: record.source,
        policy_rejected: record.policyRejected,
        document: record,
      });
    },

    async listCycleReports(siteId, limit = 30) {
      const { data, error } = await sb
        .from("revenueos_cycle_reports")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data ?? []).map((row) => row.document as CycleReportRecord);
    },

    async saveCycleReport(record: CycleReportRecord) {
      await sb.from("revenueos_cycle_reports").upsert({
        id: record.id,
        site_id: record.siteId,
        observed_at: record.observedAt,
        planner_source: record.plannerSource ?? null,
        document: record,
      });
    },

    async listExposures(siteId, limit = 100) {
      const { data, error } = await sb
        .from("revenueos_exposures")
        .select("document")
        .eq("site_id", siteId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data ?? []).map((row) => row.document as ExposureRecord);
    },

    async saveExposure(record: ExposureRecord) {
      await sb.from("revenueos_exposures").upsert({
        id: record.id,
        site_id: record.siteId,
        experiment_id: record.experimentId ?? null,
        action_type: record.actionType,
        exposure_key: record.exposureKey,
        version: record.version,
        started_at: record.startedAt,
        ended_at: record.endedAt ?? null,
        document: record,
      });
    },

    async listDiscoveryDoors(siteId) {
      const { data, error } = await sb
        .from("revenueos_discovery_doors")
        .select("document")
        .eq("site_id", siteId)
        .order("published_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((row) => row.document as DiscoveryDoor);
    },

    async saveDiscoveryDoor(door: DiscoveryDoor) {
      await sb.from("revenueos_discovery_doors").upsert({
        id: door.id,
        site_id: door.siteId,
        cluster_key: door.clusterKey,
        status: door.status,
        published_at: door.publishedAt,
        document: door,
        updated_at: new Date().toISOString(),
      });
    },

    async listCapabilityGaps(siteId) {
      let query = sb.from("revenueos_capability_gaps").select("document");
      if (siteId) query = query.eq("site_id", siteId);
      const { data, error } = await query.order("last_seen_at", {
        ascending: false,
      });
      if (error) return [];
      return (data ?? []).map((row) => row.document as CapabilityGap);
    },

    async saveCapabilityGap(gap: CapabilityGap) {
      await sb.from("revenueos_capability_gaps").upsert(
        {
          id: gap.id,
          site_id: gap.siteId,
          missing_capability: gap.missingCapability,
          desired_action: gap.desiredAction,
          importance: gap.importance,
          times_blocked: gap.timesBlocked,
          document: gap,
          first_seen_at: gap.firstSeenAt,
          last_seen_at: gap.lastSeenAt,
        },
        { onConflict: "site_id,missing_capability,desired_action" },
      );
    },

    async listChannels(siteId: string) {
      const { data, error } = await sb
        .from("revenueos_channels")
        .select("document")
        .eq("site_id", siteId)
        .order("revenue_per_action", { ascending: false });
      if (error) return [];
      return (data ?? []).map((row) => row.document as ChannelRecord);
    },

    async saveChannel(channel: ChannelRecord) {
      await sb.from("revenueos_channels").upsert(
        {
          id: channel.id,
          site_id: channel.siteId,
          platform: channel.platform,
          account: channel.account,
          capability_id: channel.capabilityId ?? "",
          revenue_per_action: channel.revenuePerAction,
          confidence: channel.confidence,
          status: channel.status,
          document: channel,
          created_at: channel.createdAt,
          updated_at: channel.updatedAt,
        },
        { onConflict: "id" },
      );
    },

    async listPursuits(siteId, opts) {
      const mode = await probeMode();
      if (mode === "document") return listPursuitDocuments(siteId, opts);
      let query = sb
        .from("revenueos_pursuits")
        .select("document")
        .eq("site_id", siteId)
        .order("priority", { ascending: false });
      if (opts?.states?.length) query = query.in("state", opts.states);
      if (opts?.limit) query = query.limit(opts.limit);
      const { data, error } = await query;
      if (error) return listPursuitDocuments(siteId, opts);
      return (data ?? []).map((row) => row.document as PursuitJob);
    },

    async savePursuit(job: PursuitJob) {
      const mode = await probeMode();
      if (mode === "document") return savePursuitDocument(job);
      const { error } = await sb.from("revenueos_pursuits").upsert(
        {
          id: job.id,
          site_id: job.siteId,
          state: job.state,
          kind: job.kind,
          pattern_key: job.patternKey ?? null,
          action_type: job.actionType ?? null,
          priority: job.priority,
          effort: job.effort,
          experiment_id: job.experimentId ?? null,
          opportunity_id: job.opportunityId ?? null,
          idempotency_key: job.idempotencyKey,
          lease_owner: job.leaseOwner ?? null,
          lease_until: job.leaseUntil ?? null,
          not_before: job.notBefore ?? null,
          attempts: job.attempts,
          max_attempts: job.maxAttempts,
          last_error: job.lastError ?? null,
          document: job,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        },
        { onConflict: "id" },
      );
      if (error) await savePursuitDocument(job);
    },

    async claimPursuits(input) {
      const now = input.now ?? new Date();
      const nowIso = now.toISOString();
      const leaseUntil = new Date(now.getTime() + input.leaseMs).toISOString();
      const mode = await probeMode();

      const candidates: PursuitJob[] =
        mode === "document"
          ? await listPursuitDocuments(input.siteId, {
              states: [
                "DISCOVER",
                "QUALIFY",
                "EXECUTE",
                "WAITING_FOR_EVIDENCE",
                "ATTRIBUTE",
                "LEARN",
                "REPLENISH",
              ],
              limit: Math.max(input.limit * 3, 24),
            })
          : await (async () => {
              const { data, error } = await sb
                .from("revenueos_pursuits")
                .select("document")
                .eq("site_id", input.siteId)
                .in("state", [
                  "DISCOVER",
                  "QUALIFY",
                  "EXECUTE",
                  "WAITING_FOR_EVIDENCE",
                  "ATTRIBUTE",
                  "LEARN",
                  "REPLENISH",
                ])
                .order("priority", { ascending: false })
                .limit(Math.max(input.limit * 3, 24));
              if (error) {
                return listPursuitDocuments(input.siteId, {
                  states: [
                    "DISCOVER",
                    "QUALIFY",
                    "EXECUTE",
                    "WAITING_FOR_EVIDENCE",
                    "ATTRIBUTE",
                    "LEARN",
                    "REPLENISH",
                  ],
                  limit: Math.max(input.limit * 3, 24),
                });
              }
              return (data ?? []).map((row) => row.document as PursuitJob);
            })();

      const claimed: PursuitJob[] = [];
      for (const job of candidates) {
        if (claimed.length >= input.limit) break;
        if (job.notBefore && Date.parse(job.notBefore) > now.getTime()) continue;
        if (
          job.leaseUntil &&
          Date.parse(job.leaseUntil) > now.getTime() &&
          job.leaseOwner !== input.owner
        ) {
          continue;
        }
        if (
          input.excludeActionTypes?.length &&
          job.actionType &&
          input.excludeActionTypes.includes(job.actionType)
        ) {
          continue;
        }
        const next: PursuitJob = {
          ...job,
          leaseOwner: input.owner,
          leaseUntil,
          updatedAt: nowIso,
        };
        try {
          if (mode === "document") await savePursuitDocument(next);
          else {
            const { error: saveError } = await sb
              .from("revenueos_pursuits")
              .upsert({
                id: next.id,
                site_id: next.siteId,
                state: next.state,
                kind: next.kind,
                pattern_key: next.patternKey ?? null,
                action_type: next.actionType ?? null,
                priority: next.priority,
                effort: next.effort,
                experiment_id: next.experimentId ?? null,
                opportunity_id: next.opportunityId ?? null,
                idempotency_key: next.idempotencyKey,
                lease_owner: next.leaseOwner,
                lease_until: next.leaseUntil,
                not_before: next.notBefore ?? null,
                attempts: next.attempts,
                max_attempts: next.maxAttempts,
                last_error: next.lastError ?? null,
                document: next,
                created_at: next.createdAt,
                updated_at: next.updatedAt,
              });
            if (saveError) await savePursuitDocument(next);
          }
          claimed.push(next);
        } catch {
          continue;
        }
      }
      return claimed;
    },

    async appendPursuitEvent(event: PursuitEvent) {
      const mode = await probeMode();
      if (mode === "document") return appendPursuitEventDocument(event);
      const { error } = await sb.from("revenueos_pursuit_events").upsert({
        id: event.id,
        pursuit_id: event.pursuitId,
        site_id: event.siteId,
        event_type: event.eventType,
        detail: event.detail,
        created_at: event.createdAt,
      });
      if (error) await appendPursuitEventDocument(event);
    },

    async listPursuitEvents(siteId, opts) {
      const mode = await probeMode();
      if (mode === "document") return listPursuitEventDocuments(siteId, opts);
      let query = sb
        .from("revenueos_pursuit_events")
        .select("id,pursuit_id,site_id,event_type,detail,created_at")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (opts?.since) query = query.gte("created_at", opts.since);
      query = opts?.limit ? query.limit(opts.limit) : query.limit(200);
      const { data, error } = await query;
      if (error) return listPursuitEventDocuments(siteId, opts);
      return (data ?? []).map(
        (row) =>
          ({
            id: row.id,
            pursuitId: row.pursuit_id,
            siteId: row.site_id,
            eventType: row.event_type,
            detail: (row.detail ?? {}) as Record<string, unknown>,
            createdAt: row.created_at,
          }) satisfies PursuitEvent,
      );
    },

    async claimLease(input) {
      const mode = await probeMode();
      const nowIso = new Date().toISOString();
      if (mode === "document") {
        const { data: existing } = await sb
          .from("revenueos_experiments")
          .select("document")
          .eq("id", leaseDocId(input.id))
          .maybeSingle();
        const doc = existing?.document as { leaseUntil?: string } | undefined;
        if (doc?.leaseUntil && Date.parse(doc.leaseUntil) > Date.now()) {
          return false;
        }
        const { error } = await sb.from("revenueos_experiments").upsert({
          id: leaseDocId(input.id),
          site_id: input.siteId,
          status: "leased",
          pattern_key: input.kind,
          category: LEASE_CAT,
          document: {
            id: input.id,
            siteId: input.siteId,
            kind: input.kind,
            leaseUntil: input.leaseUntil,
            document: input.document ?? {},
          },
          updated_at: nowIso,
        });
        if (error) throw new Error(`Document lease claim failed: ${error.message}`);
        return true;
      }
      const { data: existing } = await sb
        .from("revenueos_leases")
        .select("lease_until")
        .eq("id", input.id)
        .maybeSingle();
      if (
        existing?.lease_until &&
        Date.parse(existing.lease_until) > Date.now()
      ) {
        return false;
      }
      const { error } = await sb.from("revenueos_leases").upsert({
        id: input.id,
        site_id: input.siteId,
        kind: input.kind,
        lease_until: input.leaseUntil,
        document: input.document ?? {},
        created_at: nowIso,
      });
      if (error) throw new Error(`Lease claim failed: ${error.message}`);
      return true;
    },
  };

  return {
    store,
    mode: probeMode,
    client: sb,
    invalidateModeCache,
  };
}
