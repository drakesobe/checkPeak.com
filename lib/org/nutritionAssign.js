// lib/org/nutritionAssign.js
// Assigning a nutrition plan to an athlete: archive their active plans, then create the new one.
// Shared by /api/org/nutrition/assign-plan (one athlete) and /bulk-assign-plan (Group Blast).

import { supabaseAdmin as db } from "@/lib/supabase";

const PHASE_MAP = {
  surplus: "Surplus", bulk: "Surplus", maintain: "Maintain", cut: "Cut",
  "game week": "Game Week", gameweek: "Game Week", "bye week": "Bye Week", byeweek: "Bye Week",
};

export function normalizePhase(raw) {
  return PHASE_MAP[String(raw || "").toLowerCase().trim()] || "Maintain";
}

const str = (v) => String(v ?? "").trim();
const num = (v) => String(Number(v) || 0);

export function validatePlan(plan) {
  return Boolean(plan?.calories && plan?.protein);
}

// Returns { ok, planId, archivedCount, athleteToken } or { ok: false, status, error }
export async function assignPlanToAthlete({ orgToken, orgName, athleteToken, plan }) {
  const { data: athlete } = await db
    .from("athletes")
    .select("id, athlete_token")
    .eq("athlete_token", str(athleteToken))
    .eq("org_token", orgToken)
    .maybeSingle();
  if (!athlete) return { ok: false, status: 404, error: "Athlete not found on your team.", athleteToken };

  const { data: existing } = await db
    .from("nutrition_plans")
    .select("id")
    .eq("athlete_token", athlete.athlete_token)
    .eq("status", "active");

  if (existing?.length) {
    await db
      .from("nutrition_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .in("id", existing.map((p) => p.id));
  }

  const { data: created, error } = await db
    .from("nutrition_plans")
    .insert({
      athlete_token:   athlete.athlete_token,
      athlete_id:      athlete.id,
      org_token:       orgToken,
      status:          "active",
      phase:           normalizePhase(plan.phase),
      daily_calories:  num(plan.calories),
      daily_protein:   num(plan.protein),
      daily_carbs:     num(plan.carbs),
      daily_fat:       num(plan.fat),
      daily_hydration: num(plan.hydration || plan.hydrationOz),
      prescription:    str(plan.notes || plan.prescription),
      plan_json:       plan.planJson || null,
      created_by:      str(orgName),
      created_at:      new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { ok: false, status: 500, error: `Failed to create plan: ${error.message}`, athleteToken };
  return { ok: true, planId: created.id, archivedCount: existing?.length || 0, athleteToken: athlete.athlete_token };
}
