// pages/api/athlete/workouts/today.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function nyDateISO() {
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
    WORKOUTITEMS_TABLE_ID: !process.env.WORKOUTITEMS_TABLE_ID,
  };
}

function parseJsonMaybe(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Maps workoutItemId -> completion object
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

function escapeAirtableString(str) {
  return String(str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickBestDailyWorkout(rows) {
  const scored = (rows || []).map((r) => {
    const f = r.fields || {};
    const count = safeArray(f.WorkoutItems).length;
    return { r, count };
  });
  scored.sort((a, b) => b.count - a.count);
  return scored[0]?.r || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();
  if (Object.values(missing).some(Boolean)) {
    return res.status(500).json({
      error: "Airtable env vars missing.",
      missing,
    });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteEmailRaw =
    auth?.athlete?.Email ||
    auth?.athlete?.email ||
    auth?.email ||
    auth?.user?.Email ||
    auth?.user?.email ||
    "";

  const athleteEmail = normEmail(athleteEmailRaw);
  if (!athleteEmail) {
    return res.status(400).json({ error: "Missing athlete email in auth session." });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );

  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);
  const WorkoutItems = base(process.env.WORKOUTITEMS_TABLE_ID);

  const today = nyDateISO();

  try {
    const emailNeedle = escapeAirtableString(athleteEmail.replace(/\s+/g, ""));
    const formula = `AND(
      IS_SAME({Date}, "${today}", "day"),
      FIND(
        "${emailNeedle}",
        LOWER(SUBSTITUTE(ARRAYJOIN({AthleteEmail}), " ", ""))
      )
    )`;

    // ✅ Pull a few, then pick the one that actually has WorkoutItems
    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 10,
    }).firstPage();

    if (!rows?.length) {
      return res.status(200).json({
        dailyWorkout: null,
        items: [],
        debug: { reason: "No match for today + AthleteEmail", today, athleteEmail, formula },
      });
    }

    const rec = pickBestDailyWorkout(rows) || rows[0];
    const f = rec.fields || {};

    const completionMap = buildCompletionMap(f["Attachment Summary"]);

    const workoutItemIds = safeArray(f.WorkoutItems)
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    // Hydrate WorkoutItems linked records
    let hydrated = [];
    if (workoutItemIds.length) {
      const batches = chunk(workoutItemIds, 50);
      for (const ids of batches) {
        const orParts = ids.map((id) => `RECORD_ID()="${escapeAirtableString(id)}"`).join(",");
        const batchRows = await WorkoutItems.select({
          filterByFormula: `OR(${orParts})`,
          pageSize: 100,
        }).firstPage();

        hydrated.push(...(batchRows || []));
      }
    }

    const byId = new Map(hydrated.map((r) => [r.id, r]));

    const items = workoutItemIds.map((id, idx) => {
      const row = byId.get(id);
      const wf = row?.fields || {};

      const completion = completionMap[id];
      const done = !!completion;

      return {
        id,
        missing: !row, // helpful for debugging if a linked record didn’t hydrate

        ExerciseName: wf.ExerciseName || wf.Title || wf.Name || `Workout Item ${idx + 1}`,
        EvidenceRequired: wf.EvidenceRequired ?? false,

        Sets: wf.Sets ?? "",
        Reps: wf.Reps ?? "",
        Weight: wf.Weight ?? wf.Load ?? "",
        RPE: wf.RPE ?? "",
        Rest: wf.Rest ?? "",
        Instructions: wf.Instructions ?? "",
        VideoURL: wf.VideoURL ?? wf.Video ?? "",

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
