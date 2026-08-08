-- RevenueOS durable ledger (customer-zero install on TributeReady).
-- No end-user/customer PII. Safe to apply when DDL access is available.
--
-- Document-oriented on purpose: the brain evolves quickly, so each row stores
-- the full typed object as jsonb. New brain fields never require a migration —
-- only the small set of query/index columns below are promoted to columns.

create table if not exists public.revenueos_experiments (
  id text primary key,
  site_id text not null,
  status text not null,
  pattern_key text,
  category text,
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenueos_lessons (
  id text primary key,
  site_id text,
  industry text,
  scope text not null check (scope in ('global', 'industry', 'site')),
  pattern_key text not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenueos_scorecards (
  id bigserial primary key,
  site_id text not null,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.revenueos_attributions (
  id text primary key,
  site_id text not null,
  experiment_id text not null,
  verdict text not null,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists revenueos_experiments_site_idx
  on public.revenueos_experiments (site_id, created_at desc);
create index if not exists revenueos_experiments_pattern_idx
  on public.revenueos_experiments (site_id, pattern_key);
create index if not exists revenueos_lessons_scope_idx
  on public.revenueos_lessons (scope, industry, site_id);
create index if not exists revenueos_scorecards_site_idx
  on public.revenueos_scorecards (site_id, created_at desc);
create index if not exists revenueos_attributions_site_idx
  on public.revenueos_attributions (site_id, created_at desc);

create table if not exists public.revenueos_planner_runs (
  id text primary key,
  site_id text not null,
  source text not null,
  policy_rejected boolean not null default false,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.revenueos_cycle_reports (
  id text primary key,
  site_id text not null,
  observed_at timestamptz not null,
  planner_source text,
  document jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.revenueos_exposures (
  id text primary key,
  site_id text not null,
  experiment_id text,
  action_type text not null,
  exposure_key text not null,
  version text not null,
  document jsonb not null,
  started_at timestamptz not null,
  ended_at timestamptz
);

create index if not exists revenueos_planner_runs_site_idx
  on public.revenueos_planner_runs (site_id, created_at desc);
create index if not exists revenueos_cycle_reports_site_idx
  on public.revenueos_cycle_reports (site_id, created_at desc);
create index if not exists revenueos_exposures_site_idx
  on public.revenueos_exposures (site_id, started_at desc);
create index if not exists revenueos_exposures_key_idx
  on public.revenueos_exposures (site_id, exposure_key, version desc);

create table if not exists public.revenueos_discovery_doors (
  id text primary key,
  site_id text not null,
  cluster_key text not null,
  status text not null,
  document jsonb not null,
  published_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.revenueos_capability_gaps (
  id text primary key,
  site_id text not null,
  missing_capability text not null,
  desired_action text not null,
  importance text not null,
  times_blocked integer not null default 1,
  document jsonb not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  unique (site_id, missing_capability, desired_action)
);

create index if not exists revenueos_discovery_doors_site_idx
  on public.revenueos_discovery_doors (site_id, published_at desc);
create index if not exists revenueos_discovery_doors_cluster_idx
  on public.revenueos_discovery_doors (site_id, cluster_key);
create index if not exists revenueos_capability_gaps_site_idx
  on public.revenueos_capability_gaps (site_id, last_seen_at desc);
create index if not exists revenueos_capability_gaps_cap_idx
  on public.revenueos_capability_gaps (missing_capability, times_blocked desc);

alter table public.revenueos_experiments enable row level security;
alter table public.revenueos_lessons enable row level security;
alter table public.revenueos_scorecards enable row level security;
alter table public.revenueos_attributions enable row level security;
alter table public.revenueos_planner_runs enable row level security;
alter table public.revenueos_cycle_reports enable row level security;
alter table public.revenueos_exposures enable row level security;
alter table public.revenueos_discovery_doors enable row level security;
alter table public.revenueos_capability_gaps enable row level security;
