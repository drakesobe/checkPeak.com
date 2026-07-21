// pages/api/athlete/workouts/unmarkItem.js
// POST { workoutItemId } - undo a workout item completion.
// Deletes the completion record, resets item status to 'assigned',
// and recomputes the parent daily_workout status.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const workoutItemId = String(body?.workoutItemId || "").trim();
  if (!workoutItemId) return res.status(400).json({ error: "Missing workoutItemId" });

  // 1. Reset the workout_item status back to assigned
  const { error: itemErr } = await db
    .from("workout_items")
    .update({ status: "assigned" })
    .eq("id", workoutItemId);
  if (itemErr) return res.status(500).json({ error: "Failed to reset item status", details: itemErr.message });

  // 2. Delete completion record(s) for this item
  await db.from("workout_completions").delete().eq("workout_item_id", workoutItemId);

  // 3. Look up daily_workout_id to recompute parent status
  const { data: item } = await db
    .from("workout_items")
    .select("daily_workout_id")
    .eq("id", workoutItemId)
    .maybeSingle();

  if (item?.daily_workout_id) {
    const { data: siblings } = await db
      .from("workout_items")
      .select("status")
      .eq("daily_workout_id", item.daily_workout_id);

    const statuses = (siblings ?? []).map(s => String(s.status || "assigned").toLowerCase());
    let dwStatus = "assigned";
    if (statuses.includes("rejected"))            dwStatus = "rejected";
    else if (statuses.includes("pending_review")) dwStatus = "pending_review";
    else if (statuses.length && statuses.every(s => s === "completed")) dwStatus = "completed";

    await db.from("daily_workouts").update({ status: dwStatus }).eq("id", item.daily_workout_id);
  }

  return res.status(200).json({ ok: true });
}
