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

function pickBestDailyWorkout(rows) {
  // Prefer rows that already have WorkoutItems populated (since you confirmed it is)
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

function normalizeTextValue(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  if (v && typeof v === "object") return String(v?.value ?? "").trim();
  return String(v ?? "").trim();
}

function mustAthleteToken(auth) {
  const raw =
    auth?.athlete?.AthleteToken ||
    auth?.athlete?.athleteToken ||
    auth?.user?.AthleteToken ||
    auth?.user?.athleteToken ||
    "";

  const token = String(raw || "").trim();
  if (!token || !/^ATH-/i.test(token)) return "";
  return token;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function hydrateWorkoutItemsByIds(WorkoutItemsTable, ids = []) {
  const itemIds = safeArray(ids).map(String).map((s) => s.trim()).filter(Boolean);
  if (!itemIds.length) return [];

  const rows = [];
  for (const batch of chunk(itemIds, 50)) {
    const orParts = batch
      .map((id) => `RECORD_ID()="${escapeAirtableString(id)}"`)
      .join(",");
    const formula = `OR(${orParts})`;

    const got = await WorkoutItemsTable.select({
      filterByFormula: formula,
      pageSize: 100,
    }).firstPage();

    rows.push(...(got || []));
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  // preserve the same order as the link field
  return itemIds.map((id) => byId.get(id)).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const missing = envMissing();
  if (Object.values(missing).some(Boolean)) {
    return res.status(500).json({ error: "Airtable env vars missing.", missing });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const today = nyDateISO();

  const athleteEmailRaw =
    auth?.athlete?.Email ||
    auth?.athlete?.email ||
    auth?.email ||
    auth?.user?.Email ||
    auth?.user?.email ||
    "";
  const athleteEmail = normEmail(athleteEmailRaw);

  const athleteToken = mustAthleteToken(auth);
  if (!athleteToken) {
    return res.status(400).json({
      error:
        "Missing AthleteToken (ATH-XXXX) in auth session cookie. Log out/in after verifying the athlete record has AthleteToken populated.",
      debug: {
        today,
        athleteEmail,
        cookieKeys: Object.keys(auth?.user || {}),
        got: auth?.user?.AthleteToken || auth?.user?.athleteToken || null,
      },
    });
  }

  const athleteRecordId = String(auth?.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return res.status(400).json({
      error:
        "Missing athlete record id in auth session (expected AthleteScans record id). Needed for WorkoutCompletions matching.",
    });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );

  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);
  const WorkoutItemsTable = base(process.env.WORKOUTITEMS_TABLE_ID);

  const wcBase = new Airtable({ apiKey: process.env.WORKOUTCOMPLETIONS_API_KEY }).base(
    process.env.WORKOUTCOMPLETIONS_BASE_ID
  );
  const WorkoutCompletions = wcBase(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

  try {
    const tokenEsc = escapeAirtableString(athleteToken);

    const tokenFormula = `AND(IS_SAME({Date}, "${today}", "day"), {AthleteToken} = "${tokenEsc}")`;

    const rows = await DailyWorkouts.select({
      filterByFormula: tokenFormula,
      maxRecords: 10,
    }).firstPage();

    if (!rows?.length) {
      return res.status(200).json({
        dailyWorkout: null,
        items: [],
        debug: { reason: "No match for today", today, athleteToken, tokenFormula },
      });
    }

    const rec = pickBestDailyWorkout(rows) || rows[0];
    const f = rec.fields || {};

    // ✅ PRIMARY: hydrate from the field YOU CONFIRMED is populated
    const linkedItemIds = safeArray(f.WorkoutItems).map(String).map((s) => s.trim()).filter(Boolean);
    let hydrated = await hydrateWorkoutItemsByIds(WorkoutItemsTable, linkedItemIds);

    // ✅ FALLBACK: reverse-lookup (kept only for safety)
    let wiFormula = "";
    if (!hydrated.length) {
      const dwIdEsc = escapeAirtableString(rec.id);
      wiFormula = `FIND("${dwIdEsc}", ARRAYJOIN({DailyWorkout}&""))>0`;

      const wiRows = await WorkoutItemsTable.select({
        filterByFormula: wiFormula,
        pageSize: 100,
      }).firstPage();

      hydrated = (wiRows || []).slice();
    }

    hydrated.sort((a, b) => {
      const ao = Number(a?.fields?.Order ?? 999999);
      const bo = Number(b?.fields?.Order ?? 999999);
      return ao - bo;
    });

    // completions for today
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

      completionByWorkoutItemId.set(itemId, r);
    }

    const items = hydrated.map((row, idx) => {
      const id = row.id;
      const it = row?.fields || {};

      const completionRec = completionByWorkoutItemId.get(id);
      const cf = completionRec?.fields || {};
      const status = statusNorm(cf[WC_FIELDS.Status] || "");
      const doneForAthlete = isAthleteDone(status);

      return {
        id,
        missing: false,

        ExerciseName: it.ExerciseName || it.Title || it.Name || `Workout Item ${idx + 1}`,
        EvidenceRequired: !!it.EvidenceRequired,

        Sets: it.Sets ?? "",
        Reps: it.Reps ?? "",
        Weight: it.Weight ?? it.Load ?? "",
        RPE: it.RPE ?? "",
        Rest: it.Rest ?? "",
        Instructions: it.Instructions ?? "",
        VideoURL: it.VideoURL ?? it.Video ?? "",

        Completed: doneForAthlete ? "true" : "false",
        Status: status || "",
        CompletedAt: cf[WC_FIELDS.CompletedAt] || "",
        Note: cf[WC_FIELDS.AttachmentSummary] || "",
        CompletionId: completionRec?.id || "",
        CompletionEvidence: safeArray(cf[WC_FIELDS.CompletionEvidence]),
      };
    });

    const reviewStatus = normalizeTextValue(f.ReviewStatus) || "pending";
    const reviewedNotes = normalizeTextValue(f.ReviewedNotes) || "";

    return res.status(200).json({
      dailyWorkout: {
        id: rec.id,
        Title: f.Title || "Daily Workout",
        Date: f.Date || today,
        Status: f.Status || "assigned",
        AthleteToken: f.AthleteToken || athleteToken,
        ReviewStatus: reviewStatus,
        ReviewedNotes: reviewedNotes,
      },
      items,
      debug: {
        tokenFormula,
        linkedItemCount: linkedItemIds.length,
        hydratedCount: hydrated.length,
        fallbackWiFormulaUsed: !linkedItemIds.length || !hydrated.length ? true : false,
        wiFormula: wiFormula || null,
      },
    });
  } catch (e) {
    console.error("[api/athlete/workouts/today] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}
