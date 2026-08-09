-- Persistent operator ⇄ per-app cron coordination.
--
-- When the operator claims a business the lease is written here. Each
-- app's cron reads this table at the top of its hourly tick; if a live
-- claim exists it no-ops. If the lease expires the cron takes over.
-- This is the whole handoff mechanism — no config flags to flip, no
-- deploys required.

create table if not exists public.revenueos_operator_claims (
  site_id text primary key,
  owner text not null,
  claimed_at timestamptz not null default now(),
  lease_until timestamptz not null
);

create index if not exists revenueos_operator_claims_lease_idx
  on public.revenueos_operator_claims (lease_until desc);

alter table public.revenueos_operator_claims enable row level security;

-- Owner-drafted publishes waiting for approval in the dashboard queue.
-- The operator writes drafts here when a safety gate says "owner only";
-- the dashboard approve/reject actions flip status; on approval the
-- operator dispatches to the browser sidecar on its next tick.
create table if not exists public.revenueos_owner_drafts (
  id text primary key,
  site_id text not null,
  platform text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  owner_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists revenueos_owner_drafts_pending_idx
  on public.revenueos_owner_drafts (status, created_at desc);
create index if not exists revenueos_owner_drafts_site_idx
  on public.revenueos_owner_drafts (site_id, created_at desc);

alter table public.revenueos_owner_drafts enable row level security;
