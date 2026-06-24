// pages/api/film/publish.js
// POST { filmId } — toggle is_published on a game_film.
// Only the org that owns the film can publish/unpublish it.
//
// ── SQL migration — run once in Supabase SQL editor ──────────────────────────
// ALTER TABLE game_films ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
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

  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.body?.filmId || "").trim();

  if (!orgId)  return res.status(400).json({ error: "Missing org identity" });
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    // Fetch current state — also verifies the film belongs to this org
    const { data: film, error: fetchErr } = await supabase
      .from("game_films")
      .select("id, is_published, status, mux_playback_id")
      .eq("id", filmId)
      .eq("org_id", orgId)
      .single();

    if (fetchErr || !film) return res.status(404).json({ error: "Film not found" });

    if (film.status !== "ready") {
      return res.status(400).json({ error: "Film must finish processing before going live" });
    }

    const nextPublished = !film.is_published;

    const { error: updateErr } = await supabase
      .from("game_films")
      .update({ is_published: nextPublished })
      .eq("id", filmId)
      .eq("org_id", orgId);

    if (updateErr) throw updateErr;

    return res.status(200).json({ ok: true, published: nextPublished });
  } catch (err) {
    console.error("[film/publish]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
