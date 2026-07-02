// pages/api/athlete/onboarding-status.js
// GET  — returns { complete: bool } for the current athlete
// POST — marks onboarding as complete (idempotent)

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const token = auth.athlete?.AthleteToken;
  if (!token) return res.status(401).json({ error: "Missing athlete token" });

  // ── GET: check status ──────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { data, error } = await db
      .from("athletes")
      .select("onboarding_complete")
      .eq("athlete_token", token)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "DB error" });
    return res.status(200).json({ complete: data?.onboarding_complete === true });
  }

  // ── POST: mark complete ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { error } = await db
      .from("athletes")
      .update({ onboarding_complete: true })
      .eq("athlete_token", token);

    if (error) return res.status(500).json({ error: "DB error" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
