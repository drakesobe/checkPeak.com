// pages/api/film/confirm-jersey.js
// POST - confirm (or correct) a jersey assignment for a rekognition track ID.
// Updating ONE track_id updates ALL plays for that person in the film.

import { readUserCookie } from "@/lib/requireUser";
import { createClient }   from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.body?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  const orgId      = String(user.orgToken || user.Token || "").trim();
  const coachEmail = String(user.email || user.Email || "").trim();

  const { filmId, trackId, rosterId } = req.body ?? {};
  if (!filmId || !trackId || !rosterId) {
    return res.status(400).json({ error: "filmId, trackId, and rosterId are required" });
  }

  // Verify the roster player belongs to this org
  const { data: player, error: rErr } = await supabase
    .from("roster")
    .select("id, jersey_number, player_name, position")
    .eq("id", rosterId)
    .eq("org_id", orgId)
    .single();

  if (rErr || !player) return res.status(404).json({ error: "Player not found in roster" });

  // Update ALL tracks for this person across every play in this film
  const { error: tErr } = await supabase
    .from("player_tracks")
    .update({
      roster_id:        rosterId,
      jersey_number:    player.jersey_number,
      jersey_confirmed: true,
      confirmed_by:     coachEmail || "coach",
    })
    .eq("film_id", filmId)
    .eq("rekognition_track_id", trackId)
    .eq("org_id", orgId);

  if (tErr) return res.status(500).json({ error: tErr.message });

  return res.status(200).json({ ok: true, player });
}
