// pages/api/athlete/workouts/completeItem.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/**
 * IMPORTANT:
 * - Airtable Attachments require a PUBLIC URL. Raw file uploads won't work without an uploader (Cloudinary/S3/etc).
 * - This endpoint supports:
 *    1) JSON: { workoutItemId, fileUrl, note, date }
 *    2) multipart/form-data (OPTIONAL): workoutItemId, note, date, file
 *       - Only works if you install `formidable` and implement an uploader.
 */

// If you later install formidable, this enables multipart parsing in pages/api
export const config = {
  api: {
    bodyParser: true, // we will disable dynamically only when parsing multipart
  },
};

function nyTodayISO() {
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

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function parseJsonMaybe(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function dedupeAttachmentUrls(attArr) {
  const seen = new Set();
  const out = [];
  for (const a of safeArray(attArr)) {
    const url = String(a?.url || "").trim();
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(a);
  }
  return out;
}

async function readJsonBody(req) {
  // Next.js pages/api with bodyParser:true will populate req.body for JSON
  const body = req.body || {};
  return {
    workoutItemId: String(body.workoutItemId || "").trim(),
    fileUrl: String(body.fileUrl || "").trim(),
    note: String(body.note || "").trim(),
    date: String(body.date || "").trim(),
  };
}

async function readMultipartBody(req) {
  // Optional path if you install formidable:
  // npm i formidable
  // AND add: export const config = { api: { bodyParser: false } }
  //
  // Since your current repo may not have it, we try to require it safely.
  let formidable;
  try {
    // eslint-disable-next-line global-require
    formidable = require("formidable");
  } catch {
    return { _multipartUnsupported: true };
  }

  return new Promise((resolve) => {
    const form = formidable.default
      ? formidable.default({ multiples: false })
      : formidable({ multiples: false });

    form.parse(req, (err, fields, files) => {
      if (err) {
        resolve({ _multipartError: err });
        return;
      }

      const workoutItemId = String(fields?.workoutItemId || "").trim();
      const note = String(fields?.note || "").trim();
      const date = String(fields?.date || "").trim();

      // `file` exists but is not uploadable to Airtable unless you upload it somewhere and get a URL back.
      const file = files?.file || null;

      resolve({
        workoutItemId,
        file,
        note,
        date,
      });
    });
  });
}

function getContentType(req) {
  return String(req.headers["content-type"] || "").toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !process.env.DAILYWORKOUTS_API_KEY ||
    !process.env.DAILYWORKOUTS_BASE_ID ||
    !process.env.DAILYWORKOUTS_TABLE_ID
  ) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable not configured.",
      missing: {
        DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
        DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
        DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
      },
    });
  }

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const athleteRecordId = String(auth.athlete?.id || "").trim();
  if (!athleteRecordId) {
    return res.status(400).json({
      error:
        "Missing athleteId in auth cookie. Add athleteId (AthleteScans record id) to cookie user payload.",
    });
  }

  const ct = getContentType(req);

  // Read body (JSON default; multipart optional)
  let workoutItemId = "";
  let fileUrl = "";
  let note = "";
  let date = "";

  // If multipart, we need bodyParser disabled.
  // Since config is static, we can't flip it per-request — so we only *attempt*
  // multipart parsing for future use if you switch config to bodyParser:false.
  if (ct.includes("multipart/form-data")) {
    const mp = await readMultipartBody(req);

    if (mp?._multipartUnsupported) {
      return res.status(400).json({
        error:
          "Multipart upload not supported on this server yet. For now, submit JSON with a hosted fileUrl (Cloudinary/S3/etc).",
      });
    }

    if (mp?._multipartError) {
      return res.status(400).json({ error: "Failed to parse multipart form-data." });
    }

    workoutItemId = String(mp.workoutItemId || "").trim();
    note = String(mp.note || "").trim();
    date = String(mp.date || "").trim();

    // You MUST upload the file somewhere and set fileUrl from that upload result.
    // Keeping fileUrl empty here prevents false “uploaded” states.
    fileUrl = "";
  } else {
    const b = await readJsonBody(req);
    workoutItemId = b.workoutItemId;
    fileUrl = b.fileUrl;
    note = b.note;
    date = b.date;
  }

  if (!workoutItemId) {
    return res.status(400).json({ error: "workoutItemId is required" });
  }

  // Optional date targeting (for day navigation)
  const targetDate = isISODate(date) ? date : nyTodayISO();

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);

  try {
    const formula = `AND(
      IS_SAME({Date}, "${targetDate}", "day"),
      FIND("${athleteRecordId}", ARRAYJOIN({Athlete}&""))
    )`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 1,
    }).firstPage();

    if (!rows?.length) {
      return res.status(404).json({ error: "No daily workout found for that date." });
    }

    const rec = rows[0];
    const f = rec.fields || {};

    const existingSummaryRaw = String(f["Attachment Summary"] || "").trim();
    const existingSummary = parseJsonMaybe(existingSummaryRaw);
    const summaryList = Array.isArray(existingSummary) ? existingSummary : [];

    // Overwrite completion for this item
    const nextSummary = summaryList.filter(
      (x) => String(x?.workoutItemId || "").trim() !== workoutItemId
    );

    const completionEvent = {
      workoutItemId,
      fileUrl: fileUrl || "",
      note: note || "",
      at: new Date().toISOString(),
    };
    nextSummary.push(completionEvent);

    // Attachments: dedupe urls; only add if we have a URL
    const existingAttachments = dedupeAttachmentUrls(safeArray(f.Attachments));
    let nextAttachments = [...existingAttachments];

    if (fileUrl) {
      const already = nextAttachments.some((a) => String(a?.url || "") === fileUrl);
      if (!already) {
        nextAttachments.push({
          url: fileUrl,
          filename: `workout_${workoutItemId}.jpg`,
        });
      }
    }

    // Optional: mark workout completed when all items completed
    const workoutItemIds = safeArray(f.WorkoutItems).map((x) => String(x || "").trim()).filter(Boolean);
    const completedIds = new Set(nextSummary.map((x) => String(x?.workoutItemId || "").trim()).filter(Boolean));
    const allDone = workoutItemIds.length > 0 && workoutItemIds.every((id) => completedIds.has(id));

    const updateFields = {
      Attachments: nextAttachments,
      "Attachment Summary": JSON.stringify(nextSummary),
    };

    if (allDone) {
      updateFields.Status = "completed";
    }

    await DailyWorkouts.update(rec.id, updateFields);

    return res.status(200).json({
      ok: true,
      date: targetDate,
      workoutId: rec.id,
      workoutItemId,
      completion: completionEvent,
      allDone,
    });
  } catch (e) {
    console.error("[api/athlete/workouts/completeItem] error:", e);
    return res.status(500).json({ error: "Failed to submit completion." });
  }
}
