-- team_challenges_migration.sql
-- Coach-created team challenges. Progress is computed live from existing data
-- (readiness check-ins, set_logs, athlete_food_logs) — nothing is self-reported.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS team_challenges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_token   text        NOT NULL,
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  metric      text        NOT NULL CHECK (metric IN ('checkins', 'workout_days', 'food_days', 'prs', 'volume')),
  goal        integer     CHECK (goal IS NULL OR goal > 0),
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_team_challenges_org ON team_challenges (org_token, end_date DESC);

ALTER TABLE team_challenges ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_challenges TO service_role;
