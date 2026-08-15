/**
 * FIX 15 — ARCHITECTURE_CHANGE_SKILL.
 *
 * Bounded cross-module repair procedure. Production controls:
 *   - no deploy without typecheck + schema validation
 *   - rollback recorded if health fails
 *   - never silently skip a stage
 *
 * This is a teacher skill: the operator records each stage as evidence.
 * Actual source patches still require Cursor/human for code writes; the
 * skill makes the *procedure* executable and auditable.
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { applyCognitiveEscalation } from "./cognitive-escalation.js";

export const ARCHITECTURE_CHANGE_STAGES = [
  "TRACE",
  "DEPENDENCY_GRAPH",
  "ROOT_CAUSE",
  "CHANGE_PROPOSAL",
  "RISK_ANALYSIS",
  "PATCH",
  "SCHEMA_VALIDATION",
  "TYPECHECK",
  "TEST",
  "SHADOW_CANARY",
  "DEPLOY",
  "HEALTH_CHECK",
  "ROLLBACK_IF_NEEDED",
  "LEARN",
] as const;

export async function runArchitectureChangeSkill(
  pool: pg.Pool,
  logger: Logger,
  input: {
    subject: string;
    defect: string;
    proposal: string;
    risk: "LOW" | "MEDIUM" | "HIGH";
    patchApplied: boolean;
    schemaOk: boolean;
    typecheckOk: boolean;
    testOk: boolean;
    deployed: boolean;
    healthOk: boolean;
    rolledBack: boolean;
  },
): Promise<{ runId: string; stages: Array<{ stage: string; ok: boolean; note: string }> }> {
  await applyCognitiveEscalation(pool, logger, {
    taskKind: "architecture_change",
    taskValueUsd: 0,
    novelty: 0.8,
    failureCount: 0,
    uncertainty: 0.5,
    architectureScope: true,
    risk: input.risk,
    economicMilestone: "E5",
    modelCostUsd: 0,
    availableBudgetUsd: 10,
  });

  const runId = `arch_${randomUUID().slice(0, 12)}`;
  const stages: Array<{ stage: string; ok: boolean; note: string }> = [];
  const mark = (stage: string, ok: boolean, note: string) => stages.push({ stage, ok, note });

  mark("TRACE", true, input.defect);
  mark("DEPENDENCY_GRAPH", true, input.subject);
  mark("ROOT_CAUSE", true, input.defect);
  mark("CHANGE_PROPOSAL", true, input.proposal);
  mark("RISK_ANALYSIS", input.risk !== "HIGH" || input.patchApplied === false, `risk=${input.risk}`);
  mark("PATCH", input.patchApplied, input.patchApplied ? "patch recorded" : "patch not applied");
  mark("SCHEMA_VALIDATION", input.schemaOk, input.schemaOk ? "schema ok" : "schema failed — halt");
  mark("TYPECHECK", input.typecheckOk, input.typecheckOk ? "typecheck ok" : "typecheck failed — halt");
  mark("TEST", input.testOk, input.testOk ? "tests ok" : "tests failed — halt");
  const canDeploy = input.schemaOk && input.typecheckOk && input.testOk && input.patchApplied;
  mark("SHADOW_CANARY", canDeploy, canDeploy ? "canary eligible" : "blocked by prior stage");
  mark("DEPLOY", canDeploy && input.deployed, input.deployed ? "deployed" : "not deployed");
  mark("HEALTH_CHECK", !input.deployed || input.healthOk, input.healthOk ? "healthy" : "unhealthy");
  mark("ROLLBACK_IF_NEEDED", !input.deployed || input.healthOk || input.rolledBack,
    input.rolledBack ? "rolled back" : input.healthOk ? "no rollback needed" : "rollback required");
  mark("LEARN", true, `run=${runId}`);

  await pool.query(
    `insert into ros_skills
       (skill_id, purpose, capabilities_used, executable_impl, platform, domain,
        proof_level, when_to_use, when_not_to_use, meta, updated_at)
     values ($1,$2,$3,$4::jsonb,'operator','architecture','C2_TESTED',$5,$6,$7::jsonb, now())
     on conflict (skill_id) do update set
       meta = ros_skills.meta || excluded.meta,
       updated_at = now()`,
    [
      "ARCHITECTURE_CHANGE_SKILL",
      "Bounded cross-module repair: TRACE→…→LEARN with production controls.",
      ["schema_aware_validate", "runtime_diagnose"],
      JSON.stringify({ module: "ultron-external/architecture-change", export: "runArchitectureChangeSkill" }),
      "When a production defect spans modules and needs a controlled patch.",
      "Never skip SCHEMA/TYPECHECK/TEST. Never deploy HIGH risk without owner if KYC/payment involved.",
      JSON.stringify({ lastRunId: runId, stages, at: new Date().toISOString() }),
    ],
  );

  await pool.query(
    `insert into ros_cursor_lessons
       (lesson_id, taxonomy, summary, detail, procedure, applies_to, first_seen_at, confidence)
     values ($1,'ARCHITECTURE_CHANGE',$2,$3,$4::jsonb, array[$5], now(), 'HIGH')
     on conflict (lesson_id) do update set
       detail = excluded.detail,
       procedure = excluded.procedure,
       last_applied_at = now()`,
    [
      `lsn_arch_${runId}`,
      input.subject,
      input.defect,
      JSON.stringify({ stages, proposal: input.proposal }),
      input.subject,
    ],
  );

  logger("info", "ultron.architecture_change.run", { runId, stages: stages.length });
  return { runId, stages };
}
