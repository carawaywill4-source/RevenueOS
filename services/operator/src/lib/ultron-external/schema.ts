/**
 * ULTRON EXTERNAL AGENCY — schema.
 *
 * Additive tables that give ULTRON the real external agency it lacks:
 *   - ros_browser_sessions           persistent Playwright context state
 *   - ros_browser_actions            every browser action + evidence
 *   - ros_browser_artifacts          screenshot / DOM / download evidence hashes
 *   - ros_action_verification_plan   per-action verification signal registry
 *   - ros_attribution_edges          causal edges strategy → payment
 *   - ros_identity_profiles          consolidated Business Identity OS
 *   - ros_inbound_webhooks           inbound webhook receipts (raw + normalized)
 *   - ros_runtime_facts              systemd/chromium/fs/memory probe facts
 *   - ros_schema_snapshot            cached information_schema for validation
 *   - ros_cursor_lessons             machine-consumable lessons from Cursor
 */

import type pg from "pg";

export async function ensureUltronExternalTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_browser_sessions (
      session_id text primary key,
      purpose text not null,
      business_id text,
      platform text,
      state text not null default 'INIT',
      storage_state jsonb,
      cookies jsonb,
      last_url text,
      last_action_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      meta jsonb not null default '{}'::jsonb
    );

    create table if not exists ros_browser_actions (
      action_id text primary key,
      session_id text not null,
      kind text not null,
      selector text,
      value text,
      url text,
      result text not null default 'PENDING',
      duration_ms integer not null default 0,
      screenshot_before text,
      screenshot_after text,
      dom_hash text,
      evidence jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists ros_browser_actions_session_idx
      on ros_browser_actions (session_id, created_at desc);

    create table if not exists ros_browser_artifacts (
      artifact_id text primary key,
      session_id text,
      action_id text,
      kind text not null,
      path text,
      sha256 text,
      size_bytes integer,
      mime text,
      created_at timestamptz not null default now(),
      meta jsonb not null default '{}'::jsonb
    );

    create table if not exists ros_action_verification_plan (
      plan_id text primary key,
      external_action text not null,
      expected_signal text not null,
      wait_hours integer not null default 24,
      success_query text,
      failure_query text,
      remediation text,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_attribution_edges (
      edge_id text primary key,
      from_kind text not null,
      from_id text not null,
      to_kind text not null,
      to_id text not null,
      relation text not null,
      confidence text not null default 'WEAK',
      evidence jsonb not null default '{}'::jsonb,
      business_id text,
      created_at timestamptz not null default now()
    );
    create index if not exists ros_attribution_edges_from_idx
      on ros_attribution_edges (from_kind, from_id);
    create index if not exists ros_attribution_edges_to_idx
      on ros_attribution_edges (to_kind, to_id);

    create table if not exists ros_identity_profiles (
      profile_id text primary key,
      business_id text not null,
      display_name text not null,
      primary_email text,
      inbox_email text,
      domains text[] not null default '{}',
      usernames jsonb not null default '{}'::jsonb,
      account_refs text[] not null default '{}',
      credential_refs text[] not null default '{}',
      verification_state jsonb not null default '{}'::jsonb,
      account_health text not null default 'UNKNOWN',
      owner_blockers text[] not null default '{}',
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_inbound_webhooks (
      webhook_id text primary key,
      provider text not null,
      route text not null,
      signature_ok boolean not null default false,
      payload jsonb not null default '{}'::jsonb,
      raw_body text,
      classification text,
      normalized_ref text,
      business_id text,
      created_at timestamptz not null default now()
    );

    create table if not exists ros_runtime_facts (
      fact_id text primary key,
      probe text not null,
      value jsonb not null default '{}'::jsonb,
      observed_at timestamptz not null default now(),
      severity text not null default 'INFO'
    );

    create table if not exists ros_schema_snapshot (
      snapshot_id text primary key,
      taken_at timestamptz not null default now(),
      tables jsonb not null default '{}'::jsonb
    );

    create table if not exists ros_cursor_lessons (
      lesson_id text primary key,
      taxonomy text not null,
      summary text not null,
      detail text not null default '',
      procedure jsonb not null default '{}'::jsonb,
      applies_to text[] not null default '{}',
      first_seen_at timestamptz not null default now(),
      last_applied_at timestamptz,
      confidence text not null default 'MEDIUM'
    );

    alter table ros_inbound_webhooks
      add column if not exists trust_status text not null default 'QUARANTINED',
      add column if not exists svix_id text,
      add column if not exists verify_reason text;
    create unique index if not exists ros_inbound_webhooks_svix_uidx
      on ros_inbound_webhooks (svix_id) where svix_id is not null;

    alter table ros_closed_loop_defects
      add column if not exists verification_outcome text;
    alter table ros_attribution_edges
      add column if not exists polarity text not null default 'POSITIVE';
    alter table ros_traffic_events
      add column if not exists class_reason text;
    alter table ros_browser_sessions
      add column if not exists isolation_key text,
      add column if not exists revoked_at timestamptz;
    alter table ros_browser_actions
      add column if not exists surface_class text;

    create table if not exists ros_customer_events (
      event_id text primary key,
      kind text not null,
      business_id text,
      source text not null,
      source_id text,
      amount_usd numeric,
      evidence jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists ros_customer_events_kind_idx
      on ros_customer_events (kind, created_at desc);

    create table if not exists ros_account_evidence (
      account_id text primary key,
      platform text not null,
      ladder text not null,
      evidence jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_proof_regrades (
      regrade_id text primary key,
      subject_kind text not null,
      subject_id text not null,
      from_level text not null,
      to_level text not null,
      evidence_class text not null,
      why text not null,
      created_at timestamptz not null default now()
    );
  `);
}
