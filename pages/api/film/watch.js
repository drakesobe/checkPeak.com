// pages/api/film/watch.js
// POST { filmId } — athlete marks a film as watched (upsert).
// Called from mobile feed when a play from that film is viewed.
// Returns { ok, watched_at }
//
// ── SQL migration — run once in Supabase SQL editor ──────────────────────────
//
// CREATE TABLE IF NOT EXISTS film_watches (
//   id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   film_id         uuid REFERENCES game_films(id) ON DELETE CASCADE,
//   athlete_id      text NOT NULL,
//   athlete_name    text,
//   first_watched_at timestamptz DEFAULT now(),
//   last_watched_at  timestamptz DEFAULT now(),
//   UNIQUE(film_id, athlete_id)
// );
// CREATE INDEX IF NOT EXISTS idx_film_watches_film    ON film_watches(film_id);
// CREATE INDEX IF NOT EXISTS idx_film_watches_athlete ON film_watches(athlete_id);
// GRANT ALL ON public.film_watches TO service_role;
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

  const athleteId   = String(user.email || user.id || "").trim().toLowerCase();
  const athleteName = String(user.name || user.full_name || user.email || "").trim();
  const filmId      = String(req.body?.filmId || "").trim();

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

    const { data, error } = await supabase
      .from("film_watches")
      .upsert(
        { film_id: filmId, athlete_id: athleteId, athlete_name: athleteName, last_watched_at: now },
        { onConflict: "film_id,athlete_id", ignoreDuplicates: false }
      )
      .select("last_watched_at")
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, watched_at: data?.last_watched_at ?? now });
  } catch (err) {
    console.error("[film/watch]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
