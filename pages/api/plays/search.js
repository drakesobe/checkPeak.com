// pages/api/plays/search.js
// GET — cross-film play search for a coach org.
// Query: formation, playType, result, down, distance, labels (comma-sep), filmId, sport, limit, offset
// Returns: { ok, plays: [...], total }

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

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  const limit  = Math.min(Number(req.query.limit  || 40), 100);
  const offset = Math.max(Number(req.query.offset || 0),   0);

  const { formation, playType, result, down, distance, labels, filmId, sport } = req.query;

  try {
    let query = supabase
      .from("game_plays")
      .select(`
        id, play_number, play_type, formation, result, down, distance,
        yards_gained, personnel, notes, labels, start_time_secs, end_time_secs,
        created_at, coach_annotation,
        game_films!inner(id, title, opponent, game_date, sport, org_id, mux_playback_id, is_published)
      `, { count: "exact" })
      .eq("game_films.org_id", orgId)
      .not("game_films.mux_playback_id", "is", null)
      .not("start_time_secs", "is", null);

    if (filmId)    query = query.eq("game_films.id", filmId);
    if (sport)     query = query.eq("game_films.sport", sport);
    if (formation) query = query.ilike("formation", `%${formation}%`);
    if (playType)  query = query.eq("play_type", playType);
    if (result)    query = query.eq("result", result);
    if (down)      query = query.eq("down", Number(down));
    if (distance)  query = query.eq("distance", Number(distance));
    if (labels) {
      const labelArr = String(labels).split(",").map(l => l.trim()).filter(Boolean);
      if (labelArr.length) query = query.overlaps("labels", labelArr);
    }

    const { data: rows, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const plays = (rows ?? []).map(r => ({
      id:               r.id,
      play_number:      r.play_number,
      play_type:        r.play_type    || null,
      formation:        r.formation    || null,
      result:           r.result       || null,
      down:             r.down         ?? null,
      distance:         r.distance     ?? null,
      yards_gained:     r.yards_gained ?? null,
      personnel:        r.personnel    || null,
      notes:            r.notes        || null,
      labels:           r.labels       || [],
      start_time_secs:  r.start_time_secs,
      end_time_secs:    r.end_time_secs ?? null,
      created_at:       r.created_at,
      coach_annotation: r.coach_annotation ?? null,
      film_id:          r.game_films.id,
      film_title:       r.game_films.title    || null,
      opponent:         r.game_films.opponent || null,
      game_date:        r.game_films.game_date || null,
      sport:            r.game_films.sport    || null,
      is_published:     r.game_films.is_published ?? false,
      mux_playback_id:  r.game_films.mux_playback_id,
    }));

    return res.status(200).json({ ok: true, plays, total: count ?? 0 });
  } catch (err) {
    console.error("[plays/search]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
