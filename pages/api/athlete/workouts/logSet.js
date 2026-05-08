// pages/api/athlete/workouts/logSet.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY })
  .base(process.env.ATHLETE_BASE_ID);

const TABLE = process.env.SET_LOGS_TABLE_NAME || "Set Logs";

function getAthleteToken(auth) {
  return String(
    auth?.athlete?.AthleteToken ||
    auth?.athlete?.athleteToken ||
    auth?.user?.AthleteToken    ||
    auth?.user?.athleteToken    ||
    ""
  ).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const {
    workoutItemId, exerciseTitle, date, setNumber,
    targetReps, targetWeight, actualReps, actualWeight,
    effort, difficulty, groupId, timestamp,
  } = req.body || {};

  if (!exerciseTitle) return res.status(400).json({ error: "exerciseTitle is required" });

  const difficultyValue = difficulty ?? effort ?? null;

  try {
    const record = await base(TABLE).create({
      AthleteToken:  athleteToken,
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
    return res.status(200).json({ ok: false, warning: "Saved locally, sync failed" });
  }
}