import type pg from "pg";

export async function ensureAutonomousEngineeringTables(
  pool: pg.Pool,
): Promise<void> {
  await pool.query(`
    create table if not exists ros_eng_limitations (
      limitation_id text primary key,
      title text not null,
      commercial_impact numeric not null default 0.5,
      evidence jsonb not null default '[]'::jsonb,
      root_cause_confidence numeric not null default 0.4,
      affected_components text[] not null default '{}',
      expected_value numeric not null default 0.5,
      risk text not null default 'MEDIUM',
      complexity numeric not null default 0.5,
      proposed_solutions jsonb not null default '[]'::jsonb,
      selected_solution_id text,
      test_plan jsonb not null default '[]'::jsonb,
      status text not null default 'DETECTED',
      technical_success text not null default '',
      commercial_success text not null default '',
      hypothesis_confidence numeric not null default 0.5,
      implementation_confidence numeric not null default 0.5,
      test_confidence numeric not null default 0.5,
      commercial_confidence numeric not null default 0.3,
      root_cause_report jsonb not null default '{}'::jsonb,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ros_eng_receipts (
      evolution_id text primary key,
      limitation_id text not null,
      result text not null,
      detail text not null default '',
      files_changed text[] not null default '{}',
      tests jsonb not null default '{}'::jsonb,
      deploy jsonb not null default '{}'::jsonb,
      commercial_effect text not null default '',
      rollback_available boolean not null default true,
      known_good_dir text,
      meta jsonb not null default '{}'::jsonb,
      started_at timestamptz not null default now(),
      completed_at timestamptz
    );

    create index if not exists ros_eng_limitations_status_idx
      on ros_eng_limitations (status, expected_value desc);
  `);
}
