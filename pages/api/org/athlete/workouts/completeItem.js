// pages/api/org/athlete/workouts/completeItem.js
// POST { workoutItemId, fileUrl?, evidenceType? }
// Athlete marks a single workout item as complete.

import { requireAthleteUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAthleteUser(req, res);
  if (!user) return;

  const { workoutItemId, fileUrl, evidenceType = "photo" } = req.body || {};
  if (!workoutItemId) return res.status(400).json({ error: "workoutItemId is required." });

  try {
    // Get the workout item to check evidence_required + daily_workout_id
    const { data: item } = await db
      .from("workout_items")
      .select("id, evidence_required, daily_workout_id")
      .eq("id", String(workoutItemId).trim())
      .maybeSingle();

    if (!item) return res.status(404).json({ error: "Workout item not found." });

    // Get the daily workout for org_id + athlete_id
    const { data: dw } = await db
      .from("daily_workouts")
      .select("id, org_id, athlete_id")
      .eq("id", item.daily_workout_id)
      .maybeSingle();

    if (!dw) return res.status(404).json({ error: "Daily workout not found." });

    const needsEvidence = String(item.evidence_required || "none") !== "none";
    const status        = needsEvidence ? "pending_review" : "completed";

    const athleteId = user.id || user.athleteId || dw.athlete_id || null;

    const { data: completion, error } = await db
      .from("workout_completions")
      .upsert(
        {
          workout_item_id: item.id,
          athlete_id:      athleteId,
          org_id:          dw.org_id || null,
          status,
          completed_at:    new Date().toISOString(),
        },
        { onConflict: "workout_item_id,athlete_id", ignoreDuplicates: false }
      )
      .select("id, status")
      .single();

    if (error) return res.status(500).json({ error: "Failed to record completion.", details: error.message });

    // Store evidence in completion_evidence if a file URL was provided
    if (fileUrl && completion?.id) {
      await db.from("completion_evidence").insert({
        workout_completion_id: completion.id,
        athlete_id:            athleteId,
        url:                   String(fileUrl),
        evidence_type:         String(evidenceType || "photo"),
      });
    }

    return res.status(200).json({ ok: true, completionId: completion.id, status: completion.status });
  } catch (err) {
    console.error("[athlete/workouts/completeItem]", err);
    return res.status(500).json({ error: "Failed to complete item.", details: err?.message });
  }
}
