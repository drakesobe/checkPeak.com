-- athlete_saved_meals_migration.sql
-- Named meals an athlete can log in one tap ("Pre-game meal", "Usual breakfast").
-- items: [{ food_name, food_id, quantity, unit, grams, calories, protein_g, carbs_g, fat_g }]
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS athlete_saved_meals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_token  text        NOT NULL,
  name           text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  items          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  use_count      integer     NOT NULL DEFAULT 0,
  last_used_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_meals_athlete ON athlete_saved_meals (athlete_token, last_used_at DESC NULLS LAST);

ALTER TABLE athlete_saved_meals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_saved_meals TO service_role;
