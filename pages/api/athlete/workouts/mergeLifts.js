// pages/api/athlete/workouts/mergeLifts.js
// POST { keep: "Barbell Squat", remove: ["BB Squat", "barbell squat"] }
// Renames all set_log records with names in `remove` to the canonical `keep` name.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const { keep, remove } = req.body || {};

  if (!keep || !String(keep).trim()) return res.status(400).json({ error: "keep is required" });
  if (!Array.isArray(remove) || remove.length === 0) {
    return res.status(400).json({ error: "remove must be a non-empty array of names" });
  }

  const canonicalName = String(keep).trim();
  let totalUpdated    = 0;

  try {
    for (const oldName of remove) {
      const name = String(oldName || "").trim();
      if (!name || name === canonicalName) continue;

      const { count, error } = await db
        .from("set_logs")
        .update({ exercise_title: canonicalName })
        .eq("athlete_token", athleteToken)
        .eq("exercise_title", name);

      if (error) {
        console.error("[mergeLifts] update error:", error);
        continue;
      }
      if (count) totalUpdated += count;
    }

    return res.status(200).json({ ok: true, updated: totalUpdated, into: canonicalName });
  } catch (err) {
    console.error("[athlete/workouts/mergeLifts]", err);
    return res.status(500).json({ error: "Failed to merge lifts", details: err?.message });
  }
}
