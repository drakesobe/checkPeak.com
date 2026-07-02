-- onboarding_migration.sql
-- Adds onboarding_complete flag to athletes table.
-- Adds level column to athlete_profiles for HS / college / pro segmentation.
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_athletes_onboarding
  ON athletes (athlete_token)
  WHERE onboarding_complete = FALSE;

-- level: 'highschool' | 'college' | 'pro'
-- Used for NIL eligibility, transfer portal, benchmark segmentation, profile framing.
ALTER TABLE athlete_profiles
  ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('highschool', 'college', 'pro')) DEFAULT NULL;
