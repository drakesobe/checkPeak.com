// pages/api/org/addWorkoutItem.js
// POST { workoutId, exerciseName, sets?, reps?, weight?, rpe?, rest?, instructions?, videoUrl?, evidenceRequired?, order? }
// Adds a single workout item to an existing daily_workout. Verifies org ownership.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  const {
    workoutId,
    dailyWorkoutId, // legacy alias
    exerciseName,
    sets,
    reps,
    weight,
    load,           // legacy alias for weight
    rpe,
    rest,
    instructions,
    videoUrl,
    evidenceRequired,
    order,
  } = req.body || {};

  const wid  = String(workoutId || dailyWorkoutId || "").trim();
  const name = String(exerciseName || "").trim();

  if (!wid)  return res.status(400).json({ error: "workoutId is required." });
  if (!name) return res.status(400).json({ error: "exerciseName is required." });

  try {
    // Verify org ownership
    const { data: workout } = await db
      .from("daily_workouts")
      .select("id, org_token")
      .eq("id", wid)
      .maybeSingle();

    if (!workout) return res.status(404).json({ error: "Workout not found." });
    if (workout.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    // Get current max sort_order so we can append
    const { data: existing } = await db
      .from("workout_items")
      .select("sort_order")
      .eq("workout_id", wid)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = order != null
      ? Number(order)
      : ((existing?.[0]?.sort_order ?? 0) + 1);

    const row = {
      workout_id:        wid,
      exercise_name:     name,
      sets:              sets != null ? Number(sets) : null,
      reps:              String(reps              || ""),
      weight:            String(weight || load    || ""),
      rpe:               String(rpe               || ""),
      rest:              String(rest              || ""),
      instructions:      String(instructions      || ""),
      video_url:         String(videoUrl          || ""),
      evidence_required: String(evidenceRequired  || "none"),
      sort_order:        nextOrder,
    };

    const { data, error } = await db
      .from("workout_items")
      .insert(row)
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Failed to add workout item.", details: error.message });

    return res.status(200).json({ ok: true, workoutItemId: data.id, item: data });
  } catch (err) {
    console.error("[org/addWorkoutItem]", err);
    return res.status(500).json({ error: "Failed to add workout item.", details: err?.message });
  }
}
