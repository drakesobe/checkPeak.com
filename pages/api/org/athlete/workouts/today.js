// pages/api/org/athlete/workouts/today.js
// GET — returns today's daily workout + items for the authenticated athlete (org side).

import { requireAthleteUser } from "@/lib/requireUser";
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireAthleteUser(req, res);
  if (!user) return;

  const today        = nyDateISO();
  const athleteToken = String(user.AthleteToken || user.athleteToken || "").trim();
  const email        = String(user.email || "").toLowerCase();

  try {
    let query = db
      .from("daily_workouts")
      .select(`
        id, date, title, status, athlete_token, org_token,
        workout_items (
          id, exercise_name, sets, reps, weight, rpe, rest,
          instructions, video_url, evidence_required, sort_order, group_id,
          workout_completions ( id, status, attachment_url, review_note, athlete_acknowledged, athlete_acknowledged_at )
        )
      `)
      .eq("date", today);

    if (athleteToken) {
      query = query.eq("athlete_token", athleteToken);
    } else {
      // Fallback: lookup athlete by email to get token
      const { data: athlete } = await db
        .from("athletes").select("athlete_token").eq("email", email).maybeSingle();
      if (!athlete) return res.status(200).json({ ok: true, dailyWorkout: null, items: [] });
      query = query.eq("athlete_token", athlete.athlete_token);
    }

    const { data: rows } = await query.order("id").limit(5);

    if (!rows?.length) return res.status(200).json({ ok: true, dailyWorkout: null, items: [] });

    const dw = rows[0];
    const items = [...(dw.workout_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(item => {
      const c = (item.workout_completions ?? [])[0] ?? {};
      return {
        id:               item.id,
        ExerciseName:     item.exercise_name     || "",
        Sets:             item.sets              ?? "",
        Reps:             item.reps              || "",
        Weight:           item.weight            || "",
        RPE:              item.rpe               || "",
        Rest:             item.rest              || "",
        Instructions:     item.instructions      || "",
        VideoURL:         item.video_url         || "",
        EvidenceRequired: item.evidence_required || "none",
        groupId:          item.group_id          || null,
        Status:           c.status || "",
        Completed:        ["completed", "pending_review"].includes(c.status) ? "true" : "false",
        CompletionId:     c.id     || "",
        CompletedAt:      c.completed_at || "",
        ReviewNote:       c.review_note || "",
        AttachmentUrl:    c.attachment_url || "",
        AthleteAcknowledged: Boolean(c.athlete_acknowledged),
        AthleteAcknowledgedAt: c.athlete_acknowledged_at || "",
      };
    });

    return res.status(200).json({
      ok: true,
      dailyWorkout: { id: dw.id, Title: dw.title, Date: dw.date, Status: dw.status, AthleteToken: dw.athlete_token },
      items,
      athlete: { email },
    });
  } catch (err) {
    console.error("[org/athlete/workouts/today]", err);
    return res.status(500).json({ error: "Failed to load today workout.", details: err?.message });
  }
}
