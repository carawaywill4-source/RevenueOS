/**
 * Anti-loop memory. Identical commercially ineffective fingerprints
 * must escalate then abandon — never run 148 times.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import { ensureCommercialExecutionSchema } from "./schema.js";

export type FailureInput = {
  businessId: string;
  strategy: string;
  channel: string;
  target?: string;
  failureReason: string;
  result?: string;
};

export function failureFingerprint(input: FailureInput): string {
  const raw = [
    input.businessId,
    input.strategy,
    input.channel,
    (input.target ?? "").slice(0, 120),
    input.failureReason.slice(0, 160),
  ].join("|");
  return `fp_${createHash("sha1").update(raw).digest("hex").slice(0, 20)}`;
}

export function escalationForHits(hits: number): "retry" | "investigate" | "alter_method" | "abandon" {
  if (hits <= 1) return "retry";
  if (hits === 2) return "investigate";
  if (hits === 3) return "alter_method";
  return "abandon";
}

export async function noteFailure(
  pool: pg.Pool,
  input: FailureInput,
): Promise<{ hits: number; escalation: string; abandoned: boolean; fingerprint: string }> {
  await ensureCommercialExecutionSchema(pool);
  const fingerprint = failureFingerprint(input);
  const existing = await pool.query(
    `select hits from ros_failure_patterns where fingerprint=$1`,
    [fingerprint],
  );
  const hits = Number(existing.rows[0]?.hits ?? 0) + 1;
  const immediate = /http_409|http_403|http_401|bounced_to_submit_form/.test(input.failureReason);
  const escalation = immediate ? "abandon" : escalationForHits(hits);
  const abandoned = immediate || escalation === "abandon";
  await pool.query(
    `insert into ros_failure_patterns (
       fingerprint, business_id, strategy, channel, target, failure_reason,
       result, hits, first_seen_at, last_seen_at, abandoned, escalation
     ) values ($1,$2,$3,$4,$5,$6,$7,$8, now(), now(), $9, $10)
     on conflict (fingerprint) do update set
       hits=excluded.hits,
       last_seen_at=now(),
       abandoned=excluded.abandoned,
       escalation=excluded.escalation,
       result=excluded.result`,
    [
      fingerprint,
      input.businessId,
      input.strategy,
      input.channel,
      input.target ?? "",
      input.failureReason,
      input.result ?? "",
      hits,
      abandoned,
      escalation,
    ],
  );
  return { hits, escalation, abandoned, fingerprint };
}

export async function isAbandoned(
  pool: pg.Pool,
  input: FailureInput,
): Promise<boolean> {
  const fingerprint = failureFingerprint(input);
  const r = await pool.query(
    `select abandoned from ros_failure_patterns where fingerprint=$1`,
    [fingerprint],
  );
  return Boolean(r.rows[0]?.abandoned);
}

export async function nextChannelAfterAbandon(
  pool: pg.Pool,
  businessId: string,
  current: string,
): Promise<string> {
  const order = [
    "directories",
    "email_outreach",
    "public_listings",
    "communities",
    "owned_content",
    "marketplaces",
  ];
  const abandoned = await pool.query(
    `select channel from ros_failure_patterns
      where business_id=$1 and abandoned=true`,
    [businessId],
  );
  const dead = new Set(abandoned.rows.map((r) => String(r.channel)));
  const start = Math.max(0, order.indexOf(current));
  for (let i = 1; i <= order.length; i++) {
    const ch = order[(start + i) % order.length]!;
    if (!dead.has(ch)) return ch;
  }
  return order[(start + 1) % order.length]!;
}
