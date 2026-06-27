// pages/api/athlete/my-stats.js
// GET — returns aggregated season performance stats for the logged-in athlete.
// Resolution chain: athlete email → roster.player_name match → jersey_number
//   → player_tracks aggregates → per-game breakdown
//
// Response: {
//   ok, jersey, playerName, playCount, filmCount,
//   avgSpeed, peakSpeed, avgAccel, totalDistance,
//   byPlayType: [{ type, count, avgSpeed }],
//   recentGames: [{ filmTitle, opponent, gameDate, plays, avgSpeed }]
// }

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

  const athleteEmail = String(user.email || user.Email || "").trim().toLowerCase();
  const orgId        = String(user.orgToken || user.Token || user.orgId || user.OrgId || user.org_token || user.organizationId || "").trim();

  if (!athleteEmail || !orgId) return res.status(400).json({ error: "Missing athlete identity or org" });

  try {
    // 1. Find athlete name from athletes table
    const { data: athlete } = await supabase
      .from("athletes")
      .select("name, email")
      .ilike("email", athleteEmail)
      .eq("org_id", orgId)
      .maybeSingle();

    const athleteName = athlete?.name || null;
    if (!athleteName) return res.status(200).json({ ok: true, noData: true, reason: "Athlete not found in org" });

    // 2. Find jersey number(s) from roster by name match
    const { data: rosterRows } = await supabase
      .from("roster")
      .select("jersey_number, player_name")
      .eq("org_id", orgId)
      .ilike("player_name", athleteName);

    const jerseyNumbers = (rosterRows ?? []).map(r => r.jersey_number).filter(n => n != null);
    if (!jerseyNumbers.length) {
      return res.status(200).json({ ok: true, noData: true, reason: "No jersey number assigned", playerName: athleteName });
    }

    // 3. Fetch player_tracks joined with plays and films
    const { data: tracks, error: trackErr } = await supabase
      .from("player_tracks")
      .select(`
        id, jersey_number, max_speed_mph, avg_speed_mph, accel_peak_ms2,
        first_step_ms, distance_traveled_yd, team, created_at,
        game_plays!inner (
          id, play_type, result, down, distance,
          game_films!inner ( id, title, opponent, game_date, mux_playback_id )
        )
      `)
      .eq("org_id", orgId)
      .in("jersey_number", jerseyNumbers)
      .eq("team", "home")
      .not("max_speed_mph", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (trackErr) throw trackErr;
    if (!tracks?.length) {
      return res.status(200).json({ ok: true, noData: true, reason: "No tracking data found", playerName: athleteName, jersey: jerseyNumbers[0] });
    }

    // 4. Aggregate overall stats
    const playCount     = tracks.length;
    const speeds        = tracks.map(t => t.avg_speed_mph).filter(v => v != null);
    const peakSpeeds    = tracks.map(t => t.max_speed_mph).filter(v => v != null);
    const accels        = tracks.map(t => t.accel_peak_ms2).filter(v => v != null);
    const distances     = tracks.map(t => t.distance_traveled_yd).filter(v => v != null);
    const firstSteps    = tracks.map(t => t.first_step_ms).filter(v => v != null);

    const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
    const max = arr => arr.length ? arr.reduce((m, v) => v > m ? v : m, -Infinity) : null;

    const avgSpeed       = avg(speeds);
    const peakSpeed      = max(peakSpeeds);
    const avgAccel       = avg(accels);
    const totalDistanceYd = distances.reduce((s, v) => s + v, 0);
    const avgFirstStep   = avg(firstSteps);

    // 5. Play type breakdown
    const typeMap = {};
    for (const t of tracks) {
      const pt = t.game_plays?.play_type || "Unknown";
      if (!typeMap[pt]) typeMap[pt] = { count: 0, speedSum: 0, speedCount: 0 };
      typeMap[pt].count++;
      if (t.avg_speed_mph != null) { typeMap[pt].speedSum += t.avg_speed_mph; typeMap[pt].speedCount++; }
    }
    const byPlayType = Object.entries(typeMap)
      .map(([type, d]) => ({ type, count: d.count, avgSpeed: d.speedCount ? d.speedSum / d.speedCount : null }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 6. Per-game breakdown
    const filmMap = {};
    for (const t of tracks) {
      const film = t.game_plays?.game_films;
      if (!film?.id) continue;
      if (!filmMap[film.id]) filmMap[film.id] = { film, plays: 0, speedSum: 0, speedCount: 0, peakSpeed: 0 };
      filmMap[film.id].plays++;
      if (t.avg_speed_mph != null) { filmMap[film.id].speedSum += t.avg_speed_mph; filmMap[film.id].speedCount++; }
      if (t.max_speed_mph != null && t.max_speed_mph > filmMap[film.id].peakSpeed) filmMap[film.id].peakSpeed = t.max_speed_mph;
    }

    const recentGames = Object.values(filmMap)
      .map(({ film, plays, speedSum, speedCount, peakSpeed: ps }) => ({
        filmId:    film.id,
        filmTitle: film.title || "Untitled",
        opponent:  film.opponent || null,
        gameDate:  film.game_date || null,
        thumb:     film.mux_playback_id
          ? `https://image.mux.com/${film.mux_playback_id}/thumbnail.jpg?time=5&width=300&fit_mode=preserve`
          : null,
        plays,
        avgSpeed:  speedCount ? speedSum / speedCount : null,
        peakSpeed: ps || null,
      }))
      .sort((a, b) => {
        if (a.gameDate && b.gameDate) return new Date(b.gameDate) - new Date(a.gameDate);
        return 0;
      })
      .slice(0, 10);

    const uniqueFilmIds = new Set(tracks.map(t => t.game_plays?.game_films?.id).filter(Boolean));

    return res.status(200).json({
      ok:             true,
      playerName:     athleteName,
      jersey:         jerseyNumbers[0],
      playCount,
      filmCount:      uniqueFilmIds.size,
      avgSpeed:       avgSpeed   ? Math.round(avgSpeed   * 10) / 10 : null,
      peakSpeed:      peakSpeed  ? Math.round(peakSpeed  * 10) / 10 : null,
      avgAccel:       avgAccel   ? Math.round(avgAccel   * 100) / 100 : null,
      totalDistanceYd: Math.round(totalDistanceYd),
      avgFirstStepMs: avgFirstStep ? Math.round(avgFirstStep) : null,
      byPlayType,
      recentGames,
    });
  } catch (err) {
    console.error("[athlete/my-stats]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
