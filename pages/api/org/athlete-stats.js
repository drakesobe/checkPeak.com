// pages/api/org/athlete-stats.js
// Coach-side game stats CRUD for athletes on the org's roster.
// GET  ?email=...&sport=...&season=...  — list athlete's game logs
// POST { email, ...gameFields }         — create or update (include id to update)
// DELETE ?id=uuid                       — delete a game log

import { requireOrg } from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";

async function resolveAthleteToken(email, orgId) {
  // Lookup athlete by email and verify they belong to this org.
  const { data } = await db
    .from("athletes")
    .select("athlete_token, name")
    .ilike("email", email.trim())
    .eq("org_id", orgId)
    .maybeSingle();
  return data || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgId = String(auth.org?.id || auth.user?.orgId || "").trim();
  if (!orgId) return res.status(401).json({ error: "No org context" });

  // ── GET ───────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { email, sport, season } = req.query;
    if (!email) return res.status(400).json({ error: "email required" });

    const athlete = await resolveAthleteToken(email, orgId);
    if (!athlete) return res.status(404).json({ error: "Athlete not found on this org's roster" });

    let q = db
      .from("athlete_game_logs")
      .select("*")
      .eq("athlete_token", athlete.athlete_token)
      .order("game_date", { ascending: false });

    if (sport)  q = q.eq("sport", sport);
    if (season) q = q.eq("season_year", Number(season));

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      ok: true,
      athleteName: athlete.name,
      athleteToken: athlete.athlete_token,
      games: data ?? [],
    });
  }

  // ── POST — create or update ────────────────────────────────────────────────
  if (req.method === "POST") {
    const body = req.body || {};
    const { email, id, ...fields } = body;

    if (!email) return res.status(400).json({ error: "email required" });
    if (!fields.sport || !fields.season_year || !fields.game_date) {
      return res.status(400).json({ error: "sport, season_year, and game_date required" });
    }

    const athlete = await resolveAthleteToken(email, orgId);
    if (!athlete) return res.status(404).json({ error: "Athlete not found on this org's roster" });

    const row = {
      athlete_token: athlete.athlete_token,
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
      logged_by:     "coach",
      org_id:        orgId,
      updated_at:    new Date().toISOString(),
    };

    if (id) {
      const { data, error } = await db
        .from("athlete_game_logs")
        .update(row)
        .eq("id", id)
        .eq("athlete_token", athlete.athlete_token)
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

  // ── DELETE ────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { id, email } = req.query;
    if (!id || !email) return res.status(400).json({ error: "id and email required" });

    const athlete = await resolveAthleteToken(email, orgId);
    if (!athlete) return res.status(404).json({ error: "Athlete not found on this org's roster" });

    const { error } = await db
      .from("athlete_game_logs")
      .delete()
      .eq("id", id)
      .eq("athlete_token", athlete.athlete_token);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
