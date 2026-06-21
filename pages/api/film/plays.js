// pages/api/film/plays.js
// GET  - list plays for a film with per-play player metrics.
// POST - manually tag / update a play (coach input).
// Query (GET):  ?filmId=uuid&_authUser=...
// Body  (POST): { filmId, playId?, playNumber, result, playType, down, distance, yardsGained, formation }

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  // GET: req.query is already URL-decoded by Next.js — parse directly
  // POST: req.body from JSON content-type is also already parsed — parse directly
  const raw = req.method === "GET" ? req.query?._authUser : req.body?._authUser;
  if (raw) {
    try { return JSON.parse(String(raw)); } catch {}
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
      hash, yard_line, play_direction, personnel, labels,
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
    startTimeSecs, endTimeSecs,
    hash, yardLine, playDirection, personnel, labels,
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
    result:           result        ?? undefined,
    play_type:        playType      ?? undefined,
    down:             down          ?? undefined,
    distance:         distance      ?? undefined,
    yards_gained:     yardsGained   ?? undefined,
    formation:        formation     ?? undefined,
    start_time_secs:  startTimeSecs ?? undefined,
    end_time_secs:    endTimeSecs   ?? undefined,
    tagged_by:        user.email    ?? "coach",
    hash:             hash          ?? undefined,
    yard_line:        yardLine      ?? undefined,
    play_direction:   playDirection ?? undefined,
    personnel:        personnel     ?? undefined,
    labels:           Array.isArray(labels) && labels.length ? labels : undefined,
  };

  // Clean undefined
  Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

  if (playId) {
    const { error } = await supabase.from("game_plays").update(update).eq("id", playId);
    if (error) throw error;
    return res.status(200).json({ ok: true, updated: true });
  } else {
    // Auto-assign play number as next in sequence
    let nextPlayNumber = playNumber;
    if (nextPlayNumber == null) {
      const { count } = await supabase
        .from("game_plays")
        .select("*", { count: "exact", head: true })
        .eq("film_id", filmId);
      nextPlayNumber = (count ?? 0) + 1;
    }
    const { data, error } = await supabase
      .from("game_plays")
      .insert({ film_id: filmId, org_id: orgId, play_number: nextPlayNumber, ...update })
      .select("id, play_number")
      .single();
    if (error) throw error;

    // Keep play_count in sync
    await supabase
      .from("game_films")
      .update({ play_count: nextPlayNumber })
      .eq("id", filmId);

    return res.status(200).json({ ok: true, created: true, playId: data.id, playNumber: data.play_number });
  }
}

async function deletePlay(req, res, orgId) {
  const { filmId, playId } = req.body ?? {};
  if (!filmId || !playId) return res.status(400).json({ error: "filmId and playId required" });

  const { data: film } = await supabase.from("game_films").select("id, org_id").eq("id", filmId).single();
  if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });

  const { error } = await supabase.from("game_plays").delete().eq("id", playId).eq("film_id", filmId);
  if (error) throw error;

  const { count } = await supabase.from("game_plays").select("*", { count: "exact", head: true }).eq("film_id", filmId);
  await supabase.from("game_films").update({ play_count: count ?? 0 }).eq("id", filmId);

  return res.status(200).json({ ok: true, deleted: true });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  try {
    if (req.method === "GET")    return await getPlays(req, res, orgId);
    if (req.method === "POST")   return await tagPlay(req, res, orgId, user);
    if (req.method === "DELETE") return await deletePlay(req, res, orgId);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[film/plays]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
