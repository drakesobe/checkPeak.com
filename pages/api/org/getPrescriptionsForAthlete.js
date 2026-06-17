// pages/api/org/getPrescriptionsForAthlete.js
// GET ?athleteToken= - returns nutrition plan history for an athlete (prescription shape).

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken     = asString(auth?.org?.token);
  const athleteToken = asString(req.query?.athleteToken);

  if (!athleteToken) return res.status(400).json({ error: "athleteToken is required." });

  try {
    // Verify athlete belongs to this org
    const { data: athlete } = await db
      .from("athletes")
      .select("id")
      .eq("athlete_token", athleteToken)
      .eq("org_token", orgToken)
      .maybeSingle();

    if (!athlete) {
      return res.status(404).json({ error: "Athlete not found for this organization." });
    }

    const { data: plans, error } = await db
      .from("nutrition_plans")
      .select("id, phase, prescription, status, created_at, created_by")
      .eq("athlete_token", athleteToken)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const prescriptions = (plans || []).map(r => {
      const phase = asString(r.phase);
      return {
        id:           r.id,
        title:        phase ? `Nutrition Plan • ${phase}` : "Nutrition Plan",
        prescription: asString(r.prescription),
        createdAt:    r.created_at || "",
        createdBy:    asString(r.created_by),
        status:       asString(r.status),
      };
    });

    return res.status(200).json({
      ok: true,
      prescriptions,
      debug: { source: "nutrition_plans", athleteToken, count: prescriptions.length },
    });
  } catch (err) {
    console.error("[getPrescriptionsForAthlete] error:", err);
    return res.status(500).json({ error: "Server error", detail: err?.message || String(err) });
  }
}
