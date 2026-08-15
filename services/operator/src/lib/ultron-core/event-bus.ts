/**
 * Organ 4 — EXTERNAL EVENT BUS.
 *
 * Normalizes real external signals into a single stream:
 *   - EMAIL.SENT / EMAIL.BOUNCE / EMAIL.REPLY  (from aq_distribution_receipts + ros_inbound_messages)
 *   - PLATFORM.POST_PUBLISHED / .REJECTED       (from aq_distribution_receipts.status)
 *   - VISITOR.ARRIVED / VISITOR.QUALIFIED       (from ros_traffic_events)
 *   - CAPABILITY.PROVED                         (from ros_capability_graph transitions)
 *
 * Each event includes source, business, project, action, timestamp,
 * confidence, evidence and a `consumers` array. Any subsystem that reads
 * an event marks itself as a consumer. Events with no consumers after
 * 6h become defects (dangling external information).
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import type { ExternalEvent, Logger } from "./types.js";

function eventIdFor(kind: string, source: string, subject: string, ts: string): string {
  return `ev_${createHash("sha1").update(`${kind}|${source}|${subject}|${ts}`).digest("hex").slice(0, 20)}`;
}

async function insertEvent(
  pool: pg.Pool,
  ev: Omit<ExternalEvent, "createdAt" | "consumers">,
): Promise<boolean> {
  const r = await pool.query(
    `insert into ros_ultron_events
       (event_id, kind, source, business_id, project_id, action_id,
        payload, confidence, evidence, created_at)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9, now())
     on conflict (event_id) do nothing
     returning event_id`,
    [
      ev.eventId,
      ev.kind,
      ev.source,
      ev.businessId ?? null,
      ev.projectId ?? null,
      ev.actionId ?? null,
      JSON.stringify(ev.payload),
      ev.confidence,
      ev.evidence,
    ],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function ingestExternalEvents(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ ingested: number; byKind: Record<string, number> }> {
  let ingested = 0;
  const byKind: Record<string, number> = {};

  // 1. Email + external action receipts.
  const receipts = await pool.query(
    `select action_id, status, external_destination, executor_type, external_action,
            business_id, request_result, created_at
       from aq_distribution_receipts
      where created_at > now() - interval '48 hours'
      order by created_at desc
      limit 500`,
  );
  for (const row of receipts.rows) {
    const ts = row.created_at?.toISOString?.() ?? String(row.created_at);
    const statusUpper = String(row.status ?? "").toUpperCase();
    const execLower = String(row.executor_type ?? "").toLowerCase();
    const actionLower = String(row.external_action ?? "").toLowerCase();
    const isEmail =
      execLower.includes("email") ||
      execLower.includes("resend") ||
      actionLower.includes("email");
    let kind = "PLATFORM.ACTION";
    if (isEmail) {
      kind =
        statusUpper === "SENT" || statusUpper === "ACCEPTED"
          ? "EMAIL.SENT"
          : statusUpper === "BOUNCE"
            ? "EMAIL.BOUNCE"
            : "EMAIL.ACTION";
    } else if (statusUpper === "PUBLISHED") kind = "PLATFORM.POST_PUBLISHED";
    else if (statusUpper === "REJECTED" || statusUpper === "POST_FAILED") kind = "PLATFORM.REJECTED";
    else if (statusUpper === "ACCEPTED" || statusUpper === "SUBMISSION_ACKNOWLEDGED")
      kind = "PLATFORM.LISTING_ACCEPTED";

    const evId = eventIdFor(kind, "aq_distribution_receipts", String(row.action_id), ts);
    const inserted = await insertEvent(pool, {
      eventId: evId,
      kind,
      source: "aq_distribution_receipts",
      businessId: row.business_id ?? undefined,
      actionId: row.action_id ?? undefined,
      payload: {
        status: row.status,
        destination: row.external_destination,
        executor: row.executor_type,
        action: row.external_action,
        requestResult: row.request_result ?? {},
      },
      confidence: 0.98,
      evidence: `receipt:${row.action_id}`,
    });
    if (inserted) {
      ingested++;
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    }
  }

  // 2. Inbound messages (email replies, provider notifications).
  try {
    const inbound = await pool.query(
      `select message_id, provider, business_id, from_addr, to_addr, subject,
              classification, confidence, created_at
         from ros_inbound_messages
        where created_at > now() - interval '48 hours'
        order by created_at desc
        limit 200`,
    );
    for (const row of inbound.rows) {
      const ts = row.created_at?.toISOString?.() ?? String(row.created_at);
      const kind = `EMAIL.${String(row.classification ?? "REPLY").toUpperCase()}`;
      const evId = eventIdFor(kind, "ros_inbound_messages", String(row.message_id), ts);
      const inserted = await insertEvent(pool, {
        eventId: evId,
        kind,
        source: "ros_inbound_messages",
        businessId: row.business_id ?? undefined,
        payload: {
          provider: row.provider,
          from: row.from_addr,
          to: row.to_addr,
          subject: row.subject,
          classification: row.classification,
        },
        confidence: Number(row.confidence ?? 0.7),
        evidence: `inbound:${row.message_id}`,
      });
      if (inserted) {
        ingested++;
        byKind[kind] = (byKind[kind] ?? 0) + 1;
      }
    }
  } catch {
    // ros_inbound_messages may not exist yet in some environments — skip.
  }

  // 3. Traffic events → visitor events (only humans / qualified with a real referer).
  const visitors = await pool.query(
    `select id, business_id, class, referer, created_at
       from ros_traffic_events
      where created_at > now() - interval '24 hours'
        and class = 'VERIFIED_HUMAN_SIGNAL'
      order by created_at desc
      limit 200`,
  );
  for (const row of visitors.rows) {
    const ts = row.created_at?.toISOString?.() ?? String(row.created_at);
    const kind = row.class === "QUALIFIED" ? "VISITOR.QUALIFIED" : "VISITOR.ARRIVED";
    const evId = eventIdFor(kind, "ros_traffic_events", String(row.id), ts);
    const inserted = await insertEvent(pool, {
      eventId: evId,
      kind,
      source: "ros_traffic_events",
      businessId: row.business_id ?? undefined,
      payload: { referer: row.referer, class: row.class },
      confidence: 0.9,
      evidence: `traffic:${row.id}`,
    });
    if (inserted) {
      ingested++;
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    }
  }

  logger("info", "ultron.event_bus.ingest", { ingested, byKind });
  return { ingested, byKind };
}

export async function markEventConsumed(
  pool: pg.Pool,
  eventId: string,
  consumer: string,
): Promise<void> {
  await pool.query(
    `update ros_ultron_events
        set consumers = case
                          when $2 = any(consumers) then consumers
                          else array_append(consumers, $2)
                        end
      where event_id = $1`,
    [eventId, consumer],
  );
}

export async function unconsumedEvents(
  pool: pg.Pool,
  minutesOld = 60,
): Promise<ExternalEvent[]> {
  const r = await pool.query(
    `select event_id, kind, source, business_id, project_id, action_id,
            payload, confidence, evidence, consumers, created_at
       from ros_ultron_events
      where cardinality(consumers) = 0
        and created_at < now() - ($1::text || ' minutes')::interval
      order by created_at desc
      limit 50`,
    [String(minutesOld)],
  );
  return r.rows.map((row) => ({
    eventId: String(row.event_id),
    kind: String(row.kind),
    source: String(row.source),
    businessId: row.business_id ?? undefined,
    projectId: row.project_id ?? undefined,
    actionId: row.action_id ?? undefined,
    payload: row.payload ?? {},
    confidence: Number(row.confidence ?? 0.7),
    evidence: String(row.evidence ?? ""),
    consumers: (row.consumers ?? []) as string[],
    createdAt: row.created_at?.toISOString?.() ?? String(row.created_at),
  }));
}
