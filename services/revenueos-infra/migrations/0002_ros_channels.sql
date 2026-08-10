-- ros_channels + provenance columns for allowlisted platform import.
-- Channels were platform state in legacy revenueos_channels but absent from 0001.

CREATE TABLE IF NOT EXISTS ros_channels (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT 'default',
  capability_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ros_channels_site_idx ON ros_channels (site_id);
CREATE INDEX IF NOT EXISTS ros_channels_platform_idx ON ros_channels (platform, status);

-- Provenance on importable platform tables (SUPABASE_LEGACY | LOCAL_LEDGER | ENGINE_CHECKPOINT | SCHEDULER_CHECKPOINT)
ALTER TABLE ros_businesses ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_experiments ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_pursuits ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_events ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_lessons ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_scorecards ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_leases ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_claims ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_activity ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_portfolio_state ADD COLUMN IF NOT EXISTS provenance TEXT;
ALTER TABLE ros_config_meta ADD COLUMN IF NOT EXISTS provenance TEXT;
