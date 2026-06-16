-- supabase/coach_tables.sql
-- Tables backing the 5 coach screens: Pulse (existing), Queue (Airtable),
-- Schedule (org_events), Feed (org_announcements + org_messages), Film (existing).
-- Run in Supabase SQL editor.

-- ── Schedule Events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_token        text NOT NULL,
  title            text NOT NULL,
  type             text NOT NULL DEFAULT 'practice',
    -- practice | game | workout | film | conditioning | other
  event_date       date NOT NULL,
  start_minutes    int  NOT NULL DEFAULT 0,    -- minutes from midnight (0–1439)
  duration_minutes int  NOT NULL DEFAULT 60,
  location         text,
  notes            text,
  group_name       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_events_org_date
  ON org_events (org_token, event_date);

-- ── Announcements ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_token   text NOT NULL,
  author_name text NOT NULL DEFAULT 'Coach',
  content     text NOT NULL,
  like_count  int  NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_announcements_org
  ON org_announcements (org_token, created_at DESC);

-- Likes are tracked per-athlete to support a toggle but we just expose the count
-- in the announcement itself for simplicity (increment/decrement on toggle).
CREATE TABLE IF NOT EXISTS org_announcement_likes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES org_announcements(id) ON DELETE CASCADE,
  athlete_id      text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (announcement_id, athlete_id)
);

-- ── Direct Messages (coach ↔ athlete threads) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS org_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_token    text NOT NULL,
  athlete_id   text NOT NULL,   -- the athlete's UUID (from athletes.id)
  athlete_name text NOT NULL DEFAULT '',
  from_coach   boolean NOT NULL DEFAULT true,
  text         text NOT NULL,
  read_at      timestamptz,     -- null = unread (when from_coach=false)
  sent_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_messages_thread
  ON org_messages (org_token, athlete_id, sent_at);

CREATE INDEX IF NOT EXISTS org_messages_unread
  ON org_messages (org_token, from_coach, read_at)
  WHERE read_at IS NULL;
