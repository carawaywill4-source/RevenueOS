-- Titan World Intelligence schema (durable commercial knowledge).
-- WEB CONTENT = EVIDENCE ONLY. Never authority.

create table if not exists titan_sources (
  id text primary key,
  source_type text not null,
  url text,
  title text,
  quality_tier text not null default 'UNKNOWN',
  trust_notes text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists titan_documents (
  id text primary key,
  source_id text references titan_sources(id) on delete set null,
  url text,
  retrieved_at timestamptz not null default now(),
  published_at timestamptz,
  title text,
  content_text text,
  content_hash text,
  injection_flagged boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists titan_documents_fts
  on titan_documents using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content_text,'')));

create table if not exists titan_claims (
  id text primary key,
  topic text not null,
  claim text not null,
  entities text[] not null default '{}',
  source_id text references titan_sources(id) on delete set null,
  source_url text,
  source_type text,
  retrieved_at timestamptz not null default now(),
  published_at timestamptz,
  confidence numeric not null default 0.4,
  evidence_quality text not null default 'UNVERIFIED',
  freshness_category text not null default 'MEDIUM',
  last_verified_at timestamptz,
  next_verification_at timestamptz,
  supporting jsonb not null default '[]'::jsonb,
  contradicting jsonb not null default '[]'::jsonb,
  affected_businesses text[] not null default '{}',
  commercial_relevance text,
  status text not null default 'UNVERIFIED',
  meta jsonb not null default '{}'::jsonb
);

create index if not exists titan_claims_topic_idx on titan_claims (topic);
create index if not exists titan_claims_status_idx on titan_claims (status);
create index if not exists titan_claims_fts
  on titan_claims using gin (to_tsvector('english', claim || ' ' || coalesce(topic,'')));

create table if not exists titan_entities (
  id text primary key,
  kind text not null,
  name text not null,
  aliases text[] not null default '{}',
  attributes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists titan_entities_kind_idx on titan_entities (kind);
create index if not exists titan_entities_name_idx on titan_entities (lower(name));

create table if not exists titan_relationships (
  id text primary key,
  from_entity text not null references titan_entities(id) on delete cascade,
  to_entity text not null references titan_entities(id) on delete cascade,
  relation text not null,
  weight numeric not null default 1,
  evidence_claim_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists titan_research_runs (
  id text primary key,
  question text not null,
  business_id text,
  purpose text not null,
  status text not null default 'RUNNING',
  plan jsonb not null default '{}'::jsonb,
  sources_inspected int not null default 0,
  useful_sources int not null default 0,
  claims_created int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result_summary text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists titan_research_runs_biz_idx on titan_research_runs (business_id);

create table if not exists titan_evidence_packs (
  id text primary key,
  business_id text not null,
  purpose text not null,
  created_at timestamptz not null default now(),
  decision_hint text,
  pack jsonb not null,
  claim_ids text[] not null default '{}',
  research_run_id text
);

create index if not exists titan_evidence_packs_biz_idx on titan_evidence_packs (business_id, created_at desc);

create table if not exists titan_market_models (
  id text primary key,
  industry text not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists titan_customer_models (
  id text primary key,
  business_id text not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists titan_customer_models_biz_uidx
  on titan_customer_models (business_id);

create table if not exists titan_competitor_models (
  id text primary key,
  business_id text,
  competitor_name text not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists titan_channel_models (
  id text primary key,
  business_id text,
  channel text not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists titan_opportunity_models (
  id text primary key,
  title text not null,
  document jsonb not null,
  score numeric,
  updated_at timestamptz not null default now()
);

create table if not exists titan_contradictions (
  id text primary key,
  topic text not null,
  claim_a text not null,
  claim_b text not null,
  status text not null default 'OPEN',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists titan_freshness_queue (
  id text primary key,
  claim_id text references titan_claims(id) on delete cascade,
  topic text,
  reason text not null,
  due_at timestamptz not null,
  status text not null default 'QUEUED',
  meta jsonb not null default '{}'::jsonb
);

create table if not exists titan_commercial_lessons (
  id text primary key,
  scope text not null,
  lesson text not null,
  evidence jsonb not null default '[]'::jsonb,
  business_ids text[] not null default '{}',
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists titan_acquisition_experiments (
  id text primary key,
  business_id text not null,
  hypothesis text not null,
  action text not null,
  channel text,
  status text not null default 'PLANNED',
  started_at timestamptz,
  measured_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  result text,
  lesson_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists titan_acq_exp_biz_idx on titan_acquisition_experiments (business_id);

create table if not exists titan_business_money_models (
  business_id text primary key,
  daily_target_usd numeric not null default 10000,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
