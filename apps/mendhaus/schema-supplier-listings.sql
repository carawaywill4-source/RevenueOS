-- Run in Supabase SQL editor for project fnrwzloovduhryynmgok (Mendhaus).
-- Adds supplier sync table + high-traffic event indexes.

create table if not exists public.mh_supplier_listings (
  product_id text primary key,
  network text not null,
  supplier_product_id text not null,
  supplier_sku text,
  unit_cost_usd numeric(10,2),
  stock integer,
  hero_url text,
  gallery jsonb not null default '[]'::jsonb,
  warehouse_country text,
  search_query text,
  synced_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists mh_events_created_idx on public.mh_events (created_at desc);
create index if not exists mh_events_product_idx on public.mh_events (product_id, created_at desc);
create index if not exists mh_supplier_listings_synced_idx on public.mh_supplier_listings (synced_at desc);

alter table public.mh_supplier_listings enable row level security;
