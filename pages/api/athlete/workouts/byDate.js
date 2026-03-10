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
    const count = safeArray(f.WorkoutItems).length;
    return { r, count };
  });
  scored.sort((a, b) => b.count - a.count);
  return scored[0]?.r || null;
}

/**
 * Normalizes EvidenceRequired from Airtable to a consistent string value.
 * Airtable may store it as a boolean (true/false) or a single-select string
 * ("none", "photo", "video", "photo_or_video", "voluntary_activity_vara").
 *
 * Returns the canonical string so the client can distinguish VARA from
 * normal evidence-required items without a boolean cast.
 */
function normalizeEvidenceRequired(raw) {
  if (raw === true || raw === "true") return "photo"; // legacy boolean true => treat as photo
  if (raw === false || raw === "false" || raw == null || raw === "") return "none";
  const s = String(raw).trim().toLowerCase();
  const known = ["none", "photo", "video", "photo_or_video", "voluntary_activity_vara"];
  return known.includes(s) ? s : "none";
}

const WC_FIELDS = {
  CompletedAt: "CompletedAt",
  Athlete: "Athlete",
  AthleteToken: "AthleteToken",
  WorkoutItem: "WorkoutItem",
  Status: "Status",
  Attachment: "Attachment",
  AttachmentSummaryA: "AttachmentSummary",
  AttachmentSummaryB: "Attachment Summary",
  ReviewNote: "ReviewNote",
  AthleteAcknowledged: "AthleteAcknowledged",
  AthleteAcknowledgedAt: "AthleteAcknowledgedAt",
};

function statusNorm(s) {
  return String(s || "").trim().toLowerCase();
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

// "done" for athlete:
// completed OR pending_review
// OR rejected BUT acknowledged (so no endless loop)
function isAthleteDone(status, acknowledged) {
  const st = statusNorm(status);
  if (st === "completed" || st === "pending_review") return true;
  if (st === "rejected" && Boolean(acknowledged)) return true;
  return false;
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
    auth?.AthleteToken ||
    auth?.athleteToken ||
    "";

  const token = String(raw || "").trim();
  if (!token || !/^ATH-/i.test(token)) return "";
  return token;
}

function okNull(res, payload = {}) {
  return res.status(200).json({ dailyWorkout: null, items: [], ...payload });
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
    const orParts = batch.map((id) => `RECORD_ID()="${escapeAirtableString(id)}"`).join(",");
    const formula = `OR(${orParts})`;
    const got = await WorkoutItemsTable.select({ filterByFormula: formula, pageSize: 100 }).firstPage();
    rows.push(...(got || []));
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
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
  if (!auth.ok) {
    return okNull(res, { error: auth.error || "Unauthorized", stopRetry: true });
  }

  const isoDate = String(req.query?.date || "").trim();
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
    return okNull(res, {
      error:
        "Missing AthleteToken (ATH-XXXX) in auth session cookie. Log out/in after verifying the athlete record has AthleteToken populated.",
      stopRetry: true,
      debug: { athleteEmail, cookieKeys: Object.keys(auth?.user || {}) },
    });
  }

  const athleteRecordId = String(auth?.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return okNull(res, {
      error: "Missing athlete record id in auth session (expected AthleteScans record id).",
      stopRetry: true,
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

    const formula = `AND(
      IS_SAME({Date}, "${dateEsc}", "day"),
      {AthleteToken} = "${tokenEsc}"
    )`;

    const rows = await DailyWorkouts.select({ filterByFormula: formula, maxRecords: 10 }).firstPage();

    if (!rows?.length) {
      return okNull(res, { debug: { reason: "No match for date + AthleteToken", isoDate, athleteToken, formula } });
    }

    const rec = pickBestDailyWorkout(rows) || rows[0];
    const f = rec.fields || {};

    const linkedItemIds = safeArray(f.WorkoutItems).map(String).map((s) => s.trim()).filter(Boolean);
    let hydrated = await hydrateWorkoutItemsByIds(WorkoutItemsTable, linkedItemIds);

    let wiFormula = "";
    if (!hydrated.length) {
      const dwIdEsc = escapeAirtableString(rec.id);
      wiFormula = `FIND("${dwIdEsc}", ARRAYJOIN({DailyWorkout}&""))>0`;
      const wiRows = await WorkoutItemsTable.select({ filterByFormula: wiFormula, pageSize: 100 }).firstPage();
      hydrated = (wiRows || []).slice();
    }

    hydrated.sort((a, b) => {
      const ao = Number(a?.fields?.Order ?? 999999);
      const bo = Number(b?.fields?.Order ?? 999999);
      return ao - bo;
    });

    const wcFormula = `AND(
      IS_SAME({${WC_FIELDS.CompletedAt}}, "${dateEsc}", "day"),
      {${WC_FIELDS.AthleteToken}} = "${tokenEsc}"
    )`;

    const wcRows = await WorkoutCompletions.select({
      filterByFormula: wcFormula,
      maxRecords: 500,
    }).firstPage();

    const completionByWorkoutItemId = new Map();

    for (const r of wcRows || []) {
      const wf = r.fields || {};

      const athleteLinks = safeArray(wf[WC_FIELDS.Athlete]).map(String);
      if (athleteLinks.length && !athleteLinks.includes(String(athleteRecordId))) continue;

      const itemLinks = safeArray(wf[WC_FIELDS.WorkoutItem]).map(String);
      const itemId = String(itemLinks?.[0] || "").trim();
      if (!itemId) continue;

      const existing = completionByWorkoutItemId.get(itemId);
      if (!existing) {
        completionByWorkoutItemId.set(itemId, r);
        continue;
      }

      const exT = new Date(existing?.fields?.[WC_FIELDS.CompletedAt] || 0).getTime();
      const nxT = new Date(wf?.[WC_FIELDS.CompletedAt] || 0).getTime();
      if (!Number.isNaN(nxT) && nxT >= exT) completionByWorkoutItemId.set(itemId, r);
    }

    const items = hydrated.map((row, idx) => {
      const id = row.id;
      const it = row?.fields || {};

      const completionRec = completionByWorkoutItemId.get(id);
      const cf = completionRec?.fields || {};

      const completionStatus = statusNorm(cf[WC_FIELDS.Status] || "");
      const itemStatus = statusNorm(it.Status || "");
      const status = completionStatus || itemStatus || "";

      const reviewNote = String(cf[WC_FIELDS.ReviewNote] || "").trim();
      const athleteAcknowledged = toBool(cf[WC_FIELDS.AthleteAcknowledged]);
      const athleteAcknowledgedAt = String(cf[WC_FIELDS.AthleteAcknowledgedAt] || "").trim();

      const doneForAthlete = isAthleteDone(status, athleteAcknowledged);

      const attachmentSummary =
        String(cf[WC_FIELDS.AttachmentSummaryA] || "").trim() ||
        String(cf[WC_FIELDS.AttachmentSummaryB] || "").trim() ||
        "";

      const attachmentArr = safeArray(cf[WC_FIELDS.Attachment]);

      // ── EvidenceRequired: always return the canonical string, never a boolean.
      // This lets the client distinguish VARA from photo/video evidence.
      const evidenceRequired = normalizeEvidenceRequired(it.EvidenceRequired);

      return {
        id,
        missing: false,

        ExerciseName: it.ExerciseName || it.Title || it.Name || `Workout Item ${idx + 1}`,
        // Raw string value — client uses this to distinguish none/photo/video/vara
        EvidenceRequired: evidenceRequired,
        Sets: it.Sets ?? "",
        Reps: it.Reps ?? "",
        Weight: it.Weight ?? it.Load ?? "",
        RPE: it.RPE ?? "",
        Rest: it.Rest ?? "",
        Instructions: it.Instructions ?? "",
        VideoURL: it.VideoURL ?? it.Video ?? "",

        Completed: doneForAthlete ? "true" : "false",
        Status: status,

        CompletionStatus: completionStatus,
        ItemStatus: itemStatus,

        CompletedAt: cf[WC_FIELDS.CompletedAt] || "",
        CompletionId: completionRec?.id || "",

        Note: attachmentSummary || "",
        AttachmentSummary: attachmentSummary || "",
        Attachment: attachmentArr,
        ReviewNote: reviewNote,
        AthleteAcknowledged: athleteAcknowledged,
        AthleteAcknowledgedAt: athleteAcknowledgedAt,
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
      debug: {
        formula,
        linkedItemCount: linkedItemIds.length,
        hydratedCount: hydrated.length,
        wiFormula: wiFormula || null,
        wcFormula,
        workoutItemsTableId: process.env.WORKOUTITEMS_TABLE_ID,
      },
    });
  } catch (e) {
    console.error("[api/athlete/workouts/byDate] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}