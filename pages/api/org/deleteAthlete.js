// pages/api/org/deleteAthlete.js
// DELETE — removes an athlete that belongs to this org.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "DELETE" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken     = String(user.orgToken || user.Token || "").trim();
  const athleteId    = String(req.body?.athleteId    || req.query?.athleteId    || "").trim();
  const athleteEmail = String(req.body?.athleteEmail || req.query?.athleteEmail || "").trim().toLowerCase();

  if (!athleteId && !athleteEmail) {
    return res.status(400).json({ error: "athleteId or athleteEmail is required." });
  }

  try {
    let query = db.from("athletes").select("id, org_token");
    if (athleteId) query = query.eq("id", athleteId);
    else           query = query.eq("email", athleteEmail);

    const { data: athlete } = await query.maybeSingle();

    if (!athlete) return res.status(404).json({ error: "Athlete not found." });
    if (athlete.org_token !== orgToken) return res.status(403).json({ error: "Athlete does not belong to your org." });

    const { error } = await db.from("athletes").delete().eq("id", athlete.id);
    if (error) return res.status(500).json({ error: "Failed to delete athlete.", details: error.message });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[deleteAthlete]", err);
    return res.status(500).json({ error: "Failed to delete athlete.", details: err?.message });
  }
}
