/**
 * FIX 7 — Action verification with honest outcomes.
 *
 * Closed-loop health must distinguish resolution from verification.
 * Timer expiry is EXPIRED_UNVERIFIED, not success.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";

export type VerificationOutcome =
  | "STILL_OPEN"
  | "VERIFIED_SUCCESS"
  | "VERIFIED_FAILURE"
  | "EXPIRED_UNVERIFIED"
  | "ORPHANED"
  | "SUPERSEDED"
  | "REMEDIATED";

type PlanRow = {
  externalAction: string;
  expectedSignal: string;
  waitHours: number;
  successQuery: string;
  failureQuery: string | null;
  remediation: string | null;
};

const PLANS: PlanRow[] = [
  {
    externalAction: "attributed_email_partnership_pitch",
    expectedSignal: "trusted_inbound_reply_or_verified_human",
    waitHours: 72,
    successQuery: `
      select 1 from ros_inbound_webhooks i
        where i.trust_status = 'TRUSTED' and i.created_at > $2::timestamptz
      union
      select 1 from ros_traffic_events t
        where t.business_id = $1 and t.class = 'VERIFIED_HUMAN_SIGNAL'
          and t.created_at > $2::timestamptz
      limit 1`,
    failureQuery: null,
    remediation: "If no trusted signal within 72h, deprioritize this contact class.",
  },
  {
    externalAction: "publish_owned_intent_page",
    expectedSignal: "http_200_public_render",
    waitHours: 2,
    successQuery: `
      select 1 from aq_distribution_receipts r
        where r.action_id = $1
          and coalesce(r.public_url,'') <> ''
        limit 1`,
    failureQuery: null,
    remediation: "Owned-domain publish verifies availability, not E5.",
  },
  {
    externalAction: "portfolio_crosslink_publish",
    expectedSignal: "cross_link_exists_on_source",
    waitHours: 6,
    successQuery: `select 1 from aq_distribution_receipts where action_id = $1
                     and coalesce(public_url,'') <> '' limit 1`,
    failureQuery: null,
    remediation: "Owned-domain cross-link — does not advance E5.",
  },
  {
    externalAction: "third_party_directory_listing",
    expectedSignal: "verified_public_artifact_on_third_party",
    waitHours: 168,
    successQuery: `select 1 from aq_distribution_receipts where action_id = $1
                     and status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED')
                     and coalesce(public_url,'') <> '' limit 1`,
    failureQuery: null,
    remediation: "Escalate to browser-operator verification of the destination URL.",
  },
  {
    externalAction: "browser_submit_permitted_listing",
    expectedSignal: "artifact_present_on_platform",
    waitHours: 48,
    successQuery: `select 1 from ros_browser_actions a
                     where a.session_id = $1
                       and a.result = 'SUCCESS' limit 1`,
    failureQuery: null,
    remediation: "Retry with browser-operator verification skill.",
  },
];

async function setOutcome(
  pool: pg.Pool,
  defectId: string,
  outcome: VerificationOutcome,
  detailExtra: string,
): Promise<void> {
  const closed = outcome !== "STILL_OPEN";
  await pool.query(
    `update ros_closed_loop_defects
        set verification_outcome = $2,
            status = case when $3 then 'CLOSED' else 'OPEN' end,
            resolved_at = case when $3 then now() else resolved_at end,
            last_seen_at = now(),
            detail = coalesce(detail,'') || $4
      where defect_id = $1`,
    [defectId, outcome, closed, ` [${outcome}: ${detailExtra}]`],
  );
}

export async function seedVerificationPlans(
  pool: pg.Pool,
  logger: Logger,
): Promise<number> {
  let seeded = 0;
  for (const p of PLANS) {
    await pool.query(
      `insert into ros_action_verification_plan
         (plan_id, external_action, expected_signal, wait_hours,
          success_query, failure_query, remediation, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (plan_id) do update set
         expected_signal = excluded.expected_signal,
         wait_hours = excluded.wait_hours,
         success_query = excluded.success_query,
         failure_query = excluded.failure_query,
         remediation = excluded.remediation,
         updated_at = now()`,
      [
        `vp_${p.externalAction}`,
        p.externalAction,
        p.expectedSignal,
        p.waitHours,
        p.successQuery,
        p.failureQuery,
        p.remediation,
      ],
    );
    seeded++;
  }
  logger("info", "ultron.verification.plans_seeded", { seeded });
  return seeded;
}

export async function auditMisclosedDefects(pool: pg.Pool, logger: Logger): Promise<number> {
  // Reclassify previously RESOLVED ACTION_WITHOUT_VERIFICATION that were
  // closed because a timer expired or no plan existed.
  const r = await pool.query(
    `update ros_closed_loop_defects
        set verification_outcome = case
              when detail ilike '%[verified via%' then 'VERIFIED_SUCCESS'
              when detail ilike '%WINDOW_EXCEEDED%' then 'EXPIRED_UNVERIFIED'
              when detail ilike '%no verification plan%' then 'SUPERSEDED'
              when status = 'RESOLVED' then 'ORPHANED'
              else coalesce(verification_outcome, 'STILL_OPEN')
            end,
            status = case
              when detail ilike '%[verified via%' then 'CLOSED'
              when detail ilike '%WINDOW_EXCEEDED%' then 'CLOSED'
              when detail ilike '%no verification plan%' then 'CLOSED'
              when status = 'RESOLVED' then 'CLOSED'
              else status
            end
      where kind = 'ACTION_WITHOUT_VERIFICATION'
        and verification_outcome is null
      returning defect_id`,
  );
  logger("info", "ultron.verification.audit_misclosed", { n: r.rowCount ?? 0 });
  return r.rowCount ?? 0;
}

export async function sweepUnverifiedActions(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ verified: number; expired: number; orphaned: number; stillOpen: number }> {
  let verified = 0;
  let expired = 0;
  let orphaned = 0;
  let stillOpen = 0;

  await auditMisclosedDefects(pool, logger);

  const defects = await pool.query(
    `select d.defect_id, d.subject
       from ros_closed_loop_defects d
      where d.status = 'OPEN'
        and d.kind = 'ACTION_WITHOUT_VERIFICATION'
        and coalesce(d.verification_outcome, 'STILL_OPEN') = 'STILL_OPEN'
      limit 100`,
  );

  for (const d of defects.rows) {
    const actionId = String(d.subject);
    const receipt = await pool.query(
      `select action_id, business_id, external_action, created_at, request_result
         from aq_distribution_receipts where action_id = $1`,
      [actionId],
    );
    if (receipt.rowCount === 0) {
      await setOutcome(pool, d.defect_id, "ORPHANED", "no matching receipt");
      orphaned++;
      continue;
    }

    const row = receipt.rows[0];
    const plan = await pool.query(
      `select expected_signal, wait_hours, success_query, remediation
         from ros_action_verification_plan
        where external_action = $1`,
      [row.external_action],
    );

    if (plan.rowCount === 0) {
      await setOutcome(pool, d.defect_id, "SUPERSEDED", `no verification plan for ${row.external_action}`);
      continue;
    }

    const p = plan.rows[0];
    const params =
      String(p.success_query).includes("$2::timestamptz")
        ? [row.business_id, row.created_at]
        : [actionId];
    let ok = false;
    try {
      const r = await pool.query(String(p.success_query), params);
      ok = (r.rowCount ?? 0) > 0;
    } catch {
      ok = false;
    }
    if (ok) {
      await setOutcome(pool, d.defect_id, "VERIFIED_SUCCESS", String(p.expected_signal));
      verified++;
      continue;
    }

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const waitMs = Number(p.wait_hours) * 3_600_000;
    if (ageMs > waitMs) {
      await setOutcome(pool, d.defect_id, "EXPIRED_UNVERIFIED", String(p.remediation ?? "window exceeded"));
      expired++;
      await pool.query(
        `insert into ros_cursor_lessons
           (lesson_id, taxonomy, summary, detail, procedure, applies_to,
            first_seen_at, confidence)
         values ($1, 'ACTION_UNVERIFIED_WINDOW_EXCEEDED', $2, $3, $4::jsonb,
                 array[$5], now(), 'MEDIUM')
         on conflict (lesson_id) do nothing`,
        [
          `lsn_unverified_${row.external_action}`,
          `${row.external_action} produced no ${p.expected_signal} within window`,
          `Action ${actionId} for ${row.business_id} sent without downstream signal. Outcome=EXPIRED_UNVERIFIED, not success.`,
          JSON.stringify({ remediation: p.remediation, waitHours: p.wait_hours }),
          row.external_action,
        ],
      );
      continue;
    }
    stillOpen++;
  }

  logger("info", "ultron.verification.sweep", { verified, expired, orphaned, stillOpen });
  return { verified, expired, orphaned, stillOpen };
}
