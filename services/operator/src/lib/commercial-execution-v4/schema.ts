/**
 * Commercial Execution Engine v4 — durable schema.
 * Internal work is not commercial execution. Only rows in
 * ros_commercial_actions with external_or_internal='external'
 * and executed=true count as reaching the world.
 */

import type pg from "pg";

export const CEE_VERSION = "commercial-execution-v4.12";

export async function ensureCommercialExecutionSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_commercial_actions (
      id text primary key,
      business_id text not null,
      created_at timestamptz not null default now(),
      channel text not null,
      action_type text not null,
      target text not null default '',
      external_or_internal text not null,
      attempted boolean not null default true,
      executed boolean not null default false,
      verified boolean not null default false,
      verification_method text not null default '',
      cost_usd numeric not null default 0,
      human_exposure_possible boolean not null default false,
      result text not null default '',
      response text not null default '',
      lead_created boolean not null default false,
      checkout_created boolean not null default false,
      purchase_created boolean not null default false,
      failure_reason text not null default '',
      retryable boolean not null default false,
      next_action text not null default '',
      meta jsonb not null default '{}'::jsonb
    );
    create index if not exists ros_commercial_actions_biz_idx
      on ros_commercial_actions (business_id, created_at desc);
    create index if not exists ros_commercial_actions_ext_idx
      on ros_commercial_actions (external_or_internal, executed, created_at desc);

    create table if not exists ros_failure_patterns (
      fingerprint text primary key,
      business_id text not null,
      strategy text not null,
      channel text not null,
      target text not null default '',
      failure_reason text not null,
      result text not null default '',
      hits integer not null default 1,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      abandoned boolean not null default false,
      escalation text not null default 'retry',
      meta jsonb not null default '{}'::jsonb
    );
    create index if not exists ros_failure_patterns_biz_idx
      on ros_failure_patterns (business_id, last_seen_at desc);

    create table if not exists ros_exposure_clock (
      scope text primary key,
      minutes_since_last_external_commercial_action numeric,
      minutes_since_last_verified_human numeric,
      minutes_since_last_lead numeric,
      minutes_since_last_checkout numeric,
      minutes_since_last_purchase numeric,
      last_external_at timestamptz,
      last_human_at timestamptz,
      last_lead_at timestamptz,
      last_checkout_at timestamptz,
      last_purchase_at timestamptz,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_funnel_truth (
      business_id text primary key,
      external_actions integer not null default 0,
      exposures integer not null default 0,
      verified_humans integer not null default 0,
      engagements integer not null default 0,
      leads integer not null default 0,
      checkouts integer not null default 0,
      purchases integer not null default 0,
      revenue_usd numeric not null default 0,
      earliest_broken_stage text not null default 'EXTERNAL_ACTION',
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_channel_graph (
      id text primary key,
      business_id text not null,
      channel_class text not null,
      surface text not null default '',
      allowed boolean,
      account_needed boolean,
      automation_allowed boolean,
      cost_usd numeric not null default 0,
      expected_buyer_quality numeric,
      time_to_exposure_minutes numeric,
      attempts integer not null default 0,
      real_exposures integer not null default 0,
      leads integer not null default 0,
      checkouts integer not null default 0,
      revenue_usd numeric not null default 0,
      last_result text not null default '',
      last_attempt_at timestamptz,
      updated_at timestamptz not null default now()
    );
    create unique index if not exists ros_channel_graph_uniq
      on ros_channel_graph (business_id, channel_class, surface);

    create table if not exists ros_lane_heartbeats (
      lane text primary key,
      last_beat_at timestamptz not null default now(),
      last_ok boolean not null default true,
      last_error text not null default '',
      stalls integer not null default 0,
      recoveries integer not null default 0,
      meta jsonb not null default '{}'::jsonb
    );

    create table if not exists ros_offer_economics (
      business_id text primary key,
      price_usd numeric,
      tenk_customers_per_day numeric,
      tenk_path text not null default 'UNKNOWN',
      recommended_model text not null default '',
      evidence text not null default '',
      applied boolean not null default false,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_cee_mode (
      id text primary key default 'current',
      zero_exposure boolean not null default true,
      first_real_customer boolean not null default true,
      commercial_execution_ratio numeric not null default 0,
      last_intervention text not null default '',
      updated_at timestamptz not null default now()
    );
    insert into ros_cee_mode (id) values ('current') on conflict (id) do nothing;

    create table if not exists ros_commercial_contacts (
      email text primary key,
      source_url text not null default '',
      business_id text not null default '',
      method text not null default 'mailto',
      created_at timestamptz not null default now(),
      last_attempted_at timestamptz,
      last_result text not null default ''
    );
    create index if not exists ros_commercial_contacts_biz_idx
      on ros_commercial_contacts (business_id, created_at desc);

    create table if not exists ros_hunt_cursor (
      id text primary key,
      query_index integer not null default 0,
      pages_fetched bigint not null default 0,
      contacts_stored bigint not null default 0,
      last_engine text not null default '',
      updated_at timestamptz not null default now()
    );
    insert into ros_hunt_cursor (id) values ('web') on conflict (id) do nothing;

    create table if not exists ros_channel_memory (
      id text primary key,
      host text not null,
      business_id text not null,
      family text not null default '',
      utm_key text not null default '',
      listed_at timestamptz,
      last_result text not null default '',
      attempts integer not null default 0,
      humans integer not null default 0,
      checkouts integer not null default 0,
      purchases integer not null default 0,
      revenue_usd numeric not null default 0,
      verdict text not null default 'UNTRIED',
      score numeric not null default 0,
      reason text not null default '',
      updated_at timestamptz not null default now()
    );
    create unique index if not exists ros_channel_memory_pair
      on ros_channel_memory (host, business_id);
    create index if not exists ros_channel_memory_verdict_idx
      on ros_channel_memory (verdict, score desc);
  `);
}
