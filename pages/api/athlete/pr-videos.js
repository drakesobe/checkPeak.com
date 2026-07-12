// pages/api/athlete/pr-videos.js
// GET — return all set_log rows where is_pr = true and video_url is not null,
// ordered newest first. Used by the recruiting profile page.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const { data, error } = await db
    .from("set_logs")
    .select("id, exercise_title, date, set_number, actual_reps, actual_weight, difficulty, video_url, timestamp")
    .eq("athlete_token", athleteToken)
    .eq("is_pr", true)
    .not("video_url", "is", null)
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: "DB error", details: error.message });

  return res.status(200).json({ ok: true, videos: data ?? [] });
}
