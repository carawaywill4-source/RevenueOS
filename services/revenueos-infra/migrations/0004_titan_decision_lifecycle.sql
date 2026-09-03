-- Titan admission/rework decision experiments + closed-loop measurement.
-- Complements titan_acquisition_experiments with the same evidence→action→measure→lesson loop.

create table if not exists titan_decision_experiments (
  id text primary key,
  business_id text not null,
  candidate_id text not null,
  decision_type text not null,
  evidence_pack_id text,
  research_run_id text,
  gate_score numeric,
  gate_reason text,
  hypothesis text not null,
  mutation_requested text not null,
  mutation_authorization text,
  mutation_started_at timestamptz,
  baseline_state jsonb not null default '{}'::jsonb,
  expected_result text,
  measurement_method text,
  measurement_window_sec int not null default 900,
  status text not null default 'PLANNED',
  measured_at timestamptz,
  measurement jsonb not null default '{}'::jsonb,
  result text,
  lesson_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists titan_decision_exp_biz_idx
  on titan_decision_experiments (business_id, created_at desc);
create index if not exists titan_decision_exp_status_idx
  on titan_decision_experiments (status);

-- Claim verification metadata columns (idempotent).
alter table titan_claims
  add column if not exists verification_method text;
alter table titan_claims
  add column if not exists supporting_source_ids text[] not null default '{}';
alter table titan_claims
  add column if not exists conflicting_source_ids text[] not null default '{}';
