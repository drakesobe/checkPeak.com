// pages/api/athlete/workouts/today.js
// GET - returns today's daily workout(s) for the authenticated athlete.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function nyDateISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function normalizeEvidenceRequired(raw) {
  if (raw === true || raw === "true") return "photo";
  if (!raw || raw === false || raw === "false") return "none";
  const s = String(raw).trim().toLowerCase();
  const known = ["none", "photo", "video", "photo_or_video", "voluntary_activity_vara"];
  return known.includes(s) ? s : "none";
}

function buildWorkoutResponse(dw, athleteToken) {
  const items = [...(dw.workout_items ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item, idx) => {
      const c = (item.workout_completions ?? [])[0] ?? {};
      const status = String(c.status || "").toLowerCase();
      const doneForAthlete = status === "completed" || status === "pending_review";

      return {
        id:               item.id,
        missing:          false,
        ExerciseName:     item.exercise_name || `Workout Item ${idx + 1}`,
        EvidenceRequired: normalizeEvidenceRequired(item.evidence_required),
        Sets:             item.sets  ?? "",
        Reps:             item.reps  || "",
        Weight:           item.weight || "",
        RPE:              item.rpe   || "",
        Rest:             item.rest  || "",
        Instructions:     item.instructions || "",
        VideoURL:         item.video_url    || "",
        groupId:          item.group_id     || null,
        Completed:        doneForAthlete ? "true" : "false",
        Status:           status,
        CompletedAt:      c.completed_at  || "",
        CompletionId:     c.id            || "",
        Note:             c.review_note   || "",
        AttachmentSummary: c.review_note  || "",
        AttachmentUrl:    c.attachment_url || "",
        ReviewNote:       c.review_note   || "",
        AthleteAcknowledged:   Boolean(c.athlete_acknowledged),
        AthleteAcknowledgedAt: c.athlete_acknowledged_at || "",
      };
    });

  return {
    dailyWorkout: {
      id:                dw.id,
      Title:             dw.title             || "Daily Workout",
      Date:              dw.date,
      Status:            dw.status            || "assigned",
      AthleteToken:      dw.athlete_token     || athleteToken,
      ReviewStatus:      dw.review_status     || "pending",
      ReviewedNotes:     dw.reviewed_notes    || "",
      ScheduledTime:     dw.scheduled_time    || null,
      ScheduledDuration: dw.scheduled_duration ? Number(dw.scheduled_duration) : null,
    },
    items,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const today        = nyDateISO();
  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();

  if (!athleteToken) {
    return res.status(400).json({
      error: "Missing AthleteToken (ATH-XXXX) in session. Log out and back in.",
      debug: { cookieKeys: Object.keys(auth.user || {}) },
    });
  }

  try {
    const { data: rows, error } = await db
      .from("daily_workouts")
      .select(`
        id, date, title, status, athlete_token, org_token,
        review_status, reviewed_notes, scheduled_time, scheduled_duration,
        workout_items (
          id, exercise_name, sets, reps, weight, rpe, rest,
          instructions, video_url, evidence_required, sort_order, group_id,
          workout_completions (
            id, status, attachment_url, review_note,
            athlete_acknowledged, athlete_acknowledged_at, completed_at
          )
        )
      `)
      .eq("athlete_token", athleteToken)
      .eq("date", today)
      .order("id");

    if (error) {
      console.error("[athlete/workouts/today] supabase:", error);
      return res.status(500).json({ error: "Failed to load workout." });
    }

    if (!rows?.length) {
      return res.status(200).json({
        dailyWorkout: null,
        items: [],
        debug: { reason: "No workouts found for today", today, athleteToken },
      });
    }

    // Build all workouts
    const allWorkouts = (rows || []).map(dw => buildWorkoutResponse(dw, athleteToken));

    // Sort by scheduled time (nulls last)
    allWorkouts.sort((a, b) => {
      const ta = a.dailyWorkout.ScheduledTime || "99:99";
      const tb = b.dailyWorkout.ScheduledTime || "99:99";
      return ta.localeCompare(tb);
    });

    return res.status(200).json({
      // backward-compat single-workout fields
      dailyWorkout: allWorkouts[0]?.dailyWorkout || null,
      items:        allWorkouts[0]?.items        || [],
      // all workouts for the day
      dailyWorkouts: allWorkouts,
    });
  } catch (err) {
    console.error("[athlete/workouts/today]", err);
    return res.status(500).json({ error: "Failed to load workout.", details: err?.message });
  }
}
