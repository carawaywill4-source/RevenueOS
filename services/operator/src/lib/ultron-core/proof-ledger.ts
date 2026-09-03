/**
 * Organ 5 — PROOF LEDGER.
 *
 * Every important claim RevenueOS makes about itself gets an
 * externally-verifiable evidence row. Grading is derived from the same
 * live-evidence queries used elsewhere — no hand-set numbers.
 */

import type pg from "pg";
import type { CapabilityProofLevel, Logger, ProofClaim } from "./types.js";

async function upsertClaim(
  pool: pg.Pool,
  c: Omit<ProofClaim, "lastVerifiedAt">,
): Promise<void> {
  await pool.query(
    `insert into ros_proof_ledger
       (claim_id, claim, subject, proof_level, evidence, last_verified_at, updated_at)
     values ($1,$2,$3,$4,$5::jsonb, now(), now())
     on conflict (claim_id) do update set
       claim = excluded.claim,
       proof_level = excluded.proof_level,
       evidence = excluded.evidence,
       last_verified_at = now(),
       updated_at = now()`,
    [c.claimId, c.claim, c.subject, c.proofLevel, JSON.stringify(c.evidence)],
  );
}

export async function refreshProofLedger(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ claims: number }> {
  let claims = 0;

  // 1. CAN_SEND_EMAIL — count of SENT receipts.
  const sent = await pool.query(
    `select count(*)::int as n, max(created_at) as last
       from aq_distribution_receipts
      where status in ('SENT','ACCEPTED')
        and (executor_type ilike '%email%' or executor_type ilike '%resend%'
             or external_action ilike '%email%')
        and created_at > now() - interval '30 days'`,
  );
  const sentCount = Number(sent.rows[0]?.n ?? 0);
  await upsertClaim(pool, {
    claimId: "claim_can_send_email",
    claim: "RevenueOS can send outbound email autonomously.",
    subject: "email_send",
    proofLevel: sentCount > 0 ? "C4_EXTERNAL_ACTION_PROVEN" : "C1_IMPLEMENTED",
    evidence: [{ query: "aq_distribution_receipts.SENT/ACCEPTED 30d", count: sentCount, last: sent.rows[0]?.last }],
  });
  claims++;

  // 2. CAN_HANDLE_EMAIL_REPLIES — count of inbound messages.
  let inbound = 0;
  try {
    const r = await pool.query(
      `select count(*)::int as n from ros_inbound_messages
        where created_at > now() - interval '30 days'`,
    );
    inbound = Number(r.rows[0]?.n ?? 0);
  } catch {
    inbound = 0;
  }
  await upsertClaim(pool, {
    claimId: "claim_can_handle_email_replies",
    claim: "RevenueOS can receive and interpret email replies.",
    subject: "email_receive",
    proofLevel: inbound > 0 ? "C4_EXTERNAL_ACTION_PROVEN" : "C1_IMPLEMENTED",
    evidence: [{ query: "ros_inbound_messages 30d", count: inbound }],
  });
  claims++;

  // 3. CAN_PUBLISH_TO_THIRD_PARTY — verified external publications.
  const pub = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts r
      where r.status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED')
        and r.external_action not in ('publish_owned_intent_page','publish_owned_page',
            'owned_publish','portfolio_crosslink_publish','publish_free_utility')
        and r.executor_type not in ('PORTFOLIO_CROSSLINK','CONTENT_PUBLISH')
        and r.executor_type not ilike '%email%'
        and r.executor_type not ilike '%resend%'
        and r.channel_surface_id is not null
        and exists (
          select 1 from aq_channel_surfaces s
           where s.channel_surface_id = r.channel_surface_id
             and coalesce(s.platform,'') not in ('owned','')
             and coalesce(s.platform,'') not ilike '%owned%'
        )
        and r.created_at > now() - interval '60 days'`,
  );
  const pubCount = Number(pub.rows[0]?.n ?? 0);
  await upsertClaim(pool, {
    claimId: "claim_can_publish_third_party",
    claim: "RevenueOS can publish a verified public artifact on a third-party platform.",
    subject: "third_party_publish",
    proofLevel: pubCount > 0 ? "C5_EXTERNAL_EFFECT_PROVEN" : "C1_IMPLEMENTED",
    evidence: [{ query: "aq_distribution_receipts.PUBLISHED (third-party) 60d", count: pubCount }],
  });
  claims++;

  // 4. CAN_OBTAIN_HUMAN — attributed human traffic.
  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events
      where class = 'VERIFIED_HUMAN_SIGNAL'
        and created_at > now() - interval '30 days'`,
  );
  const humanCount = Number(humans.rows[0]?.n ?? 0);
  await upsertClaim(pool, {
    claimId: "claim_can_obtain_human",
    claim: "RevenueOS can attract a legitimate external human visitor.",
    subject: "external_human",
    proofLevel: humanCount > 0 ? "C5_EXTERNAL_EFFECT_PROVEN" : "C0_DISCOVERED",
    evidence: [{ query: "ros_traffic_events.VERIFIED_HUMAN_SIGNAL 30d", count: humanCount }],
  });
  claims++;

  // 5. CAN_AUTONOMOUSLY_CREATE_ACCOUNT — vault entries.
  let vault = 0;
  try {
    const r = await pool.query(`select count(*)::int as n from ros_platform_accounts`);
    vault = Number(r.rows[0]?.n ?? 0);
  } catch {
    vault = 0;
  }
  await upsertClaim(pool, {
    claimId: "claim_can_autonomously_create_account",
    claim: "RevenueOS can autonomously create + vault a permitted platform account.",
    subject: "account_autonomy",
    proofLevel: vault > 0 ? "C2_TESTED" : "C0_DISCOVERED",
    evidence: [{ query: "ros_platform_accounts count", count: vault }],
  });
  claims++;

  // 6. CAN_OPERATE_BROWSER — persistent browser automation absent by design.
  await upsertClaim(pool, {
    claimId: "claim_can_operate_browser",
    claim: "RevenueOS can operate a browser for permitted UI workflows.",
    subject: "browser_operator",
    proofLevel: "C0_DISCOVERED",
    evidence: [{ note: "No persistent browser operator in production runtime yet." }],
  });
  claims++;

  // 7. CAN_ACQUIRE_FIRST_CUSTOMER.
  let stripe = 0;
  try {
    const r = await pool.query(
      `select count(*)::int as n from ros_ultron_events where kind = 'STRIPE.PAID'`,
    );
    stripe = Number(r.rows[0]?.n ?? 0);
  } catch {
    stripe = 0;
  }
  await upsertClaim(pool, {
    claimId: "claim_first_revenue",
    claim: "RevenueOS has generated real external revenue (Stripe or equivalent).",
    subject: "first_revenue",
    proofLevel: stripe > 0 ? "C6_COMMERCIAL_EFFECT_PROVEN" : "C0_DISCOVERED",
    evidence: [{ query: "ros_ultron_events.STRIPE.PAID", count: stripe }],
  });
  claims++;

  logger("info", "ultron.proof_ledger.refresh", { claims });
  return { claims };
}

export async function listClaims(pool: pg.Pool): Promise<ProofClaim[]> {
  const r = await pool.query(
    `select claim_id, claim, subject, proof_level, evidence, last_verified_at
       from ros_proof_ledger
       order by proof_level desc, last_verified_at desc`,
  );
  return r.rows.map((row) => ({
    claimId: String(row.claim_id),
    claim: String(row.claim),
    subject: String(row.subject),
    proofLevel: row.proof_level as CapabilityProofLevel,
    evidence: (row.evidence ?? []) as Array<Record<string, unknown>>,
    lastVerifiedAt: row.last_verified_at?.toISOString?.() ?? String(row.last_verified_at),
  }));
}
