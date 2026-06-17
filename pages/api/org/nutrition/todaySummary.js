// pages/api/org/nutrition/todaySummary.js
// GET - summary of org athletes: how many have active plans, hydration targets set.

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  try {
    // Fetch all active athletes for org
    const { data: athletes } = await db
      .from("athletes")
      .select("id, athlete_token, name, email")
      .eq("org_token", orgToken)
      .eq("status", "active")
      .limit(2000);

    if (!athletes?.length) {
      return res.status(200).json({ ok: true, summary: { totalAthletes: 0, withPlan: 0, missingPlan: 0, hydrationSetCount: 0 }, needsList: [] });
    }

    const athleteTokens = athletes.map(a => a.athlete_token).filter(Boolean);

    // Fetch active plans for all athletes at once
    const { data: plans } = await db
      .from("nutrition_plans")
      .select("athlete_token, daily_hydration")
      .in("athlete_token", athleteTokens)
      .eq("status", "active");

    const planByToken = new Map();
    for (const p of plans ?? []) {
      if (!planByToken.has(p.athlete_token)) planByToken.set(p.athlete_token, p);
    }

    const tokensWithPlan  = new Set(planByToken.keys());
    const totalAthletes   = athletes.length;
    const withPlan        = tokensWithPlan.size;
    const missingPlan     = totalAthletes - withPlan;

    let hydrationSetCount = 0;
    for (const p of planByToken.values()) {
      if (asString(p.daily_hydration)) hydrationSetCount++;
    }

    const needsList = athletes
      .filter(a => !tokensWithPlan.has(a.athlete_token))
      .slice(0, 8)
      .map(a => ({ token: a.athlete_token, name: a.name, email: a.email }));

    return res.status(200).json({
      ok: true,
      summary: { totalAthletes, withPlan, missingPlan, hydrationSetCount },
      needsList,
    });
  } catch (err) {
    console.error("[org/nutrition/todaySummary]", err);
    return res.status(500).json({ error: err?.message || "Failed to load nutrition summary." });
  }
}
