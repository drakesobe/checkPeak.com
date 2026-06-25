// pages/api/film/play-save.js
// POST { playId } — toggle save (bookmark) for the current user.
// Returns { saved: boolean }
//
// ── SQL migration — run once in Supabase SQL editor ───────────────────────────
//
// CREATE TABLE IF NOT EXISTS play_saves (
//   play_id    uuid REFERENCES game_plays(id) ON DELETE CASCADE,
//   user_id    text NOT NULL,
//   created_at timestamptz DEFAULT now(),
//   PRIMARY KEY (play_id, user_id)
// );
// CREATE INDEX IF NOT EXISTS idx_play_saves_play ON play_saves(play_id);
// CREATE INDEX IF NOT EXISTS idx_play_saves_user ON play_saves(user_id);
// GRANT ALL ON public.play_saves TO service_role;
//
// ─────────────────────────────────────────────────────────────────────────────

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
      .from("play_saves")
      .select("play_id")
      .eq("play_id", playId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("play_saves").delete().eq("play_id", playId).eq("user_id", userId);
    } else {
      await supabase.from("play_saves").insert({ play_id: playId, user_id: userId });
    }

    return res.status(200).json({ ok: true, saved: !existing });
  } catch (err) {
    console.error("[play-save]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
