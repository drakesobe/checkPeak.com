// pages/api/parent/[token].js
// Public read-only endpoint for the Parent Portal.
// Access is gated by the athlete's share_token — no separate auth needed.
// VARA-safe: never exposes whether workouts were assigned during off-season.
// Only shows completion rate, PRs, and public profile data.

import { supabaseAdmin as db } from "@/lib/supabase";
import { getMetricKey, getBenchmarkSentence } from "@/lib/benchmarks";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  const { token } = req.query;
  if (!token || typeof token !== "string" || token.length < 6) {
    return res.status(400).json({ error: "Invalid access code" });
  }

  // ── 1. Load athlete profile by share_token ─────────────────────────────────
  const { data: profile, error: profileErr } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (profileErr) return res.status(500).json({ error: "DB error" });
  if (!profile)   return res.status(404).json({ error: "Profile not found or not public" });

  const athleteToken = profile.athlete_token;

  // ── 2. Load athlete base record (name, school) ────────────────────────────
  const { data: athleteRow } = await db
    .from("athletes")
    .select("name, email, school")
    .eq("athlete_token", athleteToken)
    .maybeSingle();

  const athleteName = athleteRow?.name || athleteRow?.Name || "Athlete";

  // ── 3. Workout completions — last 60 days (completion rate + activity heat) ─
  const since60 = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];
  const { data: completions } = await db
    .from("workout_completions")
    .select("date, status")
    .eq("athlete_token", athleteToken)
    .gte("date", since60)
    .order("date", { ascending: false });

  const completionRows = completions || [];

  // Completion rate over last 30 days
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const last30  = completionRows.filter(r => r.date >= since30);
  const completed30 = last30.filter(r => r.status === "completed" || r.status === "approved").length;
  const total30     = last30.length;
  const completionRate = total30 > 0 ? Math.round((completed30 / total30) * 100) : null;

  // Recent activity heat (last 60 days — date + whether completed)
  const activityMap = {};
  for (const r of completionRows) {
    if (!activityMap[r.date]) {
      activityMap[r.date] = r.status === "completed" || r.status === "approved";
    }
  }
  const recentActivity = Object.entries(activityMap)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 60)
    .map(([date, done]) => ({ date, done }));

  // ── 4. PRs from set_logs ──────────────────────────────────────────────────
  const { data: setLogs } = await db
    .from("set_logs")
    .select("exercise_title, actual_weight")
    .eq("athlete_token", athleteToken)
    .gt("actual_weight", 0);

  const prMap = {};
  for (const row of setLogs || []) {
    const title = row.exercise_title || "";
    const w     = Number(row.actual_weight) || 0;
    if (w > (prMap[title] || 0)) prMap[title] = w;
  }

  const prs = Object.entries(prMap)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([title, prWeight]) => ({
      title,
      prWeight,
      benchmark: (() => { const k = getMetricKey(title); return k ? getBenchmarkSentence(k, prWeight) : null; })(),
    }));

  // ── 5. Response ────────────────────────────────────────────────────────────
  return res.status(200).json({
    athlete: {
      name:       athleteName,
      sport:      profile.sport        || null,
      position:   profile.position     || null,
      gradYear:   profile.graduation_year || null,
      school:     profile.school || athleteRow?.school || null,
      bio:        profile.bio          || null,
      achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
    },
    stats: {
      completionRate,
      totalWorkouts: total30,
      completedWorkouts: completed30,
    },
    prs,
    recentActivity,
  });
}
