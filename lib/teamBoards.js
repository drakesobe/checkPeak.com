// lib/teamBoards.js
// Builds per-stat team leaderboards from athlete_game_logs rows.
//
// Fixes over the original inline logic in /api/athlete/leaderboard:
//   • Computed rate stats (FG%, AVG, OBP, ERA, Sv%…) are calculated from season totals
//     instead of summing a key that never exists in game logs (those boards used to vanish).
//   • Rate boards require a minimum number of games (half the team leader's games),
//     so 1-for-1 doesn't win "FG%".
//   • "Lower is better" rates (ERA, WHIP, GAA) rank ascending. Raw "bad" counts
//     (penalties, sacks allowed, walks allowed, goals against, unforced errors) are
//     excluded — they ranked the worst player #1.
//   • agg:"max" fields (FG Long, Punt Long) use the season best, not a sum.
//   • Role sports (baseball) aggregate hitters and pitchers separately, since they
//     share keys with opposite meaning (a pitcher's "HR" is home runs allowed).
//   • Ties share a rank. The caller's own entry is always returned as `me`,
//     even when it falls outside the `limit`.

import { SPORT_STATS } from "@/lib/sportStats";

const FOOTBALL_BOARDS = [
  { statKey: "pass_yds", label: "Pass Yards" },
  { statKey: "pass_td",  label: "Pass TDs"   },
  { statKey: "rush_yds", label: "Rush Yards" },
  { statKey: "rush_td",  label: "Rush TDs"   },
  { statKey: "rec_yds",  label: "Rec Yards"  },
  { statKey: "rec",      label: "Receptions" },
  { statKey: "tackles",  label: "Tackles"    },
  { statKey: "sacks",    label: "Sacks"      },
];

// Raw counts where more is worse — not leaderboard material.
const EXCLUDE_KEYS = new Set([
  "sacks_allowed", "penalties", "sacked", "fumbles", "int",
  "bb", "ga", "ue", "tov", "e", "errors", "cs",
]);
// Rates where lower is better — ranked ascending.
const LOWER_IS_BETTER = new Set(["era", "whip", "gaa"]);
// Stats that can legitimately be negative (don't drop values <= 0).
const SIGNED_KEYS = new Set(["pm"]);
// Computed fields that are really counting stats (sum of other counts).
const COUNTING_COMPUTED = new Set(["pts", "yfs"]);

function defsFromSection(section, roleKey, roleLabel) {
  const fields   = section?.fields   || [];
  const computed = section?.computed || [];
  const keys     = section?.display  || fields.filter(f => f.agg).slice(0, 6).map(f => f.key);
  return keys.map(key => {
    if (EXCLUDE_KEYS.has(key)) return null;
    const f = fields.find(x => x.key === key);
    if (f) {
      if (!f.agg) return null;
      return { roleKey, roleLabel, statKey: key, label: f.label, kind: f.agg === "max" ? "best" : "total", better: "high" };
    }
    const c = computed.find(x => x.key === key);
    if (c) {
      return {
        roleKey, roleLabel, statKey: key, label: c.label,
        kind:   COUNTING_COMPUTED.has(key) ? "total" : "rate",
        better: LOWER_IS_BETTER.has(key) ? "low" : "high",
        fn:     c.fn,
      };
    }
    return null;
  }).filter(Boolean);
}

export function boardDefsFor(sport) {
  if (sport === "football") {
    return FOOTBALL_BOARDS.map(b => ({ ...b, roleKey: null, roleLabel: null, kind: "total", better: "high" }));
  }
  const cfg = SPORT_STATS[sport];
  if (!cfg) return [];
  if (cfg.type === "flat") return defsFromSection(cfg, null, null);
  if (cfg.type === "role") {
    return Object.entries(cfg.roles || {}).flatMap(([rk, r]) => defsFromSection(r, rk, r.label || rk));
  }
  if (cfg.type === "grouped") {
    // Non-football grouped sports: merge groups, de-dupe by key.
    const seen = new Set();
    return Object.values(cfg.groups || {})
      .flatMap(g => defsFromSection(g, null, null))
      .filter(d => (seen.has(d.statKey) ? false : (seen.add(d.statKey), true)));
  }
  return [];
}

/** Pick a role for a log: explicit role_key, else the role whose fields best match the stats present. */
function inferRole(cfg, log) {
  if (log.role_key && cfg.roles?.[log.role_key]) return log.role_key;
  let best = null, score = -1;
  for (const [rk, r] of Object.entries(cfg.roles || {})) {
    const keys = new Set((r.fields || []).map(f => f.key));
    let s = 0;
    for (const [k, v] of Object.entries(log.stats || {})) if (keys.has(k) && Number(v)) s++;
    if (s > score) { score = s; best = rk; }
  }
  return best;
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * @param {object}   args
 * @param {string}   args.sport
 * @param {object[]} args.logs         rows with athlete_token, stats, logged_by, role_key
 * @param {object}   args.tokenToName  athlete_token → display name
 * @param {string}   args.myToken      caller's athlete_token (for isMe / me)
 * @param {number}   args.limit        max entries per board
 */
export function buildBoards({ sport, logs, tokenToName, myToken, limit = 5 }) {
  const cfg  = SPORT_STATS[sport];
  const defs = boardDefsFor(sport);
  if (!defs.length || !logs?.length) return { boards: [], teamGames: 0 };

  // bucket ('_' or roleKey) → athlete_token → accumulator
  const buckets = {};
  for (const log of logs) {
    const roleKey = cfg?.type === "role" ? inferRole(cfg, log) : null;
    const bucket  = (buckets[roleKey || "_"] ||= {});
    const a       = (bucket[log.athlete_token] ||= { sums: {}, maxes: {}, gp: 0, coachCount: 0 });
    a.gp++;
    if (log.logged_by === "coach") a.coachCount++;
    for (const [k, v] of Object.entries(log.stats || {})) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      a.sums[k]  = (a.sums[k] || 0) + n;
      a.maxes[k] = Math.max(a.maxes[k] ?? -Infinity, n);
    }
  }

  let teamGames = 0;
  for (const bucket of Object.values(buckets)) {
    for (const a of Object.values(bucket)) teamGames = Math.max(teamGames, a.gp);
  }

  const boards = [];
  for (const d of defs) {
    const accs  = Object.entries(buckets[d.roleKey || "_"] || {});
    const maxGp = accs.reduce((m, [, a]) => Math.max(m, a.gp), 0);
    const minGp = d.kind === "rate" ? Math.max(1, Math.ceil(maxGp * 0.5)) : 1;

    const rows = [];
    for (const [tok, a] of accs) {
      if (a.gp < minGp) continue;
      let value, display;
      if (d.fn) {
        const out = String(d.fn(a.sums) ?? "");
        const n   = parseFloat(out.replace("%", ""));
        if (!Number.isFinite(n)) continue;
        value = n; display = out;
      } else {
        const raw = d.kind === "best" ? a.maxes[d.statKey] : a.sums[d.statKey];
        if (raw == null || !Number.isFinite(raw)) continue;
        value = Math.round(raw * 10) / 10; display = fmt(value);
      }
      if (d.kind !== "rate" && !SIGNED_KEYS.has(d.statKey) && value <= 0) continue;
      rows.push({
        athleteToken: tok,
        name:         tokenToName[tok] || "Unknown",
        value, display,
        gp:           a.gp,
        verified:     a.coachCount > 0,
        isMe:         tok === myToken,
      });
    }
    if (!rows.length) continue;

    rows.sort((x, y) =>
      (d.better === "low" ? x.value - y.value : y.value - x.value) || x.name.localeCompare(y.name));
    let prevVal = null, prevRank = 0;
    rows.forEach((r, i) => {
      if (r.value !== prevVal) { prevRank = i + 1; prevVal = r.value; }
      r.rank = prevRank;
    });

    boards.push({
      statKey:   d.roleKey ? `${d.roleKey}:${d.statKey}` : d.statKey,
      label:     d.label,
      group:     d.roleLabel,
      kind:      d.kind,     // 'total' | 'rate' | 'best'
      better:    d.better,   // 'high' | 'low'
      qualifier: d.kind === "rate" && minGp > 1 ? `Min. ${minGp} games` : null,
      total:     rows.length,
      entries:   rows.slice(0, limit),
      me:        rows.find(r => r.isMe) || null,
    });
  }

  return { boards, teamGames };
}
