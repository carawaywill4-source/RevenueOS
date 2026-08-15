/**
 * Immutable evidence ledger.
 * LLM output may create SYNTHETIC hypotheses — reality determines confidence.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { PursuitEvent } from "../types";
import type { EvidenceRecord, EvidenceType } from "./types";

const MAX_SYNTHETIC_CONFIDENCE = 0.15;

export function createEvidence(input: {
  type: EvidenceType;
  source: string;
  statement: string;
  businessId: string;
  confidence: number;
  reliability?: number;
  scope?: string;
  possibleBias?: string;
  possibleConfounders?: string[];
  traceId?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}): EvidenceRecord {
  const synthetic = input.type === "SYNTHETIC";
  const confidence = synthetic
    ? Math.min(input.confidence, MAX_SYNTHETIC_CONFIDENCE)
    : Math.max(0, Math.min(1, input.confidence));
  const ts = input.timestamp ?? new Date().toISOString();
  return {
    evidence_id: newId("evid"),
    type: input.type,
    source: input.source,
    timestamp: ts,
    freshness_hours: 0,
    reliability: input.reliability ?? (synthetic ? 0.1 : 0.6),
    scope: input.scope ?? input.businessId,
    confidence,
    possible_bias: input.possibleBias,
    possible_confounders: input.possibleConfounders,
    statement: input.statement.slice(0, 800),
    business_id: input.businessId,
    trace_id: input.traceId,
    synthetic,
    payload: input.payload,
  };
}

export async function appendEvidence(
  store: ExperimentStore,
  evidence: EvidenceRecord,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  const evt: PursuitEvent = {
    id: newId("pevt"),
    pursuitId: "apex_evidence",
    siteId: evidence.business_id,
    eventType: "beacon",
    detail: {
      apex: true,
      kind: "apex_evidence",
      actionClass: "verified_exposure",
      evidence,
    },
    createdAt: evidence.timestamp,
  };
  await store.appendPursuitEvent(evt);
}

export async function listEvidence(
  store: ExperimentStore,
  businessId: string,
  limit = 100,
): Promise<EvidenceRecord[]> {
  if (!store.listPursuitEvents) return [];
  const events = await store.listPursuitEvents(businessId, { limit: limit * 2 });
  const out: EvidenceRecord[] = [];
  for (const e of events) {
    const evidence = e.detail?.evidence as EvidenceRecord | undefined;
    if (evidence?.evidence_id) out.push(evidence);
  }
  return out.slice(0, limit);
}
