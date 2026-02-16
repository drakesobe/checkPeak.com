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

    WORKOUTCOMPLETIONS_API_KEY: !process.env.WORKOUTCOMPLETIONS_API_KEY,
    WORKOUTCOMPLETIONS_BASE_ID: !process.env.WORKOUTCOMPLETIONS_BASE_ID,
    WORKOUTCOMPLETIONS_TABLE_ID: !process.env.WORKOUTCOMPLETIONS_TABLE_ID,
  };
}

function pickBestDailyWorkout(rows) {
  const scored = (rows || []).map((r) => {
    const f = r.fields || {};
    // Prefer records that actually have items; if reciprocal isn't populated, this may be 0
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
  // ✅ Enforce ATH- only
  if (!token || !/^ATH-/i.test(token)) return "";
  return token;
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

  const isoDate = String(req.query?.date || "").trim(); // YYYY-MM-DD
  if (!isoDate) return res.status(400).json({ error: "Missing date (YYYY-MM-DD)." });

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
        athleteEmail,
        cookieKeys: Object.keys(auth?.user || {}),
        got: auth?.user?.AthleteToken || auth?.user?.athleteToken || null,
      },
    });
  }

  // ✅ AthleteScans record id (used for WorkoutCompletions matching)
  const athleteRecordId = String(auth?.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return res.status(400).json({
      error:
        "Missing athlete record id in auth session (expected AthleteScans record id). Needed for WorkoutCompletions matching.",
    });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);
  const WorkoutItemsTable = base(process.env.WORKOUTITEMS_TABLE_ID);

  const wcBase = new Airtable({ apiKey: process.env.WORKOUTCOMPLETIONS_API_KEY }).base(
    process.env.WORKOUTCOMPLETIONS_BASE_ID
  );
  const WorkoutCompletions = wcBase(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

  try {
    const dateEsc = escapeAirtableString(isoDate);
    const tokenEsc = escapeAirtableString(athleteToken);

    // ✅ TOKEN-ONLY query (no email fallback, no Token fallback)
    const formula = `AND(
      IS_SAME({Date}, "${dateEsc}", "day"),
      {AthleteToken} = "${tokenEsc}"
    )`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 10,
    }).firstPage();

    if (!rows?.length) {
      return res.status(200).json({
        dailyWorkout: null,
        items: [],
        debug: { reason: "No match for date + AthleteToken", isoDate, athleteToken, formula },
      });
    }

    const rec = pickBestDailyWorkout(rows) || rows[0];
    const f = rec.fields || {};

    // ✅ Robust: query WorkoutItems by link-to DailyWorkout (does NOT depend on reciprocal "WorkoutItems" field being populated)
    const dwIdEsc = escapeAirtableString(rec.id);
    const wiFormula = `FIND("${dwIdEsc}", ARRAYJOIN({DailyWorkout}&""))>0`;

    const wiRows = await WorkoutItemsTable.select({
      filterByFormula: wiFormula,
      pageSize: 100,
    }).firstPage();

    const hydrated = (wiRows || []).slice().sort((a, b) => {
      const ao = Number(a?.fields?.Order ?? 999999);
      const bo = Number(b?.fields?.Order ?? 999999);
      return ao - bo;
    });

    // completions for that day
    const wcDateFormula = `IS_SAME({${WC_FIELDS.CompletedAt}}, "${dateEsc}", "day")`;
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
        Date: f.Date || isoDate,
        Status: f.Status || "assigned",
        AthleteToken: f.AthleteToken || athleteToken,
        ReviewStatus: reviewStatus,
        ReviewedNotes: reviewedNotes,
      },
      items,
      debug: { wiFormula, foundItems: hydrated.length },
    });
  } catch (e) {
    console.error("[api/athlete/workouts/byDate] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}
