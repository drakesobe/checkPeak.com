// pages/api/org/nutrition/bulk-assign-plan.js
// POST { athleteTokens: string[], plan: { calories, protein, carbs?, fat?, phase?, notes? } }
// Group Blast: gives the same nutrition plan to many athletes on the coach's team.
// Response: { ok, succeeded, failed, results: [{ athleteToken, ok, planId? , error? }] }

import { requireOrg } from "@/lib/requireOrg";
import { assignPlanToAthlete, validatePlan } from "@/lib/org/nutritionAssign";

const MAX_ATHLETES = 300;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Not authenticated" });

  const orgToken = String(auth.org?.token || "").trim();
  if (!orgToken) return res.status(401).json({ error: "Your session is missing a team. Please sign in again." });

  const { athleteTokens, plan } = req.body || {};
  const tokens = [...new Set((Array.isArray(athleteTokens) ? athleteTokens : []).map((t) => String(t || "").trim()).filter(Boolean))];
  if (!tokens.length) return res.status(400).json({ error: "Choose at least one athlete." });
  if (tokens.length > MAX_ATHLETES) return res.status(400).json({ error: `Send to at most ${MAX_ATHLETES} athletes at a time.` });
  if (!validatePlan(plan)) return res.status(400).json({ error: "The plan needs calories and protein." });

  const results = [];
  // Small batches keep this fast without flooding the database
  for (let i = 0; i < tokens.length; i += 10) {
    const batch = await Promise.all(tokens.slice(i, i + 10).map((athleteToken) =>
      assignPlanToAthlete({ orgToken, orgName: auth.org?.name, athleteToken, plan })
        .catch((e) => ({ ok: false, error: e?.message || "Failed", athleteToken }))));
    for (const r of batch) {
      results.push(r.ok ? { athleteToken: r.athleteToken, ok: true, planId: r.planId } : { athleteToken: r.athleteToken, ok: false, error: r.error });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return res.status(200).json({ ok: true, succeeded, failed: results.length - succeeded, results });
}
