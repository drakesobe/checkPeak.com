// pages/api/athlete/class/complete.js
// POST multipart/form-data { classId, classTitle, date, note?, photo, _authUser? }
// Uploads photo to Cloudinary, upserts class_attendance row in Supabase.

import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

export const config = { api: { bodyParser: false } };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

function asString(v) { return String(v ?? "").trim(); }
function isISODateOnly(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()); }

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024,
      keepExtensions: true,
      filter: ({ mimetype }) => Boolean(mimetype?.startsWith("image/")),
    });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function uploadToCloudinary(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function deleteTempFile(filePath) {
  try { if (filePath) fs.unlinkSync(filePath); } catch {}
}

function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;
    JSON.parse(decoded);
    return false;
  } catch { return true; }
}

function injectAuthFromField(req, authUserField) {
  if (!authUserField) return;
  req.cookies        = req.cookies || {};
  req.cookies.user   = authUserField;
  req.headers        = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(authUserField)}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (e) {
    return res.status(400).json({ ok: false, error: `Could not parse upload: ${e.message}` });
  }

  const getValue = (key) => {
    const v = fields[key];
    return Array.isArray(v) ? v[0] : (v ?? "");
  };
  const getFile = (key) => {
    const v = files[key];
    return Array.isArray(v) ? v[0] : (v ?? null);
  };

  if (cookieMissingOrBroken(req)) {
    const authUserField = asString(getValue("_authUser") || getValue("authUser"));
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ ok: false, error: auth?.error || "Unauthorized" });
  }

  const athleteToken =
    asString(auth?.athlete?.AthleteToken) ||
    asString(auth?.athlete?.athleteToken) ||
    asString(auth?.user?.AthleteToken)    ||
    asString(auth?.user?.athleteToken);

  const athleteEmail = asString(
    auth?.athlete?.email || auth?.athlete?.Email ||
    auth?.user?.email   || auth?.user?.Email
  );

  const orgToken = asString(
    auth?.athlete?.OrgToken || auth?.athlete?.orgToken ||
    auth?.user?.OrgToken   || auth?.user?.orgToken    ||
    auth?.athlete?.Token   || auth?.user?.Token        || ""
  );

  const classId    = asString(getValue("classId"));
  const classTitle = asString(getValue("classTitle"));
  const date       = asString(getValue("date"));
  const note       = asString(getValue("note"));
  const photoFile  = getFile("photo");

  if (!isISODateOnly(date)) {
    deleteTempFile(photoFile?.filepath);
    return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" });
  }
  if (!photoFile?.filepath) {
    return res.status(400).json({ ok: false, error: "photo is required" });
  }

  // 1. Resolve athlete record from Supabase
  let athlete = null;
  try {
    let query = db.from("athletes").select("id, athlete_token");
    if (athleteToken) {
      query = query.eq("athlete_token", athleteToken);
    } else if (athleteEmail) {
      query = query.eq("email", athleteEmail.toLowerCase());
    } else {
      deleteTempFile(photoFile.filepath);
      return res.status(401).json({ ok: false, error: "Athlete token/email missing from session." });
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    athlete = data;
  } catch (e) {
    deleteTempFile(photoFile.filepath);
    return res.status(500).json({ ok: false, error: `Athlete lookup failed: ${e.message}` });
  }

  if (!athlete?.id) {
    deleteTempFile(photoFile.filepath);
    return res.status(404).json({ ok: false, error: "Athlete record not found." });
  }

  const resolvedToken = asString(athlete.athlete_token) || athleteToken;

  // 2. Upload photo to Cloudinary
  let cloudResult;
  try {
    const safeToken = resolvedToken.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeClass = (classId || "class").replace(/[^a-zA-Z0-9_-]/g, "_");
    const monthDir  = date.slice(0, 7);

    cloudResult = await uploadToCloudinary(photoFile.filepath, {
      folder:         `athlete-class-attendance/${safeToken}/${monthDir}`,
      public_id:      `${safeToken}_${safeClass}_${date}`,
      overwrite:      true,
      resource_type:  "image",
      transformation: [
        { width: 1280, height: 960, crop: "limit" },
        { quality: "auto:good" },
        { fetch_format: "auto" },
      ],
      tags: ["class-attendance", safeToken, date],
    });
  } catch (e) {
    deleteTempFile(photoFile.filepath);
    return res.status(500).json({ ok: false, error: `Photo upload failed: ${e.message}` });
  } finally {
    deleteTempFile(photoFile.filepath);
  }

  // 3. Upsert attendance record in Supabase
  try {
    const { data: saved, error } = await db
      .from("class_attendance")
      .upsert({
        athlete_token: resolvedToken,
        athlete_id:    athlete.id,
        class_id:      classId,
        class_title:   classTitle,
        attended_at:   date,
        photo_url:     cloudResult.secure_url,
        public_id:     cloudResult.public_id,
        org_token:     orgToken || null,
        coach_notes:   note || null,
        updated_at:    new Date().toISOString(),
      }, { onConflict: "athlete_token,class_id,attended_at" })
      .select("id")
      .single();

    if (error) throw error;

    return res.status(200).json({
      ok:           true,
      date,
      classId,
      classTitle,
      noteReceived: Boolean(note),
      recordId:     saved?.id,
      photoUrl:     cloudResult.secure_url,
      athleteId:    athlete.id,
    });
  } catch (e) {
    console.error("[class/complete] Supabase write failed:", e?.message);
    return res.status(500).json({
      ok:       false,
      error:    `Attendance photo uploaded but database write failed: ${e.message}`,
      photoUrl: cloudResult?.secure_url,
    });
  }
}
