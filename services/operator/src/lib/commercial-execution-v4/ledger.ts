/**
 * Commercial action ledger + exposure clocks + funnel truth.
 * Planned/intended/generated work is not recorded as executed external action.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";
import { ensureCommercialExecutionSchema } from "./schema.js";

export type CommercialActionInput = {
  businessId: string;
  channel: string;
  actionType: string;
  target?: string;
  external: boolean;
  attempted?: boolean;
  executed: boolean;
  verified?: boolean;
  verificationMethod?: string;
  costUsd?: number;
  humanExposurePossible: boolean;
  result: string;
  response?: string;
  leadCreated?: boolean;
  checkoutCreated?: boolean;
  purchaseCreated?: boolean;
  failureReason?: string;
  retryable?: boolean;
  nextAction?: string;
  meta?: Record<string, unknown>;
};

function id(): string {
  return `cact_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export async function recordCommercialAction(
  pool: pg.Pool,
  input: CommercialActionInput,
): Promise<string> {
  await ensureCommercialExecutionSchema(pool);
  const rowId = id();
  await pool.query(
    `insert into ros_commercial_actions (
       id, business_id, channel, action_type, target, external_or_internal,
       attempted, executed, verified, verification_method, cost_usd,
       human_exposure_possible, result, response, lead_created, checkout_created,
       purchase_created, failure_reason, retryable, next_action, meta
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb
     )`,
    [
      rowId,
      input.businessId,
      input.channel,
      input.actionType,
      input.target ?? "",
      input.external ? "external" : "internal",
      input.attempted !== false,
      input.executed,
      input.verified === true,
      input.verificationMethod ?? "",
      input.costUsd ?? 0,
      input.humanExposurePossible,
      input.result.slice(0, 240),
      (input.response ?? "").slice(0, 500),
      input.leadCreated === true,
      input.checkoutCreated === true,
      input.purchaseCreated === true,
      input.failureReason ?? "",
      input.retryable === true,
      input.nextAction ?? "",
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return rowId;
}

function minutesSince(ts: Date | null): number | null {
  if (!ts) return null;
  return Math.max(0, (Date.now() - ts.getTime()) / 60_000);
}

export type ExposureClock = {
  scope: string;
  minutesSinceLastExternalCommercialAction: number | null;
  minutesSinceLastVerifiedHuman: number | null;
  minutesSinceLastLead: number | null;
  minutesSinceLastCheckout: number | null;
  minutesSinceLastPurchase: number | null;
  lastExternalAt: string | null;
  lastHumanAt: string | null;
};

export async function refreshExposureClock(
  pool: pg.Pool,
  scope: string,
): Promise<ExposureClock> {
  await ensureCommercialExecutionSchema(pool);
  const biz = scope === "portfolio" ? null : scope;

  const ext = await pool.query(
    `select max(created_at) as t from ros_commercial_actions
      where executed=true and external_or_internal='external'
        and human_exposure_possible=true
        ${biz ? "and business_id=$1" : ""}`,
    biz ? [biz] : [],
  );
  const human = await pool.query(
    `select max(created_at) as t from ros_traffic_events
      where class='VERIFIED_HUMAN_SIGNAL'
        ${biz ? "and business_id=$1" : ""}`,
    biz ? [biz] : [],
  ).catch(() => ({ rows: [{ t: null }] }));
  const lead = await pool.query(
    `select max(created_at) as t from ros_commercial_actions
      where lead_created=true ${biz ? "and business_id=$1" : ""}`,
    biz ? [biz] : [],
  );
  const checkout = await pool.query(
    `select max(created_at) as t from ros_commercial_actions
      where checkout_created=true ${biz ? "and business_id=$1" : ""}`,
    biz ? [biz] : [],
  );
  const purchase = await pool.query(
    `select max(created_at) as t from ros_customer_events
      where kind='PAYMENT_SUCCEEDED' ${biz ? "and business_id=$1" : ""}`,
    biz ? [biz] : [],
  ).catch(() => ({ rows: [{ t: null }] }));

  const lastExternal = ext.rows[0]?.t ? new Date(ext.rows[0].t) : null;
  const lastHuman = human.rows[0]?.t ? new Date(human.rows[0].t) : null;
  const lastLead = lead.rows[0]?.t ? new Date(lead.rows[0].t) : null;
  const lastCheckout = checkout.rows[0]?.t ? new Date(checkout.rows[0].t) : null;
  const lastPurchase = purchase.rows[0]?.t ? new Date(purchase.rows[0].t) : null;

  const clock: ExposureClock = {
    scope,
    minutesSinceLastExternalCommercialAction: minutesSince(lastExternal),
    minutesSinceLastVerifiedHuman: minutesSince(lastHuman),
    minutesSinceLastLead: minutesSince(lastLead),
    minutesSinceLastCheckout: minutesSince(lastCheckout),
    minutesSinceLastPurchase: minutesSince(lastPurchase),
    lastExternalAt: lastExternal?.toISOString() ?? null,
    lastHumanAt: lastHuman?.toISOString() ?? null,
  };

  await pool.query(
    `insert into ros_exposure_clock (
       scope, minutes_since_last_external_commercial_action,
       minutes_since_last_verified_human, minutes_since_last_lead,
       minutes_since_last_checkout, minutes_since_last_purchase,
       last_external_at, last_human_at, last_lead_at, last_checkout_at,
       last_purchase_at, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (scope) do update set
       minutes_since_last_external_commercial_action=excluded.minutes_since_last_external_commercial_action,
       minutes_since_last_verified_human=excluded.minutes_since_last_verified_human,
       minutes_since_last_lead=excluded.minutes_since_last_lead,
       minutes_since_last_checkout=excluded.minutes_since_last_checkout,
       minutes_since_last_purchase=excluded.minutes_since_last_purchase,
       last_external_at=excluded.last_external_at,
       last_human_at=excluded.last_human_at,
       last_lead_at=excluded.last_lead_at,
       last_checkout_at=excluded.last_checkout_at,
       last_purchase_at=excluded.last_purchase_at,
       updated_at=now()`,
    [
      scope,
      clock.minutesSinceLastExternalCommercialAction,
      clock.minutesSinceLastVerifiedHuman,
      clock.minutesSinceLastLead,
      clock.minutesSinceLastCheckout,
      clock.minutesSinceLastPurchase,
      lastExternal?.toISOString() ?? null,
      lastHuman?.toISOString() ?? null,
      lastLead?.toISOString() ?? null,
      lastCheckout?.toISOString() ?? null,
      lastPurchase?.toISOString() ?? null,
    ],
  );
  return clock;
}

export const FUNNEL_STAGES = [
  "EXTERNAL_ACTION",
  "EXPOSURE",
  "VERIFIED_HUMAN",
  "ENGAGEMENT",
  "LEAD",
  "CHECKOUT",
  "PURCHASE",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export function earliestBrokenStage(counts: {
  externalActions: number;
  exposures: number;
  verifiedHumans: number;
  engagements: number;
  leads: number;
  checkouts: number;
  purchases: number;
}): FunnelStage {
  if (counts.externalActions <= 0) return "EXTERNAL_ACTION";
  if (counts.exposures <= 0 && counts.verifiedHumans <= 0) return "EXPOSURE";
  if (counts.verifiedHumans <= 0) return "VERIFIED_HUMAN";
  if (counts.engagements <= 0) return "ENGAGEMENT";
  if (counts.leads <= 0) return "LEAD";
  if (counts.checkouts <= 0) return "CHECKOUT";
  if (counts.purchases <= 0) return "PURCHASE";
  return "PURCHASE";
}

export async function refreshFunnelTruth(
  pool: pg.Pool,
  businessId: string,
): Promise<{ stage: FunnelStage; counts: Record<string, number> }> {
  await ensureCommercialExecutionSchema(pool);
  const ext = await pool.query(
    `select count(*)::int as n from ros_commercial_actions
      where business_id=$1 and executed=true and external_or_internal='external'
        and human_exposure_possible=true`,
    [businessId],
  );
  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events
      where business_id=$1 and class='VERIFIED_HUMAN_SIGNAL'`,
    [businessId],
  ).catch(() => ({ rows: [{ n: 0 }] }));
  const leads = await pool.query(
    `select count(*)::int as n from ros_commercial_actions
      where business_id=$1 and lead_created=true`,
    [businessId],
  );
  const checkouts = await pool.query(
    `select count(*)::int as n from ros_commercial_actions
      where business_id=$1 and checkout_created=true`,
    [businessId],
  );
  const purchases = await pool.query(
    `select count(*)::int as n from ros_customer_events
      where business_id=$1 and kind='PAYMENT_SUCCEEDED'`,
    [businessId],
  ).catch(() => ({ rows: [{ n: 0 }] }));
  const rev = await pool.query(
    `select coalesce(sum(amount_usd),0) as r from ros_customer_events
      where business_id=$1 and kind='PAYMENT_SUCCEEDED'`,
    [businessId],
  ).catch(() => ({ rows: [{ r: 0 }] }));

  const counts = {
    externalActions: Number(ext.rows[0]?.n ?? 0),
    exposures: Number(humans.rows[0]?.n ?? 0),
    verifiedHumans: Number(humans.rows[0]?.n ?? 0),
    engagements: 0,
    leads: Number(leads.rows[0]?.n ?? 0),
    checkouts: Number(checkouts.rows[0]?.n ?? 0),
    purchases: Number(purchases.rows[0]?.n ?? 0),
  };
  const stage = earliestBrokenStage(counts);
  await pool.query(
    `insert into ros_funnel_truth (
       business_id, external_actions, exposures, verified_humans, engagements,
       leads, checkouts, purchases, revenue_usd, earliest_broken_stage, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     on conflict (business_id) do update set
       external_actions=excluded.external_actions,
       exposures=excluded.exposures,
       verified_humans=excluded.verified_humans,
       leads=excluded.leads,
       checkouts=excluded.checkouts,
       purchases=excluded.purchases,
       revenue_usd=excluded.revenue_usd,
       earliest_broken_stage=excluded.earliest_broken_stage,
       updated_at=now()`,
    [
      businessId,
      counts.externalActions,
      counts.exposures,
      counts.verifiedHumans,
      counts.engagements,
      counts.leads,
      counts.checkouts,
      counts.purchases,
      Number(rev.rows[0]?.r ?? 0),
      stage,
    ],
  );
  return { stage, counts };
}

export async function commercialExecutionRatio(
  pool: pg.Pool,
  windowMinutes = 60,
): Promise<{ ratio: number; external: number; total: number }> {
  const r = await pool.query(
    `select
       count(*) filter (where external_or_internal='external' and executed=true)::int as ext,
       count(*)::int as total
     from ros_commercial_actions
     where created_at > now() - ($1 || ' minutes')::interval`,
    [String(windowMinutes)],
  );
  const external = Number(r.rows[0]?.ext ?? 0);
  const total = Number(r.rows[0]?.total ?? 0);
  const ratio = total === 0 ? 0 : external / total;
  await pool.query(
    `update ros_cee_mode set commercial_execution_ratio=$1, updated_at=now() where id='current'`,
    [ratio],
  );
  return { ratio, external, total };
}

export function shouldEnterZeroExposure(clock: ExposureClock): boolean {
  const m = clock.minutesSinceLastVerifiedHuman;
  return m === null || m >= 60;
}

export function polishAllowed(clock: ExposureClock): boolean {
  const humans = clock.minutesSinceLastVerifiedHuman;
  return humans !== null && humans < 24 * 60;
}
