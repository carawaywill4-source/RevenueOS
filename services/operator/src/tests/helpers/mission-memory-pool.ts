/**
 * Purpose-built in-memory Postgres double for MissionController tests.
 *
 * Handles the specific queries MissionController issues; unknown SELECTs
 * return empty and unknown UPDATEs return 0 rows so new queries added to
 * the controller don't break tests that don't exercise them.
 */

type Row = Record<string, unknown>;

type QueryResult<T = Row> = {
  rows: T[];
  rowCount: number;
};

type MissionRow = {
  id: string;
  status: string;
  objective: unknown;
  progress: unknown;
  started_at: Date;
  deadline_at: Date | null;
  current_experiment_id: string | null;
  last_commercial_progress_at: Date | null;
  last_action_at: Date | null;
  meta: Record<string, unknown>;
};

type ExperimentRow = {
  id: string;
  mission_id: string;
  fingerprint: string;
  family: string;
  executor: string;
  state: string;
  hypothesis: string;
  business_id: string;
  buyer: string;
  offer: string;
  channel: string;
  expected_result: string;
  measurement: string;
  budget_usd: number;
  attempts: number;
  external_exposures: number;
  verified_humans: number;
  engaged_humans: number;
  clicks: number;
  checkout_starts: number;
  purchases: number;
  revenue_usd: number;
  source: string;
  started_at: Date | null;
  completed_at: Date | null;
  claimed_at: Date | null;
  claimed_by: string | null;
  heartbeat_at: Date | null;
  measuring_started_at: Date | null;
  external_action_verified_at: Date | null;
  terminal_reason: string;
  lesson: string;
  next_mutation: string;
  meta: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export function createMissionMemoryPool() {
  const missions = new Map<string, MissionRow>();
  const experiments = new Map<string, ExperimentRow>();
  const receipts: Row[] = [];
  const distributionReceipts: Array<{
    id: string;
    mission_id: string;
    experiment_id: string;
    external_receipt_id: string | null;
    platform: string;
    channel_family: string;
    distribution_type: string;
    external_id: string | null;
    public_url: string | null;
    externally_accessible: boolean;
    discoverable_or_delivered: boolean;
    verification_method: string;
    evidence: unknown;
    created_at: Date;
  }> = [];
  const ownerActions: Row[] = [];
  const incidents = new Map<string, Row & { resolved_at: Date | null }>();
  const aiLedger: Row[] = [];
  const missionClocks = new Map<string, { proven_humans_24h: number }>();

  const query = async <T = Row>(text: string, values: unknown[] = []): Promise<QueryResult<T>> => {
    const norm = text.replace(/\s+/g, " ").trim();

    // -----------------------------------------------------------------------
    // Schema DDL
    // -----------------------------------------------------------------------
    if (/^create\s+/i.test(norm)) return { rows: [], rowCount: 0 } as any;
    if (/^alter\s+table/i.test(norm)) return { rows: [], rowCount: 0 } as any;
    if (/^select\s+1$/i.test(norm)) return { rows: [], rowCount: 0 } as any;
    if (/^begin$/i.test(norm) || /^commit$/i.test(norm) || /^rollback$/i.test(norm)) {
      return { rows: [], rowCount: 0 } as any;
    }

    // -----------------------------------------------------------------------
    // MISSIONS
    // -----------------------------------------------------------------------
    if (/from ros_missions where status='ACTIVE'/i.test(norm) && /^select/i.test(norm)) {
      const active = [...missions.values()].filter((m) => m.status === "ACTIVE");
      active.sort((a, b) => b.started_at.getTime() - a.started_at.getTime());
      return { rows: active.slice(0, 1) as any, rowCount: Math.min(1, active.length) };
    }
    if (/from ros_missions where id=\$1/i.test(norm) && /^select/i.test(norm)) {
      const m = missions.get(String(values[0]));
      return { rows: m ? [m as any] : [], rowCount: m ? 1 : 0 };
    }
    if (/^insert into ros_missions/i.test(norm)) {
      const [id, primary, firstSale, longTerm, deadline] = values as any[];
      missions.set(id, {
        id,
        status: "ACTIVE",
        objective: safeJson(values[5]),
        progress: safeJson(values[6]),
        started_at: new Date(),
        deadline_at: deadline ?? null,
        current_experiment_id: null,
        last_commercial_progress_at: null,
        last_action_at: null,
        meta: { firstSaleTargetUsd: firstSale, longTermDailyRevenueTargetUsd: longTerm, primary },
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^update ros_missions set status=/i.test(norm)) {
      const [to, reason, id] = values as any[];
      const m = missions.get(String(id));
      if (m && m.status === "ACTIVE") {
        m.status = String(to);
        m.meta = { ...m.meta, lastTransitionReason: reason, lastTransitionAt: new Date().toISOString() };
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_missions set progress=/i.test(norm)) {
      const [progress, lastAt, id] = values as any[];
      const m = missions.get(String(id));
      if (m) {
        m.progress = safeJson(progress);
        m.last_commercial_progress_at = lastAt ? new Date(lastAt) : null;
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }
    if (/^update ros_missions set current_experiment_id=/i.test(norm)) {
      const [expId, id] = values as any[];
      const m = missions.get(String(id));
      if (m) {
        m.current_experiment_id = String(expId);
        m.last_action_at = new Date();
      }
      return { rows: [], rowCount: m ? 1 : 0 };
    }

    // -----------------------------------------------------------------------
    // EXPERIMENTS
    // -----------------------------------------------------------------------
    if (/from ros_commercial_experiments where mission_id=\$1 and fingerprint=\$2/i.test(norm) && /^select/i.test(norm)) {
      const [mid, fp] = values as any[];
      const match = [...experiments.values()].find((e) => e.mission_id === mid && e.fingerprint === fp);
      return { rows: match ? [match as any] : [], rowCount: match ? 1 : 0 };
    }
    if (/^insert into ros_commercial_experiments/i.test(norm) && /returning \*$/i.test(norm)) {
      const [
        id,
        missionId,
        fingerprint,
        family,
        executor,
        hypothesis,
        businessId,
        buyer,
        offer,
        channel,
        expectedResult,
        measurement,
        budgetUsd,
        source,
        meta,
      ] = values as any[];
      const exists = [...experiments.values()].find(
        (e) => e.mission_id === missionId && e.fingerprint === fingerprint,
      );
      if (exists) throw new Error("mock_pool_unique_violation_experiment_fingerprint");
      const row: ExperimentRow = {
        id: String(id),
        mission_id: String(missionId),
        fingerprint: String(fingerprint),
        family: String(family),
        executor: String(executor),
        state: "PROPOSED",
        hypothesis: String(hypothesis ?? ""),
        business_id: String(businessId ?? ""),
        buyer: String(buyer ?? ""),
        offer: String(offer ?? ""),
        channel: String(channel ?? ""),
        expected_result: String(expectedResult ?? ""),
        measurement: String(measurement ?? ""),
        budget_usd: Number(budgetUsd ?? 0),
        attempts: 0,
        external_exposures: 0,
        verified_humans: 0,
        engaged_humans: 0,
        clicks: 0,
        checkout_starts: 0,
        purchases: 0,
        revenue_usd: 0,
        source: String(source ?? "deterministic"),
        started_at: null,
        completed_at: null,
        claimed_at: null,
        claimed_by: null,
        heartbeat_at: null,
        measuring_started_at: null,
        external_action_verified_at: null,
        terminal_reason: "",
        lesson: "",
        next_mutation: "",
        meta: safeJson(meta) as Record<string, unknown>,
        created_at: new Date(),
        updated_at: new Date(),
      };
      experiments.set(row.id, row);
      return { rows: [row as any], rowCount: 1 };
    }
    if (/^update ros_commercial_experiments\s+set state='ENQUEUED'/i.test(norm) && /returning \*$/i.test(norm)) {
      const id = String(values[0]);
      const row = experiments.get(id);
      if (row && row.state === "PROPOSED") {
        row.state = "ENQUEUED";
        row.updated_at = new Date();
        return { rows: [row as any], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_commercial_experiments\s+set state='CLAIMED'/i.test(norm) && /returning \*$/i.test(norm)) {
      const [id, claimedBy] = values as any[];
      const row = experiments.get(String(id));
      if (row && row.state === "ENQUEUED") {
        row.state = "CLAIMED";
        row.claimed_at = new Date();
        row.claimed_by = String(claimedBy);
        row.heartbeat_at = new Date();
        row.attempts += 1;
        row.updated_at = new Date();
        return { rows: [row as any], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_commercial_experiments\s+set state='EXECUTING'/i.test(norm)) {
      const id = String(values[0]);
      const row = experiments.get(id);
      if (row && row.state === "CLAIMED") {
        row.state = "EXECUTING";
        if (!row.started_at) row.started_at = new Date();
        row.heartbeat_at = new Date();
        row.updated_at = new Date();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_commercial_experiments\s+set state='EXTERNAL_ACTION_VERIFIED'/i.test(norm)) {
      const id = String(values[0]);
      const row = experiments.get(id);
      if (row && (row.state === "CLAIMED" || row.state === "EXECUTING")) {
        row.state = "EXTERNAL_ACTION_VERIFIED";
        row.external_action_verified_at = new Date();
        row.heartbeat_at = new Date();
        row.updated_at = new Date();
        return { rows: [row as any], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_commercial_experiments\s+set state='MEASURING'/i.test(norm)) {
      const id = String(values[0]);
      const row = experiments.get(id);
      if (row && row.state === "EXTERNAL_ACTION_VERIFIED") {
        row.state = "MEASURING";
        row.measuring_started_at = new Date();
        row.heartbeat_at = new Date();
        row.updated_at = new Date();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_commercial_experiments\s+set state=\$1, terminal_reason=\$2/i.test(norm)) {
      const [state, reason, lesson, mutation, id] = values as any[];
      const row = experiments.get(String(id));
      if (row) {
        row.state = String(state);
        row.terminal_reason = String(reason);
        row.lesson = String(lesson);
        row.next_mutation = String(mutation);
        row.completed_at = new Date();
        row.updated_at = new Date();
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/^update ros_commercial_experiments\s+set state=\$1, lesson=/i.test(norm)) {
      const [state, lesson, mutation, id] = values as any[];
      const row = experiments.get(String(id));
      if (row) {
        row.state = String(state);
        row.lesson = String(lesson);
        row.next_mutation = String(mutation);
        row.completed_at = new Date();
        row.updated_at = new Date();
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (/^update ros_commercial_experiments\s+set heartbeat_at=/i.test(norm)) {
      const id = String(values[0]);
      const row = experiments.get(id);
      if (row) {
        row.heartbeat_at = new Date();
        row.updated_at = new Date();
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (/^update ros_commercial_experiments\s+set external_exposures=/i.test(norm)) {
      // signal accumulation — treat as no-op for these mock tests
      return { rows: [], rowCount: 1 };
    }
    if (/^select \* from ros_commercial_experiments where mission_id=\$1 and state='ENQUEUED'/i.test(norm)) {
      const mid = String(values[0]);
      const list = [...experiments.values()]
        .filter((e) => e.mission_id === mid && e.state === "ENQUEUED")
        .sort((a, b) => {
          const at = a.started_at ?? a.created_at;
          const bt = b.started_at ?? b.created_at;
          return at.getTime() - bt.getTime();
        });
      return { rows: list.slice(0, 1) as any, rowCount: Math.min(1, list.length) };
    }
    if (/^select count\(\*\)::int as n from ros_commercial_experiments/i.test(norm)) {
      const mid = String(values[0]);
      const activeStates = new Set([
        "ENQUEUED",
        "CLAIMED",
        "EXECUTING",
        "EXTERNAL_ACTION_VERIFIED",
        "MEASURING",
        "RUNNING",
      ]);
      const list = [...experiments.values()].filter(
        (e) => e.mission_id === mid && activeStates.has(e.state),
      );
      return { rows: [{ n: list.length } as any], rowCount: 1 };
    }
    if (/^select \* from ros_commercial_experiments where mission_id=\$1 and state in \(\s*'ENQUEUED','CLAIMED','EXECUTING'/i.test(norm)) {
      const mid = String(values[0]);
      const active = ["ENQUEUED", "CLAIMED", "EXECUTING", "EXTERNAL_ACTION_VERIFIED", "MEASURING", "RUNNING"];
      const list = [...experiments.values()]
        .filter((e) => e.mission_id === mid && active.includes(e.state))
        .sort((a, b) => {
          const rank = (s: string) =>
            ({
              MEASURING: 0,
              EXTERNAL_ACTION_VERIFIED: 1,
              EXECUTING: 2,
              CLAIMED: 3,
              RUNNING: 4,
              ENQUEUED: 5,
            } as any)[s] ?? 6;
          if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
          const at = a.started_at ?? a.created_at;
          const bt = b.started_at ?? b.created_at;
          return bt.getTime() - at.getTime();
        });
      return { rows: list.slice(0, 1) as any, rowCount: Math.min(1, list.length) };
    }
    if (/^select \* from ros_commercial_experiments where id=\$1$/i.test(norm)) {
      const row = experiments.get(String(values[0]));
      return { rows: row ? [row as any] : [], rowCount: row ? 1 : 0 };
    }
    if (/^select mission_id, executor, family from ros_commercial_experiments where id=\$1/i.test(norm)) {
      const row = experiments.get(String(values[0]));
      return {
        rows: row
          ? [{ mission_id: row.mission_id, executor: row.executor, family: row.family } as any]
          : [],
        rowCount: row ? 1 : 0,
      };
    }
    if (/^select mission_id from ros_commercial_experiments where id=\$1/i.test(norm)) {
      const row = experiments.get(String(values[0]));
      return { rows: row ? [{ mission_id: row.mission_id } as any] : [], rowCount: row ? 1 : 0 };
    }
    if (/^select id, executor, family, updated_at from ros_commercial_experiments/i.test(norm)) {
      // enforceQueueSlas ENQUEUED sweep — mock returns none stale
      return { rows: [], rowCount: 0 };
    }
    if (/^select id, executor from ros_commercial_experiments/i.test(norm)) {
      // enforceQueueSlas CLAIMED / EXECUTING sweep — mock returns none stale
      return { rows: [], rowCount: 0 };
    }
    if (/^select id, verified_humans, checkout_starts, purchases from ros_commercial_experiments/i.test(norm)) {
      // concludeStaleMeasuring — mock returns none due
      return { rows: [], rowCount: 0 };
    }
    // Zero-humans short-circuit selector: state='MEASURING' + family in [...] + stale
    if (/^select id, family from ros_commercial_experiments where mission_id=\$1 and state='MEASURING'/i.test(norm)) {
      const [mid, families, minutes] = values as any[];
      const famList = Array.isArray(families) ? families : [];
      const cutoff = Date.now() - Number(minutes) * 60_000;
      const list = [...experiments.values()].filter((e) => {
        if (e.mission_id !== mid) return false;
        if (e.state !== "MEASURING") return false;
        if (!famList.includes(e.family)) return false;
        const started = e.measuring_started_at ?? e.external_action_verified_at ?? e.updated_at;
        if (!started) return false;
        return started.getTime() < cutoff;
      });
      return {
        rows: list.map((e) => ({ id: e.id, family: e.family }) as any),
        rowCount: list.length,
      };
    }
    // Explicit backdating from tests: `update ros_commercial_experiments set measuring_started_at = ... where id=$1`
    if (/^update ros_commercial_experiments\s+set measuring_started_at = now\(\) - interval/i.test(norm)) {
      const id = String(values[0]);
      const match = /interval '(\d+) minutes'/i.exec(norm);
      const minutesAgo = match ? Number(match[1]) : 10;
      const row = experiments.get(id);
      if (row) {
        row.measuring_started_at = new Date(Date.now() - minutesAgo * 60_000);
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    if (/^select completed_at, external_action_verified_at from ros_commercial_experiments/i.test(norm)) {
      // cooldown lookup — mock returns none, so cooldown never blocks
      return { rows: [], rowCount: 0 };
    }
    if (/^select fingerprint from ros_commercial_experiments where mission_id=\$1 order by created_at desc limit \$2/i.test(norm)) {
      const [mid, limit] = values as any[];
      const list = [...experiments.values()]
        .filter((e) => e.mission_id === mid)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, Number(limit));
      return { rows: list.map((e) => ({ fingerprint: e.fingerprint }) as any), rowCount: list.length };
    }
    if (/^select fingerprint, family, business_id from ros_commercial_experiments where mission_id=\$1 order by coalesce\(started_at, created_at\) desc limit 1/i.test(norm)) {
      const mid = String(values[0]);
      const list = [...experiments.values()]
        .filter((e) => e.mission_id === mid)
        .sort((a, b) => {
          const at = a.started_at ?? a.created_at;
          const bt = b.started_at ?? b.created_at;
          return bt.getTime() - at.getTime();
        });
      const top = list[0];
      return {
        rows: top
          ? [{ fingerprint: top.fingerprint, family: top.family, business_id: top.business_id } as any]
          : [],
        rowCount: top ? 1 : 0,
      };
    }
    if (/^select \* from ros_commercial_experiments where mission_id=\$1 order by created_at desc limit \$2/i.test(norm)) {
      const [mid, limit] = values as any[];
      const list = [...experiments.values()]
        .filter((e) => e.mission_id === mid)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, Number(limit));
      return { rows: list as any, rowCount: list.length };
    }

    // -----------------------------------------------------------------------
    // RECEIPTS
    // -----------------------------------------------------------------------
    if (/^insert into ros_external_execution_receipts/i.test(norm)) {
      receipts.push({ values });
      return { rows: [], rowCount: 1 };
    }
    if (/^select \* from ros_external_execution_receipts/i.test(norm)) {
      return { rows: receipts as any, rowCount: receipts.length };
    }

    // -----------------------------------------------------------------------
    // OWNER ACTIONS
    // -----------------------------------------------------------------------
    if (/^insert into ros_owner_action_queue/i.test(norm)) {
      ownerActions.push({ values });
      return { rows: [], rowCount: 1 };
    }
    if (/^select \* from ros_owner_action_queue/i.test(norm)) {
      return { rows: ownerActions as any, rowCount: ownerActions.length };
    }

    // -----------------------------------------------------------------------
    // DISTRIBUTION RECEIPTS
    // -----------------------------------------------------------------------
    if (/^insert into ros_distribution_receipts/i.test(norm)) {
      const [
        id, mid, experimentId, externalReceiptId,
        platform, channelFamily, distributionType,
        externalId, publicUrl,
        externallyAccessible, discoverableOrDelivered,
        verificationMethod, evidence,
      ] = values as any[];
      distributionReceipts.push({
        id: String(id),
        mission_id: String(mid),
        experiment_id: String(experimentId),
        external_receipt_id: externalReceiptId ? String(externalReceiptId) : null,
        platform: String(platform),
        channel_family: String(channelFamily),
        distribution_type: String(distributionType),
        external_id: externalId ? String(externalId) : null,
        public_url: publicUrl ? String(publicUrl) : null,
        externally_accessible: Boolean(externallyAccessible),
        discoverable_or_delivered: Boolean(discoverableOrDelivered),
        verification_method: String(verificationMethod),
        evidence: safeJson(evidence),
        created_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^select \* from ros_distribution_receipts where mission_id=\$1/i.test(norm)) {
      const mid = String(values[0]);
      const list = distributionReceipts
        .filter((d) => d.mission_id === mid)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return { rows: list as any, rowCount: list.length };
    }

    // -----------------------------------------------------------------------
    // PROGRESS CLOCK
    // -----------------------------------------------------------------------
    if (/from ros_mission_progress_clock where mission_id=\$1/i.test(norm) && /proven_humans_24h/i.test(norm)) {
      const mid = String(values[0]);
      const clock = missionClocks.get(mid);
      return { rows: [{ n: clock?.proven_humans_24h ?? 0 } as any], rowCount: 1 };
    }
    if (/^insert into ros_mission_progress_clock/i.test(norm) && /on conflict/i.test(norm) && /proven_humans_24h/i.test(norm)) {
      const [mid, proven] = values as any[];
      missionClocks.set(String(mid), { proven_humans_24h: Number(proven ?? 0) });
      return { rows: [], rowCount: 1 };
    }
    if (/^select max\(created_at\) as at from ros_(commercial_actions|traffic_events|purchases)/i.test(norm)) {
      return { rows: [{ at: null } as any], rowCount: 1 };
    }
    if (/^select count\(\*\)::int as n from ros_(commercial_actions|traffic_events|purchases)/i.test(norm)) {
      return { rows: [{ n: 0 } as any], rowCount: 1 };
    }
    if (/^insert into ros_mission_progress_clock/i.test(norm)) {
      return { rows: [], rowCount: 1 };
    }

    // -----------------------------------------------------------------------
    // INCIDENTS
    // -----------------------------------------------------------------------
    if (/^insert into ros_mission_incidents/i.test(norm)) {
      const [id, mid, kind, severity, detail, meta] = values as any[];
      incidents.set(String(id), {
        id: String(id),
        mission_id: String(mid),
        kind: String(kind),
        severity: String(severity),
        detail: String(detail),
        opened_at: new Date(),
        resolved_at: null,
        meta: safeJson(meta),
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^select id, kind, severity, opened_at, detail from ros_mission_incidents/i.test(norm)) {
      const mid = String(values[0]);
      const list = [...incidents.values()].filter((i) => i.mission_id === mid && !i.resolved_at);
      return {
        rows: list.map((i) => ({
          id: i.id,
          kind: i.kind,
          severity: i.severity,
          opened_at: i.opened_at,
          detail: i.detail,
        }) as any),
        rowCount: list.length,
      };
    }
    if (/^update ros_mission_incidents/i.test(norm)) {
      return { rows: [], rowCount: 0 };
    }

    // -----------------------------------------------------------------------
    // AI LEDGER
    // -----------------------------------------------------------------------
    if (/^insert into ros_ai_call_ledger/i.test(norm)) {
      aiLedger.push({});
      return { rows: [], rowCount: 1 };
    }

    // Permissive fallback: unknown SELECT → empty, unknown UPDATE/DELETE → 0.
    if (/^select/i.test(norm)) return { rows: [], rowCount: 0 } as any;
    if (/^(update|delete)/i.test(norm)) return { rows: [], rowCount: 0 } as any;

    throw new Error(`mission-memory-pool: unhandled query: ${norm}`);
  };

  return {
    query,
    // Expose the internal maps for tests that want to inspect state.
    _internal: { missions, experiments, receipts, ownerActions, incidents },
  };
}

function safeJson(v: unknown): unknown {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return v ?? {};
}
