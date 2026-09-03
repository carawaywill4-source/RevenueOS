-- Channel Registry: durable acquisition surfaces with commercial posteriors.
-- Document-oriented jsonb so the brain can evolve fields without migrations.

create table if not exists public.revenueos_channels (
  id text primary key,
  site_id text not null,
  platform text not null,
  account text not null default 'default',
  capability_id text not null default '',
  revenue_per_action numeric not null default 0,
  confidence numeric not null default 0,
  status text not null default 'active',
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, platform, account, capability_id)
);

create index if not exists revenueos_channels_site_idx
  on public.revenueos_channels (site_id, revenue_per_action desc);
create index if not exists revenueos_channels_platform_idx
  on public.revenueos_channels (platform, status);

alter table public.revenueos_channels enable row level security;
