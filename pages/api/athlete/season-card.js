// pages/api/athlete/season-card.js
// GET ?season=YYYY — everything the shareable "season card" needs in one call.
// {
//   ok, name, sport, position, gradYear, school, avatarUrl,
//   profileUrl | null            (public recruiting page, only if the profile is public)
//   season,
//   ranks:   [{ label, rank, total, display, verified }]   top team-board placements (best 3)
//   lifts:   [{ exercise, weight, reps }]                   best 3 lifts by weight (last 365 days)
//   training: { sessions, prs }                              this season (calendar year)
// }

import { requireAthlete }      from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { buildBoards }         from "@/lib/teamBoards";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.checkpeak.com";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

async function setLogsSince(token, since) {
  const base = cols => db.from("set_logs").select(cols).eq("athlete_token", token).gte("date", since).limit(20000);
  let { data, error } = await base("date, exercise_title, actual_reps, actual_weight, is_pr");
  if (error && /is_pr/.test(error.message || "")) ({ data } = await base("date, exercise_title, actual_reps, actual_weight"));
  return data ?? [];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const me = getAthleteToken(auth);
  if (!me) return res.status(401).json({ error: "Missing AthleteToken" });

  const season = Number(req.query.season) || new Date().getFullYear();

  try {
    const [{ data: ath }, { data: profile }] = await Promise.all([
      db.from("athletes").select("name, sport, org_token").eq("athlete_token", me).maybeSingle(),
      db.from("athlete_profiles").select("*").eq("athlete_token", me).maybeSingle(),
    ]);
    const sport = String(profile?.sport || ath?.sport || "football").toLowerCase();

    // ── Team-board placements ────────────────────────────────────────────────
    let ranks = [];
    if (ath?.org_token) {
      const { data: roster } = await db.from("athletes").select("athlete_token, name").eq("org_token", ath.org_token);
      const tokens = (roster ?? []).map(r => r.athlete_token);
      const names  = Object.fromEntries((roster ?? []).map(r => [r.athlete_token, r.name]));
      if (tokens.length) {
        const { data: logs } = await db.from("athlete_game_logs")
          .select("athlete_token, stats, result, logged_by, role_key")
          .in("athlete_token", tokens).ilike("sport", sport).eq("season_year", season);
        const { boards } = buildBoards({ sport, logs: logs ?? [], tokenToName: names, myToken: me, limit: 1 });
        ranks = boards
          .filter(b => b.me)
          .sort((a, b) => a.me.rank - b.me.rank || b.total - a.total)
          .slice(0, 3)
          .map(b => ({ label: b.label, rank: b.me.rank, total: b.total, display: b.me.display, verified: b.me.verified }));
      }
    }

    // ── Lifts + training ─────────────────────────────────────────────────────
    const yearAgo   = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const seasonStart = `${season}-01-01`;
    const logs = await setLogsSince(me, yearAgo < seasonStart ? yearAgo : seasonStart);

    const bestByLift = new Map();
    for (const l of logs) {
      const w = Number(l.actual_weight) || 0, r = Number(l.actual_reps) || 0;
      if (w <= 0 || r <= 0 || l.date < yearAgo) continue;
      const k = String(l.exercise_title || "").trim();
      const prev = bestByLift.get(k);
      if (!prev || w > prev.weight || (w === prev.weight && r > prev.reps)) bestByLift.set(k, { exercise: k, weight: w, reps: r });
    }
    const lifts = [...bestByLift.values()].sort((a, b) => b.weight - a.weight).slice(0, 3);

    const seasonLogs = logs.filter(l => l.date >= seasonStart && l.date <= `${season}-12-31`);
    const training = {
      sessions: new Set(seasonLogs.filter(l => Number(l.actual_reps) || Number(l.actual_weight)).map(l => l.date)).size,
      prs:      seasonLogs.filter(l => l.is_pr).length,
    };

    return res.status(200).json({
      ok: true,
      name:      ath?.name || "Athlete",
      sport,
      position:  profile?.position || null,
      gradYear:  profile?.graduation_year || null,
      school:    profile?.school || null,
      avatarUrl: profile?.avatar_url || null,
      profileUrl: profile?.is_public && profile?.share_token ? `${SITE}/recruit/${profile.share_token}` : null,
      season, ranks, lifts, training,
    });
  } catch (err) {
    console.error("[athlete/season-card]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
