// pages/api/athlete/class/complete.js
//
// Records class attendance with a photo proof.
//
// Flow:
//   1. Parse multipart form (photo file + metadata)
//   2. Upload photo to Cloudinary (athlete-class-attendance folder)
//   3. Upsert attendance record in Airtable ClassAttendance table
//
// ── Airtable: ClassAttendance table ──────────────────────────────────────────
// Create this table in your Athlete base (same base as AthleteScans) with
// the following fields:
//
//   AthleteToken  — Single line text        (for filtering — same pattern as NutritionCompletions)
//   Athlete       — Link to AthleteScans    (relational integrity)
//   ClassId       — Single line text        (the class schedule ID from useClassSchedules)
//   ClassTitle    — Single line text
//   Date          — Date                    (the YYYY-MM-DD date of attendance)
//   PhotoUrl      — URL                     (Cloudinary secure_url)
//   PublicId      — Single line text        (Cloudinary public_id — for deletion/replacement)
//   AttendedAt    — Date with time          (server timestamp of submission)
//
// Set env var:
//   CLASS_ATTENDANCE_TABLE=ClassAttendance   (or your Airtable table ID)
//
// ─────────────────────────────────────────────────────────────────────────────

import Airtable  from "airtable";
import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { requireAthlete } from "@/lib/requireAthlete";

// ── Next.js: disable built-in body parser so formidable can handle the stream
export const config = { api: { bodyParser: false } };

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ── Airtable config ───────────────────────────────────────────────────────────
const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;
const ATTENDANCE_TABLE   = process.env.CLASS_ATTENDANCE_TABLE || "ClassAttendance";

// Field names — must match your Airtable columns exactly
const F_TOKEN      = "AthleteToken";
const F_ATHLETE    = "Athlete";       // linked record
const F_CLASS_ID   = "ClassId";
const F_CLASS_TITLE= "ClassTitle";
const F_DATE       = "Date";
const F_PHOTO_URL  = "PhotoUrl";
const F_PUBLIC_ID  = "PublicId";
const F_ATTENDED_AT= "AttendedAt";

const ATH_TOKEN    = "AthleteToken";
const ATH_EMAIL    = "Email";

// ── Helpers ───────────────────────────────────────────────────────────────────
function asString(v) { return String(v ?? "").trim(); }

function escapeAirtable(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

// Parse multipart form using formidable
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
      filter: ({ mimetype }) => Boolean(mimetype?.startsWith("image/")),
    });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// Upload a local temp file to Cloudinary and return the result
function uploadToCloudinary(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Clean up formidable temp file — non-fatal
function deleteTempFile(filePath) {
  try { if (filePath) fs.unlinkSync(filePath); } catch {}
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ ok: false, error: auth?.error || "Unauthorized" });
  }

  const athleteToken =
    asString(auth?.athlete?.AthleteToken) ||
    asString(auth?.athlete?.athleteToken) ||
    asString(auth?.user?.AthleteToken)    ||
    asString(auth?.user?.athleteToken);

  const athleteEmail =
    asString(auth?.athlete?.Email || auth?.athlete?.email ||
             auth?.user?.Email   || auth?.user?.email);

  // ── Parse multipart form ───────────────────────────────────────────────────
  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (e) {
    return res.status(400).json({ ok: false, error: `Could not parse upload: ${e.message}` });
  }

  // formidable v3 returns arrays for all values
  const getValue = (key) => {
    const v = fields[key];
    return Array.isArray(v) ? v[0] : (v ?? "");
  };
  const getFile = (key) => {
    const v = files[key];
    return Array.isArray(v) ? v[0] : (v ?? null);
  };

  const classId    = asString(getValue("classId"));
  const classTitle = asString(getValue("classTitle"));
  const date       = asString(getValue("date"));
  const photoFile  = getFile("photo");

  if (!isISODateOnly(date)) {
    return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" });
  }
  if (!photoFile?.filepath) {
    return res.status(400).json({ ok: false, error: "photo is required" });
  }

  // ── Airtable setup ─────────────────────────────────────────────────────────
  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    deleteTempFile(photoFile.filepath);
    return res.status(500).json({ ok: false, error: "Athlete Airtable not configured." });
  }

  const athleteBase    = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);
  const attendanceTable = athleteBase(ATTENDANCE_TABLE);

  // ── 1. Resolve athlete record ──────────────────────────────────────────────
  let athleteRec = null;
  try {
    const filter = athleteToken
      ? `FIND('${escapeAirtable(athleteToken)}', ARRAYJOIN({${ATH_TOKEN}}&''))`
      : `LOWER({${ATH_EMAIL}}&'')='${escapeAirtable(athleteEmail.toLowerCase())}'`;

    const found = await athleteBase(ATHLETE_TABLE_NAME)
      .select({ filterByFormula: filter, maxRecords: 1 })
      .firstPage();
    athleteRec = found?.[0] || null;
  } catch (e) {
    deleteTempFile(photoFile.filepath);
    return res.status(500).json({ ok: false, error: `Athlete lookup failed: ${e.message}` });
  }

  if (!athleteRec?.id) {
    deleteTempFile(photoFile.filepath);
    return res.status(404).json({ ok: false, error: "Athlete record not found." });
  }

  const resolvedToken = asString(athleteRec.fields?.[ATH_TOKEN]) || athleteToken;

  // ── 2. Upload photo to Cloudinary ──────────────────────────────────────────
  let cloudResult;
  try {
    // Folder: athlete-class-attendance/{athleteToken}/{YYYY-MM}/
    // public_id: {athleteToken}_{classId}_{date} — deterministic so re-submitting
    // the same class on the same day replaces the photo rather than duplicating
    const safeToken = resolvedToken.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeClass = (classId || "class").replace(/[^a-zA-Z0-9_-]/g, "_");
    const monthDir  = date.slice(0, 7); // "YYYY-MM"

    cloudResult = await uploadToCloudinary(photoFile.filepath, {
      folder:             `athlete-class-attendance/${safeToken}/${monthDir}`,
      public_id:          `${safeToken}_${safeClass}_${date}`,
      overwrite:          true,     // replace if same class re-submitted same day
      resource_type:      "image",
      transformation:     [
        { width: 1280, height: 960, crop: "limit" }, // cap size — full res unnecessary
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
      tags:               ["class-attendance", safeToken, date],
    });
  } catch (e) {
    deleteTempFile(photoFile.filepath);
    return res.status(500).json({ ok: false, error: `Photo upload failed: ${e.message}` });
  } finally {
    deleteTempFile(photoFile.filepath);
  }

  // ── 3. Upsert attendance record in Airtable ────────────────────────────────
  // FIX: Filter by AthleteToken text field (not linked record FIND) —
  // same pattern as the NutritionCompletions fix. ARRAYJOIN on a linked
  // record returns display names, not IDs, so FIND would never match.
  const isoMidDay   = `${date}T12:00:00.000Z`;
  const safeToken   = escapeAirtable(resolvedToken);
  const safeClassId = escapeAirtable(classId);

  const filter = `AND(
    {${F_TOKEN}}  = '${safeToken}',
    {${F_CLASS_ID}} = '${safeClassId}',
    IS_SAME({${F_DATE}}, '${isoMidDay}', 'day')
  )`;

  try {
    const existing = await attendanceTable
      .select({ filterByFormula: filter, maxRecords: 1 })
      .firstPage()
      .then(xs => xs?.[0] || null);

    const fields = {
      [F_TOKEN]:       resolvedToken,
      [F_ATHLETE]:     [athleteRec.id],
      [F_CLASS_ID]:    classId,
      [F_CLASS_TITLE]: classTitle,
      [F_DATE]:        isoMidDay,
      [F_PHOTO_URL]:   cloudResult.secure_url,
      [F_PUBLIC_ID]:   cloudResult.public_id,
      [F_ATTENDED_AT]: new Date().toISOString(),
    };

    const saved = existing?.id
      ? await attendanceTable.update(existing.id, fields)
      : await attendanceTable.create(fields);

    return res.status(200).json({
      ok:         true,
      date,
      classId,
      classTitle,
      recordId:   saved?.id,
      photoUrl:   cloudResult.secure_url,
      athleteId:  athleteRec.id,
    });

  } catch (e) {
    // Attendance recorded if Cloudinary succeeded — log but don't fail hard
    console.error("[class/complete] Airtable write failed:", e?.message);
    return res.status(500).json({
      ok:       false,
      error:    `Attendance photo uploaded but database write failed: ${e.message}`,
      photoUrl: cloudResult?.secure_url,
      airtable: { statusCode: e?.statusCode },
    });
  }
}