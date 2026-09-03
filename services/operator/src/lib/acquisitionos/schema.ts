import type pg from "pg";

export async function ensureAcquisitionOsTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists aq_channel_surfaces (
      channel_surface_id text primary key,
      channel_family text not null,
      platform text not null,
      surface_name text not null,
      surface_url text not null,
      canonical_key text not null,
      audience text,
      buyer_role text,
      market text,
      topic text,
      business_fit numeric not null default 0.5,
      commercial_intent numeric not null default 0.5,
      estimated_reach numeric not null default 0,
      estimated_relevance numeric not null default 0.5,
      cost text not null default 'free',
      account_required boolean not null default false,
      credential_required boolean not null default false,
      api_available boolean not null default false,
      automation_allowed boolean not null default false,
      manual_action_required boolean not null default true,
      posting_allowed boolean,
      promotion_allowed boolean,
      link_allowed boolean,
      rate_limits text,
      platform_rules text,
      risk text not null default 'medium',
      execution_class text not null default 'UNKNOWN',
      executor_type text not null default 'OWNER_ACTION',
      status text not null default 'DISCOVERED',
      confidence numeric not null default 0.4,
      impressions bigint not null default 0,
      visits bigint not null default 0,
      qualified_visits bigint not null default 0,
      leads bigint not null default 0,
      checkout_starts bigint not null default 0,
      purchases bigint not null default 0,
      revenue_usd numeric not null default 0,
      attempt_count int not null default 0,
      failure_count int not null default 0,
      last_used_at timestamptz,
      historical_results jsonb not null default '[]'::jsonb,
      business_ids text[] not null default '{}',
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index if not exists aq_channel_surfaces_canonical_uidx
      on aq_channel_surfaces (canonical_key);
    create index if not exists aq_channel_surfaces_family_idx
      on aq_channel_surfaces (channel_family, status);
    create index if not exists aq_channel_surfaces_exec_idx
      on aq_channel_surfaces (execution_class, status);

    create table if not exists aq_business_surfaces (
      business_id text not null,
      channel_surface_id text not null references aq_channel_surfaces(channel_surface_id),
      fit_score numeric not null default 0.5,
      priority int not null default 100,
      status text not null default 'CANDIDATE',
      last_experiment_id text,
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      primary key (business_id, channel_surface_id)
    );

    create table if not exists aq_buyer_habitats (
      business_id text primary key,
      document jsonb not null,
      clarity_score numeric not null default 0,
      updated_at timestamptz not null default now()
    );

    create table if not exists aq_distribution_receipts (
      action_id text primary key,
      business_id text not null,
      channel_surface_id text,
      buyer text,
      hypothesis text,
      asset_id text,
      external_destination text not null,
      external_action text not null,
      executor_type text not null,
      request_result jsonb not null default '{}'::jsonb,
      public_url text,
      platform_receipt text,
      status text not null,
      expected_exposure text,
      measured_exposure jsonb not null default '{}'::jsonb,
      referral_tracking jsonb not null default '{}'::jsonb,
      measurement_window_hours int not null default 72,
      counts_as_distribution boolean not null default false,
      created_at timestamptz not null default now()
    );
    create index if not exists aq_distribution_receipts_biz_idx
      on aq_distribution_receipts (business_id, created_at desc);
    create index if not exists aq_distribution_receipts_dist_idx
      on aq_distribution_receipts (counts_as_distribution, created_at desc);

    create table if not exists aq_assets (
      asset_id text primary key,
      business_id text not null,
      buyer text,
      asset_type text not null,
      purpose text,
      channel_family text,
      title text,
      public_url text,
      source_evidence jsonb not null default '[]'::jsonb,
      status text not null default 'DRAFT',
      impressions bigint not null default 0,
      visits bigint not null default 0,
      qualified_visits bigint not null default 0,
      leads bigint not null default 0,
      sales bigint not null default 0,
      revenue_usd numeric not null default 0,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      published_at timestamptz
    );
    create index if not exists aq_assets_biz_idx on aq_assets (business_id, created_at desc);

    create table if not exists aq_owner_actions (
      id text primary key,
      business_id text not null,
      channel_surface_id text,
      platform text,
      action_title text not null,
      why_it_matters text,
      expected_value text,
      exact_action text not null,
      prepared_content text,
      link text,
      estimated_minutes int not null default 5,
      status text not null default 'PENDING',
      priority int not null default 50,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists aq_owner_actions_status_idx
      on aq_owner_actions (status, priority desc, created_at desc);

    create table if not exists aq_funnel_state (
      business_id text primary key,
      rung text not null,
      bottleneck text,
      acquisition_readiness numeric not null default 0,
      coverage jsonb not null default '{}'::jsonb,
      first_human_mode boolean not null default false,
      zero_traffic_incident boolean not null default false,
      updated_at timestamptz not null default now()
    );

    create table if not exists aq_lessons (
      id text primary key,
      business_id text,
      channel_surface_id text,
      scope text not null,
      lesson text not null,
      failed_channel text,
      future_rule text,
      evidence jsonb not null default '[]'::jsonb,
      confidence numeric not null default 0.6,
      created_at timestamptz not null default now()
    );

    create table if not exists aq_suppression (
      id text primary key,
      scope text not null,
      business_id text,
      contact_key text not null,
      reason text,
      created_at timestamptz not null default now()
    );
    create unique index if not exists aq_suppression_uidx
      on aq_suppression (scope, coalesce(business_id,''), contact_key);

    create table if not exists aq_incidents (
      id text primary key,
      business_id text not null,
      kind text not null,
      diagnosis jsonb not null,
      status text not null default 'OPEN',
      created_at timestamptz not null default now(),
      resolved_at timestamptz
    );
  `);
}
