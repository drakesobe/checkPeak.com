// pages/api/athlete/leaderboard.js
// GET — per-stat team leaderboards for the athlete's own org.
// Query: sport, season, limit (entries per board; default 5, max 200)
// Response: { ok, boards: [{ statKey, label, group, kind, better, qualifier, total,
//             entries: [{ athleteToken, name, value, display, gp, verified, isMe, rank }], me }],
//             myToken, teamGames }
// Board logic lives in lib/teamBoards.js.

import { supabaseAdmin as db } from "@/lib/supabase";
import { buildBoards }         from "@/lib/teamBoards";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Athlete auth
  let user;
  try {
    const mod = await import("@/lib/requireUser");
    user = (mod.readUserCookie || mod.requireUser)(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const athleteToken = String(user.AthleteToken || user.athleteToken || user.Token || "").trim();
  if (!athleteToken) return res.status(400).json({ error: "Not an athlete account" });

  const sport  = String(req.query.sport  || "football").toLowerCase().trim();
  const season = Number(req.query.season || new Date().getFullYear());
  const limit  = Math.min(Math.max(parseInt(String(req.query.limit || "5"), 10) || 5, 1), 200);

  try {
    // Get athlete's own org_token
    const { data: athleteRow } = await db
      .from("athletes")
      .select("org_token, name")
      .eq("athlete_token", athleteToken)
      .maybeSingle();

    if (!athleteRow?.org_token) return res.status(200).json({ ok: true, boards: [], myToken: athleteToken });

    const orgToken = athleteRow.org_token;

    // Get all athletes in the org
    const { data: athletes } = await db
      .from("athletes")
      .select("athlete_token, name")
      .eq("org_token", orgToken);

    if (!athletes?.length) return res.status(200).json({ ok: true, boards: [], myToken: athleteToken });

    const tokenToName = {};
    const tokens = athletes.map(a => { tokenToName[a.athlete_token] = a.name; return a.athlete_token; });

    // Fetch game logs
    const { data: logs, error: logErr } = await db
      .from("athlete_game_logs")
      .select("athlete_token, stats, result, logged_by, role_key")
      .in("athlete_token", tokens)
      .ilike("sport", sport)
      .eq("season_year", season);

    if (logErr) return res.status(500).json({ error: logErr.message });
    if (!logs?.length) return res.status(200).json({ ok: true, boards: [], myToken: athleteToken });

    const { boards, teamGames } = buildBoards({
      sport, logs, tokenToName, myToken: athleteToken, limit,
    });

    return res.status(200).json({ ok: true, boards, myToken: athleteToken, teamGames });
  } catch (err) {
    console.error("[athlete/leaderboard]", err);
    return res.status(500).json({ error: err?.message });
  }
}
