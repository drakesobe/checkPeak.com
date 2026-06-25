// pages/api/film/feed.js
// GET ?sort=recent|trending&limit=20&offset=0
//
// Returns enriched play clips for the social feed.
// All tagged plays with a Mux playback ID surface automatically — no curation step.
// Trending score = (likes×3 + comments×2) / (age_hours+2)^1.5  (Hacker News–style decay)
//
// ── SQL migrations — run once in Supabase SQL editor ─────────────────────────
//
// CREATE TABLE IF NOT EXISTS play_likes (
//   play_id    uuid REFERENCES game_plays(id) ON DELETE CASCADE,
//   user_id    text NOT NULL,
//   created_at timestamptz DEFAULT now(),
//   PRIMARY KEY (play_id, user_id)
// );
// CREATE TABLE IF NOT EXISTS play_comments (
//   id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   play_id    uuid REFERENCES game_plays(id) ON DELETE CASCADE,
//   user_id    text NOT NULL,
//   user_name  text,
//   body       text NOT NULL,
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_play_likes_play    ON play_likes(play_id);
// CREATE INDEX IF NOT EXISTS idx_play_likes_user    ON play_likes(user_id);
// CREATE INDEX IF NOT EXISTS idx_play_comments_play ON play_comments(play_id);
// GRANT ALL ON public.play_likes, public.play_comments TO service_role;
//
// ─────────────────────────────────────────────────────────────────────────────

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

function trendingScore(likeCount, commentCount, createdAt) {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return (likeCount * 3 + commentCount * 2) / Math.pow(ageHours + 2, 1.5);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId  = String(user.orgToken || user.org_token || user.Token || user.orgId || user.org_id || user.OrgId || "").trim();
  const userId = String(user.email || user.Email || user.id || orgId).trim().toLowerCase();
  const sort   = req.query.sort === "trending" ? "trending" : "recent";
  const limit  = Math.min(Number(req.query.limit  || 20), 50);
  const offset = Math.max(Number(req.query.offset || 0),   0);

  try {
    // Trending fetches a wider window (up to 200 recent plays) then re-ranks in JS.
    // Recent just paginates chronologically.
    const isTrending  = sort === "trending";
    const fetchLimit  = isTrending ? 200 : limit;
    const fetchOffset = isTrending ? 0   : offset;
    const cutoffDate  = new Date(
      Date.now() - (isTrending ? 30 : 365) * 24 * 3_600_000
    ).toISOString();

    // Try with coach_annotation first; fall back without it if the column doesn't exist yet.
    let rows, queryError;
    ({ data: rows, error: queryError } = await supabase
      .from("game_plays")
      .select(`
        id, play_number, play_type, formation, result,
        down, distance, yards_gained, personnel, notes, labels,
        start_time_secs, end_time_secs, created_at, coach_annotation,
        game_films!inner(mux_playback_id, title, opponent, game_date, sport, org_id, id)
      `)
      .eq("game_films.org_id", orgId)
      .not("game_films.mux_playback_id", "is", null)
      .not("start_time_secs", "is", null)
      .gte("created_at", cutoffDate)
      .order("game_date", { foreignTable: "game_films", ascending: false })
      .order("play_number", { ascending: true })
      .range(fetchOffset, fetchOffset + fetchLimit - 1));

    if (queryError) {
      // Column doesn't exist yet — retry without coach_annotation
      if (queryError.code === "42703" || queryError.message?.includes("coach_annotation")) {
        ({ data: rows, error: queryError } = await supabase
          .from("game_plays")
          .select(`
            id, play_number, play_type, formation, result,
            down, distance, yards_gained, personnel, notes, labels,
            start_time_secs, end_time_secs, created_at,
            game_films!inner(mux_playback_id, title, opponent, game_date, sport, org_id, id)
          `)
          .eq("game_films.org_id", orgId)
          .not("game_films.mux_playback_id", "is", null)
          .not("start_time_secs", "is", null)
          .gte("created_at", cutoffDate)
          .order("game_date", { foreignTable: "game_films", ascending: false })
          .order("play_number", { ascending: true })
          .range(fetchOffset, fetchOffset + fetchLimit - 1));
      }
      if (queryError) throw queryError;
    }

    if (!rows?.length) return res.status(200).json({ ok: true, plays: [] });

    const playIds = rows.map(r => r.id);

    // Fetch engagement data — tables may not exist yet; default to empty if they error.
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
    } catch (engErr) {
      console.warn("[film/feed] engagement tables not ready:", engErr?.message);
    }

    const likeMap    = {};
    const commentMap = {};
    const likedSet   = new Set(userLikes.map(l => l.play_id));

    for (const l of likes)    likeMap[l.play_id]    = (likeMap[l.play_id]    || 0) + 1;
    for (const c of comments) commentMap[c.play_id] = (commentMap[c.play_id] || 0) + 1;

    let plays = rows.map(r => ({
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
      film_title:       r.game_films.title       || null,
      opponent:         r.game_films.opponent    || null,
      game_date:        r.game_films.game_date   || null,
      sport:            r.game_films.sport       || null,
      like_count:       likeMap[r.id]    || 0,
      comment_count:    commentMap[r.id] || 0,
      is_liked:         likedSet.has(r.id),
    }));

    if (isTrending) {
      plays.sort((a, b) =>
        trendingScore(b.like_count, b.comment_count, b.created_at) -
        trendingScore(a.like_count, a.comment_count, a.created_at)
      );
      plays = plays.slice(offset, offset + limit);
    }

    return res.status(200).json({ ok: true, plays });
  } catch (err) {
    console.error("[film/feed]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
