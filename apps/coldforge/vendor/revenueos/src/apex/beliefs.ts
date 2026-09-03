/**
 * Explicit commercial beliefs — APEX must be able to change its mind.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { ApexBusinessState, Belief, EvidenceRecord } from "./types";

export function scopeGuardSeedBeliefs(now = new Date()): Belief[] {
  const ts = now.toISOString();
  return [
    {
      belief_id: newId("belief"),
      statement:
        "Experienced freelancers experiencing repeated scope creep have meaningful willingness to pay for change-order tooling.",
      scope: "scopeguard:market",
      confidence: 0.61,
      supporting_evidence: [
        "public_search_demand",
        "community_discussions",
        "competitor_products",
      ],
      contradicting_evidence: ["no_revenueos_sales_yet"],
      source_quality: 0.45,
      sample_size: 0,
      created_at: ts,
      updated_at: ts,
      decay_rate: 0.02,
      business_relevance: 1,
      transferability: 0.55,
      next_falsification_test:
        "qualified high-intent exposure to ScopeGuard with measurable checkout/purchase",
      business_id: "scopeguard",
    },
  ];
}

export function defaultEmptyState(businessId: string): ApexBusinessState {
  const beliefs =
    businessId === "scopeguard" ? scopeGuardSeedBeliefs() : [];
  return {
    version: 1,
    business_id: businessId,
    updated_at: new Date().toISOString(),
    beliefs,
    recent_decisions: [],
    commercial_events_count: 0,
    qualified_visits: 0,
    checkouts: 0,
    purchases: 0,
    revenue_usd: 0,
    learning_notes: [],
  };
}

export async function loadApexState(
  store: ExperimentStore,
  businessId: string,
): Promise<ApexBusinessState> {
  if (store.listPursuitEvents) {
    const events = await store.listPursuitEvents(businessId, { limit: 80 });
    for (const e of events) {
      if (e.pursuitId === "apex_state" && e.detail?.apex_state) {
        const doc = e.detail.apex_state as ApexBusinessState;
        if (doc?.version === 1) return doc;
      }
    }
  }
  return defaultEmptyState(businessId);
}

export async function saveApexState(
  store: ExperimentStore,
  state: ApexBusinessState,
): Promise<void> {
  state.updated_at = new Date().toISOString();
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("pevt"),
    pursuitId: "apex_state",
    siteId: state.business_id,
    eventType: "learned",
    detail: { apex: true, apex_state: state },
    createdAt: state.updated_at,
  });
}

export function updateBeliefWithEvidence(
  belief: Belief,
  evidence: EvidenceRecord,
  supports: boolean,
): Belief {
  const next = { ...belief, updated_at: new Date().toISOString() };
  if (evidence.synthetic) {
    next.confidence = Math.min(
      0.7,
      Math.max(0.05, belief.confidence + (supports ? 0.01 : -0.01)),
    );
    return next;
  }
  if (supports) {
    next.supporting_evidence = [
      evidence.evidence_id,
      ...belief.supporting_evidence,
    ].slice(0, 40);
    next.confidence = Math.min(
      0.95,
      belief.confidence + 0.05 * evidence.confidence,
    );
    next.sample_size = belief.sample_size + 1;
  } else {
    next.contradicting_evidence = [
      evidence.evidence_id,
      ...belief.contradicting_evidence,
    ].slice(0, 40);
    next.confidence = Math.max(
      0.05,
      belief.confidence - 0.08 * evidence.confidence,
    );
  }
  return next;
}

export function applyPurchaseToBeliefs(
  state: ApexBusinessState,
  amountUsd: number,
): ApexBusinessState {
  const note = `purchase_${amountUsd}_updates_wtp_belief`;
  const beliefs = state.beliefs.map((b) => {
    if (!b.statement.toLowerCase().includes("willingness to pay")) return b;
    return {
      ...b,
      confidence: Math.min(0.9, b.confidence + 0.12),
      sample_size: b.sample_size + 1,
      contradicting_evidence: b.contradicting_evidence.filter(
        (c) => c !== "no_revenueos_sales_yet",
      ),
      supporting_evidence: [`sale_${Date.now()}`, ...b.supporting_evidence],
      updated_at: new Date().toISOString(),
    };
  });
  return {
    ...state,
    beliefs,
    purchases: state.purchases + 1,
    revenue_usd: state.revenue_usd + amountUsd,
    learning_notes: [note, ...state.learning_notes].slice(0, 100),
  };
}
