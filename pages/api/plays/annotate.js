// pages/api/plays/annotate.js
// POST { playId, annotation: { strokes, noteText } | null }
// Saves (or clears) a coach telestration annotation on a play.
// Returns { ok, annotation }
//
// ── SQL migration — run once in Supabase SQL editor ──────────────────────────
//
// ALTER TABLE game_plays ADD COLUMN IF NOT EXISTS coach_annotation jsonb;
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

  const orgId      = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const playId     = String(req.body?.playId || "").trim();
  const annotation = req.body?.annotation ?? null; // null = clear annotation

  if (!playId) return res.status(400).json({ error: "playId required" });

  try {
    // Verify play belongs to this org via game_films
    const { data: play } = await supabase
      .from("game_plays")
      .select("id, game_films!inner(org_id)")
      .eq("id", playId)
      .single();

    if (!play || play.game_films.org_id !== orgId)
      return res.status(404).json({ error: "Play not found" });

    const { data, error } = await supabase
      .from("game_plays")
      .update({ coach_annotation: annotation })
      .eq("id", playId)
      .select("coach_annotation")
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, annotation: data?.coach_annotation ?? null });
  } catch (err) {
    console.error("[plays/annotate]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
