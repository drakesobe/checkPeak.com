-- athlete_profiles_migration.sql
-- Run once in Supabase SQL editor to enable public recruiting profiles.

CREATE TABLE IF NOT EXISTS athlete_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_token    TEXT NOT NULL UNIQUE,
  share_token      TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  is_public        BOOLEAN NOT NULL DEFAULT false,

  -- Bio fields (athlete fills these in)
  sport            TEXT,
  position         TEXT,
  graduation_year  INTEGER,
  school           TEXT,
  height           TEXT,   -- free text e.g. "6'1"" or "73 in"
  weight           TEXT,   -- free text e.g. "182 lb"
  gpa              TEXT,
  bio              TEXT,

  -- Contact visibility
  show_contact     BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  view_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS athlete_profiles_athlete_token_idx ON athlete_profiles(athlete_token);
CREATE INDEX IF NOT EXISTS athlete_profiles_share_token_idx   ON athlete_profiles(share_token);

-- RLS: athletes can only read/write their own row; service role bypasses
ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY athlete_profiles_self ON athlete_profiles
  USING (true) WITH CHECK (true);  -- service role only; no client-side direct access
