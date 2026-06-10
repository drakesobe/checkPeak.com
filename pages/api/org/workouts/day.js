// pages/api/org/workouts/day.js
// GET ?date=YYYY-MM-DD[&sport=x] — returns all workouts for the org on a date.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

function pad2(n) { return String(n).padStart(2, "0"); }
function toISODateLocal(d) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function normLower(v) { return String(v ?? "").trim().toLowerCase(); }
function timeStrToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  const date     = String(req.query?.date || toISODateLocal(new Date())).slice(0, 10);
  const sportQ   = normLower(req.query?.sport || "");

  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  try {
    const { data, error } = await db
      .from("daily_workouts")
      .select(`
        id, date, title, status, sport, athlete_id, athlete_token, org_token, scheduled_time, scheduled_duration,
        workout_items (
          id, exercise_name, sets, reps, weight, rpe, rest,
          instructions, video_url, evidence_required, sort_order, group_id,
          workout_completions ( id, status, review_note, athlete_id )
        )
      `)
      .eq("org_token", orgToken)
      .eq("date", date);

    if (error) throw error;

    let workouts = (data ?? []).map(dw => ({
      id:           dw.id,
      Title:        dw.title  || "Workout",
      Date:         dw.date   || date,
      Status:       dw.status || "assigned",
      Sport:            dw.sport  || "",
      athleteToken:     dw.athlete_token || "",
      ScheduledTime:    dw.scheduled_time    || null,
      ScheduledMinutes: timeStrToMinutes(dw.scheduled_time),
      ScheduledDuration: dw.scheduled_duration ? Number(dw.scheduled_duration) : null,
      items: [...(dw.workout_items ?? [])].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(item => {
        const completion = (item.workout_completions ?? [])[0] ?? null;
        return {
          id:               item.id,
          ExerciseName:     item.exercise_name     || "",
          Sets:             item.sets              ?? null,
          Reps:             item.reps              || "",
          Weight:           item.weight            || "",
          RPE:              item.rpe               || "",
          Rest:             item.rest              || "",
          Instructions:     item.instructions      || "",
          VideoURL:         item.video_url         || "",
          EvidenceRequired: item.evidence_required || "none",
          GroupId:          item.group_id          || null,
          Order:            item.sort_order        ?? 0,
          Status:           completion?.status     || "",
        };
      }),
    }));

    if (sportQ) workouts = workouts.filter(w => normLower(w.Sport) === sportQ);

    const availableSports = [...new Set(workouts.map(w => normLower(w.Sport)).filter(Boolean))].sort();

    return res.status(200).json({ workouts, availableSports, date });
  } catch (err) {
    console.error("[org/workouts/day]", err);
    return res.status(500).json({ error: "Failed to load workouts.", details: err?.message });
  }
}
