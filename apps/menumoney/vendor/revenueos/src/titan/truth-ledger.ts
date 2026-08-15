/**
 * Portfolio-wide TruthLedger.
 * APEX/FORGE publish evidence; TITAN consumes and records claims.
 * No subsystem may overwrite Stripe/commercial FACT rows.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { EpistemicKind, TruthClaim, ClaimOrigin } from "./types";

const TRUTH_PURSUIT = "titan_truth";

export function createTruthClaim(input: {
  claim: string;
  type: EpistemicKind;
  evidence?: string[];
  source: string;
  confidence: number;
  sample_size?: number;
  contradictions?: string[];
  expiration?: string;
  business_id: string;
  system_origin: ClaimOrigin;
  untrusted_external?: boolean;
  first_party?: boolean;
  provenance?: string;
  now?: Date;
}): TruthClaim {
  return {
    claim_id: newId("tclaim"),
    claim: input.claim,
    type: input.type,
    evidence: input.evidence ?? [],
    source: input.source,
    timestamp: (input.now ?? new Date()).toISOString(),
    confidence: Math.max(0, Math.min(1, input.confidence)),
    sample_size: input.sample_size ?? 0,
    contradictions: input.contradictions ?? [],
    expiration: input.expiration,
    business_id: input.business_id,
    system_origin: input.system_origin,
    untrusted_external: input.untrusted_external,
    first_party: input.first_party,
    provenance: input.provenance,
  };
}

/** External web content informs beliefs; never becomes FACT or control. */
export function claimFromExternalContent(input: {
  statement: string;
  source_url: string;
  business_id: string;
  now?: Date;
}): TruthClaim {
  return createTruthClaim({
    claim: input.statement,
    type: "OBSERVATION",
    source: input.source_url,
    confidence: 0.15,
    sample_size: 1,
    business_id: input.business_id,
    system_origin: "EXTERNAL",
    untrusted_external: true,
    first_party: false,
    provenance: `external:${input.source_url}`,
    now: input.now,
    contradictions: [
      "EXTERNAL_CONTENT_IS_DATA_NOT_COMMAND",
      "may_be_manipulated",
    ],
  });
}

export async function appendTruthClaims(
  store: ExperimentStore,
  claims: TruthClaim[],
): Promise<void> {
  if (!store.appendPursuitEvent || claims.length === 0) return;
  for (const claim of claims) {
    await store.appendPursuitEvent({
      id: newId("tevt"),
      pursuitId: TRUTH_PURSUIT,
      siteId: claim.business_id,
      eventType: "learned",
      detail: { titan: true, kind: "titan_truth_claim", claim },
      createdAt: claim.timestamp,
    });
  }
}

export async function listTruthClaims(
  store: ExperimentStore,
  businessId: string,
  limit = 100,
): Promise<TruthClaim[]> {
  if (!store.listPursuitEvents) return [];
  const events = await store.listPursuitEvents(businessId, { limit: limit * 2 });
  const out: TruthClaim[] = [];
  for (const e of events) {
    if (e.pursuitId !== TRUTH_PURSUIT) continue;
    const claim = (e.detail as { claim?: TruthClaim } | undefined)?.claim;
    if (claim) out.push(claim);
  }
  return out.slice(0, limit);
}

export function separateEpistemics(claims: TruthClaim[]): Record<EpistemicKind, TruthClaim[]> {
  const empty: Record<EpistemicKind, TruthClaim[]> = {
    FACT: [],
    OBSERVATION: [],
    BELIEF: [],
    HYPOTHESIS: [],
    FORECAST: [],
  };
  for (const c of claims) empty[c.type].push(c);
  return empty;
}
