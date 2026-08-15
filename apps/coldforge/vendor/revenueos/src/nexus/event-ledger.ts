/**
 * Append-only RevenueEvent ledger.
 * Events are historical facts — corrections emit new events, never rewrite.
 */

import { newId } from "../ledger/store";
import type { DataQuality, NexusSubsystem, RevenueEvent, RiskClass } from "./types";

export const REVENUE_EVENT_SCHEMA = "revenueos.event.v1";

export type EventLedger = {
  events: RevenueEvent[];
  /** Input event ids already acknowledged (Stripe duplicates, etc.). */
  processed_external_ids: Set<string>;
  /** Idempotency keys that already produced a commercial/external effect. */
  committed_idempotency_keys: Set<string>;
};

export function createEventLedger(): EventLedger {
  return {
    events: [],
    processed_external_ids: new Set(),
    committed_idempotency_keys: new Set(),
  };
}

export function makeRevenueEvent(input: {
  event_type: string;
  producer: NexusSubsystem;
  subsystem?: NexusSubsystem;
  business_id?: string | null;
  portfolio_id?: string | null;
  actor?: string;
  risk_class?: RiskClass;
  payload?: Record<string, unknown>;
  data_quality?: DataQuality;
  attribution_confidence?: number;
  correlation_id?: string | null;
  causation_id?: string | null;
  trace_id?: string | null;
  objective_id?: string | null;
  decision_id?: string | null;
  action_id?: string | null;
  experiment_id?: string | null;
  occurred_at?: string;
  source?: string;
}): RevenueEvent {
  const now = new Date().toISOString();
  return {
    event_id: newId("rev_evt"),
    event_type: input.event_type,
    event_version: "1",
    occurred_at: input.occurred_at ?? now,
    received_at: now,
    source: input.source ?? "revenueos.nexus",
    producer: input.producer,
    business_id: input.business_id ?? null,
    portfolio_id: input.portfolio_id ?? null,
    correlation_id: input.correlation_id ?? null,
    causation_id: input.causation_id ?? null,
    trace_id: input.trace_id ?? null,
    actor: input.actor ?? input.producer,
    subsystem: input.subsystem ?? input.producer,
    objective_id: input.objective_id ?? null,
    decision_id: input.decision_id ?? null,
    action_id: input.action_id ?? null,
    experiment_id: input.experiment_id ?? null,
    risk_class: input.risk_class ?? "R0",
    payload: input.payload ?? {},
    data_quality: input.data_quality ?? "MEDIUM",
    attribution_confidence: input.attribution_confidence ?? 0,
    schema_version: REVENUE_EVENT_SCHEMA,
  };
}

/** Append a fact. Never mutates prior events. */
export function appendEvent(ledger: EventLedger, event: RevenueEvent): EventLedger {
  return {
    ...ledger,
    events: [...ledger.events, event],
  };
}

/**
 * Acknowledge an external delivery (e.g. Stripe webhook).
 * Duplicate ids ACK but must not reprocess commercial effect.
 */
export function acknowledgeExternalEvent(
  ledger: EventLedger,
  externalId: string,
): { ledger: EventLedger; duplicate: boolean } {
  if (ledger.processed_external_ids.has(externalId)) {
    return { ledger, duplicate: true };
  }
  const next = new Set(ledger.processed_external_ids);
  next.add(externalId);
  return {
    ledger: { ...ledger, processed_external_ids: next },
    duplicate: false,
  };
}

export function markIdempotencyCommitted(
  ledger: EventLedger,
  key: string,
): EventLedger {
  const next = new Set(ledger.committed_idempotency_keys);
  next.add(key);
  return { ...ledger, committed_idempotency_keys: next };
}

export function wasIdempotencyCommitted(ledger: EventLedger, key: string): boolean {
  return ledger.committed_idempotency_keys.has(key);
}

export function eventsForBusiness(
  ledger: EventLedger,
  businessId: string,
): RevenueEvent[] {
  return ledger.events.filter((e) => e.business_id === businessId);
}

export function rebuildDerivedCounts(ledger: EventLedger): {
  purchases: number;
  refunds: number;
  deployments: number;
  stranger_purchases: number;
} {
  let purchases = 0;
  let refunds = 0;
  let deployments = 0;
  let stranger_purchases = 0;
  for (const e of ledger.events) {
    if (e.event_type === "purchase.completed") purchases += 1;
    if (e.event_type === "refund.completed") refunds += 1;
    if (e.event_type === "deployment.promoted") deployments += 1;
    if (e.event_type === "STRANGER_PURCHASE_CONFIRMED") stranger_purchases += 1;
  }
  return { purchases, refunds, deployments, stranger_purchases };
}
