// pages/api/film/watch-stats.js
// GET ?filmId=uuid — returns who has watched a film and how many plays (coach only).
// Returns { ok, watched_count, total_plays, watchers: [{ athlete_name, last_watched_at, plays_watched, total_plays }] }

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.org_token || user.Token || user.orgId || user.org_id || user.OrgId || "").trim();
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    // Verify film belongs to this org
    const { data: film } = await supabase
      .from("game_films")
      .select("id, org_id")
      .eq("id", filmId)
      .maybeSingle();

    if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });

    // Fetch film-level watches + total play count + per-athlete play counts in parallel
    const [
      { data: watches, error: watchError },
      { count: totalPlays },
      { data: playWatches },
    ] = await Promise.all([
      supabase
        .from("film_watches")
        .select("athlete_id, athlete_name, last_watched_at")
        .eq("film_id", filmId)
        .order("last_watched_at", { ascending: false }),
      supabase
        .from("game_plays")
        .select("id", { count: "exact", head: true })
        .eq("film_id", filmId),
      supabase
        .from("play_watches")
        .select("athlete_id")
        .eq("film_id", filmId),
    ]);

    if (watchError) throw watchError;

    // Count plays watched per athlete
    const playCountByAthlete = {};
    for (const pw of (playWatches ?? [])) {
      playCountByAthlete[pw.athlete_id] = (playCountByAthlete[pw.athlete_id] || 0) + 1;
    }

    const total = totalPlays ?? 0;

    return res.status(200).json({
      ok:            true,
      watched_count: watches?.length ?? 0,
      total_plays:   total,
      watchers:      (watches ?? []).map(w => ({
        athlete_id:      w.athlete_id,
        athlete_name:    w.athlete_name || w.athlete_id,
        last_watched_at: w.last_watched_at,
        plays_watched:   playCountByAthlete[w.athlete_id] ?? 0,
        total_plays:     total,
      })),
    });
  } catch (err) {
    console.error("[film/watch-stats]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
