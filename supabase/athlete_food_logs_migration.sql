-- supabase/athlete_food_logs_migration.sql
-- Per-meal food entries logged by athletes.
-- Run in Supabase SQL editor after schema.sql.

CREATE TABLE IF NOT EXISTS athlete_food_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_token TEXT        NOT NULL,
  log_date      DATE        NOT NULL,
  meal_id       TEXT        NOT NULL,          -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  food_name     TEXT        NOT NULL,
  food_id       TEXT,                          -- external food-db id, nullable
  quantity      NUMERIC     NOT NULL DEFAULT 1,
  unit          TEXT        NOT NULL DEFAULT 'serving',
  grams         NUMERIC     NOT NULL,
  calories      INTEGER     NOT NULL DEFAULT 0,
  protein_g     INTEGER     NOT NULL DEFAULT 0,
  carbs_g       INTEGER     NOT NULL DEFAULT 0,
  fat_g         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS athlete_food_logs_token_date_idx
  ON athlete_food_logs (athlete_token, log_date);

ALTER TABLE athlete_food_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_food_logs TO service_role;
