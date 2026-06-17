// pages/api/org/nutrition/plans/getByAthlete.js
// GET ?athleteToken= - returns nutrition plans for an athlete, newest first.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const athleteToken = asString(req.query?.athleteToken);
  if (!athleteToken) return res.status(400).json({ error: "athleteToken is required." });

  const pageSizeRaw = parseInt(String(req.query?.pageSize || "20"), 10);
  const pageSize    = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 5), 50) : 20;
  const pageRaw     = parseInt(String(req.query?.page || "1"), 10);
  const page        = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const from        = (page - 1) * pageSize;
  const to          = from + pageSize - 1;

  try {
    const { data: records, error } = await db
      .from("nutrition_plans")
      .select("id, phase, prescription, status, daily_calories, daily_protein, daily_carbs, daily_fat, daily_hydration, plan_json, created_at, created_by, athlete_token")
      .eq("athlete_token", athleteToken)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const plans = (records || []).map(r => ({
      id:            r.id,
      phase:         r.phase          || "",
      prescription:  r.prescription   || "",
      status:        r.status         || "",
      dailyCalories: String(r.daily_calories ?? ""),
      dailyProtein:  String(r.daily_protein  ?? ""),
      dailyCarbs:    String(r.daily_carbs    ?? ""),
      dailyFat:      String(r.daily_fat      ?? ""),
      dailyHydration: String(r.daily_hydration ?? ""),
      planJson:      r.plan_json      || null,
      createdAt:     r.created_at     || "",
      createdBy:     r.created_by     || "",
      athleteToken:  r.athlete_token  || "",
    }));

    return res.status(200).json({
      ok: true,
      plans,
      page,
      pageSize,
      hasMore: plans.length === pageSize,
    });
  } catch (err) {
    console.error("[nutrition/plans/getByAthlete] error:", err);
    return res.status(500).json({ error: "Failed to load plans", detail: err?.message });
  }
}
