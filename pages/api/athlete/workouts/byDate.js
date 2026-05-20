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

function normalizeEvidenceRequired(raw) {
  if (raw === true || raw === "true") return "photo";
  if (raw === false || raw === "false" || raw == null || raw === "") return "none";
  const s = String(raw).trim().toLowerCase();
  const known = ["none", "photo", "video", "photo_or_video", "voluntary_activity_vara"];
  return known.includes(s) ? s : "none";
}

const WC_FIELDS = {
  CompletedAt:           "CompletedAt",
  Athlete:               "Athlete",
  AthleteToken:          "AthleteToken",
  WorkoutItem:           "WorkoutItem",
  Status:                "Status",
  Attachment:            "Attachment",
  AttachmentSummaryA:    "AttachmentSummary",
  AttachmentSummaryB:    "Attachment Summary",
  ReviewNote:            "ReviewNote",
  AthleteAcknowledged:   "AthleteAcknowledged",
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
    auth?.user?.AthleteToken    ||
    auth?.user?.athleteToken    ||
    auth?.AthleteToken          ||
    auth?.athleteToken          ||
    "";
  const token = String(raw || "").trim();
  if (!token || !/^ATH-/i.test(token)) return "";
  return token;
}

function okNull(res, payload = {}) {
  return res.status(200).json({ dailyWorkout: null, items: [], dailyWorkouts: [], ...payload });
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
    const got = await WorkoutItemsTable.select({
      filterByFormula: `OR(${orParts})`,
      pageSize: 100,
    }).firstPage();
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

  const athleteToken = mustAthleteToken(auth);
  if (!athleteToken) {
    return okNull(res, {
      error: "Missing AthleteToken (ATH-XXXX) in auth session cookie.",
      stopRetry: true,
      debug: { cookieKeys: Object.keys(auth?.user || {}) },
    });
  }

  const athleteRecordId = String(auth?.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return okNull(res, {
      error: "Missing athlete record id in auth session.",
      stopRetry: true,
    });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );
  const DailyWorkouts     = base(process.env.DAILYWORKOUTS_TABLE_ID);
  const WorkoutItemsTable = base(process.env.WORKOUTITEMS_TABLE_ID);

  const wcBase = new Airtable({ apiKey: process.env.WORKOUTCOMPLETIONS_API_KEY }).base(
    process.env.WORKOUTCOMPLETIONS_BASE_ID
  );
  const WorkoutCompletions = wcBase(process.env.WORKOUTCOMPLETIONS_TABLE_ID);

  try {
    const dateEsc  = escapeAirtableString(isoDate);
    const tokenEsc = escapeAirtableString(athleteToken);

    const formula = `AND(IS_SAME({Date}, "${dateEsc}", "day"), {AthleteToken} = "${tokenEsc}")`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 10,
    }).firstPage();

    if (!rows?.length) {
      return okNull(res, {
        debug: { reason: "No match for date + AthleteToken", isoDate, athleteToken, formula },
      });
    }

    // ── Fetch all completions for this athlete + date in one call ─────────────
    const wcFormula = `AND(
      IS_SAME({${WC_FIELDS.CompletedAt}}, "${dateEsc}", "day"),
      {${WC_FIELDS.AthleteToken}} = "${tokenEsc}"
    )`;

    const wcRows = await WorkoutCompletions.select({
      filterByFormula: wcFormula,
      maxRecords: 500,
    }).firstPage();

    // Build completions map: workoutItemId → most recent completion record
    const completionByWorkoutItemId = new Map();
    for (const r of wcRows || []) {
      const wf = r.fields || {};

      const athleteLinks = safeArray(wf[WC_FIELDS.Athlete]).map(String);
      if (athleteLinks.length && !athleteLinks.includes(String(athleteRecordId))) continue;

      const itemLinks = safeArray(wf[WC_FIELDS.WorkoutItem]).map(String);
      const itemId    = String(itemLinks?.[0] || "").trim();
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

    // ── Process each DailyWorkout record ──────────────────────────────────────
    const allWorkouts = [];

    for (const rec of rows) {
      const f = rec.fields || {};

      // Hydrate items
      const linkedItemIds = safeArray(f.WorkoutItems).map(String).map(s => s.trim()).filter(Boolean);
      let hydrated = await hydrateWorkoutItemsByIds(WorkoutItemsTable, linkedItemIds);

      // Fallback: reverse-lookup by DailyWorkout link
      let wiFormula = "";
      if (!hydrated.length) {
        const dwIdEsc = escapeAirtableString(rec.id);
        wiFormula     = `FIND("${dwIdEsc}", ARRAYJOIN({DailyWorkout}&""))>0`;
        const wiRows  = await WorkoutItemsTable.select({
          filterByFormula: wiFormula,
          pageSize: 100,
        }).firstPage();
        hydrated = wiRows || [];
      }

      hydrated.sort((a, b) =>
        Number(a?.fields?.Order ?? 999999) - Number(b?.fields?.Order ?? 999999)
      );

      // Map items using shared completions map
      const items = hydrated.map((row, idx) => {
        const id = row.id;
        const it = row?.fields || {};

        const completionRec = completionByWorkoutItemId.get(id);
        const cf = completionRec?.fields || {};

        const completionStatus     = statusNorm(cf[WC_FIELDS.Status] || "");
        const itemStatus           = statusNorm(it.Status || "");
        const status               = completionStatus || itemStatus || "";
        const reviewNote           = String(cf[WC_FIELDS.ReviewNote] || "").trim();
        const athleteAcknowledged  = toBool(cf[WC_FIELDS.AthleteAcknowledged]);
        const athleteAcknowledgedAt= String(cf[WC_FIELDS.AthleteAcknowledgedAt] || "").trim();
        const doneForAthlete       = isAthleteDone(status, athleteAcknowledged);

        const attachmentSummary =
          String(cf[WC_FIELDS.AttachmentSummaryA] || "").trim() ||
          String(cf[WC_FIELDS.AttachmentSummaryB] || "").trim() ||
          "";

        const attachmentArr      = safeArray(cf[WC_FIELDS.Attachment]);
        const evidenceRequired   = normalizeEvidenceRequired(it.EvidenceRequired);

        return {
          id,
          missing: false,

          ExerciseName:     it.ExerciseName || it.Title || it.Name || `Workout Item ${idx + 1}`,
          EvidenceRequired: evidenceRequired,
          Sets:             it.Sets ?? "",
          Reps:             it.Reps ?? "",
          Weight:           it.Weight ?? it.Load ?? "",
          RPE:              it.RPE ?? "",
          Rest:             it.Rest ?? "",
          Instructions:     it.Instructions ?? "",
          VideoURL:         it.VideoURL ?? it.Video ?? "",
          groupId:          String(it.GroupId || "") || null,

          Completed:        doneForAthlete ? "true" : "false",
          Status:           status,
          CompletionStatus: completionStatus,
          ItemStatus:       itemStatus,
          CompletedAt:      cf[WC_FIELDS.CompletedAt] || "",
          CompletionId:     completionRec?.id || "",

          Note:               attachmentSummary || "",
          AttachmentSummary:  attachmentSummary || "",
          Attachment:         attachmentArr,
          ReviewNote:         reviewNote,
          AthleteAcknowledged:    athleteAcknowledged,
          AthleteAcknowledgedAt:  athleteAcknowledgedAt,
        };
      });

      allWorkouts.push({
        dailyWorkout: {
          id:           rec.id,
          Title:        f.Title  || "Daily Workout",
          Date:         f.Date   || isoDate,
          Status:       f.Status || "assigned",
          AthleteToken: f.AthleteToken || athleteToken,
          ScheduledTime:f.ScheduleTime || null,   // "HH:MM" text field
          ReviewStatus: normalizeTextValue(f.ReviewStatus)  || "pending",
          ReviewedNotes:normalizeTextValue(f.ReviewedNotes) || "",
        },
        items,
      });
    }

    // Sort workouts by scheduled time so morning comes before afternoon
    allWorkouts.sort((a, b) => {
      const ta = a.dailyWorkout.ScheduledTime || "99:99";
      const tb = b.dailyWorkout.ScheduledTime || "99:99";
      return ta.localeCompare(tb);
    });

    return res.status(200).json({
      // Backward-compat single-workout fields (first/primary workout)
      dailyWorkout: allWorkouts[0]?.dailyWorkout || null,
      items:        allWorkouts[0]?.items        || [],
      // All workouts for the day
      dailyWorkouts: allWorkouts,
      debug: {
        formula,
        workoutCount:   allWorkouts.length,
        wcFormula,
        workoutItemsTableId: process.env.WORKOUTITEMS_TABLE_ID,
      },
    });

  } catch (e) {
    console.error("[api/athlete/workouts/byDate] error:", e);
    return res.status(500).json({ error: "Failed to load workout." });
  }
}