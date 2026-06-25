// pages/api/film/watch.js
// POST { filmId, playId? } — athlete marks a film/play as watched (upsert).
// Called from mobile feed when a play from that film is viewed.
// Returns { ok, watched_at }
//
// ── SQL migrations — run once in Supabase SQL editor ─────────────────────────
//
// CREATE TABLE IF NOT EXISTS film_watches (
//   id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   film_id          uuid REFERENCES game_films(id) ON DELETE CASCADE,
//   athlete_id       text NOT NULL,
//   athlete_name     text,
//   first_watched_at timestamptz DEFAULT now(),
//   last_watched_at  timestamptz DEFAULT now(),
//   UNIQUE(film_id, athlete_id)
// );
// CREATE INDEX IF NOT EXISTS idx_film_watches_film    ON film_watches(film_id);
// CREATE INDEX IF NOT EXISTS idx_film_watches_athlete ON film_watches(athlete_id);
// GRANT ALL ON public.film_watches TO service_role;
//
// CREATE TABLE IF NOT EXISTS play_watches (
//   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   play_id     uuid REFERENCES game_plays(id) ON DELETE CASCADE,
//   film_id     uuid REFERENCES game_films(id) ON DELETE CASCADE,
//   athlete_id  text NOT NULL,
//   watched_at  timestamptz DEFAULT now(),
//   UNIQUE(play_id, athlete_id)
// );
// CREATE INDEX IF NOT EXISTS idx_play_watches_film    ON play_watches(film_id);
// CREATE INDEX IF NOT EXISTS idx_play_watches_athlete ON play_watches(athlete_id);
// GRANT ALL ON public.play_watches TO service_role;
//
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const athleteId   = String(user.email || user.Email || user.id || user.athlete_token || "").trim().toLowerCase();
  const athleteName = String(user.name || user.Name || user.full_name || user.email || user.Email || "").trim();
  const filmId      = String(req.body?.filmId || "").trim();
  const playId      = String(req.body?.playId || "").trim();

  if (!filmId || !athleteId) return res.status(400).json({ error: "filmId required" });

  try {
    // Verify film exists and is published
    const { data: film } = await supabase
      .from("game_films")
      .select("id, is_published, org_id")
      .eq("id", filmId)
      .maybeSingle();

    if (!film || !film.is_published) return res.status(404).json({ error: "Film not found or not published" });

    const now = new Date().toISOString();

    // Upsert film-level watch
    const { data, error } = await supabase
      .from("film_watches")
      .upsert(
        { film_id: filmId, athlete_id: athleteId, athlete_name: athleteName, last_watched_at: now },
        { onConflict: "film_id,athlete_id", ignoreDuplicates: false }
      )
      .select("last_watched_at")
      .single();

    if (error) throw error;

    // Upsert play-level watch if playId provided
    if (playId) {
      await supabase
        .from("play_watches")
        .upsert(
          { play_id: playId, film_id: filmId, athlete_id: athleteId, watched_at: now },
          { onConflict: "play_id,athlete_id", ignoreDuplicates: true }
        );
    }

    return res.status(200).json({ ok: true, watched_at: data?.last_watched_at ?? now });
  } catch (err) {
    console.error("[film/watch]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
