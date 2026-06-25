// pages/api/film/saved.js
// GET ?_authUser=... — returns the current user's bookmarked plays,
// most recently saved first, in the same FeedPlay shape as /api/film/feed.

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

  const userId = String(user.email || user.Email || user.id || user.athlete_token || "").trim().toLowerCase();
  if (!userId) return res.status(400).json({ error: "Missing user identity" });

  const limit  = Math.min(Number(req.query.limit  || 50), 100);
  const offset = Math.max(Number(req.query.offset || 0),   0);

  try {
    // Step 1: get saved play IDs in save order (most recent first)
    const { data: saves, error: savesErr } = await supabase
      .from("play_saves")
      .select("play_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (savesErr) throw savesErr;
    if (!saves?.length) return res.status(200).json({ ok: true, plays: [] });

    const saveOrder = saves.map(s => s.play_id);

    // Step 2: fetch full play + film data for those IDs
    let rows, queryError;
    ({ data: rows, error: queryError } = await supabase
      .from("game_plays")
      .select(`
        id, play_number, play_type, formation, result,
        down, distance, yards_gained, personnel, notes, labels,
        start_time_secs, end_time_secs, created_at, coach_annotation,
        game_films!inner(mux_playback_id, title, opponent, game_date, sport, org_id, id)
      `)
      .in("id", saveOrder)
      .not("game_films.mux_playback_id", "is", null));

    if (queryError) {
      // Retry without coach_annotation if column doesn't exist yet
      if (queryError.code === "42703" || queryError.message?.includes("coach_annotation")) {
        ({ data: rows, error: queryError } = await supabase
          .from("game_plays")
          .select(`
            id, play_number, play_type, formation, result,
            down, distance, yards_gained, personnel, notes, labels,
            start_time_secs, end_time_secs, created_at,
            game_films!inner(mux_playback_id, title, opponent, game_date, sport, org_id, id)
          `)
          .in("id", saveOrder)
          .not("game_films.mux_playback_id", "is", null));
      }
      if (queryError) throw queryError;
    }

    if (!rows?.length) return res.status(200).json({ ok: true, plays: [] });

    const playIds = rows.map(r => r.id);

    // Step 3: engagement counts
    let likes = [], comments = [], userLikes = [];
    try {
      const results = await Promise.all([
        supabase.from("play_likes").select("play_id").in("play_id", playIds),
        supabase.from("play_comments").select("play_id").in("play_id", playIds),
        supabase.from("play_likes").select("play_id").eq("user_id", userId).in("play_id", playIds),
      ]);
      likes     = results[0].data ?? [];
      comments  = results[1].data ?? [];
      userLikes = results[2].data ?? [];
    } catch {}

    const likeMap    = {};
    const commentMap = {};
    const likedSet   = new Set(userLikes.map(l => l.play_id));

    for (const l of likes)    likeMap[l.play_id]    = (likeMap[l.play_id]    || 0) + 1;
    for (const c of comments) commentMap[c.play_id] = (commentMap[c.play_id] || 0) + 1;

    // Re-sort rows to match save order (Supabase IN doesn't guarantee order)
    const rowMap = Object.fromEntries(rows.map(r => [r.id, r]));
    const sorted = saveOrder.map(id => rowMap[id]).filter(Boolean);

    const plays = sorted.map(r => ({
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
      mux_playback_id:  r.game_films.mux_playback_id,
      film_id:          r.game_films.id,
      film_title:       r.game_films.title    || null,
      opponent:         r.game_films.opponent || null,
      game_date:        r.game_films.game_date   || null,
      sport:            r.game_films.sport       || null,
      like_count:       likeMap[r.id]    || 0,
      comment_count:    commentMap[r.id] || 0,
      is_liked:         likedSet.has(r.id),
      is_saved:         true,
    }));

    return res.status(200).json({ ok: true, plays });
  } catch (err) {
    console.error("[film/saved]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
