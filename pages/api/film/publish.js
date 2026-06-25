// pages/api/film/publish.js
// POST { filmId, action, viewingType? }
//   action: "publish"   — publish with viewingType ("cara"|"vara", default "vara")
//   action: "unpublish" — remove from feed
//   action: "setType"   — change viewingType on already-published film
//
// ── SQL migrations — run once in Supabase SQL editor ─────────────────────────
// ALTER TABLE game_films ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;
// ALTER TABLE game_films ADD COLUMN IF NOT EXISTS viewing_type text DEFAULT 'vara'
//   CHECK (viewing_type IN ('cara', 'vara'));
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

  const orgId       = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId      = String(req.body?.filmId      || "").trim();
  const action      = String(req.body?.action      || "toggle").trim();
  const viewingType = ["cara", "vara"].includes(req.body?.viewingType) ? req.body.viewingType : "vara";
  // watchDueDate: "YYYY-MM-DD" string or null to clear
  const rawDue      = req.body?.watchDueDate;
  const watchDueDate = rawDue ? String(rawDue).trim() || null : (rawDue === null ? null : undefined);

  if (!orgId)  return res.status(400).json({ error: "Missing org identity" });
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    const { data: film, error: fetchErr } = await supabase
      .from("game_films")
      .select("id, is_published, viewing_type, status, mux_playback_id")
      .eq("id", filmId)
      .eq("org_id", orgId)
      .single();

    if (fetchErr || !film) return res.status(404).json({ error: "Film not found" });

    let updates = {};

    if (action === "publish") {
      if (film.status !== "ready") return res.status(400).json({ error: "Film must finish processing before going live" });
      updates = { is_published: true, viewing_type: viewingType };
      if (watchDueDate !== undefined) updates.watch_due_date = watchDueDate;
    } else if (action === "unpublish") {
      updates = { is_published: false, watch_due_date: null };
    } else if (action === "setType") {
      updates = { viewing_type: viewingType };
      if (watchDueDate !== undefined) updates.watch_due_date = watchDueDate;
    } else if (action === "setDueDate") {
      updates = { watch_due_date: watchDueDate ?? null };
    } else {
      // legacy toggle
      if (!film.is_published && film.status !== "ready") return res.status(400).json({ error: "Film must finish processing before going live" });
      updates = { is_published: !film.is_published };
      if (!film.is_published) updates.viewing_type = viewingType;
    }

    const { error: updateErr } = await supabase
      .from("game_films")
      .update(updates)
      .eq("id", filmId)
      .eq("org_id", orgId);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      ok:             true,
      published:      updates.is_published ?? film.is_published,
      viewing_type:   updates.viewing_type ?? film.viewing_type ?? "vara",
      watch_due_date: updates.watch_due_date !== undefined ? updates.watch_due_date : film.watch_due_date ?? null,
    });
  } catch (err) {
    console.error("[film/publish]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
