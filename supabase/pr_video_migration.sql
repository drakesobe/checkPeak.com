-- pr_video_migration.sql
-- Adds video_url to set_logs so athletes can attach PR film clips.
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE set_logs
  ADD COLUMN IF NOT EXISTS video_url TEXT;

CREATE INDEX IF NOT EXISTS idx_set_logs_video_url
  ON set_logs (athlete_token, video_url)
  WHERE video_url IS NOT NULL;
