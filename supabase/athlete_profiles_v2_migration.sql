-- athlete_profiles v2 — new columns + profile_views table
-- Run this in your Supabase SQL editor

ALTER TABLE athlete_profiles
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
  ADD COLUMN IF NOT EXISTS achievements  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hudl_url      TEXT;

-- Time-based view tracking for analytics
CREATE TABLE IF NOT EXISTS profile_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token TEXT        NOT NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_token ON profile_views (share_token);
CREATE INDEX IF NOT EXISTS idx_profile_views_time  ON profile_views (share_token, viewed_at);
