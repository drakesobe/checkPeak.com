// pages/api/film/player-stats.js
// GET - aggregate player_tracks by jersey across all films (or one film) for an org.
// Query: ?filmId=uuid (optional - omit for all films)

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

  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  try {
    // Build base query on player_tracks (joined to game_plays → game_films)
    let q = supabase
      .from("player_tracks")
      .select(`
        jersey_number, jersey_confirmed, team,
        max_speed_mph, avg_speed_mph, first_step_ms, accel_peak_ms2,
        roster_id,
        play:game_plays!inner ( id, result, play_type, film_id,
          film:game_films!inner ( id, title, org_id, game_date )
        )
      `)
      .eq("org_id", orgId)
      .not("jersey_number", "is", null);

    if (filmId) {
      q = q.eq("film_id", filmId);
    }

    const { data, error } = await q.limit(2000);
    if (error) throw error;

    // Aggregate by jersey_number
    const map = new Map();
    for (const t of data ?? []) {
      const key = t.jersey_number;
      if (!map.has(key)) {
        map.set(key, {
          jersey:       t.jersey_number,
          team:         t.team,
          rosterId:     t.roster_id,
          plays:        0,
          maxSpeed:     null,
          sumAvgSpd:    0,
          spdN:         0,
          bestStep:     null,
          bestAccel:    null,
          successes:    0,
          films:        new Set(),
          filmTitles:   {},
        });
      }
      const a = map.get(key);
      a.plays++;
      const filmObj = t.play?.film;
      if (filmObj?.id) {
        a.films.add(filmObj.id);
        a.filmTitles[filmObj.id] = filmObj.title;
      }
      if (t.max_speed_mph != null) a.maxSpeed = a.maxSpeed == null ? t.max_speed_mph : Math.max(a.maxSpeed, t.max_speed_mph);
      if (t.avg_speed_mph != null) { a.sumAvgSpd += t.avg_speed_mph; a.spdN++; }
      if (t.first_step_ms != null) a.bestStep = a.bestStep == null ? t.first_step_ms : Math.min(a.bestStep, t.first_step_ms);
      if (t.accel_peak_ms2 != null) a.bestAccel = a.bestAccel == null ? t.accel_peak_ms2 : Math.max(a.bestAccel, t.accel_peak_ms2);
      if (["success","td"].includes(String(t.play?.result ?? "").toLowerCase())) a.successes++;
    }

    const players = Array.from(map.values())
      .map(a => ({
        jersey:       a.jersey,
        team:         a.team,
        rosterId:     a.rosterId,
        plays:        a.plays,
        maxSpeed:     a.maxSpeed,
        avgSpeed:     a.spdN > 0 ? +(a.sumAvgSpd / a.spdN).toFixed(2) : null,
        bestFirstStep:a.bestStep,
        bestAccel:    a.bestAccel,
        successes:    a.successes,
        successRate:  a.plays > 0 ? +(a.successes / a.plays * 100).toFixed(1) : null,
        filmCount:    a.films.size,
        filmIds:      Array.from(a.films),
      }))
      .sort((a, b) => (b.maxSpeed ?? 0) - (a.maxSpeed ?? 0));

    return res.status(200).json({ ok: true, players });
  } catch (err) {
    console.error("[film/player-stats]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
