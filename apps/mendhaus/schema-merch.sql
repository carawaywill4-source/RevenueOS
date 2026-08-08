-- Live merchandising state RevenueOS can mutate (single-row document).
create table if not exists public.mh_merch_state (
  id text primary key default 'live',
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

insert into public.mh_merch_state (id, document, updated_by)
values ('live', '{}'::jsonb, 'bootstrap')
on conflict (id) do nothing;

alter table public.mh_merch_state enable row level security;
