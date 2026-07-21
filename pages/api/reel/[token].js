// pages/api/reel/[token].js
// Public endpoint — returns reel data for a share token with no auth required.
// Used by the public /reel/[token] page.

import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "@/lib/sendNotification";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VIEW_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).json({ error: "Missing token" });

  const { data: reel, error } = await supabase
    .from("athlete_reels")
    .select("id, athlete_id, title, play_ids, play_highlights, play_edits, is_public, created_at, view_count")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !reel) return res.status(404).json({ error: "Reel not found" });

  // View tracking + milestone notifications (fire-and-forget, never blocks response)
  const newViews = (reel.view_count || 0) + 1;
  supabase.from("athlete_reels").update({ view_count: newViews }).eq("id", reel.id)
    .then(() => {}).catch(() => {});

  if (VIEW_MILESTONES.includes(newViews)) {
    (async () => {
      try {
        let notifToken = reel.athlete_id || "";
        // athlete_id may be an email — resolve to athlete_token for push delivery
        if (notifToken.includes("@")) {
          const { data: a } = await supabase
            .from("athletes").select("athlete_token").ilike("email", notifToken).maybeSingle();
          if (a?.athlete_token) notifToken = a.athlete_token;
        }
        if (!notifToken) return;
        const isFirst = newViews === 1;
        sendNotification([notifToken], {
          title: isFirst ? "Your reel got its first view!" : `${newViews} people have watched your reel`,
          body: `"${reel.title || "Your highlight reel"}" is getting attention from recruiters.`,
          type: "reel_view",
          data: { screen: "feed" },
        });
      } catch {}
    })();
  }

  if (!reel.play_ids?.length) return res.status(200).json({ ok: true, reel, plays: [] });

  const { data: rows } = await supabase
    .from("game_plays")
    .select("id, play_number, play_type, formation, result, start_time_secs, end_time_secs, game_films!inner(mux_playback_id, title, opponent, game_date, sport)")
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
        sport: r.game_films.sport || null,
        highlight: (reel.play_highlights || {})[r.id] || null,
        editData:  (reel.play_edits || {})[r.id] || null,
        thumb: `https://image.mux.com/${r.game_films.mux_playback_id}/thumbnail.jpg?time=${Math.max(0, r.start_time_secs + 1)}&width=600&fit_mode=preserve`,
        stream_url: `https://stream.mux.com/${r.game_films.mux_playback_id}.m3u8`,
      };
    })
    .filter(Boolean);

  return res.status(200).json({ ok: true, reel: { title: reel.title, created_at: reel.created_at }, plays });
}
