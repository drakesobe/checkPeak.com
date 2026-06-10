// pages/api/athlete/workouts/acknowledgeCompletion.js
// POST { completionId } — athlete acknowledges a rejected completion.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = asString(auth.athlete?.AthleteToken || "");
  if (!athleteToken) return res.status(400).json({ error: "Missing AthleteToken in session." });

  const body         = req.body || {};
  const completionId = asString(body?.completionId || body?.id);
  if (!completionId) return res.status(400).json({ error: "Missing completionId." });

  try {
    const { data: rec } = await db
      .from("workout_completions")
      .select("id, status, athlete_token")
      .eq("id", completionId)
      .maybeSingle();

    if (!rec) return res.status(404).json({ error: "Completion not found." });
    if (rec.athlete_token !== athleteToken) return res.status(403).json({ error: "Forbidden." });

    if (rec.status !== "rejected") {
      return res.status(400).json({ error: "Can only acknowledge rejected completions." });
    }

    const now = new Date().toISOString();
    await db.from("workout_completions").update({
      athlete_acknowledged:    true,
      athlete_acknowledged_at: now,
    }).eq("id", completionId);

    return res.status(200).json({ ok: true, id: completionId, athleteAcknowledged: true, athleteAcknowledgedAt: now });
  } catch (err) {
    console.error("[acknowledgeCompletion]", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
