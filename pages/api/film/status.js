// pages/api/film/status.js
// GET - poll processing status for a single film.
// Query: ?filmId=uuid&_authUser=...
// Returns: { status, progressPct, playCount, error? }
// Mobile polls this every 5s after upload completes.

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) {
    try { return JSON.parse(String(raw)); } catch {}
  }
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
    const { data: film, error } = await supabase
      .from("game_films")
      .select("id, title, sport, game_date, opponent, home_team, away_team, status, progress_pct, play_count, duration_secs, error_message, org_id, mux_playback_id")
      .eq("id", filmId)
      .single();

    if (error || !film) return res.status(404).json({ error: "Film not found" });
    if (film.org_id !== orgId) return res.status(403).json({ error: "Not authorized" });

    return res.status(200).json({
      ok:           true,
      title:        film.title        ?? "",
      sport:        film.sport        ?? "football",
      game_date:    film.game_date    ?? null,
      opponent:     film.opponent     ?? null,
      home_team:    film.home_team    ?? null,
      away_team:    film.away_team    ?? null,
      status:       film.status,
      progressPct:  film.progress_pct  ?? 0,
      play_count:   film.play_count    ?? 0,
      durationSecs:   film.duration_secs   ?? 0,
      muxPlaybackId: film.mux_playback_id ?? null,
      error:          film.error_message  ?? null,
    });
  } catch (err) {
    console.error("[film/status]", err);
    return res.status(500).json({ error: "Failed to fetch status", details: err?.message });
  }
}
