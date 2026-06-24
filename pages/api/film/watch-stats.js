// pages/api/film/watch-stats.js
// GET ?filmId=uuid — returns who has watched a film (coach only).
// Returns { ok, total_athletes, watched_count, watchers: [{ athlete_name, last_watched_at }] }

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

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
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

    const { data: watches, error } = await supabase
      .from("film_watches")
      .select("athlete_id, athlete_name, last_watched_at")
      .eq("film_id", filmId)
      .order("last_watched_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      ok:             true,
      watched_count:  watches?.length ?? 0,
      watchers:       (watches ?? []).map(w => ({
        athlete_name:    w.athlete_name || w.athlete_id,
        last_watched_at: w.last_watched_at,
      })),
    });
  } catch (err) {
    console.error("[film/watch-stats]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
