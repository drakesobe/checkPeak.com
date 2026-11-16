// lib/challenges.js
// Team challenge metrics + standings, computed from data athletes already generate.
//   checkins      days with a readiness check-in          (athlete_readiness)
//   workout_days  days with at least one logged set        (set_logs)
//   food_days     days with at least one food logged       (athlete_food_logs)
//   prs           PR sets logged                           (set_logs.is_pr)
//   volume        pounds lifted (weight × reps)            (set_logs)

import { supabaseAdmin as db } from "@/lib/supabase";

export const METRICS = {
  checkins:     { label: "Morning check-ins", unit: "days",    short: "check-ins" },
  workout_days: { label: "Training days",     unit: "days",    short: "training days" },
  food_days:    { label: "Days fueled",       unit: "days",    short: "days logged" },
  prs:          { label: "PRs",               unit: "PRs",     short: "PRs" },
  volume:       { label: "Volume",            unit: "lb",      short: "lb lifted" },
};

export const isMetric = m => Object.prototype.hasOwnProperty.call(METRICS, m);

/** token → value for one metric over [start, end] (inclusive dates). */
export async function metricValues(metric, tokens, start, end) {
  const out = new Map(tokens.map(t => [t, 0]));
  if (!tokens.length) return out;

  if (metric === "checkins") {
    const { data } = await db.from("athlete_readiness").select("athlete_token, log_date")
      .in("athlete_token", tokens).gte("log_date", start).lte("log_date", end);
    for (const r of data ?? []) out.set(r.athlete_token, (out.get(r.athlete_token) || 0) + 1);
    return out;
  }

  if (metric === "food_days") {
    const { data } = await db.from("athlete_food_logs").select("athlete_token, log_date")
      .in("athlete_token", tokens).gte("log_date", start).lte("log_date", end).limit(20000);
    const days = new Map();
    for (const r of data ?? []) {
      if (!days.has(r.athlete_token)) days.set(r.athlete_token, new Set());
      days.get(r.athlete_token).add(r.log_date);
    }
    for (const [t, s] of days) out.set(t, s.size);
    return out;
  }

  // set_logs-based metrics
  const cols = metric === "prs" ? "athlete_token, is_pr" : "athlete_token, date, actual_reps, actual_weight";
  const { data } = await db.from("set_logs").select(cols)
    .in("athlete_token", tokens).gte("date", start).lte("date", end).limit(50000);

  if (metric === "prs") {
    for (const r of data ?? []) if (r.is_pr) out.set(r.athlete_token, (out.get(r.athlete_token) || 0) + 1);
    return out;
  }
  if (metric === "workout_days") {
    const days = new Map();
    for (const r of data ?? []) {
      if (!(Number(r.actual_reps) || Number(r.actual_weight))) continue;
      if (!days.has(r.athlete_token)) days.set(r.athlete_token, new Set());
      days.get(r.athlete_token).add(r.date);
    }
    for (const [t, s] of days) out.set(t, s.size);
    return out;
  }
  if (metric === "volume") {
    for (const r of data ?? []) {
      const v = (Number(r.actual_weight) || 0) * (Number(r.actual_reps) || 0);
      if (v > 0) out.set(r.athlete_token, (out.get(r.athlete_token) || 0) + v);
    }
    for (const [t, v] of out) out.set(t, Math.round(v));
    return out;
  }
  return out;
}

export function challengeStatus(c, today) {
  if (today < c.start_date) return "upcoming";
  if (today > c.end_date)   return "ended";
  return "active";
}

/**
 * Full standings for a challenge.
 * @returns {{ standings: [{ athleteToken, name, value, rank, done }], participants, completed, teamTotal }}
 */
export async function buildStandings(challenge, roster /* [{ athlete_token, name }] */) {
  const tokens = roster.map(a => a.athlete_token);
  const names  = Object.fromEntries(roster.map(a => [a.athlete_token, a.name || "Athlete"]));
  const values = await metricValues(challenge.metric, tokens, challenge.start_date, challenge.end_date);

  const rows = [...values.entries()]
    .map(([t, v]) => ({ athleteToken: t, name: names[t], value: v }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  let prev = null, prevRank = 0;
  rows.forEach((r, i) => {
    if (r.value !== prev) { prevRank = i + 1; prev = r.value; }
    r.rank = r.value > 0 ? prevRank : null;          // no rank until you've done something
    r.done = !!challenge.goal && r.value >= challenge.goal;
  });

  return {
    standings:    rows,
    participants: rows.filter(r => r.value > 0).length,
    completed:    rows.filter(r => r.done).length,
    teamTotal:    rows.reduce((s, r) => s + r.value, 0),
  };
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
