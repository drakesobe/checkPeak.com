// pages/api/org/leaderboard.js
// GET — per-stat team leaderboards for the coach's org.
// Query:
//   sport          (default football)
//   season         (default current year)
//   limit          entries per board (default 5, max 200)
//   verifiedOnly   "1" → rank only coach-logged games
// Response: { ok, boards, summary, teamGames }
//   boards: see lib/teamBoards.js (entries also carry `email` for linking to athlete stats)
//   summary: { athletesWithStats, rosterSize, gamesLogged, coachLogged, verifiedPct }

import { requireOrg }          from "@/lib/requireOrg";
import { supabaseAdmin as db } from "@/lib/supabase";
import { buildBoards }         from "@/lib/teamBoards";

const EMPTY_SUMMARY = { athletesWithStats: 0, rosterSize: 0, gamesLogged: 0, coachLogged: 0, verifiedPct: 0 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgToken = String(auth.user?.orgToken || auth.user?.Token || auth.org?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org identity" });

  const sport        = String(req.query.sport  || "football").toLowerCase().trim();
  const season       = Number(req.query.season || new Date().getFullYear());
  const limit        = Math.min(Math.max(parseInt(String(req.query.limit || "5"), 10) || 5, 1), 200);
  const verifiedOnly = String(req.query.verifiedOnly || "") === "1";

  try {
    // 1. Roster
    const { data: athletes, error: athErr } = await db
      .from("athletes")
      .select("athlete_token, name, email")
      .eq("org_token", orgToken);

    if (athErr) return res.status(500).json({ error: athErr.message });
    if (!athletes?.length) return res.status(200).json({ ok: true, boards: [], summary: EMPTY_SUMMARY, teamGames: 0 });

    const tokenToName  = {};
    const tokenToEmail = {};
    const tokens = athletes.map(a => {
      tokenToName[a.athlete_token]  = a.name;
      tokenToEmail[a.athlete_token] = a.email || null;
      return a.athlete_token;
    });

    // 2. Game logs for this sport + season
    const { data: allLogs, error: logErr } = await db
      .from("athlete_game_logs")
      .select("athlete_token, stats, result, logged_by, role_key")
      .in("athlete_token", tokens)
      .ilike("sport", sport)
      .eq("season_year", season);

    if (logErr) return res.status(500).json({ error: logErr.message });

    const logsAll     = allLogs || [];
    const coachLogged = logsAll.filter(l => l.logged_by === "coach").length;
    const summary = {
      athletesWithStats: new Set(logsAll.map(l => l.athlete_token)).size,
      rosterSize:        athletes.length,
      gamesLogged:       logsAll.length,
      coachLogged,
      verifiedPct:       logsAll.length ? Math.round((coachLogged / logsAll.length) * 100) : 0,
    };

    const logs = verifiedOnly ? logsAll.filter(l => l.logged_by === "coach") : logsAll;
    if (!logs.length) return res.status(200).json({ ok: true, boards: [], summary, teamGames: 0 });

    // 3. Boards (shared with /api/athlete/leaderboard)
    const { boards, teamGames } = buildBoards({ sport, logs, tokenToName, myToken: null, limit });
    for (const b of boards) {
      for (const e of b.entries) e.email = tokenToEmail[e.athleteToken] || null;
    }

    return res.status(200).json({ ok: true, boards, summary, teamGames });
  } catch (err) {
    console.error("[org/leaderboard]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
