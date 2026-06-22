// pages/api/film/unconfirmed.js
// GET ?filmId=uuid - returns distinct rekognition tracks needing jersey confirmation.
// One entry per unique person; includes play_count (how many plays they appear in)
// and team (home/away) so the UI can filter the roster dropdown.
// Sorted by play_count DESC so high-value players (starting QB, etc.) appear first.

import { readUserCookie } from "@/lib/requireUser";
import { createClient }   from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AUTO_CONFIRM_THRESHOLD = 0.85; // auto-confirm if confidence ≥ this

function parseUser(req) {
  const raw = req.query?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
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

  // Fetch all tracks for this film, including team so we can filter roster later
  const { data, error } = await supabase
    .from("player_tracks")
    .select("rekognition_track_id, jersey_number, jersey_confidence, jersey_confirmed, roster_id, snap_x, snap_y, team, play_id")
    .eq("film_id", filmId)
    .eq("org_id", orgId)
    .not("rekognition_track_id", "is", null);

  if (error) return res.status(500).json({ error: error.message });

  // Group by track_id: count plays, pick best-confidence row for display
  const trackMap = new Map();
  for (const row of data ?? []) {
    const tid = row.rekognition_track_id;
    if (!trackMap.has(tid)) {
      trackMap.set(tid, { ...row, play_count: 0, _bestConf: row.jersey_confidence ?? 0 });
    }
    const entry = trackMap.get(tid);
    entry.play_count++;
    // Keep the row with the highest confidence for display
    if ((row.jersey_confidence ?? 0) > entry._bestConf) {
      const { play_count, _bestConf } = entry;
      trackMap.set(tid, { ...row, play_count, _bestConf: row.jersey_confidence });
    } else {
      entry.play_count = trackMap.get(tid).play_count; // keep incrementing
    }
  }

  const all = Array.from(trackMap.values()).map(({ _bestConf, ...t }) => t);

  // Pull roster for this org so we can auto-confirm high-confidence matches
  const { data: roster } = await supabase
    .from("roster")
    .select("id, jersey_number, player_name, position")
    .eq("org_id", orgId);

  const rosterByJersey = new Map((roster ?? []).map(p => [p.jersey_number, p]));

  // Auto-confirm: confidence ≥ threshold + exactly one roster player with that jersey
  const autoConfirmed = [];
  for (const track of all) {
    if (track.jersey_confirmed) continue;
    if (
      track.jersey_number != null &&
      (track.jersey_confidence ?? 0) >= AUTO_CONFIRM_THRESHOLD &&
      rosterByJersey.has(track.jersey_number)
    ) {
      const player = rosterByJersey.get(track.jersey_number);
      // Write the confirmation to DB
      await supabase
        .from("player_tracks")
        .update({
          roster_id:        player.id,
          jersey_number:    player.jersey_number,
          jersey_confirmed: true,
          confirmed_by:     "auto",
        })
        .eq("film_id", filmId)
        .eq("rekognition_track_id", track.rekognition_track_id)
        .eq("org_id", orgId);

      track.jersey_confirmed = true;
      track.roster_id        = player.id;
      autoConfirmed.push(track.rekognition_track_id);
    }
  }

  const unconfirmed = all
    .filter(t => !t.jersey_confirmed)
    .sort((a, b) => b.play_count - a.play_count); // most plays first

  const confirmed = all.filter(t => t.jersey_confirmed);

  return res.status(200).json({
    ok: true,
    total:          all.length,
    unconfirmed,
    confirmed,
    autoConfirmed:  autoConfirmed.length,
    allConfirmed:   unconfirmed.length === 0,
  });
}
