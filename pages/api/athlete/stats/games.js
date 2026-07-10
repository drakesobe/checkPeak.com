// pages/api/athlete/stats/games.js
// GET  ?sport=football&season=2025  — list game logs
// POST { ...fields }                — create or update (include id to update)
// DELETE ?id=uuid                   — delete a game

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

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { sport, season } = req.query;

    let q = db
      .from("athlete_game_logs")
      .select("*")
      .eq("athlete_token", athleteToken)
      .order("game_date", { ascending: false });

    if (sport)  q = q.ilike("sport", sport.trim());
    if (season) q = q.eq("season_year", Number(season));

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, games: data ?? [] });
  }

  // ── POST — create or update ────────────────────────────────────────────────
  if (req.method === "POST") {
    const body = req.body || {};
    const { id, ...fields } = body;

    if (!fields.sport || !fields.season_year || !fields.game_date) {
      return res.status(400).json({ error: "sport, season_year, and game_date are required" });
    }

    const row = {
      athlete_token: athleteToken,
      sport:         String(fields.sport).toLowerCase().trim(),
      season_year:   Number(fields.season_year),
      game_date:     String(fields.game_date),
      opponent:      String(fields.opponent  || "").trim() || null,
      location:      fields.location  || null,
      result:        fields.result    || null,
      team_score:    fields.team_score != null ? Number(fields.team_score) : null,
      opp_score:     fields.opp_score  != null ? Number(fields.opp_score)  : null,
      group_key:     fields.group_key  || null,
      role_key:      fields.role_key   || null,
      stats:         fields.stats      || {},
      notes:         String(fields.notes || "").trim() || null,
      updated_at:    new Date().toISOString(),
    };

    if (id) {
      const { data, error } = await db
        .from("athlete_game_logs")
        .update(row)
        .eq("id", id)
        .eq("athlete_token", athleteToken)
        .select("*")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, game: data });
    } else {
      const { data, error } = await db
        .from("athlete_game_logs")
        .insert(row)
        .select("*")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ ok: true, game: data });
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await db
      .from("athlete_game_logs")
      .delete()
      .eq("id", id)
      .eq("athlete_token", athleteToken);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
