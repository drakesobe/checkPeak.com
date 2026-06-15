-- CheckPeak Roster + Jersey Confirmation — run in Supabase SQL editor

-- ── roster ────────────────────────────────────────────────────────────────────
-- Team player directory. One row per jersey number per org.
CREATE TABLE IF NOT EXISTS roster (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        text NOT NULL,
  jersey_number int  NOT NULL,
  player_name   text NOT NULL,
  position      text,              -- QB | WR | RB | TE | OL | DL | LB | DB | K | P
  grade         text,              -- freshman | sophomore | junior | senior
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(org_id, jersey_number)
);

CREATE INDEX IF NOT EXISTS idx_roster_org ON roster(org_id);

-- ── player_tracks additions ───────────────────────────────────────────────────
-- Link each detected track to a confirmed roster player
ALTER TABLE player_tracks
  ADD COLUMN IF NOT EXISTS roster_id        uuid REFERENCES roster(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jersey_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_by     text;

CREATE INDEX IF NOT EXISTS idx_player_tracks_roster ON player_tracks(roster_id) WHERE roster_id IS NOT NULL;
