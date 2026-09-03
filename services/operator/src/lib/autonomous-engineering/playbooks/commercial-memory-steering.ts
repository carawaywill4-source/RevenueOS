/**
 * Playbook: wire commercial_comms_lessons into pre-send quality + family bias.
 * MARKER: COMMERCIAL_MEMORY_STEERING_V1
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const PLAYBOOK_ID = "commercial_memory_steering_v1";
export const MARKER = "COMMERCIAL_MEMORY_STEERING_V1";

export const TARGET_FILES = [
  "services/operator/src/lib/capability-reality/commercial-comms.ts",
  "services/operator/src/lib/titan-commercial-executive/new-audience.ts",
] as const;

const LESSON_HELPER = `
/** ${MARKER} — load persisted commercial lessons for pre-send gating. */
export async function loadCommercialCommsLessons(
  pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
): Promise<string[]> {
  try {
    const res = await pool.query(
      \`select value from ros_config_meta where key='commercial_comms_lessons' limit 1\`,
    );
    const doc = (res.rows[0]?.value ?? {}) as { lessons?: Array<{ lesson?: string }> };
    const lessons = Array.isArray(doc.lessons) ? doc.lessons : [];
    return lessons
      .map((l) => String(l.lesson ?? ""))
      .filter((s) => s.length > 8)
      .slice(-12);
  } catch {
    return [];
  }
}

/** ${MARKER} — tighten gate when historical lessons match weak patterns. */
export function applyCommercialLessonBias(
  scores: QualityScores,
  lessons: string[],
): QualityScores {
  if (!lessons.length) return scores;
  const blob = lessons.join(" \\n ").toLowerCase();
  const rejectReasons = [...scores.rejectReasons];
  let spamRisk = scores.spamRisk;
  let objectiveClarity = scores.objectiveClarity;
  if (/one license|weak cta|unclear|research-flex|routing\\/support/.test(blob)) {
    if (scores.ctaClarity < 0.75) rejectReasons.push("lesson_weak_cta");
    if (scores.objectiveClarity < 0.75) rejectReasons.push("lesson_unclear_objective");
    spamRisk = Math.min(1, spamRisk + 0.08);
    objectiveClarity = Math.max(0, objectiveClarity - 0.05);
  }
  const uniq = [...new Set(rejectReasons)];
  const total = Math.max(
    0,
    scores.total - (uniq.length > scores.rejectReasons.length ? 0.05 : 0),
  );
  return {
    ...scores,
    spamRisk,
    objectiveClarity,
    rejectReasons: uniq,
    total,
  };
}

`;

export function alreadyApplied(appRoot: string): boolean {
  const p = path.join(
    appRoot,
    "services/operator/src/lib/capability-reality/commercial-comms.ts",
  );
  if (!existsSync(p)) return false;
  return readFileSync(p, "utf8").includes(MARKER);
}

export function patchCommercialComms(src: string): string | null {
  if (src.includes(MARKER)) return src;
  if (!src.includes("export function composeCommercialEmail")) return null;
  const out = src.replace(
    /export function composeCommercialEmail/,
    `${LESSON_HELPER}export function composeCommercialEmail`,
  );
  return out.includes(MARKER) ? out : null;
}

export function patchNewAudience(src: string): string | null {
  if (src.includes(MARKER)) return src;
  if (!src.includes("composeCommercialEmail")) return null;

  let out = src;

  const importFrom = `import {
  buildResourcePlacementBrief,
  composeCommercialEmail,
} from "../capability-reality/commercial-comms.js";`;

  const importTo = `import {
  buildResourcePlacementBrief,
  composeCommercialEmail,
  loadCommercialCommsLessons,
  applyCommercialLessonBias,
} from "../capability-reality/commercial-comms.js";
// ${MARKER}`;

  if (!out.includes("loadCommercialCommsLessons")) {
    if (!out.includes(importFrom)) return null;
    out = out.replace(importFrom, importTo);
  }

  if (!out.includes("loadCommercialCommsLessons(input.pool)")) {
    out = out.replace(
      "const habitat = buildBuyerHabitat(input.businessId);",
      `const habitat = buildBuyerHabitat(input.businessId);\n  const commercialLessons = await loadCommercialCommsLessons(input.pool); // ${MARKER}`,
    );
  }

  if (!out.includes("effectivePrefer")) {
    out = out.replace(
      "const formHeavy =\n    input.banPublicForms === true ||",
      `const lessonPreferFamily = commercialLessons.some((l) => /form flood|failed_no_acceptance|public_form/i.test(l))\n    ? "partnerships"\n    : commercialLessons.some((l) => /cta|one license|unclear/i.test(l))\n      ? "directories"\n      : undefined; // ${MARKER}\n  const effectivePrefer = input.preferFamily || lessonPreferFamily;\n  const formHeavy =\n    input.banPublicForms === true ||`,
    );
    out = out.replace(
      "const families = input.preferFamily\n      ? [input.preferFamily, ...CHANNEL_FAMILIES.filter((f) => f !== input.preferFamily)]",
      "const families = effectivePrefer\n      ? [effectivePrefer, ...CHANNEL_FAMILIES.filter((f) => f !== effectivePrefer)]",
    );
  }

  if (!out.includes("applyCommercialLessonBias(composed.scores")) {
    out = out.replace(
      "const composed = composeCommercialEmail(brief);\n    if (!composed.approved) {",
      `const composed = composeCommercialEmail(brief);\n    const biased = applyCommercialLessonBias(composed.scores, commercialLessons);\n    composed.scores = biased;\n    composed.approved = biased.total >= 0.68 && biased.rejectReasons.length === 0; // ${MARKER}\n    if (!composed.approved) {`,
    );
  }

  return out.includes(MARKER) ? out : null;
}

export function applyPlaybookPatches(
  appRoot: string,
  read: (rel: string) => string,
): Array<{ relativePath: string; next: string }> {
  void appRoot;
  const out: Array<{ relativePath: string; next: string }> = [];
  const comms = patchCommercialComms(read(TARGET_FILES[0]));
  if (comms) out.push({ relativePath: TARGET_FILES[0], next: comms });
  const na = patchNewAudience(read(TARGET_FILES[1]));
  if (na) out.push({ relativePath: TARGET_FILES[1], next: na });
  return out;
}
