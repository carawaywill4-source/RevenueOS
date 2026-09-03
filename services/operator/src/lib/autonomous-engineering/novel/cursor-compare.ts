/**
 * Cursor shadow comparison + engineering lessons.
 * Cursor evaluates AFTER RevenueOS acts — never replaces the novel solution.
 */

import type pg from "pg";
import { AE_CURSOR_COMPARE_KEY } from "../types.js";
import { NOVEL_METRICS_KEY } from "./types.js";

export type CursorLesson = {
  at: string;
  projectId: string;
  cursorFound: string;
  revenueosMissed: string;
  why: string;
  missingCapability: string;
  selfEvolution: string;
};

export async function persistCursorCompare(input: {
  pool: pg.Pool;
  projectId: string;
  revenueosDiagnosis: string;
  revenueosDesign: string;
  revenueosPatch: string[];
  revenueosResult: string;
  cursorShadowNotes: string[];
  lessons?: CursorLesson[];
}): Promise<void> {
  const doc = {
    at: new Date().toISOString(),
    projectId: input.projectId,
    REVENUEOS_DIAGNOSIS: input.revenueosDiagnosis,
    REVENUEOS_DESIGN: input.revenueosDesign,
    REVENUEOS_PATCH: input.revenueosPatch,
    REVENUEOS_RESULT: input.revenueosResult,
    CURSOR_SHADOW: input.cursorShadowNotes,
    lessons: input.lessons ?? [],
    rule: "Cursor may evaluate after the fact; must not silently replace RevenueOS work",
  };
  await input.pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING_NOVEL')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='AUTONOMOUS_ENGINEERING_NOVEL'`,
    [AE_CURSOR_COMPARE_KEY, JSON.stringify(doc)],
  );
}

export async function recordNovelMetrics(input: {
  pool: pg.Pool;
  novelSolved: boolean;
  withoutPlaybook: boolean;
  diagnosisSummary: string;
  architectureSuccess: boolean;
  technicalRetain: boolean;
  commercialState: string;
  proofLevel: number;
  cursorInterventionCount: number;
  missingCapabilities: string[];
}): Promise<void> {
  const prev = await input.pool.query(
    `select value from ros_config_meta where key=$1 limit 1`,
    [NOVEL_METRICS_KEY],
  );
  const old = (prev.rows[0]?.value ?? {}) as Record<string, unknown>;
  const alreadyCounted = Boolean(old.lastProjectCounted);
  const doc = {
    ...old,
    updatedAt: new Date().toISOString(),
    novelLimitationsSolved:
      Number(old.novelLimitationsSolved ?? 0) +
      (input.novelSolved && !alreadyCounted ? 1 : 0),
    lastProjectCounted: input.novelSolved
      ? (old.lastProjectCounted ?? "AE_NOVEL_DISTRIBUTION_BREAKTHROUGH_001")
      : old.lastProjectCounted,
    lastWithoutPlaybook: input.withoutPlaybook,
    lastDiagnosis: input.diagnosisSummary,
    architectureSuccess: input.architectureSuccess,
    technicalRetainRateHint: input.technicalRetain,
    commercialState: input.commercialState,
    proofLevel: input.proofLevel,
    cursorInterventionFrequency: input.cursorInterventionCount,
    missingCapabilities: input.missingCapabilities,
    promotionThreshold:
      "3 novel problems independently diagnosed/designed/deployed/externally verified; ≥1 commercial improvement → PROVEN",
    status: "NOVEL_PARTIAL",
  };
  await input.pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING_NOVEL')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [NOVEL_METRICS_KEY, JSON.stringify(doc)],
  );
}
