/**
 * Organ 3 — AUTOMATIC CURRICULUM.
 *
 * Tracks M1–M9 milestones. Status is derived from live evidence, never
 * hand-set. Any milestone whose evidence disappears returns to PENDING.
 */

import type pg from "pg";
import type { CurriculumMilestone, Logger } from "./types.js";

type MilestoneDef = {
  id: string;
  description: string;
  evidenceQuery: string;
};

const MILESTONES: MilestoneDef[] = [
  {
    id: "M1_NEW_THIRD_PARTY_ACTUATOR",
    description: "One new third-party actuator (any real external channel).",
    evidenceQuery: `select count(*)::int as n from aq_distribution_receipts
                    where status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED','PUBLISHED')
                      and external_action not in ('publish_owned_intent_page','publish_owned_page',
                          'owned_publish','portfolio_crosslink_publish','publish_free_utility')
                      and created_at > now() - interval '30 days'`,
  },
  {
    id: "M2_LEGITIMATE_EXTERNAL_EFFECT",
    description: "One legitimate external effect verified (SENT/ACCEPTED receipt to an external destination).",
    evidenceQuery: `select count(*)::int as n from aq_distribution_receipts
                    where status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED')
                      and external_destination is not null
                      and executor_type not in ('PORTFOLIO_CROSSLINK','CONTENT_PUBLISH')
                      and external_action not in ('publish_owned_intent_page','publish_owned_page',
                          'owned_publish','portfolio_crosslink_publish','publish_free_utility')
                      and created_at > now() - interval '30 days'`,
  },
  {
    id: "M3_VERIFIED_AUDIENCE_EXPOSURE",
    description: "One verified public artifact on a third-party (non-owned) audience surface.",
    evidenceQuery: `select count(*)::int as n from aq_distribution_receipts r
                    where r.status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED')
                      and r.external_action not in ('publish_owned_intent_page','publish_owned_page',
                          'owned_publish','portfolio_crosslink_publish','publish_free_utility')
                      and r.executor_type not in ('PORTFOLIO_CROSSLINK','CONTENT_PUBLISH')
                      and r.channel_surface_id is not null
                      and exists (
                        select 1 from aq_channel_surfaces s
                         where s.channel_surface_id = r.channel_surface_id
                           and coalesce(s.platform,'') not in ('owned','')
                           and coalesce(s.platform,'') not ilike '%owned%'
                      )
                      and r.created_at > now() - interval '60 days'`,
  },
  {
    id: "M4_REAL_EXTERNAL_HUMAN",
    description: "One verified external human visitor.",
    evidenceQuery: `select count(*)::int as n from ros_traffic_events
                    where class = 'VERIFIED_HUMAN_SIGNAL'
                      and created_at > now() - interval '30 days'`,
  },
  {
    id: "M5_ONE_ENGAGEMENT",
    description: "One qualified human engagement.",
    evidenceQuery: `select count(*)::int as n from ros_traffic_events
                    where class = 'VERIFIED_HUMAN_SIGNAL'
                      and qualified = true
                      and created_at > now() - interval '30 days'`,
  },
  {
    id: "M6_ONE_COMMERCIAL_INTENT",
    description: "One commercial intent signal (checkout start, reply-to-buy, etc.).",
    evidenceQuery: `select count(*)::int as n from ros_customer_events
                    where kind in ('INTENT_SIGNAL','CHECKOUT_STARTED')
                      and created_at > now() - interval '30 days'`,
  },
  {
    id: "M7_ONE_CUSTOMER",
    description: "One customer (paid or committed).",
    evidenceQuery: `select count(*)::int as n from ros_customer_events
                    where kind in ('PAYMENT_SUCCEEDED','CHECKOUT_COMPLETED')
                      and created_at > now() - interval '90 days'`,
  },
  {
    id: "M8_SECOND_CUSTOMER_SAME_MECHANISM",
    description: "Second customer via the same causal mechanism.",
    evidenceQuery: `select count(*)::int as n from ros_customer_events
                    where kind in ('PAYMENT_SUCCEEDED','CHECKOUT_COMPLETED')
                      and created_at > now() - interval '90 days'`,
  },
  {
    id: "M9_POSITIVE_CONTRIBUTION_PROFIT",
    description: "Positive contribution profit.",
    evidenceQuery: `select 0::int as n`,
  },
];

export async function refreshCurriculum(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ achieved: number; pending: number; highest: string | null }> {
  let achieved = 0;
  let pending = 0;
  let highest: string | null = null;
  for (const m of MILESTONES) {
    let n = 0;
    try {
      const r = await pool.query(m.evidenceQuery);
      n = Number(r.rows[0]?.n ?? 0);
    } catch {
      n = 0;
    }
    const status = n > 0 ? "ACHIEVED" : "PENDING";
    if (status === "ACHIEVED") {
      achieved++;
      highest = m.id;
    } else pending++;

    await pool.query(
      `insert into ros_curriculum_state
         (milestone_id, description, status, achieved_at, evidence, updated_at)
       values ($1,$2,$3, case when $3='ACHIEVED' then now() else null end,
               $4::jsonb, now())
       on conflict (milestone_id) do update set
         description = excluded.description,
         status = excluded.status,
         achieved_at = case
                         when excluded.status='ACHIEVED' and ros_curriculum_state.achieved_at is null then now()
                         when excluded.status='PENDING' then null
                         else ros_curriculum_state.achieved_at
                       end,
         evidence = excluded.evidence,
         updated_at = now()`,
      [m.id, m.description, status, JSON.stringify({ count: n })],
    );
  }
  logger("info", "ultron.curriculum.refresh", { achieved, pending, highest });
  return { achieved, pending, highest };
}

export async function listMilestones(pool: pg.Pool): Promise<CurriculumMilestone[]> {
  const r = await pool.query(
    `select milestone_id, description, status, achieved_at
       from ros_curriculum_state
       order by milestone_id asc`,
  );
  return r.rows.map((row) => ({
    id: String(row.milestone_id),
    description: String(row.description),
    status: row.status as CurriculumMilestone["status"],
    achievedAt: row.achieved_at?.toISOString?.() ?? null,
  }));
}
