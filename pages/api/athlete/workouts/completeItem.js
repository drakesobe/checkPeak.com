// pages/api/athlete/workouts/completeItem.js
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

function parseJsonMaybe(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.DAILYWORKOUTS_API_KEY || !process.env.DAILYWORKOUTS_BASE_ID || !process.env.DAILYWORKOUTS_TABLE_ID) {
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

  const workoutItemId = String(req.body?.workoutItemId || "").trim();
  const fileUrl = String(req.body?.fileUrl || "").trim();
  const note = String(req.body?.note || "").trim();

  if (!workoutItemId) {
    return res.status(400).json({ error: "workoutItemId is required" });
  }

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );
  const DailyWorkouts = base(process.env.DAILYWORKOUTS_TABLE_ID);

  const today = nyDateISO();

  try {
    const formula = `AND(
      IS_SAME({Date}, "${today}", "day"),
      FIND("${athleteRecordId}", ARRAYJOIN({Athlete}&""))
    )`;

    const rows = await DailyWorkouts.select({
      filterByFormula: formula,
      maxRecords: 1,
    }).firstPage();

    if (!rows?.length) {
      return res.status(404).json({ error: "No daily workout found for today." });
    }

    const rec = rows[0];
    const f = rec.fields || {};

    const existingSummaryRaw = String(f["Attachment Summary"] || "").trim();
    const existingSummary = parseJsonMaybe(existingSummaryRaw);
    const summaryList = Array.isArray(existingSummary) ? existingSummary : [];

    // Replace any prior completion for this item (so re-submits overwrite)
    const nextSummary = summaryList.filter(
      (x) => String(x?.workoutItemId || "").trim() !== workoutItemId
    );

    nextSummary.push({
      workoutItemId,
      fileUrl: fileUrl || "",
      note: note || "",
      at: new Date().toISOString(),
    });

    const existingAttachments = safeArray(f.Attachments);
    const nextAttachments = [...existingAttachments];

    // Airtable attachments require URL. True camera upload needs Cloudinary/S3 later.
    if (fileUrl) {
      nextAttachments.push({
        url: fileUrl,
        filename: `workout_${workoutItemId}.jpg`,
      });
    }

    await DailyWorkouts.update(rec.id, {
      Attachments: nextAttachments,
      "Attachment Summary": JSON.stringify(nextSummary),
      // Status: "completed", // optional later (only when all items done)
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[api/athlete/workouts/completeItem] error:", e);
    return res.status(500).json({ error: "Failed to submit completion." });
  }
}
