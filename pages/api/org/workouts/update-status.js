// pages/api/org/workouts/update-status.js
// POST { id, status } — updates only the status field.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

const VALID_STATUSES = ["assigned", "complete", "completed", "draft", "archived", "pending_review", "rejected"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  const { id, status } = req.body || {};

  if (!id)     return res.status(400).json({ error: "id is required" });
  if (!status) return res.status(400).json({ error: "status is required" });

  const statusNorm = String(status).toLowerCase();
  if (!VALID_STATUSES.includes(statusNorm)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  try {
    const { data: existing } = await db
      .from("daily_workouts")
      .select("id, org_token")
      .eq("id", String(id).trim())
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Workout not found." });
    if (existing.org_token !== orgToken) return res.status(403).json({ error: "Access denied." });

    const { data, error } = await db
      .from("daily_workouts")
      .update({ status: statusNorm })
      .eq("id", String(id).trim())
      .select("id, status")
      .single();

    if (error) return res.status(500).json({ error: "Failed to update status.", details: error.message });
    return res.status(200).json({ ok: true, workout: data });
  } catch (err) {
    console.error("[org/workouts/update-status]", err);
    return res.status(500).json({ error: "Failed to update status.", details: err?.message });
  }
}
