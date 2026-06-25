// pages/api/film/required.js
// GET ?_authUser=... — returns published CARA films for the athlete's org
// with this athlete's per-film play-watch count.
//
// Response: { ok, films: [{ id, title, opponent, game_date, mux_playback_id,
//   play_count, watched_count, watch_due_date }] }

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

  const orgId     = String(user.orgToken || user.org_token || user.Token || user.orgId || user.organizationId || user.OrganizationId || "").trim();
  const athleteId = String(user.email || user.Email || user.id || user.athlete_token || "").trim().toLowerCase();

  if (!orgId || !athleteId) return res.status(400).json({ error: "Missing org or athlete identity" });

  try {
    const { data: films, error: filmErr } = await supabase
      .from("game_films")
      .select("id, title, opponent, game_date, mux_playback_id, play_count, watch_due_date")
      .eq("org_id", orgId)
      .eq("is_published", true)
      .eq("viewing_type", "cara")
      .order("watch_due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (filmErr) throw filmErr;
    if (!films?.length) return res.status(200).json({ ok: true, films: [] });

    const filmIds = films.map(f => f.id);

    // Count how many plays this athlete has watched per film
    const { data: watches } = await supabase
      .from("play_watches")
      .select("film_id")
      .eq("athlete_id", athleteId)
      .in("film_id", filmIds);

    const watchedByFilm = {};
    for (const w of watches ?? []) {
      watchedByFilm[w.film_id] = (watchedByFilm[w.film_id] || 0) + 1;
    }

    const result = films.map(f => ({
      id:             f.id,
      title:          f.title          ?? "Untitled Film",
      opponent:       f.opponent       ?? null,
      game_date:      f.game_date      ?? null,
      mux_playback_id: f.mux_playback_id ?? null,
      play_count:     f.play_count     ?? 0,
      watched_count:  watchedByFilm[f.id] ?? 0,
      watch_due_date: f.watch_due_date ?? null,
    }));

    return res.status(200).json({ ok: true, films: result });
  } catch (err) {
    console.error("[film/required]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
