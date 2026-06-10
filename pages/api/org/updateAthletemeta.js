// pages/api/org/updateAthleteMeta.js
// PATCH — updates sport or status on an athlete that belongs to this org.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken     = String(user.orgToken || user.Token || "").trim();
  const { athleteId, athleteToken, sport, status, name } = req.body || {};

  const identifier = String(athleteId || athleteToken || "").trim();
  if (!identifier) return res.status(400).json({ error: "athleteId or athleteToken is required." });

  const update = {};
  if (sport  !== undefined) update.sport  = String(sport).trim() || null;
  if (status !== undefined) update.status = String(status).trim() || "active";
  if (name   !== undefined) update.name   = String(name).trim();

  if (Object.keys(update).length === 0) return res.status(400).json({ error: "No fields to update." });

  try {
    let selectQ = db.from("athletes").select("id, org_token");
    if (/^[0-9a-f]{8}-/i.test(identifier)) selectQ = selectQ.eq("id", identifier);
    else selectQ = selectQ.eq("athlete_token", identifier);
    const { data: athlete } = await selectQ.maybeSingle();

    if (!athlete) return res.status(404).json({ error: "Athlete not found." });
    if (athlete.org_token !== orgToken) return res.status(403).json({ error: "Athlete does not belong to your org." });

    const { data, error } = await db
      .from("athletes")
      .update(update)
      .eq("id", athlete.id)
      .select("id, name, sport, status")
      .single();

    if (error) return res.status(500).json({ error: "Failed to update athlete.", details: error.message });
    return res.status(200).json({ ok: true, athlete: data });
  } catch (err) {
    console.error("[updateAthleteMeta]", err);
    return res.status(500).json({ error: "Failed to update athlete.", details: err?.message });
  }
}
