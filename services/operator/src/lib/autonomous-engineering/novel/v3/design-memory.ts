/**
 * DESIGN_REENTRY_REQUIRES_CHANGED_EVIDENCE — stop A↔B ping-pong.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import {
  DESIGN_MEMORY_KEY,
  type BlockerType,
  type DesignAttemptMemory,
} from "./types.js";

export type DesignMemoryDoc = {
  updatedAt: string;
  designs: Record<string, DesignAttemptMemory>;
  oscillation: {
    detected: boolean;
    sequence: string[];
    reason: string | null;
  };
  rule: "DESIGN_REENTRY_REQUIRES_CHANGED_EVIDENCE";
};

function hashEvidence(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

export async function loadDesignMemory(pool: pg.Pool): Promise<DesignMemoryDoc> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1 limit 1`,
    [DESIGN_MEMORY_KEY],
  );
  const v = res.rows[0]?.value as DesignMemoryDoc | undefined;
  if (v?.designs) return v;
  return {
    updatedAt: new Date().toISOString(),
    designs: {},
    oscillation: { detected: false, sequence: [], reason: null },
    rule: "DESIGN_REENTRY_REQUIRES_CHANGED_EVIDENCE",
  };
}

export async function saveDesignMemory(
  pool: pg.Pool,
  doc: DesignMemoryDoc,
): Promise<void> {
  doc.updatedAt = new Date().toISOString();
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING_V3')
     on conflict (key) do update set value=excluded.value, updated_at=now(),
       provenance='AUTONOMOUS_ENGINEERING_V3'`,
    [DESIGN_MEMORY_KEY, JSON.stringify(doc)],
  );
}

export function recordDesignFailure(
  mem: DesignMemoryDoc,
  input: {
    designId: string;
    blocker: string;
    blockerType: BlockerType;
    expectedValue: number;
    evidenceParts: string[];
  },
): DesignMemoryDoc {
  const evidenceHash = hashEvidence(input.evidenceParts);
  const prev = mem.designs[input.designId];
  const blockerChanged = Boolean(
    prev && prev.observedBlocker !== input.blocker,
  );
  mem.designs[input.designId] = {
    designId: input.designId,
    attempts: (prev?.attempts ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    observedBlocker: input.blocker,
    blockerType: input.blockerType,
    blockerChanged,
    externalCapabilityAvailable: false,
    expectedValue: input.expectedValue,
    reasonForReconsideration: null,
    materialEvidenceHash: evidenceHash,
  };
  mem.oscillation.sequence = [
    ...mem.oscillation.sequence,
    input.designId,
  ].slice(-8);
  // Detect A→B→A (or longer) with no proof climb
  const seq = mem.oscillation.sequence;
  if (seq.length >= 3) {
    const a = seq[seq.length - 3]!;
    const b = seq[seq.length - 2]!;
    const c = seq[seq.length - 1]!;
    if (a === c && a !== b) {
      mem.oscillation.detected = true;
      mem.oscillation.reason = `DESIGN_OSCILLATION: ${a}→${b}→${a} without material evidence change`;
    }
  }
  return mem;
}

/**
 * May this design be selected again?
 * Requires material evidence change OR blocker cleared OR new external capability.
 */
export function mayReenterDesign(
  mem: DesignMemoryDoc,
  designId: string,
  currentEvidenceParts: string[],
): { ok: boolean; reason: string } {
  const prev = mem.designs[designId];
  if (!prev) return { ok: true, reason: "first_attempt" };
  if (prev.attempts === 0) return { ok: true, reason: "no_prior_failure" };
  const nowHash = hashEvidence(currentEvidenceParts);
  if (nowHash !== prev.materialEvidenceHash) {
    return {
      ok: true,
      reason: "MATERIAL_EVIDENCE_CHANGED",
    };
  }
  if (prev.externalCapabilityAvailable) {
    return { ok: true, reason: "external_capability_now_available" };
  }
  return {
    ok: false,
    reason: `DESIGN_REENTRY_REQUIRES_CHANGED_EVIDENCE: ${designId} blocked by unchanged '${prev.observedBlocker}' (${prev.blockerType})`,
  };
}

export function filterDesignsByMemory<T extends { id: string; totalScore: number }>(
  mem: DesignMemoryDoc,
  designs: T[],
  evidenceParts: string[],
): { allowed: T[]; blocked: Array<{ id: string; reason: string }> } {
  const allowed: T[] = [];
  const blocked: Array<{ id: string; reason: string }> = [];
  for (const d of designs) {
    const gate = mayReenterDesign(mem, d.id, evidenceParts);
    if (gate.ok) allowed.push(d);
    else blocked.push({ id: d.id, reason: gate.reason });
  }
  allowed.sort((a, b) => b.totalScore - a.totalScore);
  return { allowed, blocked };
}
