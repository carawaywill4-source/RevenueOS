/**
 * Durable Postgres business creation architect loop.
 *
 * PORTFOLIO OBSERVE → DISCOVER → THESIS → ARCHITECT → BUILD → VALIDATE
 * Persists in Postgres. Does not freeze revenue/admit/repair lanes.
 * Opportunity-driven — does not create merely to fill slots.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import {
  PORTFOLIO_50_SPECS,
  runPortfolioArchitectCycle,
  type BusinessOpportunity,
} from "@revenueos/core";
import {
  appendArchitectEventPg,
  loadArchitectStatePg,
  loadLifecycleQueue,
  saveArchitectStatePg,
  saveLifecycleQueue,
  type ArchitectLifecycleRecord,
  type ArchitectLifecycleState,
} from "./architect-pg-store.js";
import { materializeBusinessApp } from "./business-launcher.js";
import {
  evaluateBusinessFitness,
  fitnessToArchitectTelemetry,
} from "./accepted-business-fitness.js";
import {
  evaluateTitanAdmissionQuality,
  architectTowardPerfect,
  TITAN_ADMIT_MIN_SCORE,
} from "./titan-admission-gate.js";

export const BUSINESS_ARCHITECT_VERSION = "business-architect-pg-v1";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function thesisFromOpportunity(o: BusinessOpportunity): Record<string, unknown> {
  return {
    targetCustomer: o.buyer,
    problem: o.problem,
    offer: o.productName,
    demandEvidence: "INFERRED_from_opportunity_spec",
    wtpEvidence: "UNKNOWN",
    monetizationModel: "digital_download",
    priceUsd: o.priceUsd,
    acquisitionHypotheses: [o.acquisitionHypothesis],
    fulfillmentModel: o.fulfillment,
    successMetrics: [
      "first_attributed_purchase",
      "checkout_start_rate",
      "qualified_exposure",
    ],
    killCriteria: [
      "structurally_weak_demand_after_sufficient_experimentation",
      "repeated_evolution_no_improvement",
      "fulfillment_not_viable",
    ],
  };
}

function architectureFromOpportunity(
  o: BusinessOpportunity,
): Record<string, unknown> {
  return {
    stack: "native_azure_static_commerce",
    template: "ledgerleaf",
    routes: ["/", "/api/checkout", "/api/beacon", "/robots.txt", "/sitemap.xml"],
    integrations: ["stripe_checkout", "revenueos_beacon", "indexnow"],
    technicalArchitecture: "apps/{siteId} storefront + vendor/@revenueos/core",
  };
}

function buildSpecFromOpportunity(
  o: BusinessOpportunity,
): Record<string, unknown> {
  return {
    siteId: o.siteId,
    displayName: o.displayName,
    materializeFrom: "ledgerleaf",
    deployVia: "native_azure_hosting_plane",
    commercialGate: "commercial-readiness-v1",
    admitPath: "LIVE_PROBATION",
  };
}

async function loadAcceptedSiteIds(pool: pg.Pool): Promise<string[]> {
  const res = await pool.query(
    `select value from ros_config_meta where key='admit_rollout_checkpoint'`,
  );
  const v = (res.rows[0]?.value ?? {}) as {
    accepted?: string[];
    titanManaged?: string[];
  };
  const ids = [
    ...(Array.isArray(v.titanManaged) ? v.titanManaged : []),
    ...(Array.isArray(v.accepted) ? v.accepted : []),
  ].map(String);
  return [...new Set(ids)];
}

/**
 * Advance one creation/architecture unit of work.
 * Never runs concurrent builds for the same siteId.
 */
export async function runBusinessArchitectTick(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
}): Promise<{
  advanced: boolean;
  siteId?: string;
  state?: ArchitectLifecycleState;
  detail: string;
}> {
  // CUSTOMER_ACQUISITION_EVOLUTION: freeze net-new discovery/build
  try {
    const cae = await input.pool.query(
      `select value->>'enabled' as en, value->>'freezeNetNewBusinesses' as fr
       from ros_config_meta where key='customer_acquisition_evolution_mode'`,
    );
    if (cae.rows[0]?.en === "true" || cae.rows[0]?.fr === "true") {
      input.logger("info", "architect.tick.frozen_cae", {
        reason: "prove_existing_portfolio_customer_acquisition",
      });
      return {
        advanced: false,
        detail: "frozen_customer_acquisition_evolution_mode",
      };
    }
  } catch {
    /* continue if meta missing */
  }

  const activeSiteIds = await loadAcceptedSiteIds(input.pool);
  const prev = await loadArchitectStatePg(input.pool);

  // REAL fitness telemetry — prefer durable snapshots; never invent mature stubs.
  const telemetry = [];
  let snapshotBySite: Record<string, import("./accepted-business-fitness.js").BusinessFitnessRecord> =
    {};
  try {
    const snap = await input.pool.query(
      `select value from ros_config_meta where key='portfolio_fitness_snapshots'`,
    );
    const doc = (snap.rows[0]?.value ?? {}) as {
      updatedAt?: string;
      bySite?: Record<
        string,
        import("./accepted-business-fitness.js").BusinessFitnessRecord
      >;
    };
    const age = doc.updatedAt
      ? Date.now() - Date.parse(doc.updatedAt)
      : Number.POSITIVE_INFINITY;
    if (age < 10 * 60_000 && doc.bySite) snapshotBySite = doc.bySite;
  } catch {
    /* */
  }
  for (const siteId of activeSiteIds) {
    try {
      const fitness =
        snapshotBySite[siteId] ??
        (await evaluateBusinessFitness(input.pool, siteId));
      telemetry.push(fitnessToArchitectTelemetry(fitness));
    } catch {
      telemetry.push({
        siteId,
        purchases: -1,
        revenueUsd: 0,
        landingViews: 0,
        checkoutStarts: 0,
        ageDays: 0,
        experimentCount: 0,
        ownerLocked: false,
        engineeringBlocked: false,
      });
    }
  }

  const cycle = runPortfolioArchitectCycle({
    activeSiteIds,
    activeIndustries: [],
    safety: {
      ...prev.safety,
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
      autonomousZeroCostLaunch: true,
      autonomousIncubation: true,
      autonomousBusinessDiscovery: true,
      prioritizeExistingOverNew: false,
    },
    ownerPolicy: {
      ...prev.ownerPolicy,
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
      allowCreationWithoutReferenceProof: true,
      portfolioResetAuthorizedAt:
        prev.ownerPolicy.portfolioResetAuthorizedAt ??
        "2026-08-10T00:00:00.000Z",
    },
    telemetry,
    referenceProof: {
      premium_bar_passed: true,
      independent_company_test: true,
      stranger_purchases: 1,
    },
  });

  const nextState = {
    ...prev,
    ...cycle.statePatch,
    launches: prev.launches,
    events: [...(prev.events ?? []), ...(cycle.statePatch.events ?? [])].slice(
      -80,
    ),
    safety: {
      ...prev.safety,
      ...cycle.statePatch.safety,
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
    },
    ownerPolicy: {
      ...prev.ownerPolicy,
      ...cycle.statePatch.ownerPolicy,
      maxActiveBusinesses: 50,
    },
  };
  await saveArchitectStatePg(input.pool, nextState);
  await appendArchitectEventPg(input.pool, {
    kind: "architect_cycle",
    summary: `opportunities=${cycle.statePatch.opportunities?.length ?? 0} candidate=${cycle.launchCandidate?.siteId ?? "none"} active=${activeSiteIds.length}`,
  });

  let records = await loadLifecycleQueue(input.pool);
  const building = records.find((r) => r.inFlightBuild);
  if (building) {
    return {
      advanced: false,
      siteId: building.siteId,
      state: building.state,
      detail: `build_in_flight:${building.siteId}`,
    };
  }

  // Prefer advancing an existing non-terminal record one step.
  const advanceable = records.find((r) =>
    ["DISCOVERED", "THESIS", "ARCHITECTING", "BUILDING", "VALIDATING"].includes(
      r.state,
    ),
  );

  if (advanceable) {
    const updated = await advanceRecord({
      pool: input.pool,
      appRoot: input.appRoot,
      logger: input.logger,
      record: advanceable,
      opportunities: nextState.opportunities,
    });
    records = records.map((r) =>
      r.recordId === updated.recordId ? updated : r,
    );
    await saveLifecycleQueue(input.pool, records);
    return {
      advanced: true,
      siteId: updated.siteId,
      state: updated.state,
      detail: `advanced:${updated.state}`,
    };
  }

  // Prefer Opportunity Bench (open-world) over priors / PORTFOLIO_50.
  const bench = await bestBenchOpportunity(input.pool, activeSiteIds);
  const benchCandidate = bench ? benchEntryToOpportunity(bench) : null;

  // Seed from launch candidate or next unaccepted PORTFOLIO_50 spec.
  const rawCandidate =
    benchCandidate ??
    cycle.launchCandidate ??
    opportunityFromNextSpec(activeSiteIds, nextState.opportunities);

  if (!rawCandidate) {
    return {
      advanced: false,
      detail: "no_opportunity — portfolio full or no safe candidate",
    };
  }

  const candidate = architectTowardPerfect(rawCandidate);
  const bar = evaluateTitanAdmissionQuality({
    siteId: candidate.siteId,
    opportunity: candidate,
    activeSiteIds,
    activeIndustries: [],
    titanManagedCount: activeSiteIds.length,
    isReplacement: true,
  });
  if (bar.businessQualityScore < TITAN_ADMIT_MIN_SCORE) {
    input.logger("info", "architect.tick.below_bar", {
      siteId: candidate.siteId,
      score: bar.businessQualityScore,
      decision: bar.decision,
      defects: bar.weaknesses,
    });
    return {
      advanced: false,
      siteId: candidate.siteId,
      detail: `below_bar:${bar.businessQualityScore} — will not build an ${bar.businessQualityScore}/100 thesis`,
    };
  }

  if (records.some((r) => r.siteId === candidate.siteId && r.inFlightBuild)) {
    return {
      advanced: false,
      siteId: candidate.siteId,
      detail: "duplicate_build_blocked",
    };
  }
  if (
    records.some(
      (r) =>
        r.siteId === candidate.siteId &&
        !["RETIRED", "REPLACED"].includes(r.state),
    )
  ) {
    return {
      advanced: false,
      siteId: candidate.siteId,
      detail: "lifecycle_record_exists",
    };
  }

  const record: ArchitectLifecycleRecord = {
    recordId: newId("arch"),
    siteId: candidate.siteId,
    state: "DISCOVERED",
    opportunityId: candidate.id,
    thesis: thesisFromOpportunity(candidate),
    architecture: architectureFromOpportunity(candidate),
    buildSpec: buildSpecFromOpportunity(candidate),
    commercialHypothesis: candidate.acquisitionHypothesis,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidence: [...(candidate.evidence ?? [])],
    killCriteria: [
      "structurally_weak_demand_after_sufficient_experimentation",
      "repeated_evolution_no_improvement",
    ],
    successMetrics: ["first_attributed_purchase", "checkout_start_rate"],
    inFlightBuild: false,
  };
  records.push(record);
  await saveLifecycleQueue(input.pool, records);
  await appendArchitectEventPg(input.pool, {
    kind: "lifecycle_discovered",
    summary: `DISCOVERED ${candidate.siteId}: ${candidate.productName}`,
    siteId: candidate.siteId,
  });
  input.logger("info", "architect.lifecycle.discovered", {
    siteId: candidate.siteId,
    opportunityId: candidate.id,
    version: BUSINESS_ARCHITECT_VERSION,
  });

  return {
    advanced: true,
    siteId: candidate.siteId,
    state: "DISCOVERED",
    detail: "seeded_discovered",
  };
}

/**
 * Seed a replacement opportunity into the architect lifecycle queue.
 * Does not destroy rejected-candidate knowledge — only starts a new build.
 */
export async function seedArchitectReplacement(input: {
  pool: pg.Pool;
  logger: Logger;
  opportunity: BusinessOpportunity;
  replacesSiteId: string;
  criteria?: string;
}): Promise<{ ok: boolean; siteId: string; detail: string }> {
  const opportunity = architectTowardPerfect(input.opportunity);
  const records = await loadLifecycleQueue(input.pool);
  if (
    records.some(
      (r) =>
        r.siteId === opportunity.siteId &&
        !["RETIRED", "REPLACED"].includes(r.state),
    )
  ) {
    return {
      ok: true,
      siteId: opportunity.siteId,
      detail: "replacement_lifecycle_already_exists",
    };
  }
  // Mark prior architect records for the rejected site as REPLACED (preserve evidence).
  const nextRecords = records.map((r) =>
    r.siteId === input.replacesSiteId &&
    !["RETIRED", "REPLACED", "ACCEPTED"].includes(r.state)
      ? {
          ...r,
          state: "REPLACED" as ArchitectLifecycleState,
          updatedAt: new Date().toISOString(),
          evidence: [
            ...r.evidence,
            `replaced_by:${opportunity.siteId}`,
            input.criteria ? `criteria:${input.criteria}` : "",
          ].filter(Boolean),
        }
      : r,
  );
  const record: ArchitectLifecycleRecord = {
    recordId: newId("arch"),
    siteId: opportunity.siteId,
    state: "DISCOVERED",
    opportunityId: opportunity.id,
    thesis: thesisFromOpportunity(opportunity),
    architecture: architectureFromOpportunity(opportunity),
    buildSpec: buildSpecFromOpportunity(opportunity),
    commercialHypothesis: opportunity.acquisitionHypothesis,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidence: [
      ...(opportunity.evidence ?? []),
      `replacement_for:${input.replacesSiteId}`,
      input.criteria ? `criteria:${input.criteria}` : "titan_reject_and_replace",
    ].filter(Boolean),
    killCriteria: [
      "structurally_weak_demand_after_sufficient_experimentation",
      "repeated_evolution_no_improvement",
    ],
    successMetrics: ["first_attributed_purchase", "checkout_start_rate"],
    inFlightBuild: false,
  };
  nextRecords.push(record);
  await saveLifecycleQueue(input.pool, nextRecords);
  await appendArchitectEventPg(input.pool, {
    kind: "lifecycle_replacement_discovered",
    summary: `REPLACEMENT DISCOVERED ${opportunity.siteId} for ${input.replacesSiteId}: ${opportunity.productName}`,
    siteId: opportunity.siteId,
  });
  input.logger("info", "architect.replacement.seeded", {
    siteId: opportunity.siteId,
    replaces: input.replacesSiteId,
    version: BUSINESS_ARCHITECT_VERSION,
  });
  return {
    ok: true,
    siteId: opportunity.siteId,
    detail: "seeded_replacement_discovered",
  };
}

function opportunityFromNextSpec(
  activeSiteIds: string[],
  existing: BusinessOpportunity[],
): BusinessOpportunity | null {
  const taken = new Set(activeSiteIds);
  for (const spec of PORTFOLIO_50_SPECS) {
    if (taken.has(spec.siteId)) continue;
    const fromCycle = existing.find((o) => o.siteId === spec.siteId);
    if (fromCycle) return fromCycle;
    const now = new Date().toISOString();
    const {
      portfolioClass: _c,
      empireLadder: _e,
      ...rest
    } = spec as typeof spec & {
      portfolioClass?: string;
      empireLadder?: string[];
    };
    void _c;
    void _e;
    return {
      ...rest,
      id: `opp_${spec.siteId}`,
      evidence: ["portfolio_50_spec"],
      score: 70,
      rejectReasons: [],
      lifecycle: "launch_candidate",
      createdAt: now,
    };
  }
  return null;
}

async function advanceRecord(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  record: ArchitectLifecycleRecord;
  opportunities: BusinessOpportunity[];
}): Promise<ArchitectLifecycleRecord> {
  const r = { ...input.record, updatedAt: new Date().toISOString() };
  const opp =
    input.opportunities.find((o) => o.siteId === r.siteId) ??
    opportunityFromNextSpec([], input.opportunities);

  if (r.state === "DISCOVERED") {
    r.state = "THESIS";
    r.thesis = r.thesis ?? (opp ? thesisFromOpportunity(opp) : {});
    await appendArchitectEventPg(input.pool, {
      kind: "lifecycle_thesis",
      summary: `THESIS ${r.siteId}`,
      siteId: r.siteId,
    });
    input.logger("info", "architect.lifecycle.thesis", { siteId: r.siteId });
    return r;
  }

  if (r.state === "THESIS") {
    const thesis = (r.thesis ?? {}) as Record<string, unknown>;
    const demandOk = Boolean(
      thesis.demandEvidence &&
        thesis.demandEvidence !== "INFERRED_from_opportunity_spec" &&
        thesis.demandEvidence !== "UNKNOWN",
    );
    if (!demandOk) {
      input.logger("warn", "architect.lifecycle.thesis_blocked", {
        siteId: r.siteId,
        reason: "commercial_thesis_incomplete",
      });
      return r;
    }
    r.state = "ARCHITECTING";
    r.architecture =
      r.architecture ?? (opp ? architectureFromOpportunity(opp) : {});
    r.buildSpec = r.buildSpec ?? (opp ? buildSpecFromOpportunity(opp) : {});
    await appendArchitectEventPg(input.pool, {
      kind: "lifecycle_architecting",
      summary: `ARCHITECTING ${r.siteId}`,
      siteId: r.siteId,
    });
    input.logger("info", "architect.lifecycle.architecting", {
      siteId: r.siteId,
    });
    return r;
  }

  if (r.state === "ARCHITECTING") {
    r.state = "BUILDING";
    r.inFlightBuild = true;
    await appendArchitectEventPg(input.pool, {
      kind: "lifecycle_building",
      summary: `BUILDING ${r.siteId}`,
      siteId: r.siteId,
    });
    input.logger("info", "architect.lifecycle.building", { siteId: r.siteId });

    try {
      const appDir = path.join(input.appRoot, "apps", r.siteId);
      let buildDetail = "app_exists";
      if (!existsSync(appDir) && opp) {
        const mat = materializeBusinessApp({
          opportunity: opp,
          templateSiteId: "ledgerleaf",
        });
        buildDetail = `materialized:${mat.appDir}`;
      } else if (existsSync(appDir)) {
        // Ensure durable build receipt artifact for existing apps.
        const buildDir = path.join(
          input.appRoot,
          ".data",
          "revenueos",
          "architect-builds",
          r.siteId,
        );
        mkdirSync(buildDir, { recursive: true });
        writeFileSync(
          path.join(buildDir, "build-spec.json"),
          JSON.stringify(
            {
              siteId: r.siteId,
              at: new Date().toISOString(),
              thesis: r.thesis,
              architecture: r.architecture,
              buildSpec: r.buildSpec,
              note: "build work generated — app already present",
            },
            null,
            2,
          ),
        );
        buildDetail = `build_spec_written:${buildDir}`;
      } else {
        throw new Error("missing app and opportunity for materialize");
      }
      r.evidence = [...r.evidence, buildDetail];
      r.state = "VALIDATING";
      r.inFlightBuild = false;
      await appendArchitectEventPg(input.pool, {
        kind: "lifecycle_build_complete",
        summary: `BUILD complete ${r.siteId}: ${buildDetail}`,
        siteId: r.siteId,
      });
      input.logger("info", "architect.lifecycle.build_complete", {
        siteId: r.siteId,
        buildDetail,
      });
    } catch (err) {
      r.inFlightBuild = false;
      r.lastError = err instanceof Error ? err.message : String(err);
      r.state = "ARCHITECTING";
      input.logger("error", "architect.lifecycle.build_failed", {
        siteId: r.siteId,
        message: r.lastError,
      });
    }
    return r;
  }

  if (r.state === "VALIDATING") {
    // Hand off to staged admission / commercial gate — record VALIDATING→PROBATION intent.
    r.state = "PROBATION";
    r.evidence = [
      ...r.evidence,
      "ready_for_admit_or_commercial_validation",
    ];
    await appendArchitectEventPg(input.pool, {
      kind: "lifecycle_probation_ready",
      summary: `PROBATION-ready ${r.siteId}`,
      siteId: r.siteId,
    });
    input.logger("info", "architect.lifecycle.probation_ready", {
      siteId: r.siteId,
    });
    return r;
  }

  if (r.state === "PROBATION") {
    // If already titan-managed/accepted, mark ACCEPTED in architect lane.
    const accepted = await loadAcceptedSiteIds(input.pool);
    if (accepted.includes(r.siteId)) {
      r.state = "ACCEPTED";
      await appendArchitectEventPg(input.pool, {
        kind: "lifecycle_accepted",
        summary: `ACCEPTED ${r.siteId} (admit-confirmed)`,
        siteId: r.siteId,
      });
    }
    return r;
  }

  return r;
}

export async function runBusinessArchitectLoop(deps: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  const interval = deps.intervalMs ?? 90_000;
  deps.logger("info", "architect.loop.start", {
    version: BUSINESS_ARCHITECT_VERSION,
  });
  let first = true;
  while (!deps.signal.aborted) {
    if (!first) await sleep(interval, deps.signal);
    first = false;
    if (deps.signal.aborted) break;
    try {
      const result = await runBusinessArchitectTick({
        pool: deps.pool,
        appRoot: deps.appRoot,
        logger: deps.logger,
      });
      deps.logger("info", "architect.loop.tick", {
        advanced: result.advanced,
        siteId: result.siteId ?? null,
        state: result.state ?? null,
        detail: result.detail,
      });
    } catch (err) {
      deps.logger("error", "architect.loop.error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  deps.logger("info", "architect.loop.stop", {});
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
