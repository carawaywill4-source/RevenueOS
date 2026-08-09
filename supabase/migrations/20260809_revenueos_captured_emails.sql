-- Adds a durable first-party email list captured by the exit-intent modal.
-- Per-site scoping via site_id + unique (site_id, email) guarantees idempotency
-- if the visitor bounces the modal on multiple pages.
create table if not exists public.revenueos_captured_emails (
  id bigserial primary key,
  site_id text not null,
  email text not null,
  source text not null default 'exit_intent',
  page_url text,
  referrer text,
  utm jsonb,
  ip_hash text,
  user_agent text,
  captured_at timestamptz not null default now(),
  unique (site_id, email)
);

create index if not exists revenueos_captured_emails_site_idx
  on public.revenueos_captured_emails (site_id, captured_at desc);

alter table public.revenueos_captured_emails enable row level security;

-- Server-side inserts only. Anonymous browsers hit the app's own /api
-- endpoint, which uses the service-role key server-side; RLS keeps direct
-- browser writes out.
