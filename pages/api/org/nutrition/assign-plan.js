// pages/api/org/nutrition/assign-plan.js
// POST { athleteToken, plan: { calories, protein, carbs?, fat?, phase?, notes?, planJson? } }
// Archives existing active plans for the athlete then creates a new one.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

const PHASE_MAP = {
  surplus: "Surplus", maintain: "Maintain", cut: "Cut",
  "game week": "Game Week", "bye week": "Bye Week",
};
function normalizePhase(raw) {
  return PHASE_MAP[String(raw || "").toLowerCase().trim()] || "Maintain";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  const { athleteToken, plan } = req.body || {};
  if (!asString(athleteToken)) return res.status(400).json({ error: "athleteToken is required." });
  if (!plan?.calories || !plan?.protein) return res.status(400).json({ error: "plan.calories and plan.protein are required." });

  try {
    // Verify athlete belongs to this org
    const { data: athlete } = await db
      .from("athletes")
      .select("id, athlete_token, name, email")
      .eq("athlete_token", asString(athleteToken))
      .eq("org_token", orgToken)
      .maybeSingle();

    if (!athlete) return res.status(404).json({ error: "Athlete not found.", athleteToken });

    // Archive existing active plans
    const { data: existing } = await db
      .from("nutrition_plans")
      .select("id")
      .eq("athlete_token", athlete.athlete_token)
      .eq("status", "active");

    if (existing?.length) {
      await db
        .from("nutrition_plans")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .in("id", existing.map(p => p.id));
    }

    // Create new active plan
    const orgName = asString(auth?.org?.name || "");
    const { data: newPlan, error } = await db
      .from("nutrition_plans")
      .insert({
        athlete_token:   athlete.athlete_token,
        athlete_id:      athlete.id,
        org_token:       orgToken,
        status:          "active",
        phase:           normalizePhase(plan.phase),
        daily_calories:  String(Number(plan.calories) || 0),
        daily_protein:   String(Number(plan.protein)  || 0),
        daily_carbs:     String(Number(plan.carbs)    || 0),
        daily_fat:       String(Number(plan.fat)      || 0),
        daily_hydration: String(Number(plan.hydration || plan.hydrationOz || 0) || 0),
        prescription:    asString(plan.notes || plan.prescription || ""),
        plan_json:       plan.planJson || null,
        created_by:      orgName,
        created_at:      new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return res.status(500).json({ error: "Failed to create plan.", details: error.message });

    return res.status(200).json({
      ok: true,
      planId:        newPlan.id,
      athleteToken:  athlete.athlete_token,
      archivedCount: existing?.length || 0,
      plan: {
        phase:    normalizePhase(plan.phase),
        calories: Number(plan.calories),
        protein:  Number(plan.protein),
        carbs:    Number(plan.carbs)  || 0,
        fat:      Number(plan.fat)    || 0,
        notes:    asString(plan.notes),
      },
    });
  } catch (err) {
    console.error("[org/nutrition/assign-plan]", err);
    return res.status(500).json({ error: err?.message || "Failed to assign plan." });
  }
}
