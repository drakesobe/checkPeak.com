// pages/api/film/play-like.js
// POST { playId } — toggle like for the current user.
// Returns { liked: boolean, count: number }

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const userId = String(user.email || user.Email || user.id || user.athlete_token || "").trim().toLowerCase();
  const playId = String(req.body?.playId || "").trim();

  if (!playId) return res.status(400).json({ error: "playId required" });

  try {
    const { data: existing } = await supabase
      .from("play_likes")
      .select("play_id")
      .eq("play_id", playId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("play_likes").delete().eq("play_id", playId).eq("user_id", userId);
    } else {
      await supabase.from("play_likes").insert({ play_id: playId, user_id: userId });
    }

    const { count } = await supabase
      .from("play_likes")
      .select("*", { count: "exact", head: true })
      .eq("play_id", playId);

    return res.status(200).json({ ok: true, liked: !existing, count: count ?? 0 });
  } catch (err) {
    console.error("[play-like]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
