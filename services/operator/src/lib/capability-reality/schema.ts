import type pg from "pg";

export async function ensureCapabilityRealityTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_capability_registry (
      capability_id text primary key,
      domain text not null,
      name text not null,
      state text not null,
      chain_break text,
      live_evidence text not null default '',
      failure_point text not null default '',
      action text not null default '',
      autonomous boolean not null default false,
      authenticated boolean not null default false,
      owner_authority boolean not null default false,
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    alter table ros_capability_registry
      add column if not exists autonomous boolean not null default false,
      add column if not exists authenticated boolean not null default false,
      add column if not exists owner_authority boolean not null default false,
      add column if not exists chain_break text,
      add column if not exists live_evidence text not null default '',
      add column if not exists failure_point text not null default '',
      add column if not exists action text not null default '',
      add column if not exists meta jsonb not null default '{}'::jsonb;

    create table if not exists ros_distribution_capabilities (
      id text primary key,
      channel text not null,
      platform text not null,
      account_id text,
      auth_state text not null default 'NONE',
      rule_class text not null default 'UNKNOWN_NEEDS_RESEARCH',
      audience text not null default '',
      publication_method text not null default '',
      autonomous_eligibility boolean not null default false,
      owner_requirement text,
      acceptance_verification boolean not null default false,
      publication_verification boolean not null default false,
      referral_attribution boolean not null default false,
      confidence numeric not null default 0.3,
      suppressed boolean not null default false,
      historical_roi numeric not null default 0,
      state text not null,
      evidence text not null default '',
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_platform_accounts (
      account_id text primary key,
      platform text not null,
      identity_email text,
      username text,
      status text not null default 'UNKNOWN',
      rule_class text not null default 'UNKNOWN_NEEDS_RESEARCH',
      credential_ref text,
      session_ref text,
      permissions jsonb not null default '[]'::jsonb,
      channel_ids text[] not null default '{}',
      last_verified_at timestamptz,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_credential_vault (
      credential_ref text primary key,
      platform text not null,
      kind text not null,
      -- ciphertext only; never store plaintext secrets in chat/logs
      secret_enc text not null,
      secret_hint text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      meta jsonb not null default '{}'::jsonb
    );

    create table if not exists ros_inbound_messages (
      message_id text primary key,
      provider text not null,
      thread_key text,
      business_id text,
      experiment_id text,
      receipt_id text,
      direction text not null,
      from_addr text,
      to_addr text,
      subject text,
      body_text text,
      classification text,
      confidence numeric not null default 0.5,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create index if not exists ros_inbound_messages_class_idx
      on ros_inbound_messages (classification, created_at desc);
    create index if not exists ros_capability_registry_state_idx
      on ros_capability_registry (state);
    create index if not exists ros_distribution_capabilities_state_idx
      on ros_distribution_capabilities (state, autonomous_eligibility);
  `);
}
