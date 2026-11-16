// lib/workoutLibrary.js
// The team Workout Library: workouts a coach has saved (organizations.workout_templates) that any
// athlete on the team can pick and do on their own, e.g. a leg day on an off day.
// A picked workout becomes a normal daily_workouts row on the athlete's Today, so logging, proof
// and the coach's Review Queue work exactly as they do for assigned workouts.

import { supabaseAdmin as db } from "@/lib/supabase";

export const LIBRARY_SOURCE_PREFIX = "library:";
const str = (v) => String(v ?? "").trim();

// The athlete's own team, read from the database by the signed athlete token (an athlete
// session's team code is not signed, so it is never trusted).
export async function loadAthleteForLibrary(session) {
  const token = str(session?.athlete_token || session?.AthleteToken || session?.athleteToken);
  const q = db.from("athletes").select("id, athlete_token, org_token, sport, name").limit(1);
  const { data } = token ? await q.eq("athlete_token", token) : await q.eq("email", str(session?.email).toLowerCase());
  return data?.[0] || null;
}

export async function loadTeamLibrary(orgToken) {
  const { data: org } = await db
    .from("organizations")
    .select("id, name, workout_templates")
    .eq("token", orgToken)
    .maybeSingle();
  const templates = Array.isArray(org?.workout_templates) ? org.workout_templates : [];
  return {
    org: org ? { id: org.id, name: org.name } : null,
    workouts: templates.filter((t) => t && t.id && t.athleteVisible !== false),
  };
}

const exerciseName = (ex) => str(ex?.ExerciseName || ex?.exercise_name || ex?.name);

// What the athlete sees in the list (no coach-only fields)
export function toLibraryCard(t) {
  const exercises = (Array.isArray(t.exercises) ? t.exercises : []).filter(exerciseName);
  return {
    id: str(t.id),
    name: str(t.name) || "Workout",
    sport: str(t.sport),
    category: str(t.category) || "strength",
    description: str(t.description),
    exerciseCount: exercises.length,
    exercises: exercises
      .sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0))
      .map((ex) => ({
        name: exerciseName(ex),
        sets: ex.Sets ?? null,
        reps: str(ex.Reps),
        weight: str(ex.Weight),
        rest: str(ex.Rest),
        instructions: str(ex.Instructions),
        videoUrl: str(ex.VideoURL),
        evidence: str(ex.EvidenceRequired) || "none",
      })),
    updatedAt: str(t.updatedAt || t.createdAt),
  };
}

function toItems(template, dailyWorkoutId, orgId) {
  return (Array.isArray(template.exercises) ? template.exercises : [])
    .filter(exerciseName)
    .sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0))
    .map((ex, i) => ({
      daily_workout_id:  dailyWorkoutId,
      org_id:            orgId || null,
      sort_order:        Number(ex.Order) || i + 1,
      exercise_name:     exerciseName(ex),
      sets:              ex.Sets != null && ex.Sets !== "" ? Number(ex.Sets) || null : null,
      reps:              str(ex.Reps) || null,
      weight:            str(ex.Weight) || null,
      rest:              str(ex.Rest) || null,
      instructions:      str(ex.Instructions) || null,
      video_url:         str(ex.VideoURL) || null,
      group_id:          str(ex.groupId) || null,
      evidence_required: str(ex.EvidenceRequired) || "none",
      status:            "assigned",
    }));
}

// Adds a library workout to the athlete's Today for `date`. Picking the same workout twice on one
// day returns the existing one instead of a duplicate.
export async function startLibraryWorkout({ athlete, orgId, template, date }) {
  const source = `${LIBRARY_SOURCE_PREFIX}${template.id}`;
  const { data: existing } = await db
    .from("daily_workouts")
    .select("id")
    .eq("athlete_id", athlete.id)
    .eq("date", date)
    .eq("source_workout_id", source)
    .limit(1);
  if (existing?.[0]) return { dailyWorkoutId: existing[0].id, alreadyAdded: true };

  const { data: dw, error } = await db
    .from("daily_workouts")
    .insert({
      athlete_id:        athlete.id,
      athlete_token:     athlete.athlete_token,
      org_token:         athlete.org_token,
      org_id:            orgId || null,
      date,
      title:             str(template.name) || "Workout",
      sport:             str(template.sport) || athlete.sport || null,
      status:            "assigned",
      source_workout_id: source,
    })
    .select("id")
    .single();
  if (error || !dw) throw new Error(error?.message || "Could not add the workout.");

  const items = toItems(template, dw.id, orgId);
  if (items.length) {
    const { error: itemErr } = await db.from("workout_items").insert(items);
    if (itemErr) {
      await db.from("daily_workouts").delete().eq("id", dw.id); // don't leave an empty workout behind
      throw new Error(itemErr.message);
    }
  }
  return { dailyWorkoutId: dw.id, alreadyAdded: false, itemCount: items.length };
}
