/**
 * FIX 6 — Canonical customer/commercial event sensor.
 * Exists before the first customer so E9 has a place to land.
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { writeEdge } from "./attribution.js";

export const CUSTOMER_EVENT_KINDS = [
  "LEAD_CREATED",
  "HUMAN_ENGAGED",
  "INTENT_SIGNAL",
  "CHECKOUT_STARTED",
  "CHECKOUT_COMPLETED",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "REFUND",
  "REPEAT_PURCHASE",
  "SUBSCRIPTION_STARTED",
  "SUBSCRIPTION_CANCELLED",
] as const;
export type CustomerEventKind = (typeof CUSTOMER_EVENT_KINDS)[number];

export async function recordCustomerEvent(
  pool: pg.Pool,
  input: {
    kind: CustomerEventKind;
    businessId?: string;
    source: string;
    sourceId?: string;
    amountUsd?: number;
    evidence?: Record<string, unknown>;
  },
): Promise<string> {
  const id = `ce_${randomUUID().slice(0, 12)}`;
  await pool.query(
    `insert into ros_customer_events
       (event_id, kind, business_id, source, source_id, amount_usd, evidence, created_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb, now())`,
    [
      id,
      input.kind,
      input.businessId ?? null,
      input.source,
      input.sourceId ?? null,
      input.amountUsd ?? null,
      JSON.stringify(input.evidence ?? {}),
    ],
  );
  return id;
}

export async function ingestCustomerEvents(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ ingested: number }> {
  let ingested = 0;

  // Stripe payments already persisted by hosting-plane.
  const stripe = await pool.query(
    `select event_id, event_type, business_id, session_id, detail
       from ros_stripe_events
      where processed_at > now() - interval '30 days'
      limit 200`,
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

  for (const row of stripe.rows) {
    const type = String(row.event_type ?? "");
    let kind: CustomerEventKind | null = null;
    if (type === "checkout.session.completed" || type.includes("checkout.session.completed")) {
      kind = "CHECKOUT_COMPLETED";
    } else if (type.includes("payment_intent.succeeded") || type.includes("charge.succeeded")) {
      kind = "PAYMENT_SUCCEEDED";
    } else if (type.includes("payment_intent.payment_failed") || type.includes("charge.failed")) {
      kind = "PAYMENT_FAILED";
    } else if (type.includes("charge.refunded") || type.includes("refund")) {
      kind = "REFUND";
    } else if (type.includes("customer.subscription.created")) {
      kind = "SUBSCRIPTION_STARTED";
    } else if (type.includes("customer.subscription.deleted")) {
      kind = "SUBSCRIPTION_CANCELLED";
    }
    if (!kind) continue;
    const eid = String(row.event_id ?? "");
    if (/test|proof|example/i.test(eid)) continue;
    const exists = await pool.query(
      `select 1 from ros_customer_events where source='ros_stripe_events' and source_id=$1 limit 1`,
      [row.event_id],
    );
    if ((exists.rowCount ?? 0) > 0) continue;
    const ceId = await recordCustomerEvent(pool, {
      kind,
      businessId: row.business_id ? String(row.business_id) : undefined,
      source: "ros_stripe_events",
      sourceId: String(row.event_id),
      evidence: { eventType: type, sessionId: row.session_id },
    });
    await writeEdge(pool, {
      fromKind: "stripe_event",
      fromId: String(row.event_id),
      toKind: "customer_event",
      toId: ceId,
      relation: kind === "PAYMENT_FAILED" || kind === "REFUND" ? "negative_commercial" : "produced_customer_event",
      confidence: "DIRECT",
      businessId: row.business_id ? String(row.business_id) : undefined,
      polarity: kind === "PAYMENT_FAILED" || kind === "REFUND" ? "NEGATIVE" : "POSITIVE",
      evidence: { kind },
    });
    ingested++;
  }

  // Trusted inbound replies → HUMAN_ENGAGED / LEAD_CREATED (never unverified).
  const replies = await pool.query(
    `select webhook_id, classification, business_id
       from ros_inbound_webhooks
      where trust_status = 'TRUSTED'
        and classification in ('REPLY','LEAD')
        and created_at > now() - interval '30 days'
      limit 100`,
  );
  for (const row of replies.rows) {
    const exists = await pool.query(
      `select 1 from ros_customer_events where source='ros_inbound_webhooks' and source_id=$1 limit 1`,
      [row.webhook_id],
    );
    if ((exists.rowCount ?? 0) > 0) continue;
    await recordCustomerEvent(pool, {
      kind: row.classification === "LEAD" ? "LEAD_CREATED" : "HUMAN_ENGAGED",
      businessId: row.business_id ? String(row.business_id) : undefined,
      source: "ros_inbound_webhooks",
      sourceId: String(row.webhook_id),
      evidence: { classification: row.classification, trust: "TRUSTED" },
    });
    ingested++;
  }

  logger("info", "ultron.customer_events.ingest", { ingested });
  return { ingested };
}
