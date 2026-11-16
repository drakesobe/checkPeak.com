-- athlete_readiness_migration.sql
-- Daily morning readiness check-in (sleep, energy, soreness, stress, pain).
-- One row per athlete per day; score (0–100) is computed server-side by lib/readiness.js.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS athlete_readiness (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_token  text        NOT NULL,
  org_token      text,
  log_date       date        NOT NULL,
  sleep          smallint    NOT NULL CHECK (sleep    BETWEEN 1 AND 5),  -- 5 = great
  energy         smallint    NOT NULL CHECK (energy   BETWEEN 1 AND 5),  -- 5 = high
  soreness       smallint    NOT NULL CHECK (soreness BETWEEN 1 AND 5),  -- 5 = very sore
  stress         smallint    NOT NULL CHECK (stress   BETWEEN 1 AND 5),  -- 5 = very stressed
  sleep_hours    numeric(3,1),
  pain           boolean     NOT NULL DEFAULT false,
  pain_note      text,
  score          smallint    NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_token, log_date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_org_date     ON athlete_readiness (org_token, log_date);
CREATE INDEX IF NOT EXISTS idx_readiness_athlete_date ON athlete_readiness (athlete_token, log_date DESC);

-- API routes use the service role; block direct anon/client access.
ALTER TABLE athlete_readiness ENABLE ROW LEVEL SECURITY;

-- The API reads and writes with the service role. Tables created in the SQL editor don't always
-- inherit its privileges, which shows up as "permission denied for table athlete_readiness".
GRANT SELECT, INSERT, UPDATE, DELETE ON athlete_readiness TO service_role;
