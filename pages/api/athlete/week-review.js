// pages/api/athlete/week-review.js
// GET ?start=YYYY-MM-DD&end=YYYY-MM-DD — the athlete's week, with the previous week for comparison.
// Built entirely from existing tables (set_logs, athlete_food_logs, athlete_readiness) — no new storage.
// Response: {
//   ok, week: { start, end },
//   training:  { sessions, sets, volume, prs, best: { exercise, weight, reps } | null,
//                prev: { sessions, sets, volume, prs } },
//   nutrition: { daysLogged, avgProtein, avgCalories, prev: { daysLogged, avgProtein } },
//   readiness: { checkIns, avgScore } | null      (null if the readiness table isn't set up)
// }

import { requireAthlete }      from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));

function shift(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

function trainingSummary(rows) {
  const dates = new Set();
  let sets = 0, volume = 0, prs = 0, best = null;
  for (const r of rows) {
    const reps = Number(r.actual_reps) || 0;
    const w    = Number(r.actual_weight) || 0;
    if (!reps && !w) continue;
    sets++;
    if (r.date) dates.add(r.date);
    if (w > 0 && reps > 0) volume += w * reps;
    if (r.is_pr) prs++;
    // Best set: a PR beats a non-PR; then heaviest weight; then most reps.
    const better = !best
      || (!!r.is_pr && !best.pr)
      || (!!r.is_pr === best.pr && (w > best.weight || (w === best.weight && reps > best.reps)));
    if (w > 0 && better) best = { exercise: r.exercise_title || "Lift", weight: w, reps, pr: !!r.is_pr };
  }
  return { sessions: dates.size, sets, volume: Math.round(volume), prs, best };
}

function nutritionSummary(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const d = byDay.get(r.log_date) || { pro: 0, cal: 0 };
    d.pro += Number(r.protein_g) || 0;
    d.cal += Number(r.calories)  || 0;
    byDay.set(r.log_date, d);
  }
  const days = [...byDay.values()];
  const n = days.length;
  return {
    daysLogged:  n,
    avgProtein:  n ? Math.round(days.reduce((s, d) => s + d.pro, 0) / n) : 0,
    avgCalories: n ? Math.round(days.reduce((s, d) => s + d.cal, 0) / n) : 0,
  };
}

async function setLogs(athleteToken, from, to) {
  const base = col => db.from("set_logs").select(col)
    .eq("athlete_token", athleteToken).gte("date", from).lte("date", to).limit(5000);
  let { data, error } = await base("date, exercise_title, actual_reps, actual_weight, is_pr");
  if (error && /is_pr/.test(error.message || "")) ({ data, error } = await base("date, exercise_title, actual_reps, actual_weight"));
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const start = String(req.query.start || ""), end = String(req.query.end || "");
  if (!isDate(start) || !isDate(end) || start > end) return res.status(400).json({ error: "start and end required (YYYY-MM-DD)" });
  const prevStart = shift(start, -7), prevEnd = shift(start, -1);

  try {
    const [cur, prev, food, readiness] = await Promise.all([
      setLogs(athleteToken, start, end),
      setLogs(athleteToken, prevStart, prevEnd),
      db.from("athlete_food_logs").select("log_date, protein_g, calories")
        .eq("athlete_token", athleteToken).gte("log_date", prevStart).lte("log_date", end).limit(5000),
      db.from("athlete_readiness").select("log_date, score")
        .eq("athlete_token", athleteToken).gte("log_date", start).lte("log_date", end),
    ]);

    const foodRows = food.error ? [] : (food.data ?? []);
    const nCur  = nutritionSummary(foodRows.filter(r => r.log_date >= start));
    const nPrev = nutritionSummary(foodRows.filter(r => r.log_date < start));

    const t = trainingSummary(cur);
    const tp = trainingSummary(prev);

    const rRows = readiness.error ? null : (readiness.data ?? []);

    return res.status(200).json({
      ok: true,
      week: { start, end },
      training: { ...t, best: t.best ? { exercise: t.best.exercise, weight: t.best.weight, reps: t.best.reps, pr: t.best.pr } : null,
                  prev: { sessions: tp.sessions, sets: tp.sets, volume: tp.volume, prs: tp.prs } },
      nutrition: { ...nCur, prev: { daysLogged: nPrev.daysLogged, avgProtein: nPrev.avgProtein } },
      readiness: rRows == null ? null : {
        checkIns: rRows.length,
        avgScore: rRows.length ? Math.round(rRows.reduce((s, r) => s + (Number(r.score) || 0), 0) / rRows.length) : null,
      },
    });
  } catch (err) {
    console.error("[athlete/week-review]", err);
    return res.status(500).json({ error: "Failed", details: err?.message });
  }
}
