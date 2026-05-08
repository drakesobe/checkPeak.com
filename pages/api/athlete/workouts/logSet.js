// pages/api/athlete/workouts/logSet.js
// Persists a single set log entry to the Airtable "Set Logs" table.
// Called fire-and-forget from useWorkoutLog — localStorage is the primary store,
// this is the cross-device/coach-visible layer.

import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY })
  .base(process.env.ATHLETE_BASE_ID);

const TABLE = process.env.SET_LOGS_TABLE_NAME || "Set Logs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Pull athlete identity from session cookie
  // Adjust this to match however you read the session in other routes
  const athleteToken = req.session?.athleteToken
    || req.cookies?.athleteToken
    || req.body?.athleteToken
    || "";

  const {
    workoutItemId,
    exerciseTitle,
    date,
    setNumber,
    targetReps,
    targetWeight,
    actualReps,
    actualWeight,
    effort,        // legacy field name
    difficulty,    // preferred field name going forward
    groupId,
    timestamp,
    id,
  } = req.body || {};

  if (!exerciseTitle) {
    return res.status(400).json({ error: "exerciseTitle is required" });
  }

  const difficultyValue = difficulty ?? effort ?? null;

  try {
    const record = await base(TABLE).create({
      AthleteToken:  String(athleteToken || ""),
      ExerciseTitle: String(exerciseTitle || ""),
      WorkoutItemId: String(workoutItemId || ""),
      Date:          String(date || ""),
      SetNumber:     Number(setNumber) || 0,
      TargetReps:    String(targetReps || ""),
      TargetWeight:  String(targetWeight || ""),
      ActualReps:    Number(actualReps) || 0,
      ActualWeight:  Number(actualWeight) || 0,
      Difficulty:    difficultyValue != null ? Number(difficultyValue) : 0,
      GroupId:       String(groupId || ""),
      Timestamp:     Number(timestamp) || Date.now(),
    }, { typecast: true });

    return res.status(200).json({ ok: true, id: record.id });
  } catch (err) {
    console.error("logSet error:", err);
    // Don't surface Airtable errors to the client — localStorage already saved it
    return res.status(200).json({ ok: false, warning: "Saved locally, sync failed" });
  }
}