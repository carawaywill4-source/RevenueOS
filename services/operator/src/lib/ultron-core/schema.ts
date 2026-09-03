/**
 * ULTRON ECONOMIC CORE — schema.
 *
 * Consolidates the missing cognitive substrate:
 *   - ros_world_facts       (Organ 1: world model with time + source + confidence)
 *   - ros_capability_graph  (Organ 2: proof-level C0–C6 + skill composition)
 *   - ros_skills            (Organ 2: executable reusable skills)
 *   - ros_events            (Organ 4: external event bus)
 *   - ros_proof_ledger      (Organ 5: queryable claims with evidence)
 *   - ros_closed_loop_defects (Organ 5: dangling/incomplete-loop watcher)
 *   - ros_curriculum_state  (Organ 3: M1–M9 progress)
 *   - ros_reasoning_events  (Organ 3: cognitive router trace + limits)
 *   - ros_first_task_state  (Organ 3: unknown external-exposure task loop)
 *
 * All tables are additive — existing capability-reality / titan-world-store /
 * autonomous-engineering tables are the source of truth and remain intact.
 */

import type pg from "pg";

export async function ensureUltronCoreTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_world_facts (
      fact_id text primary key,
      entity_kind text not null,
      entity_id text not null,
      predicate text not null,
      value jsonb not null default '{}'::jsonb,
      source text not null default '',
      observed_at timestamptz not null default now(),
      last_verified_at timestamptz not null default now(),
      expires_at timestamptz,
      confidence numeric not null default 0.5,
      contradicted_by text,
      consumed_by text[] not null default '{}',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists ros_world_facts_entity_idx
      on ros_world_facts (entity_kind, entity_id, predicate);
    create index if not exists ros_world_facts_stale_idx
      on ros_world_facts (expires_at);

    create table if not exists ros_capability_graph (
      capability_id text primary key,
      name text not null,
      domain text not null,
      description text not null default '',
      inputs jsonb not null default '{}'::jsonb,
      outputs jsonb not null default '{}'::jsonb,
      preconditions jsonb not null default '[]'::jsonb,
      authentication text not null default 'NONE',
      allowed_actions jsonb not null default '[]'::jsonb,
      constraints jsonb not null default '[]'::jsonb,
      financial_cost numeric not null default 0,
      compute_cost numeric not null default 0,
      risk text not null default 'LOW',
      latency_ms integer not null default 0,
      proof_level text not null default 'C0_DISCOVERED',
      success_rate numeric not null default 0,
      commercial_history jsonb not null default '{}'::jsonb,
      last_verified_at timestamptz,
      owner_dependency boolean not null default false,
      registry_ref text,
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    create index if not exists ros_capability_graph_proof_idx
      on ros_capability_graph (proof_level);

    create table if not exists ros_skills (
      skill_id text primary key,
      purpose text not null,
      preconditions jsonb not null default '[]'::jsonb,
      capabilities_used text[] not null default '{}',
      executable_impl jsonb not null default '{}'::jsonb,
      input_schema jsonb not null default '{}'::jsonb,
      output_schema jsonb not null default '{}'::jsonb,
      platform text not null default '',
      domain text not null default '',
      risk text not null default 'LOW',
      cost numeric not null default 0,
      proof_level text not null default 'C0_DISCOVERED',
      success_count integer not null default 0,
      failure_count integer not null default 0,
      when_to_use text not null default '',
      when_not_to_use text not null default '',
      version integer not null default 1,
      last_executed_at timestamptz,
      meta jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_ultron_events (
      event_id text primary key,
      kind text not null,
      source text not null,
      business_id text,
      project_id text,
      action_id text,
      payload jsonb not null default '{}'::jsonb,
      confidence numeric not null default 0.7,
      evidence text not null default '',
      consumers text[] not null default '{}',
      created_at timestamptz not null default now()
    );
    create index if not exists ros_ultron_events_kind_idx
      on ros_ultron_events (kind, created_at desc);
    create index if not exists ros_ultron_events_business_idx
      on ros_ultron_events (business_id, created_at desc);
    create index if not exists ros_ultron_events_unconsumed_idx
      on ros_ultron_events (created_at desc)
      where cardinality(consumers) = 0;

    create table if not exists ros_proof_ledger (
      claim_id text primary key,
      claim text not null,
      subject text not null,
      proof_level text not null default 'C0_DISCOVERED',
      evidence jsonb not null default '[]'::jsonb,
      last_verified_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_closed_loop_defects (
      defect_id text primary key,
      kind text not null,
      subject text not null,
      detail text not null default '',
      severity text not null default 'MEDIUM',
      status text not null default 'OPEN',
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      resolved_at timestamptz,
      meta jsonb not null default '{}'::jsonb
    );
    create index if not exists ros_closed_loop_defects_status_idx
      on ros_closed_loop_defects (status, kind);

    create table if not exists ros_curriculum_state (
      milestone_id text primary key,
      description text not null,
      status text not null default 'PENDING',
      achieved_at timestamptz,
      evidence jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_reasoning_events (
      event_id text primary key,
      tier text not null,
      task text not null,
      required_tier text not null default 'DETERMINISTIC',
      authorized_tier text not null default 'DETERMINISTIC',
      limitation_recorded boolean not null default false,
      detail text not null default '',
      duration_ms integer not null default 0,
      created_at timestamptz not null default now()
    );

    create table if not exists ros_first_task_state (
      task_id text primary key,
      objective text not null,
      status text not null default 'PLANNING',
      selected_business text,
      selected_strategy text,
      selected_capability text,
      candidate_plans jsonb not null default '[]'::jsonb,
      critic_notes jsonb not null default '[]'::jsonb,
      chosen_plan_id text,
      why_chosen text not null default '',
      why_others_lost text[] not null default '{}',
      predictions jsonb not null default '{}'::jsonb,
      execution_trace jsonb not null default '[]'::jsonb,
      external_effect jsonb not null default '{}'::jsonb,
      proof_level text not null default 'E0_KNOWLEDGE',
      economic_proof_level text not null default 'E0_KNOWLEDGE',
      reflection jsonb not null default '{}'::jsonb,
      new_capabilities jsonb not null default '[]'::jsonb,
      new_skills jsonb not null default '[]'::jsonb,
      new_world_knowledge jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_gap_map (
      snapshot_id text primary key,
      taken_at timestamptz not null default now(),
      map jsonb not null default '{}'::jsonb,
      missing_links jsonb not null default '[]'::jsonb,
      organs jsonb not null default '{}'::jsonb
    );
  `);
}
