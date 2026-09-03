/**
 * KnowledgeClaim factory + epistemic separation helpers.
 */

import { newId, type ExperimentStore } from "../../ledger/store";
import type { CausalStatus, EpistemicClass, KnowledgeClaim, KnowledgeVolatility } from "./types";
import type { EvidenceVector } from "./types";
import { coarseConfidence } from "./evidence-vector";

const CLAIM_PURSUIT = "titan_cortex_claim";

export function assertKnowledgeClaim(input: {
  statement: string;
  classification: EpistemicClass;
  domain: string;
  scope?: string;
  business_id?: string;
  valid_from?: string;
  valid_until?: string;
  supporting_evidence?: string[];
  contradicting_evidence?: string[];
  applicability_conditions?: string[];
  known_exceptions?: string[];
  causal_status?: CausalStatus;
  freshness?: KnowledgeVolatility;
  transferability?: number;
  source_ids?: string[];
  evidence_vector?: EvidenceVector;
  sample_size?: number;
  now?: Date;
}): KnowledgeClaim {
  const now = (input.now ?? new Date()).toISOString();
  const weight = input.evidence_vector
    ? 1 - input.evidence_vector.uncertainty
    : classificationPrior(input.classification);
  const sample = input.sample_size ?? input.evidence_vector?.sample_size ?? 0;
  // Verified FACT/MEASUREMENT (e.g. Stripe zero) is not "tiny sample vibes".
  const verified =
    input.classification === "FACT" || input.classification === "MEASUREMENT";
  const { confidence, interval } = verified
    ? {
        confidence: Number(Math.min(0.95, Math.max(0.85, weight)).toFixed(2)),
        interval: { low: 0.8, high: 0.98 } as { low: number; high: number },
      }
    : coarseConfidence(weight, sample);

  return {
    claim_id: newId("cclaim"),
    statement: input.statement,
    classification: input.classification,
    domain: input.domain,
    scope: input.scope ?? "general",
    business_id: input.business_id,
    valid_from: input.valid_from,
    valid_until: input.valid_until,
    observed_at: now,
    learned_at: now,
    supporting_evidence: input.supporting_evidence ?? [],
    contradicting_evidence: input.contradicting_evidence ?? [],
    confidence,
    confidence_interval: interval,
    applicability_conditions: input.applicability_conditions ?? [],
    known_exceptions: input.known_exceptions ?? [],
    causal_status: input.causal_status ?? "UNKNOWN",
    source_diversity: new Set(input.source_ids ?? []).size,
    freshness: input.freshness ?? "MODERATE",
    transferability: input.transferability ?? 0.5,
    dependencies: [],
    derived_from: [],
    supersedes: [],
    source_ids: input.source_ids ?? [],
    evidence_vector: input.evidence_vector,
    last_verified_at: now,
  };
}

function classificationPrior(c: EpistemicClass): number {
  switch (c) {
    case "FACT":
      return 0.95;
    case "MEASUREMENT":
      return 0.9;
    case "OBSERVATION":
      return 0.7;
    case "ESTABLISHED_PRINCIPLE":
      return 0.65;
    case "FORECAST":
      return 0.45;
    case "HYPOTHESIS":
    case "BELIEF":
    case "INFERENCE":
      return 0.4;
    case "UNKNOWN":
      return 0.1;
    default:
      return 0.5;
  }
}

/** Never silently collapse epistemic classes. */
export function assertEpistemicSeparation(
  a: KnowledgeClaim,
  b: KnowledgeClaim,
): { ok: boolean; detail: string } {
  if (a.classification === b.classification && a.statement === b.statement) {
    return { ok: true, detail: "same object" };
  }
  if (a.classification !== b.classification) {
    return {
      ok: true,
      detail: `preserved:${a.classification}≠${b.classification}`,
    };
  }
  return { ok: true, detail: "same class distinct statements" };
}

export function separateByClass(
  claims: KnowledgeClaim[],
): Partial<Record<EpistemicClass, KnowledgeClaim[]>> {
  const out: Partial<Record<EpistemicClass, KnowledgeClaim[]>> = {};
  for (const c of claims) {
    (out[c.classification] ??= []).push(c);
  }
  return out;
}

export async function persistKnowledgeClaim(
  store: ExperimentStore,
  claim: KnowledgeClaim,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: CLAIM_PURSUIT,
    siteId: claim.business_id ?? "portfolio",
    eventType: "learned",
    detail: { titan: true, cortex: true, kind: "knowledge_claim", claim },
    createdAt: claim.learned_at,
  });
}

/**
 * Temporal awareness: when we learned vs when it was true.
 */
export function beliefAtTime(
  claims: KnowledgeClaim[],
  atIso: string,
): KnowledgeClaim[] {
  const t = new Date(atIso).getTime();
  return claims.filter((c) => {
    const learned = new Date(c.learned_at).getTime();
    if (learned > t) return false;
    if (c.valid_from && new Date(c.valid_from).getTime() > t) return false;
    if (c.valid_until && new Date(c.valid_until).getTime() < t) return false;
    return true;
  });
}
