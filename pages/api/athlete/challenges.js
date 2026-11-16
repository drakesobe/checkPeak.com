// pages/api/athlete/challenges.js
// GET → the athlete's active (and just-ended, last 2 days) team challenges with their progress.
// { challenges: [{ id, title, metric, metricLabel, unit, goal, startDate, endDate, status, daysLeft,
//                  me: { value, rank, done }, participants, completed, rosterSize,
//                  leader: { name, value } | null, top: [{ name, value, rank, done, isMe }] }] }

import { requireAthlete }      from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { METRICS, buildStandings, challengeStatus, todayISO } from "@/lib/challenges";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

function shift(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const me = getAthleteToken(auth);
  if (!me) return res.status(401).json({ error: "Missing AthleteToken" });

  try {
    const { data: ath } = await db.from("athletes").select("org_token").eq("athlete_token", me).maybeSingle();
    if (!ath?.org_token) return res.status(200).json({ ok: true, challenges: [] });

    const today = todayISO();
    const [{ data: rows, error }, { data: roster }] = await Promise.all([
      db.from("team_challenges").select("*").eq("org_token", ath.org_token)
        .lte("start_date", today).gte("end_date", shift(today, -2))
        .order("end_date", { ascending: true }).limit(5),
      db.from("athletes").select("athlete_token, name").eq("org_token", ath.org_token),
    ]);
    if (error) return res.status(500).json({ error: error.message });

    const challenges = await Promise.all((rows ?? []).map(async c => {
      const s = await buildStandings(c, roster ?? []);
      const mine = s.standings.find(r => r.athleteToken === me) || { value: 0, rank: null, done: false };
      const leader = s.standings.find(r => r.value > 0) || null;
      const daysLeft = Math.max(0, Math.round((new Date(`${c.end_date}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000));
      return {
        id: c.id, title: c.title, metric: c.metric,
        metricLabel: METRICS[c.metric].label, unit: METRICS[c.metric].unit,
        goal: c.goal, startDate: c.start_date, endDate: c.end_date,
        status: challengeStatus(c, today), daysLeft,
        me: { value: mine.value, rank: mine.rank, done: mine.done },
        participants: s.participants, completed: s.completed, rosterSize: (roster ?? []).length,
        leader: leader ? { name: leader.name, value: leader.value } : null,
        top: s.standings.filter(r => r.value > 0).slice(0, 5)
          .map(r => ({ name: r.name, value: r.value, rank: r.rank, done: r.done, isMe: r.athleteToken === me })),
      };
    }));

    return res.status(200).json({ ok: true, challenges });
  } catch (err) {
    console.error("[athlete/challenges]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
