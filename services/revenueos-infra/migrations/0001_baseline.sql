-- RevenueOS native baseline schema (PostgreSQL 15-compatible).
-- Owned by RevenueOS — not a dump of Supabase internals.

CREATE TABLE IF NOT EXISTS ros_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ros_businesses (
  site_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  industry TEXT,
  app_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ros_pursuits (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  state TEXT NOT NULL,
  pattern_key TEXT,
  action_type TEXT,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ros_pursuits_site_idx ON ros_pursuits (site_id);

CREATE TABLE IF NOT EXISTS ros_events (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ros_events_site_created_idx ON ros_events (site_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ros_lessons (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ros_experiments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ros_experiments_category_idx ON ros_experiments (category);

CREATE TABLE IF NOT EXISTS ros_claims (
  site_id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ros_leases (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  document JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ros_scorecards (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ros_portfolio_state (
  id TEXT PRIMARY KEY,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ros_jobs (
  job_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  lease_owner TEXT,
  lease_expiration TIMESTAMPTZ,
  error TEXT,
  checkpoint JSONB,
  result JSONB
);
CREATE INDEX IF NOT EXISTS ros_jobs_claim_idx
  ON ros_jobs (status, scheduled_at, priority)
  WHERE status IN ('QUEUED', 'RETRY_WAIT');

CREATE TABLE IF NOT EXISTS ros_activity (
  id TEXT PRIMARY KEY,
  site_id TEXT,
  at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  quality TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ros_activity_at_idx ON ros_activity (at DESC);

CREATE TABLE IF NOT EXISTS ros_releases (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  version TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  health TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ros_health (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  state TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ros_health_subject_uidx
  ON ros_health (subject_type, subject_id);

CREATE TABLE IF NOT EXISTS ros_config_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
