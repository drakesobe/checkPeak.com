// pages/api/org/workouts/update.js
// POST { id, title?, date?, sport?, status? } — patches a daily workout.

import { requireOrgSideUser } from "@/lib/requireUser";
import { updateOrgWorkout } from "@/lib/supabaseOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

const VALID_STATUSES = ["assigned", "complete", "completed", "draft", "archived"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  const { id, title, date, sport, status } = req.body || {};

  if (!id) return res.status(400).json({ error: "id is required" });

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  if (status && !VALID_STATUSES.includes(String(status).toLowerCase())) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    // Verify ownership
    const { data: existing } = await db
      .from("daily_workouts")
      .select("id, org_token")
      .eq("id", String(id).trim())
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Workout not found." });
    if (existing.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    const fields = {};
    if (title  !== undefined) fields.title  = String(title).trim();
    if (date   !== undefined) fields.date   = String(date).slice(0, 10);
    if (sport  !== undefined) fields.sport  = String(sport).toLowerCase().trim() || null;
    if (status !== undefined) fields.status = String(status).toLowerCase();

    if (Object.keys(fields).length === 0) return res.status(400).json({ error: "No fields to update." });

    const { data, error } = await updateOrgWorkout(String(id).trim(), fields);
    if (error) return res.status(500).json({ error: "Failed to update workout.", details: error.message });

    return res.status(200).json({ ok: true, workout: data });
  } catch (err) {
    console.error("[org/workouts/update]", err);
    return res.status(500).json({ error: "Failed to update workout.", details: err?.message });
  }
}
