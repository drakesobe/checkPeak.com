// pages/api/athlete/workouts/today.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function nyDateISO() {
  // YYYY-MM-DD in America/New_York
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
  };
}

function parseJsonMaybe(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// We store completion events in Attachment Summary as JSON array.
// This maps workoutItemId -> { fileUrl, at, note }
function buildCompletionMap(summaryRaw) {
  const parsed = parseJsonMaybe(String(summaryRaw || "").trim());
  const list = Array.isArray(parsed) ? parsed : [];
  const map = {};
  list.forEach((x) => {
    const id = String(x?.workoutItemId || "").trim();
    if (!id) return;
    map[id] = x;
  });
  return map;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();
  if (missing.DAILYWORKOUTS_API_KEY || missing.DAILYWORKOUTS_BASE_ID || missing.DAILYWORKOUTS_TABLE_ID) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
      debug: { cwd: process.cwd() },
    });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  // Best: athlete Airtable record id in cookie
  const athleteRecordId = String(auth.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return res.status(400).json({
      error:
        "Missing athleteId in auth cookie. Add athleteId (AthleteScans record id) to the cookie user payload so we can filter DailyWorkouts by linked Athlete field.",
    });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);

  const today = nyDateISO();

  try {
    // Linked-record fields in Airtable are arrays of record ids.
    // We'll match records that contain athleteRecordId AND same day.
    const formula = `AND(
      IS_SAME({Date}, "${today}", "day"),
      FIND("${athleteRecordId}", ARRAYJOIN({Athlete}&""))
    )`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 1,
    }).firstPage();

    if (!rows?.length) {
      return res.status(200).json({ dailyWorkout: null, items: [] });
    }

    const rec = rows[0];
    const f = rec.fields || {};

    const completionMap = buildCompletionMap(f["Attachment Summary"]);

    const workoutItemIds = safeArray(f.WorkoutItems);

    // ✅ MVP items (until WorkoutItems table is wired)
    const items = workoutItemIds.map((id, idx) => {
      const key = String(id || "").trim();
      const completion = completionMap[key];
      const done = !!completion;

      return {
        id: key,
        ExerciseName: `Workout Item ${idx + 1}`,
        EvidenceRequired: false, // later: pull from WorkoutItems
        Sets: "",
        Reps: "",
        Load: "",
        RPE: "",
        Rest: "",
        Instructions: "",
        VideoURL: "",
        Completed: done ? "true" : "false",
        EvidenceUrl: completion?.fileUrl || "",
        CompletedAt: completion?.at || "",
      };
    });

    return res.status(200).json({
      dailyWorkout: {
        id: rec.id,
        Title: f.Title || "Daily Workout",
        Date: f.Date || today,
        Status: f.Status || "assigned",
      },
      items,
    });
  } catch (e) {
    console.error("[api/athlete/workouts/today] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}
