// pages/api/film/analytics.js
// GET ?filmId=uuid
// Returns EPA, drives, direction, tempo, motion, personnel, pressure - all server-side.

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── EPA model (simplified Expected Points) ────────────────────────────────────
const ZONE_YARDS = { own_territory: 22, midfield: 50, red_zone: 82 };

function ep(down, distance, yardLine) {
  const pos  = -1.6 + (Math.min(99, yardLine) / 100) * 7.6;
  const dAdj = [0, 0, -0.35, -0.9, -1.5][down ?? 1] ?? 0;
  const dist = Math.max(0, (Math.min(distance ?? 10, 20) - 5) * 0.04);
  return pos + dAdj - dist;
}

function calcEPA(play) {
  const yL      = ZONE_YARDS[play.field_zone] ?? 50;
  const epBefore = ep(play.down, play.distance, yL);
  const result   = (play.result ?? "").toLowerCase();
  const yg       = Number(play.yards_gained ?? 0);
  let epAfter;
  if (result === "td")        epAfter = 6.3;
  else if (result === "turnover") epAfter = -1.4;
  else {
    const newYL   = Math.min(99, yL + yg);
    const gained  = yg >= (play.distance ?? 10);
    const newDown = gained ? 1 : (play.down ?? 1) + 1;
    const newDist = gained ? 10 : Math.max(1, (play.distance ?? 10) - yg);
    epAfter = newDown > 4 ? -1.4 : ep(newDown, newDist, newYL);
  }
  return +((epAfter - epBefore).toFixed(2));
}

// ── Pre-snap motion: home player with first_step_ms < 120 ─────────────────────
function hasPreSnapMotion(homeTracks) {
  return homeTracks.some(t => t.first_step_ms != null && t.first_step_ms < 120);
}

// ── Personnel grouping from snap positions ────────────────────────────────────
function detectPersonnel(homeTracks) {
  if (!homeTracks.length) return "?";
  const backfield = homeTracks.filter(t => (t.snap_y ?? 50) < 49.5 && !((t.snap_x ?? 26.65) > 24 && (t.snap_x ?? 26.65) < 29));
  const wide      = homeTracks.filter(t => { const x = t.snap_x ?? 26.65; return x < 10 || x > 43; });
  const rb = Math.min(2, Math.max(0, backfield.length));
  const te = Math.min(3, Math.max(0, homeTracks.length - 6 - rb - wide.length));
  return `${rb}${Math.max(0, te)}`;
}

// ── Run direction from snap position of highest-distance backfield player ──────
function getRunDirection(homeTracks) {
  const backfield = homeTracks.filter(t => (t.snap_y ?? 50) < 49.5);
  if (!backfield.length) return null;
  const carrier = backfield.reduce((b, t) => (t.distance_traveled_yd ?? 0) > (b.distance_traveled_yd ?? 0) ? t : b, backfield[0]);
  const x = carrier.snap_x ?? 26.65;
  return x < 21 ? "left" : x > 32 ? "right" : "middle";
}

// ── Drive reconstruction ──────────────────────────────────────────────────────
function reconstructDrives(enriched) {
  const sorted = [...enriched].sort((a, b) => a.play_number - b.play_number);
  const drives = [];
  let current  = [];

  for (let i = 0; i < sorted.length; i++) {
    const p    = sorted[i];
    const prev = sorted[i - 1];
    const newDrive = i === 0 ||
      (prev && ["td", "turnover"].includes(prev.result)) ||
      (prev && prev.play_type === "kick");

    if (newDrive && current.length) { drives.push(buildDrive(drives.length + 1, current)); current = []; }
    current.push(p);
  }
  if (current.length) drives.push(buildDrive(drives.length + 1, current));
  return drives;
}

function buildDrive(num, plays) {
  const last  = plays[plays.length - 1];
  const yards = +plays.reduce((s, p) => s + Number(p.yards_gained ?? 0), 0).toFixed(1);
  const epa   = +plays.reduce((s, p) => s + (p._epa ?? 0), 0).toFixed(2);
  const result =
    last.result === "td"       ? "Touchdown"        :
    last.result === "turnover" ? "Turnover"          :
    last.play_type === "kick"  ? "Punt"             :
    (last.down === 4 && last.result === "failure") ? "Turnover on Downs" :
    "End of Film";
  return {
    number:   num,
    plays:    plays.length,
    yards,
    epa,
    result,
    playList: plays.map(p => ({
      playNumber:  p.play_number,
      playType:    p.play_type,
      down:        p.down,
      distance:    p.distance,
      yardsGained: p.yards_gained,
      result:      p.result,
    })),
  };
}

// ── Aggregation helper ────────────────────────────────────────────────────────
function aggBy(enriched, keyFn) {
  const m = {};
  for (const p of enriched) {
    const k = keyFn(p) ?? "unknown";
    if (!m[k]) m[k] = { sum: 0, n: 0, suc: 0 };
    m[k].sum += p._epa; m[k].n++;
    if (["success", "td"].includes(p.result)) m[k].suc++;
  }
  return Object.fromEntries(
    Object.entries(m).map(([k, v]) => [k, {
      avg:         +( v.sum / v.n).toFixed(2),
      plays:       v.n,
      successRate: Math.round(v.suc / v.n * 100),
    }])
  );
}

// ── Auth helper (supports _authUser query param for mobile) ──────────────────
function parseUser(req) {
  // req.query values are already URL-decoded by Next.js — parse directly
  const raw = req.query?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).end();

  const user   = parseUser(req);
  if (!user)   return res.status(401).json({ error: "Not authenticated" });
  const orgId  = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  try {
    const { data: plays, error } = await supabase
      .from("game_plays")
      .select(`
        id, play_number, play_type, formation, down, distance,
        field_zone, yards_gained, result, start_time_secs, end_time_secs,
        hash, yard_line, play_direction, personnel,
        player_tracks ( jersey_number, team, snap_x, snap_y, first_step_ms, distance_traveled_yd )
      `)
      .eq("film_id", filmId)
      .eq("org_id", orgId)
      .order("play_number");

    if (error) throw error;
    if (!plays?.length) return res.status(200).json({ ok: true, empty: true, drives: [], direction: [], personnel: [] });

    // ── Enrich per play ──────────────────────────────────────────────────────
    // Coach-tagged fields (play_direction, personnel) take priority over AI detection.
    // This means analytics work immediately after tagging, before the ECS worker runs.
    const enriched = plays.map(p => {
      const home = (p.player_tracks ?? []).filter(t => t.team === "home");
      const away = (p.player_tracks ?? []).filter(t => t.team === "away");
      const aiDir  = p.play_type === "run" ? getRunDirection(home) : null;
      const aiPers = home.length ? detectPersonnel(home) : null;
      return {
        ...p,
        _epa:      calcEPA(p),
        motion:    hasPreSnapMotion(home),
        personnel: p.personnel ?? aiPers ?? "?",
        direction: p.play_direction ?? aiDir,
        pressure:  p.play_type === "pass" && away.length >= 5,
        _homeN:    home.length,
        _awayN:    away.length,
      };
    });

    const total = enriched.length;

    // ── EPA ──────────────────────────────────────────────────────────────────
    const overall = +(enriched.reduce((s, p) => s + p._epa, 0) / total).toFixed(2);
    const epa = {
      overall,
      byPlayType:  aggBy(enriched, p => p.play_type),
      byFormation: aggBy(enriched, p => p.formation),
      byDown:      aggBy(enriched, p => p.down != null ? String(p.down) : null),
    };

    // ── Tempo ────────────────────────────────────────────────────────────────
    const sorted = [...enriched].sort((a, b) => a.play_number - b.play_number);
    const gaps   = [];
    for (let i = 1; i < sorted.length; i++) {
      const g = (sorted[i].start_time_secs ?? 0) - (sorted[i - 1].end_time_secs ?? 0);
      if (g > 0 && g < 120) gaps.push(g);
    }
    const tempo = {
      avgSecs:     gaps.length ? +(gaps.reduce((a, b) => a + b) / gaps.length).toFixed(1) : null,
      fastestSecs: gaps.length ? +Math.min(...gaps).toFixed(1) : null,
      slowestSecs: gaps.length ? +Math.max(...gaps).toFixed(1) : null,
    };

    // ── Motion ───────────────────────────────────────────────────────────────
    const motionCount = enriched.filter(p => p.motion).length;
    const motionRate  = Math.round(motionCount / total * 100);

    // ── Personnel ────────────────────────────────────────────────────────────
    const PERS_LABELS = { "10":"1RB 0TE","11":"1RB 1TE","12":"1RB 2TE","20":"2RB 0TE","21":"2RB 1TE","22":"2RB 2TE" };
    const pMap = {};
    for (const p of enriched) {
      const g = p.personnel;
      if (!pMap[g]) pMap[g] = { plays: 0, suc: 0 };
      pMap[g].plays++;
      if (["success", "td"].includes(p.result)) pMap[g].suc++;
    }
    const personnel = Object.entries(pMap)
      .sort((a, b) => b[1].plays - a[1].plays)
      .map(([g, v]) => ({
        grouping:    g,
        label:       PERS_LABELS[g] ?? `${g} personnel`,
        plays:       v.plays,
        pct:         Math.round(v.plays / total * 100),
        successRate: Math.round(v.suc / v.plays * 100),
      }));

    // ── Run direction ────────────────────────────────────────────────────────
    const dMap = { left: { plays: 0, suc: 0, yards: 0 }, middle: { plays: 0, suc: 0, yards: 0 }, right: { plays: 0, suc: 0, yards: 0 } };
    for (const p of enriched) {
      if (p.play_type !== "run" || !p.direction) continue;
      dMap[p.direction].plays++;
      if (["success", "td"].includes(p.result)) dMap[p.direction].suc++;
      dMap[p.direction].yards += Number(p.yards_gained ?? 0);
    }
    const direction = ["left", "middle", "right"].map(d => {
      const v = dMap[d];
      return {
        direction:   d,
        plays:       v.plays,
        successRate: v.plays > 0 ? Math.round(v.suc / v.plays * 100) : 0,
        avgYards:    v.plays > 0 ? +(v.yards / v.plays).toFixed(1)   : 0,
      };
    });

    // ── Pressure ─────────────────────────────────────────────────────────────
    const passPlays     = enriched.filter(p => p.play_type === "pass");
    const pressureCount = passPlays.filter(p => p.pressure).length;
    const pressureRate  = passPlays.length > 0 ? Math.round(pressureCount / passPlays.length * 100) : 0;

    // ── Hash tendency ─────────────────────────────────────────────────────────
    const HASH_ORDER = ["left_wide","left_hash","middle","right_hash","right_wide"];
    const hashMap = {};
    for (const p of enriched) {
      if (!p.hash) continue;
      if (!hashMap[p.hash]) hashMap[p.hash] = { plays: 0, suc: 0, run: 0, pass: 0 };
      hashMap[p.hash].plays++;
      if (["success","td"].includes(p.result)) hashMap[p.hash].suc++;
      if (p.play_type === "run")  hashMap[p.hash].run++;
      if (p.play_type === "pass") hashMap[p.hash].pass++;
    }
    const hashTendency = HASH_ORDER
      .filter(h => hashMap[h])
      .map(h => ({ hash: h, ...hashMap[h], successRate: Math.round(hashMap[h].suc / hashMap[h].plays * 100) }));

    // ── Field zone analysis (from coach-tagged yard_line) ─────────────────────
    const ZONES = [
      { key:"own_end_zone", label:"Own 1-19",   min:1,  max:19  },
      { key:"own_20",       label:"Own 20-39",  min:20, max:39  },
      { key:"midfield",     label:"Midfield",   min:40, max:59  },
      { key:"opp_40",       label:"Opp 40-20",  min:60, max:79  },
      { key:"red_zone",     label:"Red Zone",   min:80, max:99  },
    ];
    const zoneStats = ZONES.map(z => {
      const zPlays = enriched.filter(p => p.yard_line >= z.min && p.yard_line <= z.max);
      const suc    = zPlays.filter(p => ["success","td"].includes(p.result)).length;
      const run    = zPlays.filter(p => p.play_type === "run").length;
      const pass   = zPlays.filter(p => p.play_type === "pass").length;
      const avgYd  = zPlays.filter(p => p.yards_gained != null);
      return {
        ...z,
        plays:       zPlays.length,
        successRate: zPlays.length > 0 ? Math.round(suc / zPlays.length * 100) : 0,
        avgYards:    avgYd.length > 0 ? +(avgYd.reduce((s,p) => s + Number(p.yards_gained), 0) / avgYd.length).toFixed(1) : null,
        runPct:      zPlays.length > 0 ? Math.round(run / zPlays.length * 100) : null,
        passPct:     zPlays.length > 0 ? Math.round(pass / zPlays.length * 100) : null,
      };
    }).filter(z => z.plays > 0);

    // ── Drives ───────────────────────────────────────────────────────────────
    const drives = reconstructDrives(enriched);

    // ── Opponent ─────────────────────────────────────────────────────────────
    const awayPlays       = enriched.filter(p => p._awayN > 0);
    const opponentTendency = awayPlays.length > 0 ? {
      avgDefenders: +(awayPlays.reduce((s, p) => s + p._awayN, 0) / awayPlays.length).toFixed(1),
      playsWithData: awayPlays.length,
    } : null;

    return res.status(200).json({
      ok: true,
      totalPlays: total,
      epa,
      tempo,
      motionRate,
      motionCount,
      personnel,
      direction,
      pressureRate,
      pressureCount,
      passPlays: passPlays.length,
      drives,
      opponentTendency,
      hashTendency,
      zoneStats,
    });

  } catch (err) {
    console.error("[film/analytics]", err);
    return res.status(500).json({ error: err?.message ?? "Server error" });
  }
}
