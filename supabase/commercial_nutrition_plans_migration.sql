-- supabase/commercial_nutrition_plans_migration.sql
-- Nutrition plan templates for the commercial trainer platform.
-- Run in Supabase SQL editor after schema.sql.

CREATE TABLE IF NOT EXISTS commercial_nutrition_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id   UUID REFERENCES trainers(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  tier         TEXT NOT NULL DEFAULT 'Basic',
  phase        TEXT NOT NULL DEFAULT 'Maintain',
  published    BOOLEAN NOT NULL DEFAULT false,
  plan_json    JSONB NOT NULL DEFAULT '{}',
  prescription TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_nutrition_plans_trainer_id_idx
  ON commercial_nutrition_plans(trainer_id);

ALTER TABLE commercial_nutrition_plans ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_nutrition_plans TO service_role;
