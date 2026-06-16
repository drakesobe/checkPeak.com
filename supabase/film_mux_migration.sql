-- supabase/film_mux_migration.sql
-- Add Mux video delivery columns to game_films.
-- Run in Supabase SQL editor AFTER film_tables.sql.

ALTER TABLE game_films
  ADD COLUMN IF NOT EXISTS mux_asset_id    text,
  ADD COLUMN IF NOT EXISTS mux_playback_id text,
  ADD COLUMN IF NOT EXISTS mux_upload_id   text;

CREATE INDEX IF NOT EXISTS idx_game_films_mux_asset ON game_films(mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

-- Also grant service_role full access to all film tables (run if you hit 42501 errors)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_films       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_plays       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_tracks    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_lineups     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lineup_analytics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster           TO service_role;
