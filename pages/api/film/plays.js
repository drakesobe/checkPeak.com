// pages/api/film/plays.js
// GET  — list plays for a film with per-play player metrics.
// POST — manually tag / update a play (coach input).
// Query (GET):  ?filmId=uuid&_authUser=...
// Body  (POST): { filmId, playId?, playNumber, result, playType, down, distance, yardsGained, formation }

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.method === "GET" ? req.query?._authUser : req.body?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

async function getPlays(req, res, orgId) {
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  // Verify film belongs to org
  const { data: film } = await supabase
    .from("game_films")
    .select("id, org_id, status")
    .eq("id", filmId)
    .single();

  if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });

  const { data: plays, error } = await supabase
    .from("game_plays")
    .select(`
      id, play_number, start_time_secs, end_time_secs, clip_url,
      formation, play_type, down, distance, yards_gained, result, tagged_by,
      player_tracks (
        jersey_number, team, max_speed_mph, avg_speed_mph,
        accel_peak_ms2, first_step_ms, snap_x, snap_y
      )
    `)
    .eq("film_id", filmId)
    .order("play_number", { ascending: true });

  if (error) throw error;

  return res.status(200).json({ ok: true, plays: plays ?? [], filmStatus: film.status });
}

async function tagPlay(req, res, orgId, user) {
  const {
    filmId, playId, playNumber,
    result, playType, down, distance, yardsGained, formation,
  } = req.body ?? {};

  if (!filmId) return res.status(400).json({ error: "filmId required" });

  // Verify ownership
  const { data: film } = await supabase
    .from("game_films")
    .select("id, org_id")
    .eq("id", filmId)
    .single();

  if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });

  const update = {
    result:      result     ?? undefined,
    play_type:   playType   ?? undefined,
    down:        down       ?? undefined,
    distance:    distance   ?? undefined,
    yards_gained:yardsGained ?? undefined,
    formation:   formation  ?? undefined,
    tagged_by:   user.email ?? "coach",
  };

  // Clean undefined
  Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

  if (playId) {
    // Update existing play
    const { error } = await supabase.from("game_plays").update(update).eq("id", playId);
    if (error) throw error;
    return res.status(200).json({ ok: true, updated: true });
  } else {
    // Insert new manually-tagged play
    const { data, error } = await supabase
      .from("game_plays")
      .insert({ film_id: filmId, org_id: orgId, play_number: playNumber ?? 0, ...update })
      .select("id")
      .single();
    if (error) throw error;
    return res.status(200).json({ ok: true, created: true, playId: data.id });
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  try {
    if (req.method === "GET")  return await getPlays(req, res, orgId);
    if (req.method === "POST") return await tagPlay(req, res, orgId, user);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[film/plays]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
