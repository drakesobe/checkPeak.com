// pages/api/analytics/onboarding.js
// Logs onboarding step completions for funnel analysis.
// Fire-and-forget from mobile — errors never block the user.
// Table: onboarding_events (athlete_token, step, step_name, created_at)

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();

  const auth = requireAthlete(req);
  const body = req.body || {};
  const step     = Number(body.step ?? -1);
  const stepName = body.stepName ? String(body.stepName).slice(0, 64) : null;

  if (step < 0) return res.status(400).json({ error: "step required" });

  const athleteToken = auth.ok
    ? String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim() || null
    : null;

  // Intentionally fire-and-forget — if the table doesn't exist, the error is swallowed
  db.from("onboarding_events")
    .insert({ athlete_token: athleteToken, step, step_name: stepName })
    .then(() => {})
    .catch(() => {});

  return res.status(200).json({ ok: true });
}
