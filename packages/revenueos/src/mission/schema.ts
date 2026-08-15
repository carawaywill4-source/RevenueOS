/**
 * MissionController schema.
 *
 * A "mission" is the commercial goal the system is pursuing right now.
 * It has deterministic status transitions and durable Postgres state.
 * Only the MissionController transitions status. LLM output is advisory.
 *
 * A "commercial experiment" is one attempt at reaching real humans and
 * converting them. Experiments are fingerprinted by
 * {channel_family, audience_key, offer_key, positioning_key, product}
 * so that a renamed variant of the same strategy cannot be re-enqueued.
 *
 * The progress clock records last-external-progress timestamps computed
 * from real DB facts (ros_purchases, ros_traffic_events, ros_commercial_actions).
 * "Being busy" is not "making commercial progress."
 */

import type pg from "pg";

export const MISSION_SCHEMA_VERSION = "mission-controller-v1";

export async function ensureMissionSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_missions (
      id text primary key,
      status text not null default 'ACTIVE',
      objective_primary text not null default 'REAL_REVENUE',
      first_sale_target_usd numeric not null default 1,
      long_term_daily_revenue_target_usd numeric not null default 0,
      started_at timestamptz not null default now(),
      deadline_at timestamptz,
      current_experiment_id text,
      last_commercial_progress_at timestamptz,
      last_action_at timestamptz,
      objective jsonb not null default '{}'::jsonb,
      progress jsonb not null default '{}'::jsonb,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (status in (
        'ACTIVE',
        'SUCCESS',
        'DEADLINE_REACHED',
        'PAUSED_BY_OWNER',
        'ABANDONED_BY_OWNER'
      ))
    );

    create index if not exists ros_missions_status_idx
      on ros_missions (status, started_at desc);

    create table if not exists ros_commercial_experiments (
      id text primary key,
      mission_id text not null,
      fingerprint text not null,
      family text not null,
      executor text not null,
      state text not null default 'PROPOSED',
      hypothesis text not null default '',
      business_id text not null default '',
      buyer text not null default '',
      offer text not null default '',
      channel text not null default '',
      expected_result text not null default '',
      measurement text not null default '',
      budget_usd numeric not null default 0,
      attempts integer not null default 0,
      external_exposures integer not null default 0,
      verified_humans integer not null default 0,
      engaged_humans integer not null default 0,
      clicks integer not null default 0,
      checkout_starts integer not null default 0,
      purchases integer not null default 0,
      revenue_usd numeric not null default 0,
      source text not null default 'deterministic',
      started_at timestamptz,
      completed_at timestamptz,
      claimed_at timestamptz,
      claimed_by text,
      heartbeat_at timestamptz,
      measuring_started_at timestamptz,
      external_action_verified_at timestamptz,
      terminal_reason text not null default '',
      lesson text not null default '',
      next_mutation text not null default '',
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (state in (
        'PROPOSED',
        'ENQUEUED',
        'CLAIMED',
        'EXECUTING',
        'EXTERNAL_ACTION_VERIFIED',
        'MEASURING',
        'WIN',
        'LOSS',
        'INCONCLUSIVE',
        'BLOCKED',
        'FAILED',
        'ABANDONED_DUPLICATE',
        'RUNNING',
        'COMPLETED'
      ))
    );

    -- Additive migration for pre-existing installations that predate the
    -- richer state machine. Safe on fresh databases too.
    alter table ros_commercial_experiments
      add column if not exists claimed_at timestamptz,
      add column if not exists claimed_by text,
      add column if not exists heartbeat_at timestamptz,
      add column if not exists measuring_started_at timestamptz,
      add column if not exists external_action_verified_at timestamptz,
      add column if not exists terminal_reason text not null default '';

    -- Drop the pre-executor-bridge CHECK constraint (which only accepted
    -- PROPOSED/ENQUEUED/RUNNING/COMPLETED/FAILED/ABANDONED_DUPLICATE) and
    -- replace it with the full state machine. The DO block makes this
    -- idempotent — safe to re-run.
    do $mig$
    begin
      if exists (
        select 1 from pg_constraint
         where conname = 'ros_commercial_experiments_state_check'
      ) then
        alter table ros_commercial_experiments
          drop constraint ros_commercial_experiments_state_check;
      end if;
    exception when others then
      -- Never fatal.
      null;
    end
    $mig$;

    do $mig2$
    begin
      alter table ros_commercial_experiments
        add constraint ros_commercial_experiments_state_check
        check (state in (
          'PROPOSED',
          'ENQUEUED',
          'CLAIMED',
          'EXECUTING',
          'EXTERNAL_ACTION_VERIFIED',
          'MEASURING',
          'WIN',
          'LOSS',
          'INCONCLUSIVE',
          'BLOCKED',
          'FAILED',
          'ABANDONED_DUPLICATE',
          'RUNNING',
          'COMPLETED'
        ));
    exception when duplicate_object then
      null;
    end
    $mig2$;

    create unique index if not exists ros_commercial_experiments_fp_uniq
      on ros_commercial_experiments (mission_id, fingerprint);

    create index if not exists ros_commercial_experiments_state_idx
      on ros_commercial_experiments (mission_id, state, executor);

    create index if not exists ros_commercial_experiments_recency_idx
      on ros_commercial_experiments (mission_id, created_at desc);

    create table if not exists ros_mission_progress_clock (
      mission_id text primary key,
      last_external_exposure_at timestamptz,
      last_verified_human_at timestamptz,
      last_engagement_at timestamptz,
      last_checkout_start_at timestamptz,
      last_purchase_at timestamptz,
      external_exposures_1h integer not null default 0,
      verified_humans_1h integer not null default 0,
      engagements_1h integer not null default 0,
      checkout_starts_1h integer not null default 0,
      purchases_total integer not null default 0,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_mission_incidents (
      id text primary key,
      mission_id text not null,
      kind text not null,
      severity text not null default 'WARN',
      detail text not null default '',
      opened_at timestamptz not null default now(),
      resolved_at timestamptz,
      meta jsonb not null default '{}'::jsonb
    );

    create index if not exists ros_mission_incidents_open_idx
      on ros_mission_incidents (mission_id, resolved_at, opened_at desc);

    -- Every physical external execution attempt writes a receipt. This is the
    -- authoritative record that RevenueOS *did* something outside itself, not
    -- merely that it *intended* to. MissionController transitions to
    -- EXTERNAL_ACTION_VERIFIED only when a corresponding row lands here with
    -- verified=true.
    create table if not exists ros_external_execution_receipts (
      id text primary key,
      experiment_id text not null,
      mission_id text not null,
      executor text not null,
      channel_family text not null,
      external_action_type text not null,
      external_id text,
      public_url text,
      verification_method text not null,
      verified boolean not null default false,
      evidence jsonb not null default '{}'::jsonb,
      error text not null default '',
      started_at timestamptz not null default now(),
      completed_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      check (verification_method in (
        'PUBLIC_HTTP',
        'PROVIDER_RECEIPT',
        'PLATFORM_API',
        'EXTERNAL_BROWSER',
        'NONE'
      ))
    );
    create index if not exists ros_external_execution_receipts_exp_idx
      on ros_external_execution_receipts (experiment_id, created_at desc);
    create index if not exists ros_external_execution_receipts_verified_idx
      on ros_external_execution_receipts (verified, created_at desc);

    -- DistributionReceipt is a stronger sibling of the external receipt: it
    -- asserts we created a *legitimate opportunity for a stranger to
    -- encounter the offer*, not merely that an API call succeeded. Only
    -- executor outcomes that place the offer in front of independent
    -- humans (marketplace listings, public posts, qualified outbound with
    -- external provider delivery, etc.) create rows here.
    create table if not exists ros_distribution_receipts (
      id text primary key,
      mission_id text not null,
      experiment_id text not null,
      external_receipt_id text,
      platform text not null,
      channel_family text not null,
      distribution_type text not null,
      external_id text,
      public_url text,
      externally_accessible boolean not null default true,
      discoverable_or_delivered boolean not null default false,
      verification_method text not null,
      evidence jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      check (distribution_type in (
        'MARKETPLACE_LISTING',
        'PUBLIC_POST',
        'SEARCHABLE_RESOURCE',
        'QUALIFIED_OUTBOUND',
        'DIRECTORY_PUBLICATION',
        'PARTNER_SURFACE'
      )),
      check (verification_method in (
        'PLATFORM_API',
        'PUBLIC_HTTP',
        'EXTERNAL_BROWSER',
        'EMAIL_PROVIDER'
      ))
    );
    create index if not exists ros_distribution_receipts_mission_idx
      on ros_distribution_receipts (mission_id, created_at desc);
    create index if not exists ros_distribution_receipts_platform_idx
      on ros_distribution_receipts (platform, created_at desc);

    -- Additive columns for the progress clock table: distribution + strict
    -- human. Existing installs get filled in on next tick.
    alter table ros_mission_progress_clock
      add column if not exists last_external_action_at timestamptz,
      add column if not exists last_distribution_opportunity_at timestamptz,
      add column if not exists last_proven_human_visit_at timestamptz,
      add column if not exists external_actions_24h integer not null default 0,
      add column if not exists distribution_opportunities_24h integer not null default 0,
      add column if not exists proven_humans_24h integer not null default 0,
      add column if not exists legacy_unverified_human_signal_1h integer not null default 0;

    -- One-account-can't-freeze-the-mission queue: when an experiment is
    -- BLOCKED because a real human needs to log in / accept ToS / create an
    -- account, we surface the exact ask here and continue with another
    -- executable experiment.
    create table if not exists ros_owner_action_queue (
      id text primary key,
      mission_id text not null,
      experiment_id text,
      platform text not null,
      exact_action text not null,
      why_required text not null,
      url text,
      followup_after text not null default '',
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      meta jsonb not null default '{}'::jsonb
    );
    create index if not exists ros_owner_action_queue_open_idx
      on ros_owner_action_queue (mission_id, resolved_at, created_at desc);

    create table if not exists ros_ai_call_ledger (
      id text primary key,
      provider text not null,
      model text not null default '',
      reason text not null default '',
      mission_id text,
      experiment_id text,
      input_tokens integer not null default 0,
      output_tokens integer not null default 0,
      estimated_cost_usd numeric not null default 0,
      commercial_outcome text not null default '',
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists ros_ai_call_ledger_provider_idx
      on ros_ai_call_ledger (provider, created_at desc);
  `);
}
