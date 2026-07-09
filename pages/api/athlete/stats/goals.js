// pages/api/athlete/stats/goals.js
// GET  ?sport=football&season=2026  — list goals
// POST { sport, season_year, field_key, target }  — upsert
// DELETE ?sport=football&season=2026&field_key=pass_yds  — remove one

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  // ── GET ───────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { sport, season } = req.query;
    let q = db
      .from("athlete_stat_goals")
      .select("*")
      .eq("athlete_token", athleteToken)
      .order("field_key");

    if (sport)  q = q.eq("sport", sport);
    if (season) q = q.eq("season_year", Number(season));

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, goals: data ?? [] });
  }

  // ── POST — upsert (ON CONFLICT update) ────────────────────────────────────────
  if (req.method === "POST") {
    const { sport, season_year, field_key, target } = req.body || {};
    if (!sport || !season_year || !field_key || target == null) {
      return res.status(400).json({ error: "sport, season_year, field_key, and target are required" });
    }

    const row = {
      athlete_token: athleteToken,
      sport:         String(sport).toLowerCase().trim(),
      season_year:   Number(season_year),
      field_key:     String(field_key).trim(),
      target:        Number(target),
      updated_at:    new Date().toISOString(),
    };

    const { data, error } = await db
      .from("athlete_stat_goals")
      .upsert(row, { onConflict: "athlete_token,sport,season_year,field_key" })
      .select("*")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, goal: data });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { sport, season, field_key } = req.query;
    if (!sport || !season || !field_key) {
      return res.status(400).json({ error: "sport, season, and field_key required" });
    }

    const { error } = await db
      .from("athlete_stat_goals")
      .delete()
      .eq("athlete_token", athleteToken)
      .eq("sport", sport)
      .eq("season_year", Number(season))
      .eq("field_key", field_key);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
