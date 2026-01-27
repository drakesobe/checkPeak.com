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

    WORKOUTCOMPLETIONS_API_KEY: !process.env.WORKOUTCOMPLETIONS_API_KEY,
    WORKOUTCOMPLETIONS_BASE_ID: !process.env.WORKOUTCOMPLETIONS_BASE_ID,
    WORKOUTCOMPLETIONS_TABLE_ID: !process.env.WORKOUTCOMPLETIONS_TABLE_ID,
  };
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

const WC_FIELDS = {
  CompletedAt: "CompletedAt",
  Athlete: "Athlete",
  WorkoutItem: "WorkoutItem",
  Status: "Status",
  AttachmentSummary: "Attachment Summary",
  CompletionEvidence: "CompletionEvidence",
};

function statusNorm(s) {
  return String(s || "").trim().toLowerCase();
}

function isAthleteDone(status) {
  const st = statusNorm(status);
  return st === "completed" || st === "pending_review";
}

// Airtable may return weird objects for empty/stale lookups; normalize to a clean string
function normalizeTextValue(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  if (v && typeof v === "object") {
    // Handle Airtable "cell value" objects like {state:"empty", value:null}
    const maybe = v?.value;
    return String(maybe ?? "").trim();
  }
  return String(v ?? "").trim();
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

  // ✅ IMPORTANT: we need the athlete Airtable record id (AthleteScans rec...)
  const athleteRecordId = String(auth?.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return res.status(400).json({
      error:
        "Missing athlete record id in auth session (expected AthleteScans record id). Needed for WorkoutCompletions matching.",
    });
  }

  const today = nyDateISO();

  // DailyWorkouts base
  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );

  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);
  const WorkoutItems = base(process.env.WORKOUTITEMS_TABLE_ID);

  // WorkoutCompletions base
  const wcBase = new Airtable({ apiKey: process.env.WORKOUTCOMPLETIONS_API_KEY }).base(
    process.env.WORKOUTCOMPLETIONS_BASE_ID
  );
  const WorkoutCompletions = wcBase(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

  try {
    // --- 1) Find today's DailyWorkout for this athlete (email lookup logic stays) ---
    const emailNeedle = escapeAirtableString(athleteEmail.replace(/\s+/g, ""));
    const formula = `AND(
      IS_SAME({Date}, "${today}", "day"),
      FIND(
        "${emailNeedle}",
        LOWER(SUBSTITUTE(ARRAYJOIN({AthleteEmail}), " ", ""))
      )
    )`;

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

    const workoutItemIds = safeArray(f.WorkoutItems)
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    // --- 2) Hydrate WorkoutItems records ---
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

    // --- 3) Pull WorkoutCompletions for today; then match athlete + workoutItem in JS ---
    const wcDateFormula = `IS_SAME({${WC_FIELDS.CompletedAt}}, "${escapeAirtableString(today)}", "day")`;

    const wcRows = await WorkoutCompletions.select({
      filterByFormula: wcDateFormula,
      maxRecords: 200,
    }).firstPage();

    const completionByWorkoutItemId = new Map();

    for (const r of wcRows || []) {
      const wf = r.fields || {};
      const athleteLinks = Array.isArray(wf[WC_FIELDS.Athlete]) ? wf[WC_FIELDS.Athlete] : [];
      if (!athleteLinks.map(String).includes(String(athleteRecordId))) continue;

      const itemLinks = Array.isArray(wf[WC_FIELDS.WorkoutItem]) ? wf[WC_FIELDS.WorkoutItem] : [];
      const itemId = String(itemLinks?.[0] || "").trim();
      if (!itemId) continue;

      const prev = completionByWorkoutItemId.get(itemId);
      const prevAt = prev?.fields?.[WC_FIELDS.CompletedAt] ? String(prev.fields[WC_FIELDS.CompletedAt]) : "";
      const nextAt = wf?.[WC_FIELDS.CompletedAt] ? String(wf[WC_FIELDS.CompletedAt]) : "";
      if (!prev || (nextAt && nextAt > prevAt)) completionByWorkoutItemId.set(itemId, r);
    }

    // --- 4) Build response items in DailyWorkouts order ---
    const items = workoutItemIds.map((id, idx) => {
      const row = byId.get(id);
      const it = row?.fields || {};

      const completionRec = completionByWorkoutItemId.get(id);
      const cf = completionRec?.fields || {};
      const status = statusNorm(cf[WC_FIELDS.Status] || "");
      const doneForAthlete = isAthleteDone(status);

      return {
        id,
        missing: !row,

        ExerciseName: it.ExerciseName || it.Title || it.Name || `Workout Item ${idx + 1}`,
        EvidenceRequired: !!it.EvidenceRequired,

        Sets: it.Sets ?? "",
        Reps: it.Reps ?? "",
        Weight: it.Weight ?? it.Load ?? "",
        RPE: it.RPE ?? "",
        Rest: it.Rest ?? "",
        Instructions: it.Instructions ?? "",
        VideoURL: it.VideoURL ?? it.Video ?? "",

        // ✅ Completion state
        Completed: doneForAthlete ? "true" : "false",
        Status: status || "", // completed | pending_review | rejected | ""
        CompletedAt: cf[WC_FIELDS.CompletedAt] || "",
        Note: cf[WC_FIELDS.AttachmentSummary] || "",
        CompletionId: completionRec?.id || "",
        CompletionEvidence: safeArray(cf[WC_FIELDS.CompletionEvidence]),
      };
    });

    // ✅ NEW: include review feedback fields on the dailyWorkout object
    const reviewStatus = normalizeTextValue(f.ReviewStatus) || "pending";
    const reviewedNotes = normalizeTextValue(f.ReviewedNotes) || "";

    return res.status(200).json({
      dailyWorkout: {
        id: rec.id,
        Title: f.Title || "Daily Workout",
        Date: f.Date || today,
        Status: f.Status || "assigned",

        // ✅ These drive the athlete UI
        ReviewStatus: reviewStatus,
        ReviewedNotes: reviewedNotes,
      },
      items,
    });
  } catch (e) {
    console.error("[api/athlete/workouts/today] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}
