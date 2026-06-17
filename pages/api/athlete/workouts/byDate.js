// pages/api/athlete/workouts/byDate.js
// GET ?date=YYYY-MM-DD - returns all daily workouts for the athlete on a specific date.

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

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
      const completionStatus = String(c.status || "").toLowerCase();
      const itemStatus       = String(item.status || "").toLowerCase();
      const status           = completionStatus || itemStatus || "";
      const doneForAthlete   = status === "completed" || status === "pending_review" ||
                               (status === "rejected" && Boolean(c.athlete_acknowledged));

      const attachmentSummary = c.review_note || "";

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
        Completed:              doneForAthlete ? "true" : "false",
        Status:                 status,
        CompletionStatus:       completionStatus,
        ItemStatus:             itemStatus,
        CompletedAt:            c.completed_at  || "",
        CompletionId:           c.id            || "",
        Note:                   attachmentSummary,
        AttachmentSummary:      attachmentSummary,
        AttachmentUrl:          c.attachment_url || "",
        ReviewNote:             c.review_note    || "",
        AthleteAcknowledged:    Boolean(c.athlete_acknowledged),
        AthleteAcknowledgedAt:  c.athlete_acknowledged_at || "",
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

function okNull(res, payload = {}) {
  return res.status(200).json({ dailyWorkout: null, items: [], dailyWorkouts: [], ...payload });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return okNull(res, { error: auth.error || "Unauthorized", stopRetry: true });

  const isoDate      = String(req.query?.date || "").trim().slice(0, 10);
  const athleteToken = String(auth.athlete?.AthleteToken || "").trim();

  if (!isoDate) return res.status(400).json({ error: "Missing date (YYYY-MM-DD)." });

  if (!athleteToken) {
    return okNull(res, {
      error: "Missing AthleteToken (ATH-XXXX) in session.",
      stopRetry: true,
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
          instructions, video_url, evidence_required, sort_order, group_id, status,
          workout_completions (
            id, status, attachment_url, review_note,
            athlete_acknowledged, athlete_acknowledged_at, completed_at
          )
        )
      `)
      .eq("athlete_token", athleteToken)
      .eq("date", isoDate)
      .order("id");

    if (error) {
      console.error("[athlete/workouts/byDate] supabase:", error);
      return res.status(500).json({ error: "Failed to load workout." });
    }

    if (!rows?.length) {
      return okNull(res, { debug: { reason: "No workouts found", isoDate, athleteToken } });
    }

    const allWorkouts = (rows || []).map(dw => buildWorkoutResponse(dw, athleteToken));

    allWorkouts.sort((a, b) => {
      const ta = a.dailyWorkout.ScheduledTime || "99:99";
      const tb = b.dailyWorkout.ScheduledTime || "99:99";
      return ta.localeCompare(tb);
    });

    return res.status(200).json({
      dailyWorkout:  allWorkouts[0]?.dailyWorkout || null,
      items:         allWorkouts[0]?.items        || [],
      dailyWorkouts: allWorkouts,
    });
  } catch (err) {
    console.error("[athlete/workouts/byDate]", err);
    return res.status(500).json({ error: "Failed to load workout.", details: err?.message });
  }
}
