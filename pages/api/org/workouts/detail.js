// pages/api/org/workouts/detail.js
// GET ?id=<uuid> — full workout detail + sibling workouts.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  const rawId    = String(req.query?.id || "").trim();

  if (!rawId) return res.status(400).json({ error: "id is required" });

  // Legacy at: IDs are no longer supported
  if (rawId.startsWith("at:")) {
    return res.status(404).json({ error: "Legacy Airtable workout IDs are no longer supported." });
  }

  try {
    const { data: dw } = await db
      .from("daily_workouts")
      .select(`
        id, date, title, status, sport, athlete_token, org_token,
        workout_items (
          id, exercise_name, sets, reps, weight, rpe, rest,
          instructions, video_url, evidence_required, sort_order, group_id,
          workout_completions ( id, status, review_note )
        )
      `)
      .eq("id", rawId)
      .maybeSingle();

    if (!dw || dw.org_token !== orgToken) {
      return res.status(404).json({ error: "Workout not found." });
    }

    const workout = {
      id:           dw.id,
      Title:        dw.title  || "Workout",
      Date:         dw.date,
      Status:       dw.status || "assigned",
      Sport:        dw.sport  || "",
      athleteToken: dw.athlete_token || "",
      items: [...(dw.workout_items ?? [])].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(item => ({
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
        Status:           (item.workout_completions ?? [])[0]?.status || "",
      })),
    };

    // Siblings (same org, same date, same title)
    const { data: siblings } = await db
      .from("daily_workouts")
      .select("id, athlete_token, title")
      .eq("org_token", orgToken)
      .eq("date", dw.date)
      .eq("title", dw.title);

    const tokens = (siblings ?? []).map(s => s.athlete_token).filter(Boolean);
    let athletes = [];
    if (tokens.length) {
      const { data: rows } = await db
        .from("athletes")
        .select("athlete_token, name, email")
        .in("athlete_token", tokens);
      athletes = rows ?? [];
    }

    const athleteMap = new Map(athletes.map(a => [a.athlete_token, a]));
    const siblingsOut = (siblings ?? []).map(s => ({
      id:           s.id,
      athleteToken: s.athlete_token || "",
      athleteName:  athleteMap.get(s.athlete_token)?.name || "",
      isSelf:       s.id === rawId,
    }));

    return res.status(200).json({ ok: true, workout, siblings: siblingsOut });
  } catch (err) {
    console.error("[org/workouts/detail]", err);
    return res.status(500).json({ error: "Failed to load workout detail.", details: err?.message });
  }
}
