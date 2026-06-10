// pages/api/org/reviewCompletion.js
// POST { completionId, decision: "approve"|"reject", note? }
// Trainer/Admin reviews a workout completion.

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

  const { completionId, decision, note } = req.body || {};
  if (!completionId) return res.status(400).json({ error: "completionId is required." });

  const d = String(decision || "").toLowerCase();
  if (d !== "approve" && d !== "reject") return res.status(400).json({ error: "decision must be approve or reject." });

  const nextStatus = d === "approve" ? "completed" : "rejected";

  try {
    // Verify ownership
    const { data: existing } = await db
      .from("workout_completions")
      .select("id, org_token, workout_item_id")
      .eq("id", String(completionId).trim())
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Completion not found." });
    if (existing.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    // Update completion
    const { error: updErr } = await db
      .from("workout_completions")
      .update({
        status:      nextStatus,
        review_note: note ? String(note) : null,
        reviewed_by: String(user.memberId || user.id || ""),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updErr) return res.status(500).json({ error: "Failed to update completion.", details: updErr.message });

    // Cascade: update workout_item status
    if (existing.workout_item_id) {
      await db
        .from("workout_items")
        .update({ status: nextStatus })
        .eq("id", existing.workout_item_id);

      // Recompute daily_workout status
      const { data: wi } = await db
        .from("workout_items")
        .select("workout_id")
        .eq("id", existing.workout_item_id)
        .maybeSingle();

      if (wi?.workout_id) {
        const { data: items } = await db
          .from("workout_items")
          .select("status")
          .eq("workout_id", wi.workout_id);

        const statuses = (items ?? []).map(i => String(i.status || "assigned").toLowerCase());
        let dwStatus = "assigned";
        if (statuses.includes("rejected"))       dwStatus = "rejected";
        else if (statuses.includes("pending_review")) dwStatus = "pending_review";
        else if (statuses.length && statuses.every(s => s === "completed")) dwStatus = "completed";

        await db.from("daily_workouts").update({ status: dwStatus }).eq("id", wi.workout_id);
      }
    }

    return res.status(200).json({ ok: true, status: nextStatus });
  } catch (err) {
    console.error("[org/reviewCompletion]", err);
    return res.status(500).json({ error: "Failed to review completion.", details: err?.message });
  }
}
