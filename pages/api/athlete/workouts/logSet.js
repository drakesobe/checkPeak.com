// pages/api/athlete/workouts/logSet.js
// POST - logs a single set for a workout item.

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

  const {
    workoutItemId, exerciseTitle, date, setNumber,
    targetReps, targetWeight, actualReps, actualWeight,
    effort, difficulty, groupId, timestamp, notes,
  } = req.body || {};

  if (!exerciseTitle) return res.status(400).json({ error: "exerciseTitle is required" });

  const difficultyValue = difficulty ?? effort ?? null;

  try {
    const { data, error } = await db
      .from("set_logs")
      .insert({
        athlete_token:  athleteToken,
        exercise_title: String(exerciseTitle || "").trim(),
        workout_item_id: workoutItemId ? String(workoutItemId) : null,
        date:           date          ? String(date).slice(0, 10) : null,
        set_number:     Number(setNumber) || 0,
        target_reps:    String(targetReps  || ""),
        target_weight:  String(targetWeight || ""),
        actual_reps:    Number(actualReps)   || 0,
        actual_weight:  Number(actualWeight) || 0,
        difficulty:     difficultyValue != null ? Number(difficultyValue) : 0,
        group_id:       groupId ? String(groupId) : null,
        timestamp:      Number(timestamp) || Date.now(),
        notes:          String(notes || "").trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[logSet]", error);
      return res.status(200).json({ ok: false, warning: "Saved locally, sync failed", details: error.message });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[athlete/workouts/logSet]", err);
    return res.status(200).json({ ok: false, warning: "Saved locally, sync failed" });
  }
}
