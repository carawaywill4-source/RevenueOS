/**
 * Azure-owned serial admission controller.
 *
 * ONE new business enters LIVE_PROBATION at a time.
 * After 15 healthy minutes → ACCEPTED → TITAN_MANAGED.
 * Accepted businesses keep operating concurrently.
 * Cursor is not in the loop — state persists in ros_config_meta.
 */

import type pg from "pg";
import { PORTFOLIO_50_SPECS } from "@revenueos/core";
import type { BusinessRuntimeStatus } from "./scheduler.js";
import type { OwnerControlState } from "./owner-controls-types.js";
import { isBusinessCommerciallyPaused } from "./owner-controls-types.js";
import { applyOwnerControlPg, loadOwnerControlsPg } from "./postgres-platform.js";
import {
  getReliabilitySnapshot,
  scanAdapterMissingIncidents,
} from "./engineering-repair.js";
import {
  ADMISSION_GATE_VERSION,
  admissionAllowed,
  assessCommercialReadiness,
  attemptCommercialRepair,
  auditManagedBusinesses,
  type CommercialReadinessResult,
} from "./commercial-readiness.js";
import { requestCommercialRepairForCandidate } from "./storefront-repair-executor.js";
import { enqueueEngineeringSelfRepair } from "./parallel-autonomy.js";
import {
  authorizeAdmissionDecision,
  evaluateTitanAdmissionQuality,
  persistTitanJudgment,
  selectReplacementOpportunity,
  setPortfolioOrigin,
  type TitanAdmissionJudgment,
} from "./titan-admission-gate.js";
import { seedArchitectReplacement } from "./business-architect-loop.js";
import { loadLifecycleQueue } from "./architect-pg-store.js";
import { buildEvidencePack } from "./titan-evidence-pack.js";
import {
  createReworkDecisionExperiment,
  loadApplicableLessons,
} from "./titan-decision-lifecycle.js";

export const ADMIT_CHECKPOINT_KEY = "admit_rollout_checkpoint";
export const TARGET_PORTFOLIO_DEFAULT = 50;

export type AdmitPhase =
  | "IDLE"
  | "PREPARING"
  | "LIVE_PROBATION"
  | "ACCEPTING"
  | "PORTFOLIO_BUILD_COMPLETE"
  | "PLATFORM_PAUSED"
  | "CRITICAL_HOLD"
  | "ENGINEERING_REPAIR";

export type AdmitBusinessRecord = {
  siteId: string;
  status:
    | "CANDIDATE"
    | "LIVE_PROBATION"
    | "ACCEPTED"
    | "TITAN_MANAGED"
    | "REJECTED"
    | "UNDER_REPAIR";
  probationStartedAt?: string;
  healthyMsAccumulated?: number;
  acceptedAt?: string;
  titanManagedAt?: string;
  lastHealthAt?: string;
  lastError?: string | null;
  rejectReason?: string;
};

export type AdmitCheckpoint = {
  version: 1;
  targetPortfolio: number;
  probationMinutes: number;
  phase: AdmitPhase;
  currentCandidate: string | null;
  probationStartedAt: string | null;
  healthyMsAccumulated: number;
  lastHealthyAt: string | null;
  accepted: string[];
  titanManaged: string[];
  rejected: string[];
  underRepair: string[];
  vacantSlots: number;
  replacementRequired: string[];
  candidateQueue: string[];
  platformHealth: "OK" | "DEGRADED" | "CRITICAL";
  /** When true, do not start NEW candidates (accepted keep running). */
  pauseNewAdmissions: boolean;
  pauseNewAdmissionsReason: string | null;
  lastCheckpointAt: string;
  notes: string[];
  reliability?: {
    totalFailures: number;
    uniqueFingerprints: number;
    repeatFailures: number;
    autoRepaired: number;
    codeRepairs: number;
    rollbacks: number;
  };
  /** Latest Titan quality gate judgment for current/last candidate. */
  lastTitanJudgment?: TitanAdmissionJudgment | null;
  /** SiteIds waiting for product rework before probation. */
  reworkQueue?: string[];
  /** Replacement siteIds seeded by architect awaiting admit. */
  replacementQueue?: string[];
  /** Soft-retired accepted businesses (restorable; not actively managed). */
  softRetired?: string[];
};

export type AdmitLogger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function admissionOrder(): string[] {
  return PORTFOLIO_50_SPECS.map((s) => s.siteId);
}

function emptyCheckpoint(target: number, probationMinutes: number): AdmitCheckpoint {
  const queue = admissionOrder();
  return {
    version: 1,
    targetPortfolio: target,
    probationMinutes,
    phase: "IDLE",
    currentCandidate: null,
    probationStartedAt: null,
    healthyMsAccumulated: 0,
    lastHealthyAt: null,
    accepted: [],
    titanManaged: [],
    rejected: [],
    underRepair: [],
    vacantSlots: target,
    replacementRequired: [],
    candidateQueue: queue,
    platformHealth: "OK",
    pauseNewAdmissions: false,
    pauseNewAdmissionsReason: null,
    lastCheckpointAt: new Date().toISOString(),
    notes: ["initialized"],
    lastTitanJudgment: null,
    reworkQueue: [],
    replacementQueue: [],
  };
}

export async function loadAdmitCheckpoint(
  pool: pg.Pool,
  target: number,
  probationMinutes: number,
): Promise<AdmitCheckpoint> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [ADMIT_CHECKPOINT_KEY],
  );
  const raw = res.rows[0]?.value as Partial<AdmitCheckpoint> | undefined;
  if (!raw || raw.version !== 1) {
    return emptyCheckpoint(target, probationMinutes);
  }
  const base = emptyCheckpoint(target, probationMinutes);
  return {
    ...base,
    ...raw,
    version: 1,
    targetPortfolio: Number(raw.targetPortfolio ?? target),
    probationMinutes: Number(raw.probationMinutes ?? probationMinutes),
    accepted: Array.isArray(raw.accepted) ? raw.accepted.map(String) : [],
    titanManaged: Array.isArray(raw.titanManaged)
      ? raw.titanManaged.map(String)
      : [],
    rejected: Array.isArray(raw.rejected) ? raw.rejected.map(String) : [],
    underRepair: Array.isArray(raw.underRepair)
      ? raw.underRepair.map(String)
      : [],
    replacementRequired: Array.isArray(raw.replacementRequired)
      ? raw.replacementRequired.map(String)
      : [],
    candidateQueue: Array.isArray(raw.candidateQueue)
      ? raw.candidateQueue.map(String)
      : base.candidateQueue,
    notes: Array.isArray(raw.notes) ? raw.notes.map(String) : [],
    pauseNewAdmissions: Boolean(raw.pauseNewAdmissions),
    pauseNewAdmissionsReason: raw.pauseNewAdmissionsReason
      ? String(raw.pauseNewAdmissionsReason)
      : null,
    lastTitanJudgment:
      (raw.lastTitanJudgment as TitanAdmissionJudgment | null | undefined) ??
      null,
    reworkQueue: Array.isArray(raw.reworkQueue)
      ? raw.reworkQueue.map(String)
      : [],
    replacementQueue: Array.isArray(raw.replacementQueue)
      ? raw.replacementQueue.map(String)
      : [],
    softRetired: Array.isArray(raw.softRetired)
      ? raw.softRetired.map(String)
      : [],
  };
}

export async function saveAdmitCheckpoint(
  pool: pg.Pool,
  cp: AdmitCheckpoint,
): Promise<void> {
  const at = new Date().toISOString();
  const soft = new Set(
    (Array.isArray(cp.softRetired) ? cp.softRetired : []).map(String),
  );
  // Soft-retired businesses must never be resurrected by concurrent lane saves.
  const titanManaged = cp.titanManaged.filter((s) => !soft.has(s));
  const accepted = cp.accepted.filter((s) => !soft.has(s));
  const next = {
    ...cp,
    titanManaged,
    accepted,
    softRetired: [...soft],
    vacantSlots: Math.max(0, cp.targetPortfolio - titanManaged.length),
    lastCheckpointAt: at,
  };
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,$3::timestamptz,'ENGINE_CHECKPOINT')
     on conflict (key) do update set
       value=excluded.value, updated_at=excluded.updated_at,
       provenance='ENGINE_CHECKPOINT'`,
    [ADMIT_CHECKPOINT_KEY, JSON.stringify(next), at],
  );
  await pool.query(
    `insert into ros_portfolio_state (id, document, updated_at, provenance)
     values ('portfolio:admit-rollout', $1::jsonb, $2::timestamptz, 'ENGINE_CHECKPOINT')
     on conflict (id) do update set
       document=excluded.document, updated_at=excluded.updated_at,
       provenance='ENGINE_CHECKPOINT'`,
    [JSON.stringify(next), at],
  );
}

async function markBusinessLifecycle(
  pool: pg.Pool,
  siteId: string,
  lifecycle: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `update ros_businesses
     set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
         status = 'active',
         updated_at = now()
     where site_id = $1`,
    [
      siteId,
      JSON.stringify({
        lifecycle,
        admit: {
          lifecycle,
          ...extra,
          updatedAt: new Date().toISOString(),
        },
      }),
    ],
  );
}

function isCandidateHealthy(
  status: BusinessRuntimeStatus | undefined,
  siteId: string,
  control: OwnerControlState,
): { ok: boolean; reason?: string } {
  if (!status) return { ok: false, reason: "missing_runtime_status" };
  if (status.siteId !== siteId) {
    return { ok: false, reason: "scopeguard_site_mismatch" };
  }
  // Control plane is authoritative — ignore stale scheduler commerciallyPaused
  // flags left by checkpoint hydrate / pause-set races (homegrid overnight stall).
  if (isBusinessCommerciallyPaused(control, siteId)) {
    return { ok: false, reason: "commercially_paused" };
  }
  if (status.lastError) return { ok: false, reason: `last_error:${status.lastError}` };
  if (status.ticks < 1) return { ok: false, reason: "no_ticks_yet" };
  if (status.lastOk !== true) return { ok: false, reason: "last_tick_not_ok" };
  if (!status.lastTickAt) return { ok: false, reason: "no_last_tick" };
  const ageMs = Date.now() - Date.parse(status.lastTickAt);
  if (ageMs > 5 * 60_000) return { ok: false, reason: "stale_tick" };
  return { ok: true };
}

export type AdmitControllerDeps = {
  pool: pg.Pool;
  logger: AdmitLogger;
  getBusinessStatuses: () => BusinessRuntimeStatus[];
  getControlState: () => OwnerControlState;
  setControlState: (state: OwnerControlState) => void;
  platformHealthy: () => boolean;
  appRoot: string;
  signal: AbortSignal;
  targetPortfolio?: number;
  probationMinutes?: number;
  tickIntervalMs?: number;
  /**
   * Hot-register a probation candidate into portfolio-dynamic + scheduler.
   * Required when Titan/architect selects a siteId not already in the 50 runtime catalog.
   */
  ensureRuntimeBusiness?: (
    siteId: string,
  ) => Promise<{ ok: boolean; detail: string }>;
};

/**
 * Start the autonomous admit loop. Resolves only when aborted.
 */
export async function runPortfolioAdmitController(
  deps: AdmitControllerDeps,
): Promise<void> {
  const target = deps.targetPortfolio ?? TARGET_PORTFOLIO_DEFAULT;
  const probationMinutes = deps.probationMinutes ?? 15;
  const needMs = probationMinutes * 60_000;
  const intervalMs = deps.tickIntervalMs ?? 30_000;
  let cp = await loadAdmitCheckpoint(deps.pool, target, probationMinutes);

  deps.logger("info", "admit.controller.start", {
    target,
    probationMinutes,
    phase: cp.phase,
    accepted: cp.accepted.length,
    titanManaged: cp.titanManaged.length,
    current: cp.currentCandidate,
    admissionGateVersion: ADMISSION_GATE_VERSION,
  });

  // Non-destructive commercial audit of existing TITAN_MANAGED (no demotion).
  // Runs once at controller start; does not touch current probation candidate.
  void (async () => {
    try {
      if (cp.titanManaged.length === 0) return;
      const managed = cp.titanManaged.filter(
        (id) => id !== cp.currentCandidate,
      );
      const results = await auditManagedBusinesses({
        pool: deps.pool,
        siteIds: managed,
        logger: deps.logger,
      });
      // Queue only — storefront-repair-executor owns public deploy/verify.
      // Do NOT call /api/owner/execute here (not the canonical publish path).
      deps.logger("info", "admit.commercial_audit.bootstrap", {
        gateVersion: ADMISSION_GATE_VERSION,
        managed: managed.length,
        ready: results.filter((r) => r.status === "READY").length,
        repairRequired: results.filter((r) => r.status === "REPAIR_REQUIRED")
          .length,
        repairsAttempted: 0,
        note: "deferred_to_storefront_repair_executor",
        currentCandidateUntouched: cp.currentCandidate,
      });
    } catch (err) {
      deps.logger("warn", "admit.commercial_audit.bootstrap_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  const syncPauseSet = async (): Promise<void> => {
    const active = new Set<string>([
      ...cp.titanManaged,
      ...cp.accepted,
      ...(cp.currentCandidate ? [cp.currentCandidate] : []),
    ]);
    const all = admissionOrder();
    // Pause everyone not active in admit set; resume active.
    for (const siteId of all) {
      const shouldRun = active.has(siteId);
      const paused = deps.getControlState().pausedBusinesses.includes(siteId);
      if (!shouldRun && !paused) {
        const r = await applyOwnerControlPg({
          pool: deps.pool,
          command: "pause_business",
          siteId,
          actor: "admit-controller",
        });
        if (r.ok) deps.setControlState(r.state);
      } else if (shouldRun && paused) {
        const r = await applyOwnerControlPg({
          pool: deps.pool,
          command: "resume_business",
          siteId,
          actor: "admit-controller",
        });
        if (r.ok) deps.setControlState(r.state);
      }
    }
    // Ensure portfolio-level pause is off during admit.
    if (deps.getControlState().portfolioPaused) {
      const r = await applyOwnerControlPg({
        pool: deps.pool,
        command: "resume_revenueos",
        actor: "admit-controller",
      });
      if (r.ok) deps.setControlState(r.state);
    }
    // Prioritize current candidate.
    if (cp.currentCandidate) {
      const r = await applyOwnerControlPg({
        pool: deps.pool,
        command: "prioritize_business",
        siteId: cp.currentCandidate,
        actor: "admit-controller",
      });
      if (r.ok) deps.setControlState(r.state);
    }
  };

  const repairDeps = () => ({
    pool: deps.pool,
    logger: deps.logger,
    appRoot: deps.appRoot,
    pauseNewAdmissions: async (reason: string) => {
      cp.pauseNewAdmissions = true;
      cp.pauseNewAdmissionsReason = reason;
      cp.notes = [...cp.notes.slice(-20), `pause_new_admissions:${reason}`];
      await saveAdmitCheckpoint(deps.pool, cp);
    },
    resumeNewAdmissions: async () => {
      cp.pauseNewAdmissions = false;
      cp.pauseNewAdmissionsReason = null;
      await saveAdmitCheckpoint(deps.pool, cp);
    },
    pauseBusiness: async (siteId: string) => {
      const r = await applyOwnerControlPg({
        pool: deps.pool,
        command: "pause_business",
        siteId,
        actor: "engineering-repair",
      });
      if (r.ok) deps.setControlState(r.state);
    },
    resumeBusiness: async (siteId: string) => {
      const r = await applyOwnerControlPg({
        pool: deps.pool,
        command: "resume_business",
        siteId,
        actor: "engineering-repair",
      });
      if (r.ok) deps.setControlState(r.state);
    },
    markEngineeringBlocked: async (
      siteId: string,
      blocked: boolean,
      cause: string | null,
    ) => {
      await markBusinessLifecycle(
        deps.pool,
        siteId,
        blocked ? "UNDER_REPAIR" : (cp.titanManaged.includes(siteId)
          ? "TITAN_MANAGED"
          : "LIVE_PROBATION"),
        {
          engineeringBlocked: blocked,
          engineeringCause: cause,
          // Titan must not commercially-kill for eng defects.
          titanCommercialHold: blocked,
        },
      );
      if (blocked && !cp.underRepair.includes(siteId)) {
        cp.underRepair.push(siteId);
      }
      if (!blocked) {
        cp.underRepair = cp.underRepair.filter((s) => s !== siteId);
      }
      await saveAdmitCheckpoint(deps.pool, cp);
    },
    getRolloutBusinessNumber: () =>
      cp.titanManaged.length + (cp.currentCandidate ? 1 : 0),
    signal: deps.signal,
  });

  const beginNextCandidate = async (depth = 0): Promise<void> => {
    if (depth > 12) {
      deps.logger("warn", "admit.begin_next.depth_limit", { depth });
      return;
    }
    if (cp.pauseNewAdmissions) {
      deps.logger("warn", "admit.new_admissions_paused", {
        reason: cp.pauseNewAdmissionsReason,
        titanManaged: cp.titanManaged.length,
      });
      return;
    }
    if (cp.titanManaged.length >= cp.targetPortfolio) {
      cp.phase = "PORTFOLIO_BUILD_COMPLETE";
      cp.currentCandidate = null;
      cp.probationStartedAt = null;
      cp.healthyMsAccumulated = 0;
      cp.notes = [...cp.notes.slice(-20), "portfolio_build_complete"];
      await saveAdmitCheckpoint(deps.pool, cp);
      deps.logger("info", "admit.portfolio_complete", {
        titanManaged: cp.titanManaged.length,
        target: cp.targetPortfolio,
      });
      return;
    }

    const done = new Set([
      ...cp.titanManaged,
      ...cp.accepted,
      ...cp.rejected,
      ...(cp.softRetired ?? []),
    ]);

    // Prefer remaining PORTFOLIO_50 candidates. Only pull architect-ready sites
    // that we explicitly queued as replacements (avoid half-built lifecycle noise).
    // Do NOT fold reworkQueue into `done` then filter it — that empties rework every call.
    cp.replacementQueue = (cp.replacementQueue ?? []).filter((id) => !done.has(id));
    cp.reworkQueue = (cp.reworkQueue ?? []).filter((id) => !done.has(id));
    const reworkSet = new Set(cp.reworkQueue ?? []);
    let architectReady: string[] = [];
    try {
      const life = await loadLifecycleQueue(deps.pool);
      const replaceSet = new Set(cp.replacementQueue ?? []);
      // DISCOVERED/INCUBATING replacements must be evaluable — waiting only for
      // PROBATION/VALIDATING left the queue empty after mass REWORK.
      architectReady = life
        .filter(
          (r) =>
            (replaceSet.has(r.siteId) ||
              r.state === "PROBATION" ||
              r.state === "VALIDATING" ||
              r.state === "DISCOVERED") &&
            !["RETIRED", "REPLACED", "ACCEPTED"].includes(r.state) &&
            !done.has(r.siteId) &&
            !reworkSet.has(r.siteId),
        )
        .map((r) => r.siteId);
    } catch {
      architectReady = [];
    }

    cp.candidateQueue = admissionOrder().filter(
      (id) => !done.has(id) && !reworkSet.has(id),
    );
    let next =
      architectReady[0] ??
      cp.candidateQueue[0] ??
      null;

    // Vacant slots + exhausted inherited queue → seed discovery replacements.
    if (!next && depth < 3) {
      const industries = PORTFOLIO_50_SPECS.filter((s) =>
        cp.titanManaged.includes(s.siteId),
      ).map((s) => s.industry);
      let benchOpps:
        | import("@revenueos/core").BusinessOpportunity[]
        | undefined;
      try {
        const {
          listOpportunityBench,
          benchEntryToOpportunity,
        } = await import("./opportunity-bench-pg.js");
        const bench = await listOpportunityBench(deps.pool);
        benchOpps = bench
          .filter((b) => b.origin === "OPEN_WORLD_DISCOVERED" || b.expected_value >= 62)
          .map(benchEntryToOpportunity);
      } catch {
        benchOpps = undefined;
      }
      const replacement = selectReplacementOpportunity({
        rejectedSiteId: `vacancy_${cp.titanManaged.length}`,
        criteria:
          "Digital, high-margin, high-intent organic, autonomous fulfillment, credible $10k/day path",
        activeSiteIds: [...cp.titanManaged, ...cp.accepted],
        activeIndustries: industries,
        rejectedSiteIds: [
          ...cp.rejected,
          ...(cp.reworkQueue ?? []),
          ...(cp.softRetired ?? []),
        ],
        benchOpportunities: benchOpps,
      });
      if (replacement) {
        const seeded = await seedArchitectReplacement({
          pool: deps.pool,
          logger: deps.logger,
          opportunity: replacement,
          replacesSiteId: `vacancy_${cp.titanManaged.length}`,
          criteria: benchOpps?.some((b) => b.siteId === replacement.siteId)
            ? "open_world_or_bench_replacement"
            : "no_candidates_seed_replacement",
        });
        if (!cp.replacementQueue) cp.replacementQueue = [];
        if (!cp.replacementQueue.includes(replacement.siteId)) {
          cp.replacementQueue.push(replacement.siteId);
        }
        deps.logger("info", "admit.vacancy.seeded_replacement", {
          siteId: replacement.siteId,
          detail: seeded.detail,
        });
        await saveAdmitCheckpoint(deps.pool, cp);
        await beginNextCandidate(depth + 1);
        return;
      }
    }

    // Still empty: wait on rework repairs (IDLE), do not freeze the platform.
    if (!next) {
      cp.phase = "IDLE";
      cp.currentCandidate = null;
      cp.notes = [
        ...cp.notes.slice(-20),
        (cp.reworkQueue ?? []).length
          ? "awaiting_rework_completion_or_architect_seed"
          : "no_candidates_remaining — awaiting architect replacements",
      ];
      cp.replacementRequired = Array.from(
        {
          length: Math.max(0, cp.targetPortfolio - cp.titanManaged.length),
        },
        (_, i) => `slot_${i + 1}`,
      );
      await saveAdmitCheckpoint(deps.pool, cp);
      deps.logger("warn", "admit.no_candidates", {
        vacant: cp.targetPortfolio - cp.titanManaged.length,
        reworkQueued: (cp.reworkQueue ?? []).length,
      });
      return;
    }

    // Enter PREPARING for Titan quality gate (does not start healthyMs clock).
    cp.phase = "PREPARING";
    cp.currentCandidate = next;
    cp.probationStartedAt = null;
    cp.healthyMsAccumulated = 0;
    cp.lastHealthyAt = null;
    cp.candidateQueue = cp.candidateQueue.filter((id) => id !== next);
    cp.reworkQueue = (cp.reworkQueue ?? []).filter((id) => id !== next);
    cp.replacementQueue = (cp.replacementQueue ?? []).filter((id) => id !== next);
    await saveAdmitCheckpoint(deps.pool, cp);

    const activeIndustries = PORTFOLIO_50_SPECS.filter((s) =>
      cp.titanManaged.includes(s.siteId),
    ).map((s) => s.industry);
    const isReplacement =
      (cp.replacementRequired ?? []).includes(next) ||
      architectReady.includes(next) ||
      !PORTFOLIO_50_SPECS.some((s) => s.siteId === next);

    let productWeak = false;
    try {
      const gateProbe = await assessCommercialReadiness({
        siteId: next,
        pool: deps.pool,
      });
      productWeak = !gateProbe.ready;
    } catch {
      productWeak = false;
    }

    // Titan world research evidence pack (bounded). Fail-open to deterministic gate.
    let evidencePack: Awaited<ReturnType<typeof buildEvidencePack>> | null =
      null;
    try {
      evidencePack = await buildEvidencePack({
        pool: deps.pool,
        businessId: next,
        purpose: "ADMISSION",
        forceRefresh: true,
        logger: deps.logger,
      });
    } catch (err) {
      deps.logger("warn", "admit.titan_evidence_pack_failed", {
        siteId: next,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    let applicableLessons: Awaited<ReturnType<typeof loadApplicableLessons>> =
      [];
    try {
      applicableLessons = await loadApplicableLessons({
        pool: deps.pool,
        siteId: next,
        productWeak,
        failureCodes: productWeak
          ? ["NO_COMMERCIAL_OFFER", "NO_PUBLIC_STOREFRONT", "NO_CTA"]
          : [],
        limit: 5,
      });
    } catch {
      applicableLessons = [];
    }

    const judgment = evaluateTitanAdmissionQuality({
      siteId: next,
      activeSiteIds: [...cp.titanManaged, ...cp.accepted],
      activeIndustries,
      titanManagedCount: cp.titanManaged.length,
      targetPortfolio: cp.targetPortfolio,
      productWeak,
      isReplacement,
      evidencePack: evidencePack
        ? {
            decisionHint: evidencePack.decisionHint,
            wouldBuildToday: evidencePack.wouldBuildToday,
            opportunityCostNote: evidencePack.opportunityCostNote,
            usefulSources: evidencePack.usefulSources,
            facts: evidencePack.facts,
            tenKPath: evidencePack.tenKPath,
            researchSummary: evidencePack.researchSummary,
          }
        : null,
      applicableLessons,
    });
    if (judgment.lessonsConsidered?.length) {
      deps.logger("info", "admit.titan_lessons_considered", {
        siteId: next,
        lessons: judgment.lessonsConsidered.map((l) => ({
          id: l.id,
          applied: l.applied,
          transferability: l.transferability,
          effect: l.decisionEffect,
        })),
      });
    }
    const apex = authorizeAdmissionDecision(judgment);
    judgment.apexAuthorized = apex.authorized;
    judgment.apexDetail = apex.detail;
    cp.lastTitanJudgment = judgment;
    await persistTitanJudgment(deps.pool, judgment);

    deps.logger("info", "admit.titan_quality_gate", {
      siteId: next,
      decision: judgment.decision,
      score: judgment.businessQualityScore,
      confidence: judgment.confidence,
      wouldBuildToday: judgment.wouldBuildToday,
      apexAuthorized: apex.authorized,
      apexDetail: apex.detail,
    });

    if (!apex.authorized) {
      cp.notes = [
        ...cp.notes.slice(-20),
        `titan_gate_apex_denied:${next}:${apex.detail}`,
      ];
      // Hold in PREPARING — do not admit or reject without Apex.
      await markBusinessLifecycle(deps.pool, next, "PREPARING", {
        titanGate: judgment,
        apexDenied: apex.detail,
      });
      await saveAdmitCheckpoint(deps.pool, cp);
      return;
    }

    if (judgment.decision === "REJECT_AND_REPLACE") {
      if (!cp.rejected.includes(next)) cp.rejected.push(next);
      if (!cp.replacementRequired.includes(next)) {
        cp.replacementRequired.push(next);
      }
      cp.notes = [
        ...cp.notes.slice(-20),
        `titan_reject:${next}:score=${judgment.businessQualityScore}`,
      ];
      await markBusinessLifecycle(deps.pool, next, "REJECTED", {
        titanGate: judgment,
        preservedAssets: true,
        note: "Removed from active portfolio consideration — knowledge retained",
      });
      await setPortfolioOrigin(deps.pool, next, "INHERITED", {
        rejected: true,
        judgmentScore: judgment.businessQualityScore,
      });

      const replacement = selectReplacementOpportunity({
        rejectedSiteId: next,
        criteria: judgment.replacementOpportunityCriteria,
        activeSiteIds: [...cp.titanManaged, ...cp.accepted],
        activeIndustries,
        rejectedSiteIds: cp.rejected,
      });
      if (replacement) {
        const seeded = await seedArchitectReplacement({
          pool: deps.pool,
          logger: deps.logger,
          opportunity: replacement,
          replacesSiteId: next,
          criteria: judgment.replacementOpportunityCriteria,
        });
        if (!cp.replacementQueue) cp.replacementQueue = [];
        if (!cp.replacementQueue.includes(replacement.siteId)) {
          cp.replacementQueue.push(replacement.siteId);
        }
        cp.notes = [
          ...cp.notes.slice(-20),
          `architect_replacement_seeded:${replacement.siteId}:${seeded.detail}`,
        ];
        deps.logger("info", "admit.replacement.seeded", {
          rejected: next,
          replacement: replacement.siteId,
          score: replacement.score,
        });
      } else {
        deps.logger("warn", "admit.replacement.no_opportunity", {
          rejected: next,
        });
      }
      cp.currentCandidate = null;
      cp.lastTitanJudgment = judgment;
      await saveAdmitCheckpoint(deps.pool, cp);
      // Continue immediately to next candidate / replacement (no pause).
      await beginNextCandidate(depth + 1);
      return;
    }

    if (judgment.decision === "REWORK_BEFORE_ADMISSION") {
      if (!cp.underRepair.includes(next)) cp.underRepair.push(next);
      if (!cp.reworkQueue) cp.reworkQueue = [];
      if (!cp.reworkQueue.includes(next)) cp.reworkQueue.push(next);
      cp.phase = "PREPARING";
      cp.notes = [
        ...cp.notes.slice(-20),
        `titan_rework:${next}:score=${judgment.businessQualityScore}`,
      ];
      await markBusinessLifecycle(deps.pool, next, "REWORK_BEFORE_ADMISSION", {
        titanGate: judgment,
      });
      try {
        const decisionId = await createReworkDecisionExperiment({
          pool: deps.pool,
          businessId: next,
          decisionType: "REWORK_BEFORE_ADMISSION",
          evidencePackId: evidencePack?.packId ?? null,
          researchRunId: evidencePack?.researchRunId ?? null,
          gateScore: judgment.businessQualityScore,
          gateReason: judgment.reasoningSummary,
          mutationRequested: "RESTORE_PUBLIC_STOREFRONT",
          mutationAuthorization: apex.detail,
          baseline: {
            productWeak,
            lessonsApplied: judgment.lessonsConsidered
              ?.filter((l) => l.applied)
              .map((l) => l.id),
          },
          logger: deps.logger,
        });
        deps.logger("info", "admit.titan_rework.decision_recorded", {
          siteId: next,
          decisionId,
        });
      } catch (err) {
        deps.logger("warn", "admit.titan_rework.decision_record_failed", {
          siteId: next,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      await requestCommercialRepairForCandidate({
        pool: deps.pool,
        siteId: next,
        failures: [
          {
            code: "NO_COMMERCIAL_OFFER",
            detail: `TITAN_REWORK: ${judgment.reasoningSummary}`,
          },
        ],
        logger: deps.logger,
      }).catch(() => undefined);
      // Do not block the queue — continue evaluating other candidates
      // while rework runs in parallel for this site.
      cp.currentCandidate = null;
      await saveAdmitCheckpoint(deps.pool, cp);
      deps.logger("info", "admit.titan_rework", {
        siteId: next,
        score: judgment.businessQualityScore,
      });
      await beginNextCandidate(depth + 1);
      return;
    }

    // FAST_ACCEPT or PROBATION → enter LIVE_PROBATION (commercial gate still at accept).
    const fast = judgment.decision === "FAST_ACCEPT";
    if (deps.ensureRuntimeBusiness) {
      try {
        const ens = await deps.ensureRuntimeBusiness(next);
        deps.logger("info", "admit.runtime.ensure", {
          siteId: next,
          ok: ens.ok,
          detail: ens.detail,
        });
        if (!ens.ok) {
          deps.logger("warn", "admit.runtime.ensure_failed", {
            siteId: next,
            detail: ens.detail,
            note: "Candidate cannot earn healthy ticks without runtime status",
          });
        }
      } catch (err) {
        deps.logger("warn", "admit.runtime.ensure_error", {
          siteId: next,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    cp.phase = "LIVE_PROBATION";
    cp.currentCandidate = next;
    cp.probationStartedAt = new Date().toISOString();
    cp.healthyMsAccumulated = fast ? Math.floor(needMs * 0.5) : 0;
    cp.lastHealthyAt = null;
    await markBusinessLifecycle(deps.pool, next, "LIVE_PROBATION", {
      probationStartedAt: cp.probationStartedAt,
      titanGate: judgment,
      fastTrack: fast,
    });
    await syncPauseSet();
    await saveAdmitCheckpoint(deps.pool, cp);
    deps.logger("info", "admit.probation.start", {
      siteId: next,
      probationMinutes,
      activeAccepted: cp.titanManaged.length,
      titanDecision: judgment.decision,
      score: judgment.businessQualityScore,
      fastTrack: fast,
    });
  };

  /**
   * Commercial readiness gate — required in addition to 15m system health.
   * Failure pauses ONLY this candidate (under commercial repair); does not
   * pause portfolio admissions globally or reset healthyMs.
   */
  let commercialGateBlocked: CommercialReadinessResult | null = null;
  let lastCommercialRepairAt = 0;
  const COMMERCIAL_REPAIR_COOLDOWN_MS = 10 * 60_000;

  const runCommercialGate = async (
    siteId: string,
  ): Promise<CommercialReadinessResult> => {
    const result = await assessCommercialReadiness({
      siteId,
      pool: deps.pool,
    });
    deps.logger(
      result.ready ? "info" : "warn",
      "admit.commercial_gate",
      {
        siteId,
        gateVersion: ADMISSION_GATE_VERSION,
        ready: result.ready,
        status: result.status,
        failures: result.failures.map((f) => f.code),
        canonicalUrl: result.canonicalUrl,
        checks: result.checks,
      },
    );
    return result;
  };

  const acceptCurrent = async (): Promise<void> => {
    const siteId = cp.currentCandidate;
    if (!siteId) return;

    // COMMERCIAL READINESS GATE — system health alone is not enough.
    const gate = await runCommercialGate(siteId);
    if (!admissionAllowed(gate)) {
      commercialGateBlocked = gate;
      cp.notes = [
        ...cp.notes.slice(-20),
        `commercial_gate_block:${siteId}:${gate.failures.map((f) => f.code).join(",")}`,
      ];
      // Stay LIVE_PROBATION — do not demote, do not advance, do not pause OS.
      await markBusinessLifecycle(deps.pool, siteId, "LIVE_PROBATION", {
        commercialGate: {
          gateVersion: ADMISSION_GATE_VERSION,
          ready: false,
          failures: gate.failures,
          assessedAt: gate.assessedAt,
        },
        healthyMsAccumulated: cp.healthyMsAccumulated,
        commercialHold: true,
        titanCommercialHold: false,
      });
      // Queue durable storefront repair for this candidate (cooldown).
      if (Date.now() - lastCommercialRepairAt > COMMERCIAL_REPAIR_COOLDOWN_MS) {
        lastCommercialRepairAt = Date.now();
        await requestCommercialRepairForCandidate({
          pool: deps.pool,
          siteId,
          failures: gate.failures,
          logger: deps.logger,
        });
        const repair = await attemptCommercialRepair({
          pool: deps.pool,
          siteId,
          failures: gate.failures,
          appRoot: deps.appRoot,
          logger: deps.logger,
        });
        cp.notes = [
          ...cp.notes.slice(-20),
          `commercial_repair:${siteId}:${repair.detail.slice(0, 120)}`,
        ];
        deps.logger("info", "admit.commercial_repair.attempt", {
          siteId,
          attempted: repair.attempted,
          detail: repair.detail,
          healthyMsPreserved: cp.healthyMsAccumulated,
        });
      }
      cp.phase = "LIVE_PROBATION";
      await saveAdmitCheckpoint(deps.pool, cp);
      deps.logger("warn", "admit.commercial_gate.blocked_accept", {
        siteId,
        failures: gate.failures.map((f) => f.code),
        healthyMsPreserved: cp.healthyMsAccumulated,
        note: "TITAN_MANAGED requires HEALTHY + PUBLICLY SELLABLE",
      });
      return;
    }

    commercialGateBlocked = null;
    cp.phase = "ACCEPTING";
    const at = new Date().toISOString();
    if (!cp.accepted.includes(siteId)) cp.accepted.push(siteId);
    if (!cp.titanManaged.includes(siteId)) cp.titanManaged.push(siteId);
    const inPortfolio50 = PORTFOLIO_50_SPECS.some((s) => s.siteId === siteId);
    const wasReplacement = (cp.notes ?? []).some((n) =>
      n.includes(`architect_replacement_seeded:${siteId}`),
    );
    const wasRework = (cp.reworkQueue ?? []).includes(siteId);
    let openWorld = false;
    try {
      const { listOpportunityBench } = await import("./opportunity-bench-pg.js");
      const bench = await listOpportunityBench(deps.pool);
      openWorld = bench.some(
        (b) =>
          b.siteId === siteId && b.origin === "OPEN_WORLD_DISCOVERED",
      );
    } catch {
      openWorld = false;
    }
    const portfolioOrigin = openWorld
      ? ("OPEN_WORLD_DISCOVERED" as const)
      : !inPortfolio50
        ? wasReplacement
          ? ("REPLACEMENT" as const)
          : ("REVENUEOS_CREATED" as const)
        : wasRework
          ? ("REBUILT" as const)
          : ("INHERITED" as const);
    await setPortfolioOrigin(deps.pool, siteId, portfolioOrigin, {
      acceptedAt: at,
      titanScore: cp.lastTitanJudgment?.businessQualityScore,
    });
    await markBusinessLifecycle(deps.pool, siteId, "TITAN_MANAGED", {
      acceptedAt: at,
      titanManagedAt: at,
      healthyMsAccumulated: cp.healthyMsAccumulated,
      realMoneyMode: true,
      portfolioOrigin,
      commercialGate: {
        gateVersion: ADMISSION_GATE_VERSION,
        ready: true,
        assessedAt: gate.assessedAt,
        status: gate.status,
        failures: gate.failures,
      },
    });
    cp.reworkQueue = (cp.reworkQueue ?? []).filter((id) => id !== siteId);
    cp.replacementQueue = (cp.replacementQueue ?? []).filter(
      (id) => id !== siteId,
    );
    cp.notes = [
      ...cp.notes.slice(-20),
      `accepted:${siteId}:${at}`,
      `commercial_gate_pass:${siteId}:${ADMISSION_GATE_VERSION}`,
    ];
    deps.logger("info", "admit.accepted", {
      siteId,
      titanManaged: cp.titanManaged.length,
      target: cp.targetPortfolio,
      healthyMs: cp.healthyMsAccumulated,
      commercialGateVersion: ADMISSION_GATE_VERSION,
      commerciallySellable: true,
    });
    cp.currentCandidate = null;
    cp.probationStartedAt = null;
    cp.healthyMsAccumulated = 0;
    cp.lastHealthyAt = null;
    await saveAdmitCheckpoint(deps.pool, cp);
    await beginNextCandidate();
  };

  // Bootstrap — never reset mid-probation / mid-repair progress.
  // Soft-retired businesses must never remain as currentCandidate.
  if (
    cp.currentCandidate &&
    (cp.softRetired ?? []).includes(cp.currentCandidate)
  ) {
    deps.logger("warn", "admit.soft_retired.eject_candidate", {
      siteId: cp.currentCandidate,
    });
    cp.currentCandidate = null;
    cp.probationStartedAt = null;
    cp.healthyMsAccumulated = 0;
    cp.lastHealthyAt = null;
    cp.phase = "IDLE";
    await saveAdmitCheckpoint(deps.pool, cp);
  }

  if (cp.phase === "ENGINEERING_REPAIR" && cp.currentCandidate) {
    cp.phase = "LIVE_PROBATION";
    await syncPauseSet();
    await saveAdmitCheckpoint(deps.pool, cp);
    deps.logger("info", "admit.repair.resume_probation", {
      siteId: cp.currentCandidate,
      healthyMsAccumulated: cp.healthyMsAccumulated,
    });
  } else if (cp.phase === "CRITICAL_HOLD") {
    await syncPauseSet();
    deps.logger("error", "admit.critical_hold.active", {
      reason: cp.pauseNewAdmissionsReason,
      currentCandidate: cp.currentCandidate,
      healthyMsAccumulated: cp.healthyMsAccumulated,
    });
  } else if (
    cp.phase === "IDLE" ||
    (cp.phase === "PREPARING" && !cp.currentCandidate) ||
    (cp.phase === "LIVE_PROBATION" && !cp.currentCandidate)
  ) {
    await beginNextCandidate();
  } else if (cp.phase === "PREPARING" && cp.currentCandidate) {
    // Mid-gate hold (e.g. Apex denied) — keep pause set; do not reset.
    await syncPauseSet();
    await saveAdmitCheckpoint(deps.pool, cp);
    deps.logger("info", "admit.preparing.resume", {
      siteId: cp.currentCandidate,
      judgment: cp.lastTitanJudgment?.decision,
    });
  } else if (cp.phase === "LIVE_PROBATION" && cp.currentCandidate) {
    await syncPauseSet();
    await saveAdmitCheckpoint(deps.pool, cp);
    deps.logger("info", "admit.probation.resume", {
      siteId: cp.currentCandidate,
      healthyMsAccumulated: cp.healthyMsAccumulated,
    });
  } else if (cp.phase === "PORTFOLIO_BUILD_COMPLETE") {
    await syncPauseSet();
    deps.logger("info", "admit.already_complete", {
      titanManaged: cp.titanManaged.length,
    });
  } else {
    await syncPauseSet();
  }

  /** Debounce identical repair fingerprints so unhealthy ticks don't storm. */
  const recentRepairAt = new Map<string, number>();
  const REPAIR_COOLDOWN_MS = 5 * 60_000;
  let lastAdapterScanAt = 0;

  while (!deps.signal.aborted) {
    await sleep(intervalMs, deps.signal);
    if (deps.signal.aborted) break;
    // Refresh owner controls from PG in case of external changes.
    try {
      deps.setControlState(await loadOwnerControlsPg(deps.pool));
    } catch {
      /* keep memory state */
    }

    // Missing commercial adapters are engineering defects — scan + repair.
    if (Date.now() - lastAdapterScanAt > 5 * 60_000) {
      lastAdapterScanAt = Date.now();
      try {
        const scan = await scanAdapterMissingIncidents(repairDeps());
        if (scan.handled > 0) {
          const snap = await getReliabilitySnapshot(deps.pool);
          cp.reliability = {
            totalFailures: snap.metrics.totalFailures,
            uniqueFingerprints: snap.metrics.uniqueFingerprints,
            repeatFailures: snap.metrics.repeatFailures,
            autoRepaired: snap.metrics.autoRepaired,
            codeRepairs: snap.metrics.codeRepairs,
            rollbacks: snap.metrics.rollbacks,
          };
          await saveAdmitCheckpoint(deps.pool, cp);
          deps.logger("warn", "admit.repair.adapter_scan", scan);
        }
      } catch (err) {
        deps.logger("warn", "admit.repair.adapter_scan_failed", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!deps.platformHealthy()) {
      if (cp.phase === "LIVE_PROBATION") {
        cp.platformHealth = "DEGRADED";
        cp.phase = "PLATFORM_PAUSED";
        cp.notes = [...cp.notes.slice(-20), "platform_unhealthy_pause_admit"];
        await saveAdmitCheckpoint(deps.pool, cp);
        deps.logger("warn", "admit.platform_paused", {});
      }
      continue;
    }
    cp.platformHealth = "OK";

    if (cp.phase === "PLATFORM_PAUSED") {
      // Resume probation if we still have a candidate mid-flight.
      if (cp.currentCandidate) {
        cp.phase = "LIVE_PROBATION";
        deps.logger("info", "admit.platform_resumed", {
          siteId: cp.currentCandidate,
        });
      } else if (
        cp.titanManaged.length < cp.targetPortfolio &&
        !cp.pauseNewAdmissions
      ) {
        await beginNextCandidate();
      }
    }

    if (cp.phase === "CRITICAL_HOLD") {
      // Human-required; keep accepted businesses running; do not admit or reset.
      await saveAdmitCheckpoint(deps.pool, cp);
      continue;
    }

    if (cp.phase === "ENGINEERING_REPAIR") {
      // In-flight repair tick ownership is inside the unhealthy branch; if we
      // wake here (e.g. after restart), return to probation without reset.
      if (cp.currentCandidate) cp.phase = "LIVE_PROBATION";
      else if (!cp.pauseNewAdmissions) await beginNextCandidate();
      continue;
    }

    // Promote rework candidates whose commercial product became ready.
    // Scan a few heads — do not stall behind a single forever-broken site.
    if ((cp.reworkQueue ?? []).length > 0 && !cp.currentCandidate) {
      const scan = (cp.reworkQueue ?? []).slice(0, 5);
      let promoted: string | null = null;
      for (const reworkId of scan) {
        try {
          const gate = await assessCommercialReadiness({
            siteId: reworkId,
            pool: deps.pool,
          });
          if (gate.ready) {
            promoted = reworkId;
            break;
          }
        } catch {
          /* try next */
        }
      }
      if (promoted) {
        cp.reworkQueue = cp.reworkQueue!.filter((id) => id !== promoted);
        cp.underRepair = cp.underRepair.filter((id) => id !== promoted);
        cp.notes = [
          ...cp.notes.slice(-20),
          `titan_rework_complete:${promoted}`,
        ];
        cp.candidateQueue = [
          promoted,
          ...cp.candidateQueue.filter((id) => id !== promoted),
        ];
        await saveAdmitCheckpoint(deps.pool, cp);
        deps.logger("info", "admit.titan_rework.ready", { siteId: promoted });
        await beginNextCandidate();
        continue;
      }
    }

    if (cp.phase === "PREPARING" && !cp.currentCandidate && !cp.pauseNewAdmissions) {
      await beginNextCandidate();
      continue;
    }

    if (cp.phase === "PORTFOLIO_BUILD_COMPLETE") {
      // Capacity target is 50 QUALIFIED businesses — vacancy preferred over weak admit.
      // CUSTOMER_ACQUISITION_EVOLUTION_MODE: never reopen admissions to chase vacancies.
      cp.vacantSlots = Math.max(0, cp.targetPortfolio - cp.titanManaged.length);
      if (cp.pauseNewAdmissions) {
        await saveAdmitCheckpoint(deps.pool, cp);
        deps.logger("info", "admit.portfolio_frozen_cae", {
          titanManaged: cp.titanManaged.length,
          vacantSlots: cp.vacantSlots,
          reason: cp.pauseNewAdmissionsReason,
        });
        continue;
      }
      if (cp.vacantSlots > 0 && cp.replacementRequired.length === 0) {
        cp.replacementRequired = ["vacancy"];
        cp.phase = "IDLE";
        // beginNextCandidate still runs quality/economics gates; weak candidates reject.
        await beginNextCandidate();
      } else {
        await saveAdmitCheckpoint(deps.pool, cp);
      }
      continue;
    }

    if (cp.phase !== "LIVE_PROBATION" || !cp.currentCandidate) {
      if (
        cp.titanManaged.length < cp.targetPortfolio &&
        !cp.pauseNewAdmissions &&
        !cp.currentCandidate
      ) {
        await beginNextCandidate();
      }
      continue;
    }

    const siteId = cp.currentCandidate;
    const status = deps.getBusinessStatuses().find((b) => b.siteId === siteId);
    const health = isCandidateHealthy(
      status,
      siteId,
      deps.getControlState(),
    );
    const now = Date.now();

    // Escape hatch: candidate stuck overnight with zero healthy accrual and
    // durable storefront unrepaired → rework + advance (do not burn the slot).
    const probationAgeMs = cp.probationStartedAt
      ? now - Date.parse(cp.probationStartedAt)
      : 0;
    if (
      !health.ok &&
      probationAgeMs > 2 * 60 * 60_000 &&
      (cp.healthyMsAccumulated ?? 0) < needMs * 0.1
    ) {
      const commercial = await deps.pool.query(
        `select value->'businesses'->$1 as st
         from ros_config_meta where key='commercial_business_states'`,
        [siteId],
      );
      const st = commercial.rows[0]?.st as
        | {
            state?: string;
            failures?: string[];
            acquisitionSuppressed?: boolean;
          }
        | null;
      const brokenStorefront =
        st?.state === "REPAIR_REQUIRED" ||
        (Array.isArray(st?.failures) &&
          st.failures.includes("NO_PUBLIC_STOREFRONT")) ||
        st?.acquisitionSuppressed === true;
      if (brokenStorefront || health.reason === "stale_tick") {
        cp.reworkQueue = [...new Set([...(cp.reworkQueue ?? []), siteId])];
        cp.notes = [
          ...cp.notes.slice(-20),
          `probation_stuck_rework:${siteId}:${health.reason ?? "unknown"}:${Math.round(probationAgeMs / 60000)}m`,
        ];
        deps.logger("warn", "admit.probation.stuck_rework", {
          siteId,
          reason: health.reason,
          probationAgeMs,
          commercialState: st?.state ?? null,
          failures: st?.failures ?? [],
        });
        cp.currentCandidate = null;
        cp.probationStartedAt = null;
        cp.healthyMsAccumulated = 0;
        cp.lastHealthyAt = null;
        cp.phase = "IDLE";
        await markBusinessLifecycle(deps.pool, siteId, "REWORK", {
          reason: "probation_stuck_unrepairable_overnight",
          lastHealthReason: health.reason,
        });
        await saveAdmitCheckpoint(deps.pool, cp);
        await beginNextCandidate();
        continue;
      }
    }

    if (health.ok) {
      // Each healthy poll credits up to one interval (no credit while unhealthy).
      cp.healthyMsAccumulated += intervalMs;
      cp.lastHealthyAt = new Date(now).toISOString();
      await markBusinessLifecycle(deps.pool, siteId, "LIVE_PROBATION", {
        healthyMsAccumulated: cp.healthyMsAccumulated,
        lastHealthAt: cp.lastHealthyAt,
        lastOk: true,
      });
      deps.logger("info", "admit.probation.healthy_tick", {
        siteId,
        healthyMsAccumulated: cp.healthyMsAccumulated,
        needMs,
        ticks: status?.ticks ?? 0,
        lastExecuted: status?.lastExecuted ?? 0,
      });
      await saveAdmitCheckpoint(deps.pool, cp);
      if (cp.healthyMsAccumulated >= needMs) {
        // If previously blocked by commercial gate, re-test without resetting clock.
        if (commercialGateBlocked?.siteId === siteId) {
          const again = await runCommercialGate(siteId);
          if (!admissionAllowed(again)) {
            commercialGateBlocked = again;
            if (Date.now() - lastCommercialRepairAt > COMMERCIAL_REPAIR_COOLDOWN_MS) {
              lastCommercialRepairAt = Date.now();
              await requestCommercialRepairForCandidate({
                pool: deps.pool,
                siteId,
                failures: again.failures,
                logger: deps.logger,
              });
              await attemptCommercialRepair({
                pool: deps.pool,
                siteId,
                failures: again.failures,
                appRoot: deps.appRoot,
                logger: deps.logger,
              });
            }
            deps.logger("warn", "admit.commercial_gate.still_blocked", {
              siteId,
              failures: again.failures.map((f) => f.code),
              healthyMsPreserved: cp.healthyMsAccumulated,
            });
            await saveAdmitCheckpoint(deps.pool, cp);
            continue;
          }
        }
        await acceptCurrent();
      }
    } else {
      cp.lastHealthyAt = null;
      const reason = health.reason ?? "unknown";
      cp.notes = [...cp.notes.slice(-20), `unhealthy:${siteId}:${reason}`];
      deps.logger("warn", "admit.probation.unhealthy", {
        siteId,
        reason,
        healthyMsAccumulated: cp.healthyMsAccumulated,
      });
      // Preserve healthyMsAccumulated — repair must not wipe probation progress.
      await markBusinessLifecycle(deps.pool, siteId, "LIVE_PROBATION", {
        lastError: reason,
        healthyMsAccumulated: cp.healthyMsAccumulated,
      });

      // Self-heal: architect/Titan candidates missing from portfolio-dynamic never
      // appear in scheduler statuses → infinite missing_runtime_status loops.
      if (reason === "missing_runtime_status" && deps.ensureRuntimeBusiness) {
        try {
          const ens = await deps.ensureRuntimeBusiness(siteId);
          deps.logger("info", "admit.runtime.ensure_on_unhealthy", {
            siteId,
            ok: ens.ok,
            detail: ens.detail,
          });
          if (ens.ok) {
            await syncPauseSet();
            await saveAdmitCheckpoint(deps.pool, cp);
            continue;
          }
        } catch (err) {
          deps.logger("warn", "admit.runtime.ensure_on_unhealthy_error", {
            siteId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const repairKey = `${siteId}|${reason}`.slice(0, 240);
      const last = recentRepairAt.get(repairKey) ?? 0;
      if (Date.now() - last < REPAIR_COOLDOWN_MS) {
        // Still unhealthy, but repair already attempted recently — keep probation.
        await saveAdmitCheckpoint(deps.pool, cp);
        continue;
      }
      recentRepairAt.set(repairKey, Date.now());

      // Do NOT block admission polling on engineering self-repair.
      // Self-repair runs on its own parallel autonomy worker.
      enqueueEngineeringSelfRepair({
        siteId,
        reason,
        source: "admit",
      });
      deps.logger("info", "admit.repair.enqueued_async", {
        siteId,
        reason,
        healthyMsPreserved: cp.healthyMsAccumulated,
        note: "SELF_REPAIR detached — admit continues",
      });
      // Stay in LIVE_PROBATION; engineering worker may briefly report ENGINEERING_REPAIR via events.
      cp.phase = "LIVE_PROBATION";
      await saveAdmitCheckpoint(deps.pool, cp);
      void (async () => {
        try {
          const snap = await getReliabilitySnapshot(deps.pool);
          cp.reliability = {
            totalFailures: snap.metrics.totalFailures,
            uniqueFingerprints: snap.metrics.uniqueFingerprints,
            repeatFailures: snap.metrics.repeatFailures,
            autoRepaired: snap.metrics.autoRepaired,
            codeRepairs: snap.metrics.codeRepairs,
            rollbacks: snap.metrics.rollbacks,
          };
          await saveAdmitCheckpoint(deps.pool, cp);
        } catch {
          /* non-blocking */
        }
      })();
    }
  }

  deps.logger("info", "admit.controller.stop", {
    phase: cp.phase,
    titanManaged: cp.titanManaged.length,
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort);
  });
}
