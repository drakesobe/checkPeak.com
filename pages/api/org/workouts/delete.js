// pages/api/org/workouts/delete.js
// POST { id } - hard-deletes a daily workout after verifying org ownership.

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

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id is required" });

  try {
    const { data: workout } = await db
      .from("daily_workouts")
      .select("id, org_token")
      .eq("id", String(id).trim())
      .maybeSingle();

    if (!workout) return res.status(404).json({ error: "Workout not found." });
    if (workout.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    const { error } = await db.from("daily_workouts").delete().eq("id", workout.id);
    if (error) return res.status(500).json({ error: "Failed to delete workout.", details: error.message });

    return res.status(200).json({ ok: true, deleted: workout.id });
  } catch (err) {
    console.error("[org/workouts/delete]", err);
    return res.status(500).json({ error: "Failed to delete workout.", details: err?.message });
  }
}
