// pages/api/parent/[token].js
// Public read-only endpoint for the Parent Portal.
// Access is gated by the athlete's share_token — no separate auth needed.
// VARA-safe: never exposes whether workouts were assigned during off-season.
// Only shows completion rate, streak, PRs, and public profile data.

import { supabaseAdmin as db } from "@/lib/supabase";
import { getMetricKey, getBenchmarkSentence } from "@/lib/benchmarks";

// ── helpers ────────────────────────────────────────────────────────────────────

function calcStreak(rows) {
  const doneSet = new Set(
    rows
      .filter(r => r.status === "completed" || r.status === "approved")
      .map(r => r.date)
  );
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const yestISO = yest.toISOString().split("T")[0];

  // Streak is still alive if today hasn't been logged yet but yesterday was
  const startOffset = doneSet.has(todayISO) ? 0 : doneSet.has(yestISO) ? 1 : null;
  if (startOffset === null) return { count: 0, startDate: null };

  let count = 0;
  for (let i = startOffset; i < 366; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    if (doneSet.has(iso)) count++;
    else break;
  }

  const startD = new Date(today);
  startD.setDate(today.getDate() - startOffset - count + 1);
  return { count, startDate: startD.toISOString().split("T")[0] };
}

function calcWeek(rows) {
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];
  const dow = today.getDay(); // 0 = Sun
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const doneSet = new Set(
    rows
      .filter(r => r.status === "completed" || r.status === "approved")
      .map(r => r.date)
  );

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    return {
      iso,
      done:     doneSet.has(iso),
      isFuture: iso > todayISO,
      isToday:  iso === todayISO,
    };
  });

  return { days, done: days.filter(d => d.done).length };
}

// ── handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  const { token } = req.query;
  if (!token || typeof token !== "string" || token.length < 6) {
    return res.status(400).json({ error: "Invalid access code" });
  }

  // ── 1. athlete profile ──────────────────────────────────────────────────────
  const { data: profile, error: profileErr } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (profileErr) return res.status(500).json({ error: "DB error" });
  if (!profile)   return res.status(404).json({ error: "Profile not found or not public" });

  const athleteToken = profile.athlete_token;

  // ── 2. athlete base record ──────────────────────────────────────────────────
  const { data: athleteRow } = await db
    .from("athletes")
    .select("name, email, school")
    .eq("athlete_token", athleteToken)
    .maybeSingle();

  const athleteName = athleteRow?.name || athleteRow?.Name || "Athlete";

  // ── 3. workout completions — 60 days ───────────────────────────────────────
  const since60 = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];
  const { data: completions } = await db
    .from("workout_completions")
    .select("date, status")
    .eq("athlete_token", athleteToken)
    .gte("date", since60)
    .order("date", { ascending: false });

  const completionRows = completions || [];

  // 30-day completion rate
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const last30       = completionRows.filter(r => r.date >= since30);
  const completed30  = last30.filter(r => r.status === "completed" || r.status === "approved").length;
  const total30      = last30.length;
  const completionRate = total30 > 0 ? Math.round((completed30 / total30) * 100) : null;

  // Streak + this week
  const streak = calcStreak(completionRows);
  const week   = calcWeek(completionRows);

  // Activity heat — 60 days
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

  // ── 4. PRs with 30-day trend ───────────────────────────────────────────────
  const { data: setLogs } = await db
    .from("set_logs")
    .select("exercise_title, actual_weight, date, created_at")
    .eq("athlete_token", athleteToken)
    .gt("actual_weight", 0);

  const prMap    = {}; // title -> { weight, date }
  const prOldMap = {}; // title -> max weight from before 30d

  for (const row of setLogs || []) {
    const title   = row.exercise_title || "";
    const w       = Number(row.actual_weight) || 0;
    const rowDate = row.date || (row.created_at ? String(row.created_at).split("T")[0] : null);

    if (w > (prMap[title]?.weight || 0)) {
      prMap[title] = { weight: w, date: rowDate };
    }
    if (rowDate && rowDate < since30 && w > (prOldMap[title] || 0)) {
      prOldMap[title] = w;
    }
  }

  const prs = Object.entries(prMap)
    .filter(([, v]) => v.weight > 0)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .slice(0, 8)
    .map(([title, { weight, date }]) => {
      const prev  = prOldMap[title] ?? null;
      const delta = prev !== null ? weight - prev : null;
      const k     = getMetricKey(title);
      return {
        title,
        prWeight: weight,
        prDate:   date,
        delta,
        benchmark: k ? getBenchmarkSentence(k, weight) : null,
      };
    });

  // ── 5. Highlights (public reel + Hudl link) ───────────────────────────────
  const { data: reel } = await db
    .from("athlete_reels")
    .select("share_token, title, play_ids")
    .eq("athlete_id", athleteToken)
    .eq("is_public", true)
    .maybeSingle();

  // ── 6. Response ────────────────────────────────────────────────────────────
  return res.status(200).json({
    athlete: {
      name:          athleteName,
      avatarUrl:     profile.avatar_url       || null,
      sport:         profile.sport            || null,
      position:      profile.position         || null,
      gradYear:      profile.graduation_year  || null,
      school:        profile.school || athleteRow?.school || null,
      bio:           profile.bio              || null,
      achievements:  Array.isArray(profile.achievements) ? profile.achievements : [],
      parentMessage: profile.parent_message   || null,
    },
    stats: {
      completionRate,
      totalWorkouts:     total30,
      completedWorkouts: completed30,
    },
    streak,
    week,
    prs,
    recentActivity,
    reel: reel
      ? { shareToken: reel.share_token, title: reel.title, playCount: reel.play_ids?.length ?? 0 }
      : null,
    hudlUrl: profile.hudl_url || null,
  });
}
