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

-- Service-role access only (server-side brain). RLS on with no public policies.
alter table public.revenueos_experiments enable row level security;
alter table public.revenueos_lessons enable row level security;
alter table public.revenueos_scorecards enable row level security;
alter table public.revenueos_attributions enable row level security;
