import { randomBytes } from "node:crypto";
import type pg from "pg";

/** Theater — never commercial progress. */
export const THEATER_KINDS = new Set([
  "self_http_probe",
  "health_check",
  "operator_tick",
  "research_count",
  "claim_stored",
  "sitemap_create",
  "indexnow_submit",
  "rss_generation",
  "websub_publish",
  "portfolio_crosslink_publish",
  "dashboard_update",
  "code_deployment",
  "business_admission",
  "content_without_external_exposure",
  "publish_owned_intent_page",
  "feed_publish",
]);

/** Meaningful commercial progress only. */
export const PROGRESS_KINDS = new Set([
  "new_audience_distribution",
  "exposure_verified",
  "external_impression",
  "human_visit",
  "qualified_human",
  "lead",
  "reply",
  "cta",
  "checkout",
  "purchase",
  "revenue",
  "repeat_purchase",
  "referral",
  "validated_channel_learning",
  "validated_business_improvement",
  "strategy_escalation",
  "economic_remodel",
  "capability_gap_closed",
]);

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export async function recordCommercialProgress(
  pool: pg.Pool,
  input: {
    businessId: string;
    eventKind: string;
    detail?: string;
    isNewAudience?: boolean;
    meta?: Record<string, unknown>;
  },
): Promise<{ id: string; accepted: boolean; theater: boolean }> {
  const theater = THEATER_KINDS.has(input.eventKind);
  const accepted = !theater && PROGRESS_KINDS.has(input.eventKind);
  const id = eid("cpe");
  await pool.query(
    `insert into titan_commercial_progress_events
     (id, business_id, event_kind, is_theater, is_new_audience, detail, meta)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      id,
      input.businessId,
      input.eventKind,
      theater || !accepted,
      Boolean(input.isNewAudience) && accepted,
      input.detail ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  if (accepted) {
    await pool.query(
      `update titan_business_commercial_missions set
         last_meaningful_progress_at = now(),
         last_external_action_at = case when $2 then now() else last_external_action_at end,
         last_new_audience_at = case when $3 then now() else last_new_audience_at end,
         updated_at = now()
       where business_id=$1`,
      [input.businessId, accepted, Boolean(input.isNewAudience)],
    );
  }
  return { id, accepted, theater: theater || !accepted };
}
