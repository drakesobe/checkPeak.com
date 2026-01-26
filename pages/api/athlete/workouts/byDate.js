// pages/api/athlete/workouts/byDate.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function escapeAirtableString(str) {
  return String(str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
    WORKOUTITEMS_TABLE_ID: !process.env.WORKOUTITEMS_TABLE_ID,
  };
}

function pickBestDailyWorkout(rows) {
  // Prefer the workout that actually has WorkoutItems linked (most items wins)
  const scored = (rows || []).map((r) => {
    const f = r.fields || {};
    const count = safeArray(f.WorkoutItems).length;
    return { r, f, count };
  });
  scored.sort((a, b) => b.count - a.count);
  return scored[0] || null;
}

// Airtable "IN" helper to fetch by record IDs in batches
async function fetchWorkoutItemsByIds(WorkoutItemsTable, ids) {
  const unique = Array.from(new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (unique.length === 0) return [];

  // Airtable max OR() args can get big; chunk to be safe
  const chunkSize = 50;
  const chunks = [];
  for (let i = 0; i < unique.length; i += chunkSize) chunks.push(unique.slice(i, i + chunkSize));

  const results = [];
  for (const chunk of chunks) {
    const formula = `OR(${chunk.map((id) => `RECORD_ID()="${escapeAirtableString(id)}"`).join(",")})`;
    const rows = await WorkoutItemsTable.select({
      filterByFormula: formula,
      pageSize: 100,
    }).firstPage();
    results.push(...rows);
  }

  return results;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = envMissing();
  if (
    missing.DAILYWORKOUTS_API_KEY ||
    missing.DAILYWORKOUTS_BASE_ID ||
    missing.DAILYWORKOUTS_TABLE_ID ||
    missing.WORKOUTITEMS_TABLE_ID
  ) {
    return res.status(500).json({
      error: "Airtable env vars missing.",
      missing,
    });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  // date is required here
  const isoDate = String(req.query?.date || "").trim(); // YYYY-MM-DD
  if (!isoDate) return res.status(400).json({ error: "Missing date (YYYY-MM-DD)." });

  // Pull athlete email from auth cookie/session
  const athleteEmailRaw =
    auth?.athlete?.Email ||
    auth?.athlete?.email ||
    auth?.email ||
    auth?.user?.Email ||
    auth?.user?.email ||
    "";

  const athleteEmail = normEmail(athleteEmailRaw);
  if (!athleteEmail) return res.status(400).json({ error: "Missing athlete email in auth session." });

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);

  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);
  const WorkoutItemsTable = base(process.env.WORKOUTITEMS_TABLE_ID);

  try {
    // AthleteEmail is a lookup -> array -> ARRAYJOIN
    const emailEsc = escapeAirtableString(athleteEmail);
    const dateEsc = escapeAirtableString(isoDate);

    const formula = `AND(
      IS_SAME({Date}, "${dateEsc}", "day"),
      FIND("${emailEsc}", LOWER(SUBSTITUTE(ARRAYJOIN({AthleteEmail}), " ", "")))
    )`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 10,
    }).firstPage();

    if (!rows?.length) {
      return res.status(200).json({ dailyWorkout: null, items: [] });
    }

    const picked = pickBestDailyWorkout(rows);
    const rec = picked?.r || rows[0];
    const f = rec.fields || {};

    const workoutItemIds = safeArray(f.WorkoutItems);

    // ✅ HYDRATE: fetch full WorkoutItems records
    const itemRows = await fetchWorkoutItemsByIds(WorkoutItemsTable, workoutItemIds);

    // Keep original DailyWorkouts order
    const byId = new Map(itemRows.map((r) => [r.id, r]));
    const ordered = workoutItemIds.map((id) => byId.get(String(id)) || null).filter(Boolean);

    // Normalize item fields for your UI
    const items = ordered.map((r) => {
      const it = r.fields || {};
      return {
        id: r.id,
        ExerciseName: it.ExerciseName || it.Title || it.Name || "Exercise",
        EvidenceRequired: !!it.EvidenceRequired,
        Sets: it.Sets ?? "",
        Reps: it.Reps ?? "",
        Weight: it.Weight ?? it.Load ?? "", // ✅ normalize to Weight
        RPE: it.RPE ?? "",
        Rest: it.Rest ?? "",
        Instructions: it.Instructions ?? "",
        VideoURL: it.VideoURL ?? "",
        Completed: "false", // completion state can be layered later (Attachment Summary map, etc.)
      };
    });

    return res.status(200).json({
      dailyWorkout: {
        id: rec.id,
        Title: f.Title || "Daily Workout",
        Date: f.Date || isoDate,
        Status: f.Status || "assigned",
      },
      items,
    });
  } catch (e) {
    console.error("[api/athlete/workouts/byDate] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}
