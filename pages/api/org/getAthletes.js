// pages/api/org/getAthletes.js
// GET — returns all athletes linked to this org.

import { requireOrgSideUser } from "@/lib/requireUser";
import { getAthletesByOrgToken } from "@/lib/supabaseOrg";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  try {
    const { data: athletes, error } = await getAthletesByOrgToken(orgToken);
    if (error) return res.status(500).json({ error: "Failed to fetch athletes.", details: error.message });

    const formatted = athletes.map(a => ({
      id:           a.id,
      Name:         a.name         || "",
      Email:        a.email        || "",
      AthleteToken: a.athlete_token || "",
      Sport:        a.sport        || "",
      Status:       a.status       || "active",
      CreatedAt:    a.created_at   || "",
    }));

    return res.status(200).json({ ok: true, athletes: formatted });
  } catch (err) {
    console.error("[getAthletes]", err);
    return res.status(500).json({ error: "Failed to fetch athletes.", details: err?.message });
  }
}
