// pages/api/org/athlete/completeWorkoutItems.js
// POST { email, workoutItemId, evidenceType?, fileUrl? }
// Legacy endpoint: completes a workout item identified by athlete email (no cookie required).

import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, workoutItemId, evidenceType = "photo", fileUrl } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) return res.status(400).json({ error: "Valid email is required." });
  if (!workoutItemId) return res.status(400).json({ error: "workoutItemId is required." });

  try {
    // Resolve athlete by email
    const { data: athlete } = await db
      .from("athletes")
      .select("id, athlete_token, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!athlete) return res.status(404).json({ error: "Athlete not found." });

    // Get workout item
    const { data: item } = await db
      .from("workout_items")
      .select("id, evidence_required, workout_id")
      .eq("id", String(workoutItemId).trim())
      .maybeSingle();

    if (!item) return res.status(404).json({ error: "Workout item not found." });

    // Get daily workout for org context
    const { data: dw } = await db
      .from("daily_workouts")
      .select("id, org_token, athlete_token")
      .eq("id", item.workout_id)
      .maybeSingle();

    if (!dw) return res.status(404).json({ error: "Daily workout not found." });

    const evidenceReq   = String(item.evidence_required || "none");
    const needsEvidence = evidenceReq !== "none";
    const status        = needsEvidence ? "pending_review" : "completed";

    const { data: completion, error } = await db
      .from("workout_completions")
      .upsert(
        {
          workout_item_id: item.id,
          workout_id:      dw.id,
          athlete_id:      athlete.id,
          athlete_token:   athlete.athlete_token || dw.athlete_token,
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
    console.error("[org/athlete/completeWorkoutItems]", err);
    return res.status(500).json({ error: "Failed to complete workout item.", details: err?.message });
  }
}
