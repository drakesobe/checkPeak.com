// pages/api/athlete/reel.js
// Athlete highlight reel — ordered collection of saved plays shareable via public link.
//
// Requires Supabase table:
//   create table athlete_reels (
//     id uuid default gen_random_uuid() primary key,
//     athlete_id text not null,
//     title text not null default 'My Highlight Reel',
//     play_ids text[] not null default '{}',
//     share_token text unique default null,
//     is_public boolean default false,
//     created_at timestamptz default now(),
//     updated_at timestamptz default now()
//   );
//   create index on athlete_reels(athlete_id);
//   create index on athlete_reels(share_token);
//
// GET  — returns own reel with hydrated plays
// POST { action:'upsert', title?, playIds }   — create/update reel
// POST { action:'share' }                     — generate/return public share token
// POST { action:'unpublish' }                 — remove public access
// DELETE ?playId=<uuid>                       — remove single play from reel

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 }  from "uuid";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.query?._authUser ?? req.body?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

function athleteId(user) {
  return String(user?.email || user?.Email || user?.athlete_token || user?.id || "").trim().toLowerCase();
}

async function hydrateReel(reel) {
  if (!reel || !reel.play_ids?.length) return { ...reel, plays: [] };
  const { data: rows } = await supabase
    .from("game_plays")
    .select("id, play_number, play_type, formation, result, start_time_secs, end_time_secs, game_films!inner(mux_playback_id, title, opponent, game_date)")
    .in("id", reel.play_ids)
    .not("game_films.mux_playback_id", "is", null);

  const rowMap = Object.fromEntries((rows ?? []).map(r => [r.id, r]));
  const plays = reel.play_ids
    .map(id => {
      const r = rowMap[id];
      if (!r) return null;
      return {
        id: r.id,
        play_number: r.play_number,
        play_type: r.play_type || null,
        formation: r.formation || null,
        result: r.result || null,
        start_time_secs: r.start_time_secs,
        end_time_secs: r.end_time_secs ?? null,
        mux_playback_id: r.game_films.mux_playback_id,
        film_title: r.game_films.title || null,
        opponent: r.game_films.opponent || null,
        game_date: r.game_films.game_date || null,
        thumb: `https://image.mux.com/${r.game_films.mux_playback_id}/thumbnail.jpg?time=${Math.max(0, r.start_time_secs + 1)}&width=400&fit_mode=preserve`,
      };
    })
    .filter(Boolean);

  return { ...reel, plays };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // ── GET — return own reel ───────────────────────────────────────────────────
  if (req.method === "GET") {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const uid = athleteId(user);
    if (!uid) return res.status(400).json({ error: "Missing user identity" });

    const { data: reel } = await supabase
      .from("athlete_reels")
      .select("*")
      .eq("athlete_id", uid)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!reel) return res.status(200).json({ ok: true, reel: null, plays: [] });

    return res.status(200).json({ ok: true, reel, ...(await hydrateReel(reel)) });
  }

  // ── DELETE — remove a play from the reel ───────────────────────────────────
  if (req.method === "DELETE") {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const uid = athleteId(user);
    const playId = String(req.query.playId || "").trim();
    if (!playId) return res.status(400).json({ error: "playId required" });

    const { data: reel } = await supabase
      .from("athlete_reels")
      .select("id, play_ids")
      .eq("athlete_id", uid)
      .limit(1)
      .maybeSingle();

    if (!reel) return res.status(404).json({ error: "No reel found" });

    const newIds = (reel.play_ids || []).filter(id => id !== playId);
    const { data: updated } = await supabase
      .from("athlete_reels")
      .update({ play_ids: newIds, updated_at: new Date().toISOString() })
      .eq("id", reel.id)
      .select("*")
      .single();

    return res.status(200).json({ ok: true, reel: updated, ...(await hydrateReel(updated)) });
  }

  // ── POST — create/update/share ──────────────────────────────────────────────
  if (req.method === "POST") {
    const user = parseUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const uid = athleteId(user);
    if (!uid) return res.status(400).json({ error: "Missing user identity" });

    const { action, title, playIds } = req.body ?? {};

    if (action === "upsert") {
      if (!Array.isArray(playIds)) return res.status(400).json({ error: "playIds array required" });
      const safeTitle = String(title || "My Highlight Reel").trim().slice(0, 100);

      const { data: existing } = await supabase
        .from("athlete_reels")
        .select("id, share_token, is_public")
        .eq("athlete_id", uid)
        .limit(1)
        .maybeSingle();

      let reel;
      if (existing) {
        const { data } = await supabase
          .from("athlete_reels")
          .update({ title: safeTitle, play_ids: playIds, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("*")
          .single();
        reel = data;
      } else {
        const { data } = await supabase
          .from("athlete_reels")
          .insert({ athlete_id: uid, title: safeTitle, play_ids: playIds })
          .select("*")
          .single();
        reel = data;
      }

      return res.status(200).json({ ok: true, reel, ...(await hydrateReel(reel)) });
    }

    if (action === "share") {
      const { data: reel } = await supabase
        .from("athlete_reels")
        .select("*")
        .eq("athlete_id", uid)
        .limit(1)
        .maybeSingle();

      if (!reel) return res.status(404).json({ error: "Create a reel first" });
      if (reel.play_ids?.length === 0) return res.status(400).json({ error: "Add plays to your reel before sharing" });

      const token = reel.share_token || uuidv4();
      const { data: updated } = await supabase
        .from("athlete_reels")
        .update({ share_token: token, is_public: true, updated_at: new Date().toISOString() })
        .eq("id", reel.id)
        .select("*")
        .single();

      return res.status(200).json({ ok: true, reel: updated, share_token: token });
    }

    if (action === "unpublish") {
      const { data: reel } = await supabase
        .from("athlete_reels")
        .select("id")
        .eq("athlete_id", uid)
        .limit(1)
        .maybeSingle();

      if (reel) {
        await supabase
          .from("athlete_reels")
          .update({ is_public: false, updated_at: new Date().toISOString() })
          .eq("id", reel.id);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
