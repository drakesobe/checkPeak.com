// pages/api/athlete/stats/unread-count.js
// Returns the total count of coach-logged game entries for the authenticated athlete.
// Used by the mobile Today screen to show a badge when new coach stats exist.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const { count, error } = await db
    .from("athlete_game_logs")
    .select("*", { count: "exact", head: true })
    .eq("athlete_token", athleteToken)
    .eq("logged_by", "coach");

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, count: count ?? 0 });
}
