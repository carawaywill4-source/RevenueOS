-- Run once in the Supabase SQL editor before enabling checkout.
create extension if not exists pgcrypto;

create or replace function public.is_safe_growth_attribution(p_value jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    jsonb_typeof(p_value) = 'object'
    and p_value - array[
      'source', 'medium', 'campaign', 'referrerHost', 'capturedAt'
    ]::text[] = '{}'::jsonb
    and octet_length(p_value::text) <= 2048
    and (
      not (p_value ? 'source')
      or (
        jsonb_typeof(p_value -> 'source') = 'string'
        and p_value ->> 'source' ~ '^[a-zA-Z0-9._~-]{1,64}$'
      )
    )
    and (
      not (p_value ? 'medium')
      or (
        jsonb_typeof(p_value -> 'medium') = 'string'
        and p_value ->> 'medium' ~ '^[a-zA-Z0-9._~-]{1,64}$'
      )
    )
    and (
      not (p_value ? 'campaign')
      or (
        jsonb_typeof(p_value -> 'campaign') = 'string'
        and p_value ->> 'campaign' ~ '^[a-zA-Z0-9._~-]{1,64}$'
      )
    )
    and (
      not (p_value ? 'referrerHost')
      or (
        jsonb_typeof(p_value -> 'referrerHost') = 'string'
        and p_value ->> 'referrerHost' ~ '^[a-zA-Z0-9.-]{1,253}$'
      )
    )
    and (
      not (p_value ? 'capturedAt')
      or (
        jsonb_typeof(p_value -> 'capturedAt') = 'string'
        and p_value ->> 'capturedAt'
          ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$'
      )
    );
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  memorial_name text not null,
  draft jsonb not null,
  details jsonb not null default '{}'::jsonb,
  email text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'fulfilled', 'refunded', 'abandoned')),
  access_token uuid not null default gen_random_uuid() unique,
  review_token uuid not null default gen_random_uuid() unique,
  stripe_session_id text unique,
  payment_intent_id text unique,
  pdf_path text,
  photo_path text,
  growth_session_id uuid,
  first_touch_attribution jsonb not null default '{}'::jsonb,
  last_touch_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  source_deleted_at timestamptz,
  constraint orders_first_touch_attribution_safe
    check (public.is_safe_growth_attribution(first_touch_attribution)),
  constraint orders_last_touch_attribution_safe
    check (public.is_safe_growth_attribution(last_touch_attribution))
);

alter table public.orders enable row level security;

alter table public.orders
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists photo_path text,
  add column if not exists payment_intent_id text unique,
  add column if not exists review_token uuid not null default gen_random_uuid(),
  add column if not exists growth_session_id uuid,
  add column if not exists first_touch_attribution jsonb not null default '{}'::jsonb,
  add column if not exists last_touch_attribution jsonb not null default '{}'::jsonb,
  add column if not exists source_deleted_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('awaiting_payment', 'fulfilled', 'refunded', 'abandoned'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_first_touch_attribution_safe'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_first_touch_attribution_safe
      check (public.is_safe_growth_attribution(first_touch_attribution));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_last_touch_attribution_safe'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_last_touch_attribution_safe
      check (public.is_safe_growth_attribution(last_touch_attribution));
  end if;
end
$$;

-- Orders are server-only. The service role bypasses RLS; no public policy is
-- intentionally created.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memorial-files',
  'memorial-files',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memorial-photos',
  'memorial-photos',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create index if not exists orders_access_token_idx
  on public.orders (access_token);

create unique index if not exists orders_review_token_idx
  on public.orders (review_token);

create index if not exists orders_created_at_idx
  on public.orders (created_at);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 600),
  purchase_reason text check (
    purchase_reason is null or purchase_reason in (
      'ease', 'writing', 'design', 'privacy', 'speed', 'bundle', 'price', 'other'
    )
  ),
  improvement text check (
    improvement is null or char_length(improvement) <= 600
  ),
  public_consent_at timestamptz,
  status text not null default 'published'
    check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

alter table public.reviews
  add column if not exists purchase_reason text,
  add column if not exists improvement text,
  add column if not exists public_consent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_purchase_reason_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews add constraint reviews_purchase_reason_check
    check (
      purchase_reason is null or purchase_reason in (
        'ease', 'writing', 'design', 'privacy', 'speed', 'bundle', 'price', 'other'
      )
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_improvement_check'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews add constraint reviews_improvement_check
    check (improvement is null or char_length(improvement) <= 600);
  end if;
end
$$;

-- Reviews are written and read through server-only endpoints. The service role
-- bypasses RLS; no public policy is intentionally created.

create index if not exists reviews_status_created_at_idx
  on public.reviews (status, created_at desc);

create table if not exists public.growth_events (
  id bigint generated by default as identity primary key,
  event_name text not null check (
    event_name in (
      'landing_view',
      'builder_started',
      'builder_step_completed',
      'draft_generated',
      'draft_edited',
      'checkout_started',
      'checkout_cancelled',
      'purchase_completed',
      'fulfillment_completed',
      'fulfillment_failed',
      'memorial_viewed',
      'pdf_downloaded',
      'review_submitted',
      'memorial_shared'
    )
  ),
  session_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and octet_length(metadata::text) <= 2048
  ),
  created_at timestamptz not null default now(),
  constraint growth_events_metadata_safe check (
    (
      event_name = 'landing_view'
      and metadata ? 'page'
      and metadata - 'page' = '{}'::jsonb
      and metadata ->> 'page' in (
        'home', 'funeral_program', 'obituary', 'celebration', 'resources',
        'obituary_templates', 'order_of_service_templates',
        'funeral_readings', 'eulogy_examples', 'funeral_program_word',
        'funeral_pamphlet',         'funeral_program_google_docs',
        'where_to_print',
        'funeral_program_cost',
        'funeral_program_examples'
      )
    )
    or (
      event_name = 'builder_started'
      and metadata ? 'entry'
      and metadata - 'entry' = '{}'::jsonb
      and metadata ->> 'entry' in ('home', 'restart')
    )
    or (
      event_name = 'builder_step_completed'
      and metadata ? 'step'
      and metadata - 'step' = '{}'::jsonb
      and metadata ->> 'step' in (
        'details', 'memories', 'style', 'preview'
      )
    )
    or (
      event_name = 'draft_generated'
      and metadata ? 'theme'
      and metadata - 'theme' = '{}'::jsonb
      and metadata ->> 'theme' in ('garden', 'classic', 'sky')
    )
    or (
      event_name = 'draft_edited'
      and metadata ? 'section'
      and metadata - 'section' = '{}'::jsonb
      and metadata ->> 'section' in (
        'heading', 'obituary', 'remembrance', 'closing'
      )
    )
    or (
      event_name = 'checkout_started'
      and metadata ?& array['theme', 'hasPhoto']
      and metadata - array['theme', 'hasPhoto']::text[] = '{}'::jsonb
      and metadata ->> 'theme' in ('garden', 'classic', 'sky')
      and jsonb_typeof(metadata -> 'hasPhoto') = 'boolean'
    )
    or (
      event_name = 'checkout_cancelled'
      and metadata ? 'stage'
      and metadata - 'stage' = '{}'::jsonb
      and metadata ->> 'stage' in ('checkout', 'payment')
    )
    or (
      event_name in (
        'purchase_completed', 'fulfillment_completed',
        'memorial_viewed', 'pdf_downloaded'
      )
      and metadata = '{}'::jsonb
    )
    or (
      event_name = 'fulfillment_failed'
      and metadata ? 'stage'
      and metadata - 'stage' = '{}'::jsonb
      and metadata ->> 'stage' in ('pdf', 'storage', 'email', 'database', 'unknown')
    )
    or (
      event_name = 'review_submitted'
      and metadata ? 'rating'
      and metadata - 'rating' = '{}'::jsonb
      and (metadata ->> 'rating')::integer between 1 and 5
    )
    or (
      event_name = 'memorial_shared'
      and metadata ? 'method'
      and metadata - 'method' = '{}'::jsonb
      and metadata ->> 'method' in ('native', 'copy', 'qr')
    )
  )
);

alter table public.growth_events enable row level security;

-- Growth data is server-only. Events are deliberately categorical: memorial
-- text, email addresses, IP addresses, URLs, and photo data are never accepted.
create index if not exists growth_events_created_at_idx
  on public.growth_events (created_at desc);

create index if not exists growth_events_name_created_at_idx
  on public.growth_events (event_name, created_at desc);

create index if not exists growth_events_session_created_at_idx
  on public.growth_events (session_id, created_at desc);

create table if not exists public.customer_feedback (
  id bigint generated by default as identity primary key,
  feedback_type text not null check (
    feedback_type in ('cancellation', 'draft_quality')
  ),
  session_id uuid not null,
  rating smallint check (rating between 1 and 5),
  reason text,
  created_at timestamptz not null default now(),
  check (
    (
      feedback_type = 'cancellation'
      and rating is null
      and reason in (
        'too_expensive',
        'not_ready',
        'technical_issue',
        'privacy_concern',
        'other_no_comment'
      )
    )
    or
    (
      feedback_type = 'draft_quality'
      and rating is not null
      and (
        reason is null
        or reason in (
          'too_generic',
          'inaccurate',
          'tone',
          'missing_details',
          'good'
        )
      )
    )
  )
);

alter table public.customer_feedback enable row level security;

-- Feedback is categorical only; there is intentionally no free-text column.
create index if not exists customer_feedback_type_created_at_idx
  on public.customer_feedback (feedback_type, created_at desc);

create or replace function public.purge_expired_growth_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.growth_events
  where created_at < now() - interval '90 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.growth_report(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with
  event_counts as (
    select event_name, count(*)::integer as total
    from public.growth_events
    where created_at >= p_start and created_at < p_end
    group by event_name
  ),
  feedback_type_counts as (
    select feedback_type, count(*)::integer as total
    from public.customer_feedback
    where created_at >= p_start and created_at < p_end
    group by feedback_type
  ),
  cancellation_counts as (
    select reason, count(*)::integer as total
    from public.customer_feedback
    where feedback_type = 'cancellation'
      and created_at >= p_start and created_at < p_end
    group by reason
  ),
  quality_rating_counts as (
    select rating::text as rating, count(*)::integer as total
    from public.customer_feedback
    where feedback_type = 'draft_quality'
      and created_at >= p_start and created_at < p_end
    group by rating
  ),
  quality_reason_counts as (
    select reason, count(*)::integer as total
    from public.customer_feedback
    where feedback_type = 'draft_quality'
      and reason is not null
      and created_at >= p_start and created_at < p_end
    group by reason
  ),
  order_status_counts as (
    select status, count(*)::integer as total
    from public.orders
    where created_at >= p_start and created_at < p_end
    group by status
  ),
  attribution_counts as (
    select
      coalesce(
        nullif(first_touch_attribution ->> 'source', ''),
        nullif(first_touch_attribution ->> 'referrerHost', ''),
        'direct'
      ) as source,
      count(*)::integer as total
    from public.orders
    where created_at >= p_start and created_at < p_end
    group by 1
  ),
  review_reason_counts as (
    select coalesce(purchase_reason, 'not_answered') as reason,
      count(*)::integer as total
    from public.reviews
    where created_at >= p_start and created_at < p_end
    group by 1
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start', p_start, 'end', p_end),
    'events', jsonb_build_object(
      'total', (
        select count(*) from public.growth_events
        where created_at >= p_start and created_at < p_end
      ),
      'uniqueSessions', (
        select count(distinct session_id) from public.growth_events
        where created_at >= p_start and created_at < p_end
      ),
      'byName', coalesce(
        (select jsonb_object_agg(event_name, total) from event_counts),
        '{}'::jsonb
      )
    ),
    'feedback', jsonb_build_object(
      'total', (
        select count(*) from public.customer_feedback
        where created_at >= p_start and created_at < p_end
      ),
      'byType', coalesce(
        (
          select jsonb_object_agg(feedback_type, total)
          from feedback_type_counts
        ),
        '{}'::jsonb
      ),
      'cancellationReasons', coalesce(
        (select jsonb_object_agg(reason, total) from cancellation_counts),
        '{}'::jsonb
      ),
      'draftQuality', jsonb_build_object(
        'averageRating', (
          select round(avg(rating)::numeric, 2)
          from public.customer_feedback
          where feedback_type = 'draft_quality'
            and created_at >= p_start and created_at < p_end
        ),
        'ratings', coalesce(
          (select jsonb_object_agg(rating, total) from quality_rating_counts),
          '{}'::jsonb
        ),
        'reasons', coalesce(
          (select jsonb_object_agg(reason, total) from quality_reason_counts),
          '{}'::jsonb
        )
      )
    ),
    'orders', jsonb_build_object(
      'total', (
        select count(*) from public.orders
        where created_at >= p_start and created_at < p_end
      ),
      'byStatus', coalesce(
        (select jsonb_object_agg(status, total) from order_status_counts),
        '{}'::jsonb
      ),
      'byFirstTouchSource', coalesce(
        (select jsonb_object_agg(source, total) from attribution_counts),
        '{}'::jsonb
      ),
      'grossRevenueUsd', (
        select round((count(*) * 34.99)::numeric, 2)
        from public.orders
        where status = 'fulfilled'
          and fulfilled_at >= p_start and fulfilled_at < p_end
      )
    ),
    'reviews', jsonb_build_object(
      'total', (
        select count(*) from public.reviews
        where created_at >= p_start and created_at < p_end
      ),
      'averageRating', (
        select round(avg(rating)::numeric, 2) from public.reviews
        where created_at >= p_start and created_at < p_end
      ),
      'improvementNotesProvided', (
        select count(*) from public.reviews
        where improvement is not null
          and created_at >= p_start and created_at < p_end
      ),
      'purchaseReasons', coalesce(
        (select jsonb_object_agg(reason, total) from review_reason_counts),
        '{}'::jsonb
      )
    )
  );
$$;

revoke all on function public.purge_expired_growth_events() from public;
revoke all on function public.growth_report(timestamptz, timestamptz) from public;
grant execute on function public.purge_expired_growth_events() to service_role;
grant execute on function public.growth_report(timestamptz, timestamptz)
  to service_role;

create table if not exists public.generation_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1
);

alter table public.generation_limits enable row level security;

create or replace function public.check_generation_limit(
  p_key text,
  p_limit integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.generation_limits as limits (
    key_hash,
    window_started_at,
    request_count
  )
  values (p_key, now(), 1)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when limits.window_started_at < now() - interval '10 minutes'
        then now()
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at < now() - interval '10 minutes'
        then 1
      else limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;
-- RevenueOS ledger tables (customer-zero install on TributeReady).
-- No memorial/customer PII. Safe to apply when DDL access is available.

create table if not exists public.revenueos_experiments (
  id text primary key,
  site_id text not null,
  status text not null,
  hypothesis jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  predicted_outcome text,
  actual_outcome text,
  lesson_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.revenueos_actions (
  id bigserial primary key,
  experiment_id text references public.revenueos_experiments(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.revenueos_lessons (
  id text primary key,
  scope text not null check (scope in ('global', 'industry', 'site')),
  site_id text,
  industry text,
  pattern_key text not null,
  summary text not null,
  evidence_count integer not null default 1,
  transferable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenueos_scorecard_snapshots (
  id bigserial primary key,
  site_id text not null,
  scorecard jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists revenueos_experiments_site_idx
  on public.revenueos_experiments (site_id, created_at desc);
create index if not exists revenueos_lessons_scope_idx
  on public.revenueos_lessons (scope, industry, site_id);
create index if not exists revenueos_scorecard_site_idx
  on public.revenueos_scorecard_snapshots (site_id, created_at desc);

alter table public.revenueos_experiments enable row level security;
alter table public.revenueos_actions enable row level security;
alter table public.revenueos_lessons enable row level security;
alter table public.revenueos_scorecard_snapshots enable row level security;

-- end revenueos schema

