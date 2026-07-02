-- recruit_messages_migration.sql
-- Stores recruiter contact messages for athlete inbox.
-- Safe to run multiple times (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS recruit_messages (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_token TEXT        NOT NULL,
  share_token   TEXT        NOT NULL,
  sender_name   TEXT        NOT NULL,
  sender_email  TEXT        NOT NULL,
  sender_org    TEXT,
  message       TEXT        NOT NULL,
  read          BOOLEAN     DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruit_messages_athlete
  ON recruit_messages (athlete_token, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recruit_messages_unread
  ON recruit_messages (athlete_token, read)
  WHERE read = FALSE;
