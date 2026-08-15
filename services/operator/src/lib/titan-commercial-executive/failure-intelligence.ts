/**
 * Failure → intelligence. Same strategy may not repeat without a difference.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";

function eid(): string {
  return `fail_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export type FailureRecord = {
  businessId: string;
  strategyKey: string;
  channelFamily?: string;
  surface?: string;
  rootCauseHypothesis: string;
  evidence: Record<string, unknown>;
  lesson: string;
  nextDifferentAction: string;
};

export async function ensureFailureTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists titan_commercial_failures (
      id text primary key,
      business_id text not null,
      strategy_key text not null,
      channel_family text,
      surface text,
      root_cause_hypothesis text not null,
      evidence jsonb not null default '{}'::jsonb,
      lesson text not null,
      next_different_action text not null,
      created_at timestamptz not null default now()
    );
    create index if not exists titan_commercial_failures_biz_idx
      on titan_commercial_failures (business_id, created_at desc);
    create index if not exists titan_commercial_failures_strategy_idx
      on titan_commercial_failures (business_id, strategy_key, created_at desc);
  `);
}

export async function recordCommercialFailure(
  pool: pg.Pool,
  input: FailureRecord,
): Promise<string> {
  await ensureFailureTables(pool);
  const id = eid();
  await pool.query(
    `insert into titan_commercial_failures
     (id, business_id, strategy_key, channel_family, surface, root_cause_hypothesis,
      evidence, lesson, next_different_action)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
    [
      id,
      input.businessId,
      input.strategyKey,
      input.channelFamily ?? null,
      input.surface ?? null,
      input.rootCauseHypothesis,
      JSON.stringify(input.evidence),
      input.lesson,
      input.nextDifferentAction,
    ],
  );
  return id;
}

/** True if this exact strategy failed recently without a recorded difference. */
export async function strategyRecentlyFailed(
  pool: pg.Pool,
  businessId: string,
  strategyKey: string,
  hours = 12,
): Promise<boolean> {
  await ensureFailureTables(pool);
  const res = await pool.query(
    `select 1 from titan_commercial_failures
     where business_id=$1 and strategy_key=$2
       and created_at > now() - ($3::text || ' hours')::interval
     limit 1`,
    [businessId, strategyKey, String(hours)],
  );
  return Boolean(res.rows[0]);
}

export async function recentFailureLessons(
  pool: pg.Pool,
  businessId: string,
  limit = 5,
): Promise<Array<{ strategyKey: string; lesson: string; next: string }>> {
  await ensureFailureTables(pool);
  const res = await pool.query(
    `select strategy_key, lesson, next_different_action
     from titan_commercial_failures
     where business_id=$1 order by created_at desc limit $2`,
    [businessId, limit],
  );
  return res.rows.map((r) => ({
    strategyKey: String(r.strategy_key),
    lesson: String(r.lesson),
    next: String(r.next_different_action),
  }));
}

export function classifyFailureRootCause(input: {
  betKind: string;
  newAudience: boolean;
  detail: string;
}): { hypothesis: string; lesson: string; next: string; strategyKey: string } {
  const d = input.detail.toLowerCase();
  if (input.betKind === "discovery_empty") {
    return {
      strategyKey: "ddg_complex_query",
      hypothesis: "CHANNEL/SEARCH — discovery query returned no third-party surfaces",
      lesson: "Use simple intent queries + channel-graph fallback; do not retry complex boolean DDG",
      next: "rank existing HUMAN_ACTION directories/communities + public_form on verified URLs",
    };
  }
  if (input.betKind === "owner_action_prepared") {
    return {
      strategyKey: "auto_pitch_unavailable",
      hypothesis: "EXECUTOR — no public email/form without captcha; owner surface required",
      lesson: "Auto path exhausted for this surface class; escalate owner OR build form/email adapter",
      next: "try different domain/surface family; open capability gap if pattern repeats",
    };
  }
  if (!input.newAudience && /resend|email/i.test(d)) {
    return {
      strategyKey: "email_outreach",
      hypothesis: "TECHNOLOGY — outreach sender/deliverability blocked",
      lesson: "Email pitch needs verified FROM domain; do not spam retries",
      next: "public_form on other surfaces OR owner action; gap: verified OUTREACH_FROM_EMAIL",
    };
  }
  if (input.betKind === "public_form" && !input.newAudience) {
    return {
      strategyKey: "public_form_fail",
      hypothesis: "SURFACE — form rejected or captcha/anti-bot",
      lesson: "Skip captcha surfaces; rotate domains",
      next: "different third-party surface + email if public contact exists",
    };
  }
  return {
    strategyKey: input.betKind || "unknown_bet",
    hypothesis: "UNKNOWN — experiment did not create new-audience exposure",
    lesson: "Do not retry identical bet; change surface family or executor",
    next: "diversify channel family (directory vs community vs creator vs partner)",
  };
}
