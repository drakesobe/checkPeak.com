// pages/api/org/workouts/create.js
// POST - creates daily workouts for one or more athletes on one or more dates.
// Fully migrated to Supabase.

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { createOrgWorkout, upsertAthleteByToken } from "@/lib/supabaseOrg";
import { sendNotification } from "@/lib/sendNotification";

function toStr(v)   { return v == null ? "" : String(v); }
function toTrimmed(v) { return toStr(v).trim(); }
function toNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}
function isAthleteToken(v) { return /^ATH-/i.test(String(v || "").trim()); }

function normalizeItem(it = {}, idx = 0) {
  const evidenceAllowed = new Set(["none", "photo", "video", "photo_or_video", "voluntary_activity_vara"]);
  const ev = toTrimmed(it.EvidenceRequired || it.evidenceRequired || "none");
  return {
    sort_order:        toNumOrNull(it.Order ?? it.order) ?? idx + 1,
    exerciseName:      toTrimmed(it.ExerciseName || it.exerciseName || it.name),
    sets:              toNumOrNull(it.Sets   ?? it.sets),
    reps:              toTrimmed(it.Reps    ?? it.reps   ?? "")  || null,
    weight:            toTrimmed(it.Weight  ?? it.weight ?? "")  || null,
    rpe:               toTrimmed(it.RPE     ?? it.rpe    ?? "")  || null,
    rest:              toTrimmed(it.Rest    ?? it.rest   ?? "")  || null,
    instructions:      toTrimmed(it.Instructions ?? it.instructions ?? "") || null,
    videoUrl:          toTrimmed(it.VideoURL ?? it.videoUrl ?? "") || null,
    evidenceRequired:  evidenceAllowed.has(ev) ? ev : "none",
    groupId:           toTrimmed(it.groupId ?? it.GroupId ?? "") || null,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.Token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Missing org token on session." });

  try {
    const { athleteId, athleteIds, date, dates, title, sport, status, items = [], scheduledTime, scheduledDuration } = req.body || {};

    const allDates = Array.isArray(dates) && dates.length
      ? dates.map(d => String(d).slice(0, 10)).filter(Boolean)
      : date ? [String(date).slice(0, 10)] : [];

    if (!allDates.length) return res.status(400).json({ error: "date or dates[] is required." });

    const incomingTokens = Array.isArray(athleteIds)
      ? athleteIds.filter(Boolean)
      : athleteId ? [athleteId] : [];

    if (!incomingTokens.length) return res.status(400).json({ error: "athleteId or athleteIds[] is required." });
    if (items && !Array.isArray(items)) return res.status(400).json({ error: "items must be an array." });

    const normalizedItems = items.map((it, i) => normalizeItem(it, i)).filter(it => it.exerciseName);

    // Resolve athlete Supabase records by token (or email)
    const resolvedAthletes = [];
    for (const token of incomingTokens) {
      const t = String(token || "").trim();
      if (!t) continue;

      let query = db.from("athletes").select("id, athlete_token, email, sport");
      if (isAthleteToken(t)) query = query.eq("athlete_token", t);
      else if (t.includes("@")) query = query.eq("email", t.toLowerCase());
      else query = query.eq("id", t);

      const { data: athlete } = await query.maybeSingle();

      if (athlete) {
        resolvedAthletes.push(athlete);
      } else if (isAthleteToken(t)) {
        // Upsert a minimal placeholder so the workout can be linked
        const { data: upserted } = await upsertAthleteByToken({
          athlete_token: t,
          org_token:     orgToken,
        });
        if (upserted) resolvedAthletes.push({ id: upserted.id, athlete_token: t, sport: null });
      }
    }

    if (!resolvedAthletes.length) {
      return res.status(400).json({ error: "No valid athletes found for provided IDs/tokens." });
    }

    const createdDailyWorkouts = [];

    for (const targetDate of allDates) {
      for (const athlete of resolvedAthletes) {
        const resolvedSport = sport
          ? String(sport).toLowerCase().trim()
          : (athlete.sport || "");

        const { data: workout, error } = await createOrgWorkout({
          orgToken,
          athleteId:        athlete.id,
          athleteToken:     athlete.athlete_token,
          title:            String(title || "Daily Workout"),
          date:             targetDate,
          status:           String(status || "assigned"),
          sport:            resolvedSport,
          items:            normalizedItems,
          scheduledTime:    scheduledTime || null,
          scheduledDuration: scheduledDuration != null ? Number(scheduledDuration) || null : null,
        });

        if (error) {
          console.error("[org/workouts/create] createOrgWorkout error:", error);
          continue;
        }

        createdDailyWorkouts.push({
          dailyWorkoutId:   workout.id,
          date:             targetDate,
          athleteToken:     athlete.athlete_token,
          workoutItemIds:   workout.itemIds,
          createdItemCount: workout.itemIds.length,
        });
      }
    }

    // Notify each athlete whose workout was just assigned (fire-and-forget)
    const notifiedTokens = [...new Set(createdDailyWorkouts.map(w => w.athleteToken).filter(Boolean))];
    if (notifiedTokens.length) {
      const workoutTitle = String(title || "Workout");
      const dateLabel    = allDates.length === 1 ? allDates[0] : `${allDates.length} dates`;
      sendNotification(notifiedTokens, {
        title: "New Workout Assigned",
        body:  `${workoutTitle} has been added to your schedule for ${dateLabel}.`,
        type:  "workout_assigned",
        data:  { date: allDates[0] || "" },
      });
    }

    return res.status(200).json({
      ok:                true,
      createdDailyWorkouts,
      totalWorkouts:     createdDailyWorkouts.length,
      warning:           normalizedItems.length === 0
        ? "No workout items created - no items had ExerciseName set."
        : null,
    });
  } catch (err) {
    console.error("[org/workouts/create]", err);
    return res.status(500).json({ error: "Failed to create workout", details: err?.message });
  }
}
