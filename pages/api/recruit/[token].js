// pages/api/recruit/[token].js
// Public endpoint — no auth required.
// Returns everything needed to render a recruiter-facing athlete profile.

import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }
function max(arr) { return arr.length ? arr.reduce((m, v) => (v > m ? v : m), -Infinity) : null; }
function round1(n) { return n != null ? Math.round(n * 10) / 10 : null; }
function round2(n) { return n != null ? Math.round(n * 100) / 100 : null; }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).json({ error: "Missing token" });

  // 1. Profile
  const { data: profile, error: pErr } = await db
    .from("athlete_profiles")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (pErr || !profile) return res.status(404).json({ error: "Profile not found" });

  // 2. Athlete name + email
  const { data: athlete } = await db
    .from("athletes")
    .select("name, email, sport")
    .eq("athlete_token", profile.athlete_token)
    .maybeSingle();

  // 3. Strength PRs (last 365 days)
  const since365 = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const { data: logs } = await db
    .from("set_logs")
    .select("exercise_title, actual_weight, actual_reps, target_weight, video_url")
    .eq("athlete_token", profile.athlete_token)
    .gt("actual_weight", 0)
    .gt("actual_reps", 0)
    .gt("timestamp", since365)
    .order("actual_weight", { ascending: false })
    .limit(1000);

  const prMap = {};
  for (const log of (logs ?? [])) {
    const title = (log.exercise_title || "").trim();
    if (!title) continue;
    const w = Number(log.actual_weight) || 0;
    const r = Number(log.actual_reps)   || 0;
    if (w <= 0) continue;
    const unitRaw = String(log.target_weight || "");
    const unit    = /kg/i.test(unitRaw) ? "kg" : "lb";
    if (!prMap[title] || w > prMap[title].maxWeight) {
      prMap[title] = { exercise: title, maxWeight: w, unit, maxReps: r, videoUrl: log.video_url || null };
    }
  }

  const strengthPRs = Object.values(prMap)
    .sort((a, b) => b.maxWeight - a.maxWeight)
    .slice(0, 8);

  // 4. Training heatmap (84 days) + 30-day session count
  const since84 = Date.now() - 84 * 24 * 60 * 60 * 1000;
  const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const { data: trainingLogs } = await db
    .from("set_logs")
    .select("date, timestamp")
    .eq("athlete_token", profile.athlete_token)
    .gt("timestamp", since84);

  const heatmapDates  = [...new Set((trainingLogs ?? []).map(l => l.date).filter(Boolean))];
  const distinctDates30d = new Set(
    (trainingLogs ?? []).filter(l => l.timestamp > since30).map(l => l.date).filter(Boolean)
  ).size;

  // Oldest log ever
  const { data: oldestLog } = await db
    .from("set_logs")
    .select("date")
    .eq("athlete_token", profile.athlete_token)
    .order("timestamp", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 5. Athletic tracking stats (from player_tracks via roster jersey match)
  let athleticStats = null;
  if (athlete?.name) {
    const orgResult = await db
      .from("athletes")
      .select("org_id")
      .eq("athlete_token", profile.athlete_token)
      .maybeSingle();
    const orgId = orgResult.data?.org_id;

    if (orgId) {
      const { data: rosterRows } = await db
        .from("roster")
        .select("jersey_number")
        .eq("org_id", orgId)
        .ilike("player_name", athlete.name);

      const jerseys = (rosterRows ?? []).map(r => r.jersey_number).filter(n => n != null);

      if (jerseys.length) {
        const { data: tracks } = await db
          .from("player_tracks")
          .select("max_speed_mph, avg_speed_mph, accel_peak_ms2, distance_traveled_yd, game_plays!inner(game_films!inner(id))")
          .eq("org_id", orgId)
          .in("jersey_number", jerseys)
          .not("max_speed_mph", "is", null)
          .limit(500);

        if (tracks?.length) {
          const speeds     = tracks.map(t => t.avg_speed_mph).filter(v => v != null);
          const peakSpeeds = tracks.map(t => t.max_speed_mph).filter(v => v != null);
          const accels     = tracks.map(t => t.accel_peak_ms2).filter(v => v != null);
          const filmIds    = new Set(tracks.map(t => t.game_plays?.game_films?.id).filter(Boolean));
          athleticStats = {
            peakSpeed: round1(max(peakSpeeds)),
            avgSpeed:  round1(avg(speeds)),
            avgAccel:  round2(avg(accels)),
            playCount: tracks.length,
            filmCount: filmIds.size,
          };
        }
      }
    }
  }

  // 6. Public reel
  const { data: reel } = await db
    .from("athlete_reels")
    .select("share_token, title, play_ids")
    .eq("athlete_id", profile.athlete_token)
    .eq("is_public", true)
    .maybeSingle();

  // 7. Log view (fire-and-forget: both view_count and profile_views table)
  const newViewCount = (profile.view_count || 0) + 1;
  Promise.all([
    db.from("athlete_profiles")
      .update({ view_count: newViewCount })
      .eq("share_token", token),
    db.from("profile_views")
      .insert({ share_token: token }),
  ]).catch(() => {});

  return res.status(200).json({
    ok: true,
    profile: {
      sport:           profile.sport           || athlete?.sport || null,
      position:        profile.position        || null,
      graduation_year: profile.graduation_year || null,
      school:          profile.school          || null,
      height:          profile.height          || null,
      weight:          profile.weight          || null,
      gpa:             profile.gpa             || null,
      bio:             profile.bio             || null,
      achievements:    profile.achievements    || [],
      avatar_url:      profile.avatar_url      || null,
      hudl_url:        profile.hudl_url        || null,
      view_count:      newViewCount,
    },
    athlete: {
      name:  athlete?.name  || "Athlete",
      email: profile.show_contact ? (athlete?.email || null) : null,
    },
    strengthPRs,
    athleticStats,
    reel:          reel ? { shareToken: reel.share_token, title: reel.title, playCount: reel.play_ids?.length ?? 0 } : null,
    heatmapDates,
    trainingStats: {
      sessions30d:    distinctDates30d,
      totalExercises: Object.keys(prMap).length,
      trainingSince:  oldestLog?.date || null,
    },
  });
}
