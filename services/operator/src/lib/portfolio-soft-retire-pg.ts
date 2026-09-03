/**
 * Soft-retire accepted/Titan-managed businesses on Azure Postgres.
 * Preserves learning; frees portfolio slots; does not hard-delete code/data.
 */

import type pg from "pg";
import { governAction } from "@revenueos/core";
import {
  ADMIT_CHECKPOINT_KEY,
  loadAdmitCheckpoint,
  saveAdmitCheckpoint,
  TARGET_PORTFOLIO_DEFAULT,
} from "./portfolio-admit-controller.js";
import {
  appendArchitectEventPg,
  loadArchitectStatePg,
  loadLifecycleQueue,
  saveArchitectStatePg,
  saveLifecycleQueue,
} from "./architect-pg-store.js";
import type { BusinessFitnessRecord } from "./accepted-business-fitness.js";
import { retireBusinessPreserve, findBusiness } from "../portfolio.js";

export const SOFT_RETIRE_VERSION = "soft-retire-pg-v1";
export const RETIREMENT_DECISIONS_KEY = "accepted_retirement_decisions";
export const REPLACEMENT_LINEAGE_KEY = "portfolio_replacement_lineage";

export type SoftRetirementDecision = {
  decisionId: string;
  business_id: string;
  fitness_state: string;
  reason: string;
  evidence: string[];
  experiments_attempted: number;
  repairs_attempted: number;
  pivots_attempted: number;
  Titan_confidence: number;
  replacement_opportunity_if_known: string | null;
  expected_value_keep: number;
  expected_value_replace: number;
  risk: "low" | "medium";
  Apex_decision: { authorized: boolean; detail: string; riskClass: string };
  preservation_plan: string;
  rollback_plan: string;
  at: string;
  status: "SOFT_RETIRED" | "DENIED" | "SKIPPED";
};

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function appendDecision(
  pool: pg.Pool,
  decision: SoftRetirementDecision,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [RETIREMENT_DECISIONS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { decisions: [] }) as {
    decisions?: SoftRetirementDecision[];
  };
  const decisions = Array.isArray(doc.decisions) ? [...doc.decisions] : [];
  decisions.push(decision);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'SOFT_RETIRE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='SOFT_RETIRE'`,
    [
      RETIREMENT_DECISIONS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        decisions: decisions.slice(-200),
      }),
    ],
  );
}

export async function recordReplacementLineage(
  pool: pg.Pool,
  input: {
    retiredBusiness: string;
    vacancyReason: string;
    opportunityId?: string;
    replacementSiteId?: string;
    origin?: string;
    status: string;
    detail?: string;
  },
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [REPLACEMENT_LINEAGE_KEY],
  );
  const doc = (res.rows[0]?.value ?? { lineages: [] }) as {
    lineages?: Array<Record<string, unknown>>;
  };
  const lineages = Array.isArray(doc.lineages) ? [...doc.lineages] : [];
  lineages.push({
    ...input,
    at: new Date().toISOString(),
  });
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'SOFT_RETIRE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='SOFT_RETIRE'`,
    [
      REPLACEMENT_LINEAGE_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        lineages: lineages.slice(-200),
      }),
    ],
  );
}

/**
 * Soft-retire a Titan-managed business. Preserves history in Postgres + optional FS.
 */
export async function softRetireManagedBusinessPg(input: {
  pool: pg.Pool;
  siteId: string;
  fitness: BusinessFitnessRecord;
  reason: string;
  replacementOpportunityId?: string | null;
  expectedValueKeep?: number;
  expectedValueReplace?: number;
  logger: Logger;
}): Promise<SoftRetirementDecision> {
  const apex = governAction({
    action: "soft_retire_accepted_business",
    riskClass: "R1",
  });

  const decision: SoftRetirementDecision = {
    decisionId: newId("retire"),
    business_id: input.siteId,
    fitness_state: input.fitness.fitness_state,
    reason: input.reason,
    evidence: input.fitness.evidence,
    experiments_attempted:
      input.fitness.acquisition_experiments_attempted +
      input.fitness.code_evolution_attempts,
    repairs_attempted: input.fitness.repair_attempts,
    pivots_attempted: input.fitness.pivot_attempts,
    Titan_confidence: input.fitness.titan_confidence,
    replacement_opportunity_if_known:
      input.replacementOpportunityId ?? null,
    expected_value_keep: input.expectedValueKeep ?? input.fitness.titan_confidence,
    expected_value_replace: input.expectedValueReplace ?? 70,
    risk: "medium",
    Apex_decision: {
      authorized: apex.authorized,
      detail: apex.detail,
      riskClass: apex.riskClass,
    },
    preservation_plan:
      "SOFT_RETIRED: keep ros_businesses row, experiments, lessons, evidence packs, money/customer models, fitness snapshot, retirement decision; remove from titanManaged/accepted scheduling only",
    rollback_plan:
      "Restore siteId to titanManaged/accepted from retirement snapshot in ros_portfolio_state portfolio:retired:{siteId}; set lifecycle RESTORABLE→ACTIVE",
    at: new Date().toISOString(),
    status: "DENIED",
  };

  if (!apex.authorized) {
    await appendDecision(input.pool, decision);
    input.logger("warn", "soft_retire.apex_denied", {
      siteId: input.siteId,
      detail: apex.detail,
    });
    return decision;
  }

  // Never retire the current admission candidate mid-flight.
  const cp = await loadAdmitCheckpoint(
    input.pool,
    TARGET_PORTFOLIO_DEFAULT,
    15,
  );
  if (cp.currentCandidate === input.siteId) {
    decision.status = "SKIPPED";
    decision.reason = `${input.reason}|skipped_current_candidate`;
    await appendDecision(input.pool, decision);
    return decision;
  }
  if (!cp.titanManaged.includes(input.siteId) && !cp.accepted.includes(input.siteId)) {
    decision.status = "SKIPPED";
    decision.reason = `${input.reason}|not_managed`;
    await appendDecision(input.pool, decision);
    return decision;
  }

  // Snapshot for restore.
  await input.pool.query(
    `insert into ros_portfolio_state (id, document, updated_at, provenance)
     values ($1,$2::jsonb,now(),'SOFT_RETIRE')
     on conflict (id) do update set
       document=excluded.document, updated_at=now(), provenance='SOFT_RETIRE'`,
    [
      `portfolio:retired:${input.siteId}`,
      JSON.stringify({
        siteId: input.siteId,
        status: "SOFT_RETIRED",
        restorable: true,
        decision,
        fitness: input.fitness,
        priorAccepted: cp.accepted.includes(input.siteId),
        priorTitanManaged: cp.titanManaged.includes(input.siteId),
        retiredAt: decision.at,
      }),
    ],
  );

  // Update admit checkpoint — free slot.
  const softRetired = Array.isArray(cp.softRetired) ? [...cp.softRetired] : [];
  if (!softRetired.includes(input.siteId)) softRetired.push(input.siteId);

  cp.titanManaged = cp.titanManaged.filter((s) => s !== input.siteId);
  cp.accepted = cp.accepted.filter((s) => s !== input.siteId);
  cp.underRepair = cp.underRepair.filter((s) => s !== input.siteId);
  cp.reworkQueue = (cp.reworkQueue ?? []).filter((s) => s !== input.siteId);
  if (!cp.replacementRequired.includes(input.siteId)) {
    cp.replacementRequired.push(input.siteId);
  }
  cp.notes = [
    ...cp.notes.slice(-40),
    `soft_retired:${input.siteId}:${input.fitness.fitness_state}`,
  ];
  cp.softRetired = softRetired.slice(-100);
  cp.vacantSlots = Math.max(0, cp.targetPortfolio - cp.titanManaged.length);
  await saveAdmitCheckpoint(input.pool, cp);

  // Business metadata — SOFT_RETIRED / RESTORABLE
  await input.pool.query(
    `update ros_businesses
     set status='retired',
         metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb,
         updated_at = now()
     where site_id=$1`,
    [
      input.siteId,
      JSON.stringify({
        admit: {
          lifecycle: "SOFT_RETIRED",
          status: "SOFT_RETIRED",
          restorable: true,
          retiredAt: decision.at,
          retirementReason: input.reason,
          retirementDecisionId: decision.decisionId,
        },
      }),
    ],
  );

  // Lifecycle queue
  const records = await loadLifecycleQueue(input.pool);
  const nextRecords = records.map((r) =>
    r.siteId === input.siteId && r.state !== "REPLACED"
      ? {
          ...r,
          state: "RETIRED" as const,
          updatedAt: decision.at,
          evidence: [
            ...r.evidence,
            `soft_retired:${decision.decisionId}`,
            `reason:${input.reason}`,
          ],
        }
      : r,
  );
  await saveLifecycleQueue(input.pool, nextRecords);

  // Architect state retirement decisions
  const arch = await loadArchitectStatePg(input.pool);
  arch.retirementDecisions = [
    ...(arch.retirementDecisions ?? []),
    {
      siteId: input.siteId,
      mode: "soft" as const,
      why: input.reason,
      evidence: {
        fitness: input.fitness.fitness_state,
        confidence: input.fitness.titan_confidence,
        experiments: decision.experiments_attempted,
      },
      whatWasTried: [
        `repairs=${input.fitness.repair_attempts}`,
        `pivots=${input.fitness.pivot_attempts}`,
        `code_evo=${input.fitness.code_evolution_attempts}`,
      ],
      whatWasLearned: input.fitness.evidence,
      reversible: true,
      at: decision.at,
    },
  ].slice(-100);
  await saveArchitectStatePg(input.pool, arch);

  await appendArchitectEventPg(input.pool, {
    kind: "accepted_soft_retired",
    summary: `SOFT_RETIRED ${input.siteId}: ${input.reason}`,
    siteId: input.siteId,
  });

  // Best-effort filesystem preserve (Mac/local registry) — never throws.
  try {
    const manifest = findBusiness(input.siteId);
    if (manifest) {
      retireBusinessPreserve(manifest, {
        retiredAt: decision.at,
        reason: input.reason,
        mode: "soft",
      });
    }
  } catch {
    /* Azure may not have dynamic portfolio files */
  }

  decision.status = "SOFT_RETIRED";
  await appendDecision(input.pool, decision);
  await recordReplacementLineage(input.pool, {
    retiredBusiness: input.siteId,
    vacancyReason: input.reason,
    opportunityId: input.replacementOpportunityId ?? undefined,
    status: "VACANCY_OPEN",
    detail: `slot_freed vacantSlots=${cp.vacantSlots}`,
  });

  input.logger("info", "soft_retire.completed", {
    siteId: input.siteId,
    decisionId: decision.decisionId,
    vacantSlots: cp.vacantSlots,
    fitness: input.fitness.fitness_state,
    version: SOFT_RETIRE_VERSION,
  });

  return decision;
}

export async function loadSoftRetiredSiteIds(pool: pg.Pool): Promise<string[]> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [ADMIT_CHECKPOINT_KEY],
  );
  const v = (res.rows[0]?.value ?? {}) as { softRetired?: string[] };
  return Array.isArray(v.softRetired) ? v.softRetired.map(String) : [];
}
