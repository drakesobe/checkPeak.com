// pages/api/athlete/workouts/logs.js
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
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const { exerciseTitle, days = 120, limit = 500 } = req.query;

  const safeToken = athleteToken.replace(/"/g, '\\"');
  let formula = `{AthleteToken} = "${safeToken}"`;
  if (exerciseTitle) {
    const safeTitle = String(exerciseTitle).replace(/"/g, '\\"');
    formula = `AND(${formula}, {ExerciseTitle} = "${safeTitle}")`;
  }

  try {
    const records = await base(TABLE)
      .select({
        filterByFormula: formula,
        sort: [{ field: "Timestamp", direction: "desc" }],
        maxRecords: Number(limit),
      })
      .all();

    const logs = records.map(r => ({
      id:            r.id,
      workoutItemId: r.get("WorkoutItemId") || "",
      exerciseTitle: r.get("ExerciseTitle") || "",
      date:          r.get("Date")          || "",
      setNumber:     r.get("SetNumber")     || 0,
      targetReps:    r.get("TargetReps")    || "",
      targetWeight:  r.get("TargetWeight")  || "",
      actualReps:    r.get("ActualReps")    || 0,
      actualWeight:  r.get("ActualWeight")  || 0,
      difficulty:    r.get("Difficulty")    || 0,
      groupId:       r.get("GroupId")       || "",
      timestamp:     r.get("Timestamp")     || 0,
    }));

    return res.status(200).json({ ok: true, logs, total: logs.length });
  } catch (err) {
    console.error("logs GET error:", err);
    return res.status(500).json({ error: "Failed to fetch logs" });
  }
}