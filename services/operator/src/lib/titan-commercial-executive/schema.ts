import type pg from "pg";

export async function ensureCommercialExecutiveTables(
  pool: pg.Pool,
): Promise<void> {
  await pool.query(`
    create table if not exists titan_business_commercial_missions (
      business_id text primary key,
      mission text not null,
      target_daily_revenue numeric not null default 10000,
      current_real_daily_revenue numeric not null default 0,
      real_customers int not null default 0,
      real_purchases int not null default 0,
      qualified_visits int not null default 0,
      checkout_starts int not null default 0,
      primary_bottleneck text,
      secondary_bottleneck text,
      buyer text,
      offer text,
      price_usd numeric,
      revenue_model text,
      best_channel text,
      current_experiment text,
      next_action text,
      confidence numeric not null default 0.4,
      distance_to_goal numeric not null default 10000,
      last_meaningful_progress_at timestamptz,
      last_external_action_at timestamptz,
      last_new_audience_at timestamptz,
      commercial_velocity numeric not null default 0,
      commercial_pressure numeric not null default 0,
      funnel_rung text,
      acquisition_state text not null default 'UNKNOWN',
      first_human_war_mode boolean not null default true,
      document jsonb not null default '{}'::jsonb,
      status text not null default 'ACTIVE',
      updated_at timestamptz not null default now()
    );

    create table if not exists titan_commercial_progress_events (
      id text primary key,
      business_id text not null,
      event_kind text not null,
      is_theater boolean not null default false,
      is_new_audience boolean not null default false,
      detail text,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists titan_commercial_progress_biz_idx
      on titan_commercial_progress_events (business_id, created_at desc);
    create index if not exists titan_commercial_progress_kind_idx
      on titan_commercial_progress_events (event_kind, created_at desc);

    create table if not exists titan_commercial_stagnation_incidents (
      id text primary key,
      business_id text not null,
      kind text not null,
      diagnosis jsonb not null,
      escalation text,
      status text not null default 'OPEN',
      created_at timestamptz not null default now(),
      resolved_at timestamptz
    );
    create index if not exists titan_commercial_stagnation_open_idx
      on titan_commercial_stagnation_incidents (status, created_at desc);

    create table if not exists titan_commercial_executive_cycles (
      id text primary key,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      summary jsonb not null default '{}'::jsonb
    );

    create table if not exists titan_acquisition_capability_gaps (
      id text primary key,
      business_id text,
      gap text not null,
      evidence jsonb not null default '[]'::jsonb,
      expected_value text,
      proposed_capability text,
      status text not null default 'OPEN',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    -- Extend distribution receipts with new_audience flag when missing
    alter table aq_distribution_receipts
      add column if not exists is_new_audience boolean not null default false;
  `);

  // Correct prior theater mis-labeled as distribution
  await pool.query(`
    update aq_distribution_receipts
    set counts_as_distribution = false,
        is_new_audience = false
    where external_action in (
      'websub_publish','portfolio_crosslink_publish','publish_owned_intent_page',
      'indexnow_submit','feed_publish'
    );
  `);
}
