// pages/api/org/nutrition/assign-plan.js
// POST { athleteToken, plan: { calories, protein, carbs?, fat?, phase?, notes?, planJson? } }
// Archives the athlete's active plans, then creates the new one.

import { requireOrg } from "@/lib/requireOrg";
import { assignPlanToAthlete, normalizePhase, validatePlan } from "@/lib/org/nutritionAssign";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = String(auth?.org?.token || "").trim();
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  const { athleteToken, plan } = req.body || {};
  if (!String(athleteToken || "").trim()) return res.status(400).json({ error: "athleteToken is required." });
  if (!validatePlan(plan)) return res.status(400).json({ error: "plan.calories and plan.protein are required." });

  try {
    const r = await assignPlanToAthlete({ orgToken, orgName: auth?.org?.name, athleteToken, plan });
    if (!r.ok) return res.status(r.status || 500).json({ error: r.error, athleteToken });

    return res.status(200).json({
      ok: true,
      planId:        r.planId,
      athleteToken:  r.athleteToken,
      archivedCount: r.archivedCount,
      plan: {
        phase:    normalizePhase(plan.phase),
        calories: Number(plan.calories),
        protein:  Number(plan.protein),
        carbs:    Number(plan.carbs) || 0,
        fat:      Number(plan.fat)   || 0,
        notes:    String(plan.notes ?? "").trim(),
      },
    });
  } catch (err) {
    console.error("[org/nutrition/assign-plan]", err);
    return res.status(500).json({ error: err?.message || "Failed to assign plan." });
  }
}
