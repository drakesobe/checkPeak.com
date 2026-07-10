// pages/api/org/leaderboard.js
// GET — return per-stat leaderboard boards for the org's athletes.
// Query: sport, season (year)

import { requireOrg }          from "@/lib/requireOrg";
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
  if (cfg.type === "flat")    allFields = cfg.fields   || [];
  if (cfg.type === "grouped") {
    for (const g of Object.values(cfg.groups || {})) allFields.push(...(g.fields || []));
  }
  if (cfg.type === "role") {
    for (const r of Object.values(cfg.roles  || {})) allFields.push(...(r.fields || []));
  }

  const displayKeys = cfg.display || allFields.slice(0, 6).map(f => f.key);
  return displayKeys
    .map(key => {
      const f = allFields.find(ff => ff.key === key);
      return f ? { statKey: key, label: f.label } : null;
    })
    .filter(Boolean)
    .slice(0, 8);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgToken = String(auth.user?.orgToken || auth.user?.Token || auth.org?.token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org identity" });

  const sport  = String(req.query.sport  || "football").toLowerCase().trim();
  const season = Number(req.query.season || new Date().getFullYear());

  try {
    // 1. Get all athletes in this org
    const { data: athletes, error: athErr } = await db
      .from("athletes")
      .select("athlete_token, name")
      .eq("org_token", orgToken);

    if (athErr) return res.status(500).json({ error: athErr.message });
    if (!athletes?.length) return res.status(200).json({ ok: true, boards: [] });

    const tokenToName = {};
    const tokens = athletes.map(a => { tokenToName[a.athlete_token] = a.name; return a.athlete_token; });

    // 2. Fetch all game logs for these athletes for this sport+season
    const { data: logs, error: logErr } = await db
      .from("athlete_game_logs")
      .select("athlete_token, stats, result, logged_by")
      .in("athlete_token", tokens)
      .ilike("sport", sport)
      .eq("season_year", season);

    if (logErr) return res.status(500).json({ error: logErr.message });
    if (!logs?.length) return res.status(200).json({ ok: true, boards: [] });

    // 3. Aggregate per athlete
    const aggMap = {}; // athleteToken → { stats totals, gp, wins, verified }
    for (const log of logs) {
      const tok = log.athlete_token;
      if (!aggMap[tok]) {
        aggMap[tok] = { stats: {}, gp: 0, wins: 0, coachCount: 0 };
      }
      const a = aggMap[tok];
      a.gp++;
      if (log.result === "W") a.wins++;
      if (log.logged_by === "coach") a.coachCount++;
      const s = log.stats || {};
      for (const [k, v] of Object.entries(s)) {
        a.stats[k] = (a.stats[k] || 0) + (Number(v) || 0);
      }
    }

    // 4. Build boards
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
          }))
          .filter(e => e.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, TOP_N);

        return { statKey, label, entries };
      })
      .filter(b => b.entries.length > 0);

    return res.status(200).json({ ok: true, boards });
  } catch (err) {
    console.error("[leaderboard]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
