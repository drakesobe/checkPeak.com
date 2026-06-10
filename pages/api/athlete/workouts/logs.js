// pages/api/athlete/workouts/logs.js
// GET ?exerciseTitle=&days=120&limit=500 — fetch set logs for the athlete.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const { exerciseTitle, limit = 500 } = req.query;

  try {
    let query = db
      .from("set_logs")
      .select("id, workout_item_id, exercise_title, date, set_number, target_reps, target_weight, actual_reps, actual_weight, difficulty, group_id, timestamp, reps_completed, weight_used, rpe_actual, logged_at, notes")
      .eq("athlete_token", athleteToken)
      .order("timestamp", { ascending: false })
      .limit(Number(limit) || 500);

    if (exerciseTitle) {
      query = query.eq("exercise_title", String(exerciseTitle).trim());
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Failed to fetch logs", details: error.message });

    const logs = (data ?? []).map(r => ({
      id:            r.id,
      workoutItemId: r.workout_item_id || "",
      exerciseTitle: r.exercise_title  || "",
      date:          r.date            || (r.logged_at ? r.logged_at.slice(0, 10) : ""),
      setNumber:     r.set_number      || 0,
      targetReps:    r.target_reps     || "",
      targetWeight:  r.target_weight   || "",
      actualReps:    r.actual_reps     ?? r.reps_completed ?? 0,
      actualWeight:  r.actual_weight   ?? (r.weight_used ? Number(r.weight_used) : 0),
      difficulty:    r.difficulty      ?? (r.rpe_actual  ? Number(r.rpe_actual)  : 0),
      groupId:       r.group_id        || "",
      timestamp:     r.timestamp       || (r.logged_at ? new Date(r.logged_at).getTime() : 0),
      notes:         r.notes           || "",
    }));

    return res.status(200).json({ ok: true, logs, total: logs.length });
  } catch (err) {
    console.error("[athlete/workouts/logs]", err);
    return res.status(500).json({ error: "Failed to fetch logs", details: err?.message });
  }
}
