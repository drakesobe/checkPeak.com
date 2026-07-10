// pages/api/athlete/leaderboard.js
// GET — leaderboard for the athlete's own org.
// Reads the athlete's org_token from their profile, then runs same logic as /api/org/leaderboard.
// Query: sport, season

import { requireUser }         from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { SPORT_STATS }         from "@/lib/sportStats";

const TOP_N = 5;

const FOOTBALL_BOARDS = [
  { statKey: "pass_yds",  label: "Pass Yards"  },
  { statKey: "pass_td",   label: "Pass TDs"    },
  { statKey: "rush_yds",  label: "Rush Yards"  },
  { statKey: "rush_td",   label: "Rush TDs"    },
  { statKey: "rec_yds",   label: "Rec Yards"   },
  { statKey: "rec",       label: "Receptions"  },
  { statKey: "tackles",   label: "Tackles"     },
  { statKey: "sacks",     label: "Sacks"       },
];

function getBoardsForSport(sport) {
  if (sport === "football") return FOOTBALL_BOARDS;
  const cfg = SPORT_STATS[sport];
  if (!cfg) return [];
  let allFields = [];
  if (cfg.type === "flat")    allFields = cfg.fields || [];
  if (cfg.type === "grouped") for (const g of Object.values(cfg.groups || {})) allFields.push(...(g.fields || []));
  if (cfg.type === "role")    for (const r of Object.values(cfg.roles  || {})) allFields.push(...(r.fields || []));
  const displayKeys = cfg.display || allFields.slice(0, 6).map(f => f.key);
  return displayKeys
    .map(key => { const f = allFields.find(ff => ff.key === key); return f ? { statKey: key, label: f.label } : null; })
    .filter(Boolean).slice(0, 8);
}

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
      .select("athlete_token, stats, result, logged_by")
      .in("athlete_token", tokens)
      .ilike("sport", sport)
      .eq("season_year", season);

    if (logErr) return res.status(500).json({ error: logErr.message });
    if (!logs?.length) return res.status(200).json({ ok: true, boards: [], myToken: athleteToken });

    // Aggregate per athlete
    const aggMap = {};
    for (const log of logs) {
      const tok = log.athlete_token;
      if (!aggMap[tok]) aggMap[tok] = { stats: {}, gp: 0, wins: 0, coachCount: 0 };
      const a = aggMap[tok];
      a.gp++;
      if (log.result === "W") a.wins++;
      if (log.logged_by === "coach") a.coachCount++;
      for (const [k, v] of Object.entries(log.stats || {})) {
        a.stats[k] = (a.stats[k] || 0) + (Number(v) || 0);
      }
    }

    const boardDefs = getBoardsForSport(sport);
    const boards = boardDefs
      .map(({ statKey, label }) => {
        const entries = Object.entries(aggMap)
          .map(([tok, agg]) => ({
            athleteToken: tok,
            name:         tokenToName[tok] || "Unknown",
            value:        agg.stats[statKey] || 0,
            gp:           agg.gp,
            verified:     agg.coachCount > 0,
            isMe:         tok === athleteToken,
          }))
          .filter(e => e.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, TOP_N);
        return { statKey, label, entries };
      })
      .filter(b => b.entries.length > 0);

    return res.status(200).json({ ok: true, boards, myToken: athleteToken });
  } catch (err) {
    console.error("[athlete/leaderboard]", err);
    return res.status(500).json({ error: err?.message });
  }
}
