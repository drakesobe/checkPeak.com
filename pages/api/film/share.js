// pages/api/film/share.js
// GET  ?token=  → public, no auth, returns shared film or cut-up data
// POST { filmId, type:"film" } or { playlistId, type:"cutup" } → create share token (auth required)

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(decodeURIComponent(String(raw))); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ── GET: public — return shared data by token ───────────────────────────
  if (req.method === "GET") {
    const token = String(req.query.token ?? "").trim();
    if (!token) return res.status(400).json({ error: "token required" });

    const { data: share, error: shareErr } = await supabase
      .from("game_film_shares")
      .select("id, share_type, title, film_id, playlist_id, org_id, view_count")
      .eq("token", token)
      .single();

    if (shareErr || !share) return res.status(404).json({ error: "Share link not found or expired" });

    // Bump view count
    await supabase.from("game_film_shares").update({ view_count: (share.view_count ?? 0) + 1 }).eq("id", share.id);

    if (share.share_type === "film") {
      const { data: film } = await supabase
        .from("game_films")
        .select("id, title, game_date, opponent, home_away, status, mux_playback_id, s3_key, org_id")
        .eq("id", share.film_id)
        .single();

      if (!film) return res.status(404).json({ error: "Film not found" });

      // Get plays
      const { data: plays } = await supabase
        .from("game_plays")
        .select("id, play_number, play_type, down, distance, yards_gained, result, start_time_secs, end_time_secs, formation, hash, personnel, notes")
        .eq("film_id", film.id)
        .order("play_number", { ascending: true });

      // Attach pinned coach comments to each play
      const playIds = (plays ?? []).map(p => p.id);
      let pinnedByPlay = {};
      if (playIds.length > 0) {
        const { data: pinned } = await supabase
          .from("play_comments")
          .select("id, play_id, user_name, body, created_at")
          .in("play_id", playIds)
          .eq("is_pinned", true)
          .order("created_at", { ascending: true });
        for (const c of (pinned ?? [])) {
          if (!pinnedByPlay[c.play_id]) pinnedByPlay[c.play_id] = [];
          pinnedByPlay[c.play_id].push(c);
        }
      }
      const enrichedPlays = (plays ?? []).map(p => ({
        ...p,
        pinnedComments: pinnedByPlay[p.id] ?? [],
      }));

      // Get S3 presigned URL if no Mux
      let videoUrl = null;
      if (!film.mux_playback_id && film.s3_key) {
        try {
          const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
          const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
          const s3 = new S3Client({ region: process.env.AWS_REGION });
          videoUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: film.s3_key }), { expiresIn: 14400 });
        } catch {}
      }

      return res.status(200).json({ ok: true, type: "film", film, plays: enrichedPlays, videoUrl, title: share.title ?? film.title });
    }

    if (share.share_type === "cutup") {
      const { data: list } = await supabase
        .from("game_play_lists")
        .select(`
          id, name, film_id,
          game_play_list_items (
            id, position,
            game_plays (
              id, play_number, play_type, down, distance, yards_gained,
              result, start_time_secs, end_time_secs, clip_url, notes, film_id
            )
          )
        `)
        .eq("id", share.playlist_id)
        .single();

      if (!list) return res.status(404).json({ error: "Playlist not found" });

      // Build sorted plays
      const rawItems = (list.game_play_list_items ?? [])
        .sort((a, b) => a.position - b.position)
        .map(i => ({ ...i.game_plays, _itemId: i.id, _position: i.position }));

      // Attach pinned coach comments to each play in the cut-up
      const cutupPlayIds = rawItems.map(p => p.id).filter(Boolean);
      let cutupPinnedByPlay = {};
      if (cutupPlayIds.length > 0) {
        const { data: cutupPinned } = await supabase
          .from("play_comments")
          .select("id, play_id, user_name, body, created_at")
          .in("play_id", cutupPlayIds)
          .eq("is_pinned", true)
          .order("created_at", { ascending: true });
        for (const c of (cutupPinned ?? [])) {
          if (!cutupPinnedByPlay[c.play_id]) cutupPinnedByPlay[c.play_id] = [];
          cutupPinnedByPlay[c.play_id].push(c);
        }
      }
      const items = rawItems.map(p => ({ ...p, pinnedComments: cutupPinnedByPlay[p.id] ?? [] }));

      // Get the film for video URL (use first play's film)
      const filmId = list.film_id ?? items[0]?.film_id;
      let film = null, videoUrl = null;
      if (filmId) {
        const { data: f } = await supabase.from("game_films").select("id, title, mux_playback_id, s3_key").eq("id", filmId).single();
        film = f;
        if (f && !f.mux_playback_id && f.s3_key) {
          try {
            const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
            const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
            const s3 = new S3Client({ region: process.env.AWS_REGION });
            videoUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: f.s3_key }), { expiresIn: 14400 });
          } catch {}
        }
      }

      return res.status(200).json({ ok: true, type: "cutup", playlist: { ...list, items }, film, videoUrl, title: share.title ?? list.name });
    }

    return res.status(400).json({ error: "Unknown share type" });
  }

  // ── POST: create share link (auth required) ─────────────────────────────
  if (req.method === "POST") {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();

    const { filmId, playlistId, type = "film" } = req.body ?? {};

    try {
      let insert = { org_id: orgId, share_type: type, created_by: user.email ?? "coach" };

      if (type === "film") {
        if (!filmId) return res.status(400).json({ error: "filmId required" });
        const { data: film } = await supabase.from("game_films").select("id, org_id, title").eq("id", filmId).single();
        if (!film || film.org_id !== orgId) return res.status(404).json({ error: "Film not found" });
        insert.film_id = filmId;
        insert.title   = film.title;
      } else if (type === "cutup") {
        if (!playlistId) return res.status(400).json({ error: "playlistId required" });
        const { data: list } = await supabase.from("game_play_lists").select("id, org_id, name").eq("id", playlistId).single();
        if (!list || list.org_id !== orgId) return res.status(404).json({ error: "Playlist not found" });
        insert.playlist_id = playlistId;
        insert.title       = list.name;
      } else {
        return res.status(400).json({ error: "type must be 'film' or 'cutup'" });
      }

      // Upsert — if a share for this film/playlist already exists, reuse it
      const matchField = type === "film" ? "film_id" : "playlist_id";
      const { data: existing } = await supabase
        .from("game_film_shares")
        .select("token")
        .eq(matchField, insert[matchField])
        .eq("share_type", type)
        .maybeSingle();

      if (existing) return res.status(200).json({ ok: true, token: existing.token });

      const { data, error } = await supabase.from("game_film_shares").insert(insert).select("token").single();
      if (error) throw error;

      return res.status(200).json({ ok: true, token: data.token });
    } catch (err) {
      console.error("[film/share]", err);
      return res.status(500).json({ error: err?.message ?? "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
