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
    // Get the workout item to check evidence_required + get org context
    const { data: item } = await db
      .from("workout_items")
      .select("id, evidence_required, workout_id")
      .eq("id", String(workoutItemId).trim())
      .maybeSingle();

    if (!item) return res.status(404).json({ error: "Workout item not found." });

    // Get the daily workout for org_token + athlete_token
    const { data: dw } = await db
      .from("daily_workouts")
      .select("id, org_token, athlete_token, athlete_id")
      .eq("id", item.workout_id)
      .maybeSingle();

    if (!dw) return res.status(404).json({ error: "Daily workout not found." });

    const evidenceReq  = String(item.evidence_required || "none");
    const needsEvidence = evidenceReq !== "none";
    const status       = needsEvidence ? "pending_review" : "completed";

    // Upsert completion (one per item per athlete)
    const athleteId    = user.id || user.athleteId || null;
    const athleteToken = String(user.AthleteToken || user.athleteToken || "").trim() || null;

    const { data: completion, error } = await db
      .from("workout_completions")
      .upsert(
        {
          workout_item_id: item.id,
          workout_id:      dw.id,
          athlete_id:      athleteId,
          athlete_token:   athleteToken || dw.athlete_token,
          org_token:       dw.org_token,
          status,
          ...(fileUrl ? { attachment_url: String(fileUrl), attachment_type: String(evidenceType) } : {}),
          completed_at:    new Date().toISOString(),
        },
        { onConflict: "workout_item_id,athlete_token", ignoreDuplicates: false }
      )
      .select("id, status")
      .single();

    if (error) return res.status(500).json({ error: "Failed to record completion.", details: error.message });

    return res.status(200).json({ ok: true, completionId: completion.id, status: completion.status });
  } catch (err) {
    console.error("[athlete/workouts/completeItem]", err);
    return res.status(500).json({ error: "Failed to complete item.", details: err?.message });
  }
}
