/**
 * PRIORITY 5 — CAUSAL ATTRIBUTION GRAPH (foundation).
 *
 * Writes directed edges as ULTRON progresses through the pipeline:
 *
 *   world_fact → strategy → plan → capability → skill → action →
 *   artifact → distribution → visitor → engagement → intent →
 *   lead/reply → checkout → payment → profit
 *
 * Confidence tiers:
 *   DIRECT           — cryptographic/receipt-level (marker + receipt ID)
 *   STRONG_INFERRED  — timestamp adjacency + platform match
 *   WEAK_INFERRED    — heuristic (business + time)
 *   UNATTRIBUTED     — no traceable link
 *
 * The graph is queryable so closed-loop watcher and first-task reflection
 * can consume it — attribution is not a report artifact, it's live state.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";

function edgeId(fromKind: string, fromId: string, toKind: string, toId: string, rel: string): string {
  return `att_${createHash("sha1").update(`${fromKind}|${fromId}|${toKind}|${toId}|${rel}`).digest("hex").slice(0, 20)}`;
}

export async function writeEdge(
  pool: pg.Pool,
  input: {
    fromKind: string;
    fromId: string;
    toKind: string;
    toId: string;
    relation: string;
    confidence: "DIRECT" | "STRONG_INFERRED" | "WEAK_INFERRED" | "UNATTRIBUTED";
    businessId?: string;
    evidence?: Record<string, unknown>;
    polarity?: "POSITIVE" | "NEGATIVE" | "ABSENT";
  },
): Promise<string> {
  const id = edgeId(input.fromKind, input.fromId, input.toKind, input.toId, input.relation);
  await pool.query(
    `insert into ros_attribution_edges
       (edge_id, from_kind, from_id, to_kind, to_id, relation, confidence,
        evidence, business_id, created_at, polarity)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9, now(), $10)
     on conflict (edge_id) do update set
       confidence = case
                      when excluded.confidence = 'DIRECT' then 'DIRECT'
                      when ros_attribution_edges.confidence = 'DIRECT' then 'DIRECT'
                      else excluded.confidence
                    end,
       polarity = excluded.polarity,
       evidence = ros_attribution_edges.evidence || excluded.evidence`,
    [
      id,
      input.fromKind,
      input.fromId,
      input.toKind,
      input.toId,
      input.relation,
      input.confidence,
      JSON.stringify(input.evidence ?? {}),
      input.businessId ?? null,
      input.polarity ?? "POSITIVE",
    ],
  );
  return id;
}

/**
 * Sweep — infer edges from the existing state. Non-destructive; idempotent.
 * Types of edges written:
 *   plan   →  action        (from ros_first_task_state)
 *   action →  artifact      (aq_distribution_receipts.public_url)
 *   action →  visitor       (ros_traffic_events after receipt.created_at, same business)
 *   visitor→  engagement    (repeat visits from same referer)
 *   event  →  action        (EMAIL.SENT receipt from ros_ultron_events)
 */
export async function inferAttributionEdges(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ edges: number; byRelation: Record<string, number> }> {
  const counts: Record<string, number> = {};
  let edges = 0;

  const recentReceipts = await pool.query(
    `select action_id, business_id, external_action, executor_type,
            request_result, public_url, created_at, channel_surface_id
       from aq_distribution_receipts
      where created_at > now() - interval '14 days'
      order by created_at desc
      limit 500`,
  );

  for (const r of recentReceipts.rows) {
    // action → artifact
    if (r.public_url) {
      await writeEdge(pool, {
        fromKind: "action",
        fromId: String(r.action_id),
        toKind: "artifact",
        toId: String(r.public_url),
        relation: "produced_artifact",
        confidence: "DIRECT",
        businessId: r.business_id,
        evidence: { url: r.public_url },
      });
      counts.produced_artifact = (counts.produced_artifact ?? 0) + 1;
      edges++;
    }

    // plan → action (via marker if present)
    const marker = (r.request_result as { marker?: string } | null)?.marker;
    if (marker) {
      await writeEdge(pool, {
        fromKind: "capability_marker",
        fromId: String(marker),
        toKind: "action",
        toId: String(r.action_id),
        relation: "produced_by_capability",
        confidence: "DIRECT",
        businessId: r.business_id,
        evidence: { marker },
      });
      counts.produced_by_capability = (counts.produced_by_capability ?? 0) + 1;
      edges++;
    }

    // action → visitor (visitor arrived after action, same business)
    const visitors = await pool.query(
      `select id, referer, created_at, class from ros_traffic_events
        where business_id = $1
          and class in ('VERIFIED_HUMAN_SIGNAL','LIKELY_HUMAN')
          and created_at between $2::timestamptz and $2::timestamptz + interval '14 days'
        limit 20`,
      [r.business_id, r.created_at],
    );
    const verified = visitors.rows.filter((v) => v.class === "VERIFIED_HUMAN_SIGNAL");
    for (const v of verified) {
      await writeEdge(pool, {
        fromKind: "action",
        fromId: String(r.action_id),
        toKind: "visitor",
        toId: String(v.id),
        relation: "attracted_visitor",
        confidence: "STRONG_INFERRED",
        businessId: r.business_id,
        evidence: { referer: v.referer },
      });
      counts.attracted_visitor = (counts.attracted_visitor ?? 0) + 1;
      edges++;
    }

    // Negative / absence: artifact with zero verified exposure in window.
    if (r.public_url && verified.length === 0) {
      await writeEdge(pool, {
        fromKind: "action",
        fromId: String(r.action_id),
        toKind: "artifact",
        toId: String(r.public_url),
        relation: "zero_verified_exposure",
        confidence: "DIRECT",
        polarity: "ABSENT",
        businessId: r.business_id,
        evidence: { windowDays: 14, humans: 0 },
      });
      counts.zero_verified_exposure = (counts.zero_verified_exposure ?? 0) + 1;
      edges++;
    }
  }

  // Checkout abandoned / payment failed from customer events.
  const negatives = await pool.query(
    `select event_id, kind, business_id, source_id
       from ros_customer_events
      where kind in ('PAYMENT_FAILED','CHECKOUT_STARTED')
        and created_at > now() - interval '30 days'
      limit 100`,
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  for (const n of negatives.rows) {
    if (String(n.kind) === "PAYMENT_FAILED") {
      await writeEdge(pool, {
        fromKind: "customer_event",
        fromId: String(n.event_id),
        toKind: "payment",
        toId: String(n.source_id ?? n.event_id),
        relation: "payment_failed",
        confidence: "DIRECT",
        polarity: "NEGATIVE",
        businessId: n.business_id ? String(n.business_id) : undefined,
      });
      counts.payment_failed = (counts.payment_failed ?? 0) + 1;
      edges++;
    }
    if (String(n.kind) === "CHECKOUT_STARTED") {
      const completed = await pool.query(
        `select 1 from ros_customer_events
          where kind='CHECKOUT_COMPLETED' and business_id is not distinct from $1
            and created_at > now() - interval '7 days' limit 1`,
        [n.business_id ?? null],
      );
      if ((completed.rowCount ?? 0) === 0) {
        await writeEdge(pool, {
          fromKind: "customer_event",
          fromId: String(n.event_id),
          toKind: "checkout",
          toId: String(n.source_id ?? n.event_id),
          relation: "checkout_abandoned",
          confidence: "WEAK_INFERRED",
          polarity: "ABSENT",
          businessId: n.business_id ? String(n.business_id) : undefined,
        });
        counts.checkout_abandoned = (counts.checkout_abandoned ?? 0) + 1;
        edges++;
      }
    }
  }

  logger("info", "ultron.attribution.inferred", { edges, byRelation: counts });
  return { edges, byRelation: counts };
}

export async function summarizeAttribution(
  pool: pg.Pool,
): Promise<{
  edges: number;
  byRelation: Record<string, number>;
  byConfidence: Record<string, number>;
  visitorsAttributed: number;
}> {
  const r1 = await pool.query(
    `select relation, count(*)::int as n from ros_attribution_edges group by 1`,
  );
  const r2 = await pool.query(
    `select confidence, count(*)::int as n from ros_attribution_edges group by 1`,
  );
  const r3 = await pool.query(
    `select count(distinct to_id)::int as n from ros_attribution_edges
       where to_kind = 'visitor'`,
  );
  const byRelation: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  for (const r of r1.rows) byRelation[String(r.relation)] = Number(r.n);
  for (const r of r2.rows) byConfidence[String(r.confidence)] = Number(r.n);
  const total = Object.values(byRelation).reduce((a, b) => a + b, 0);
  return { edges: total, byRelation, byConfidence, visitorsAttributed: Number(r3.rows[0]?.n ?? 0) };
}
