-- CheckPeak Film Intelligence — database migration
-- Run in Supabase SQL editor or via supabase db push

-- ── Clean slate: drop any partial tables from previous attempts ───────────────
-- CASCADE removes dependent indexes and foreign keys automatically
DROP TABLE IF EXISTS lineup_analytics CASCADE;
DROP TABLE IF EXISTS play_lineups     CASCADE;
DROP TABLE IF EXISTS player_tracks    CASCADE;
DROP TABLE IF EXISTS game_plays       CASCADE;
DROP TABLE IF EXISTS game_films       CASCADE;

-- ── game_films ──────────────────────────────────────────────────────────────
-- One row per uploaded game film
CREATE TABLE IF NOT EXISTS game_films (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,              -- org token (matches organizations.token)
  title               text NOT NULL,              -- "vs Lincoln HS - Week 3"
  sport               text NOT NULL DEFAULT 'football',
  game_date           date,
  opponent            text,
  home_team           text,
  away_team           text,
  s3_key_raw          text,                       -- raw upload: raw/{orgId}/{filmId}.mp4
  s3_key_processed    text,                       -- transcoded: processed/{filmId}.mp4
  duration_secs       int,
  frame_rate          numeric(6,3),
  width_px            int,
  height_px           int,
  homography_json     jsonb,                      -- pixel→yards calibration matrix
  status              text NOT NULL DEFAULT 'uploading',
  --   uploading | transcoding | analyzing | tagging | ready | failed
  progress_pct        int DEFAULT 0,              -- 0-100 for UI progress bar
  error_message       text,
  play_count          int DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_films_org    ON game_films(org_id);
CREATE INDEX IF NOT EXISTS idx_game_films_status ON game_films(status);
CREATE INDEX IF NOT EXISTS idx_game_films_date   ON game_films(game_date DESC);

-- ── game_plays ───────────────────────────────────────────────────────────────
-- One row per detected (or manually tagged) play
CREATE TABLE IF NOT EXISTS game_plays (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id             uuid NOT NULL REFERENCES game_films(id) ON DELETE CASCADE,
  org_id              text NOT NULL,
  play_number         int NOT NULL,
  start_frame         int,
  end_frame           int,
  start_time_secs     numeric(8,3),               -- seconds from film start
  end_time_secs       numeric(8,3),
  clip_s3_key         text,                       -- clips/{filmId}/{playNumber}.mp4
  clip_url            text,                       -- CloudFront or presigned URL cache

  -- Football-specific tagging (nullable for other sports)
  formation           text,                       -- shotgun | under_center | wildcat | pistol
  play_type           text,                       -- run | pass | kick | penalty
  down                int,
  distance            int,
  field_zone          text,                       -- red_zone | midfield | own_territory
  yards_gained        numeric(5,1),
  result              text,                       -- success | failure | td | turnover | penalty

  tagged_by           text DEFAULT 'auto',        -- 'auto' or coach email
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_plays_film   ON game_plays(film_id);
CREATE INDEX IF NOT EXISTS idx_game_plays_org    ON game_plays(org_id);
CREATE INDEX IF NOT EXISTS idx_game_plays_type   ON game_plays(play_type);

-- ── player_tracks ─────────────────────────────────────────────────────────────
-- Per-player movement data within a single play
CREATE TABLE IF NOT EXISTS player_tracks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id             uuid NOT NULL REFERENCES game_plays(id) ON DELETE CASCADE,
  film_id             uuid NOT NULL,
  org_id              text NOT NULL,
  jersey_number       int,                        -- null until OCR confirms
  jersey_confidence   numeric(4,3),               -- 0.0–1.0 OCR confidence
  team                text,                       -- 'home' | 'away'
  rekognition_track_id text,                      -- Rekognition person tracking ID

  -- Position at snap (real-world field coords in yards from back of end zone)
  snap_x              numeric(6,2),
  snap_y              numeric(6,2),

  -- Route as sampled polyline [{t, x, y, vx, vy}] at 5fps
  route_json          jsonb,

  -- Derived metrics
  max_speed_mph       numeric(5,2),
  avg_speed_mph       numeric(5,2),
  accel_peak_ms2      numeric(6,3),               -- m/s² peak acceleration
  first_step_ms       int,                        -- ms from snap to first movement ≥ 0.5 mph
  distance_traveled_yd numeric(6,2),

  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_tracks_play    ON player_tracks(play_id);
CREATE INDEX IF NOT EXISTS idx_player_tracks_jersey  ON player_tracks(org_id, jersey_number);

-- ── play_lineups ──────────────────────────────────────────────────────────────
-- Lineup fingerprint per play (enables "when these players are on the field…")
CREATE TABLE IF NOT EXISTS play_lineups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id             uuid NOT NULL REFERENCES game_plays(id) ON DELETE CASCADE,
  org_id              text NOT NULL,
  lineup_hash         text NOT NULL,              -- SHA-256 of sorted home jersey numbers
  jersey_numbers      int[],                      -- e.g. {10,22,54,73,87}
  positions_json      jsonb                       -- {87: {x:12.4, y:26.1, role:'WR'}}
);

CREATE INDEX IF NOT EXISTS idx_play_lineups_hash ON play_lineups(org_id, lineup_hash);

-- ── lineup_analytics ──────────────────────────────────────────────────────────
-- Aggregated success rates: lineup × play_type → success%
-- Updated by trigger or worker after each game is processed
CREATE TABLE IF NOT EXISTS lineup_analytics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  lineup_hash         text NOT NULL,
  jersey_numbers      int[],
  play_type           text,                       -- run | pass | kick
  formation           text,
  attempts            int DEFAULT 0,
  successes           int DEFAULT 0,
  avg_yards           numeric(5,2),
  total_yards         numeric(8,2) DEFAULT 0,
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(org_id, lineup_hash, play_type, formation)
);

CREATE INDEX IF NOT EXISTS idx_lineup_analytics_org  ON lineup_analytics(org_id);
CREATE INDEX IF NOT EXISTS idx_lineup_analytics_hash ON lineup_analytics(org_id, lineup_hash);
