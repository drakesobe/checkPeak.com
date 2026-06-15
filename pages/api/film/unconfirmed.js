// pages/api/film/unconfirmed.js
// GET ?filmId=uuid — returns distinct rekognition tracks needing jersey confirmation.
// One entry per unique person detected; picks the highest-confidence OCR row per track.

import { readUserCookie } from "@/lib/requireUser";
import { createClient }   from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  const orgId = String(user.orgToken || user.Token || "").trim();
  const { filmId } = req.query;
  if (!filmId) return res.status(400).json({ error: "filmId is required" });

  const { data, error } = await supabase
    .from("player_tracks")
    .select("rekognition_track_id, jersey_number, jersey_confidence, jersey_confirmed, roster_id, snap_x, snap_y")
    .eq("film_id", filmId)
    .eq("org_id", orgId)
    .not("rekognition_track_id", "is", null)
    .order("jersey_confidence", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Deduplicate: one entry per track_id (already sorted by confidence desc, so first wins)
  const seen = new Map();
  for (const row of data ?? []) {
    if (!seen.has(row.rekognition_track_id)) seen.set(row.rekognition_track_id, row);
  }

  const all          = Array.from(seen.values());
  const unconfirmed  = all.filter(t => !t.jersey_confirmed);
  const confirmed    = all.filter(t =>  t.jersey_confirmed);

  return res.status(200).json({
    ok: true,
    total:       all.length,
    unconfirmed,
    confirmed,
    allConfirmed: unconfirmed.length === 0,
  });
}
