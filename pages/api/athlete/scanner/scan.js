// pages/api/athlete/scanner/scan.js
//
// Mobile supplement scanner endpoint.
// Accepts multipart image → calls Textract OCR → calls /api/check → returns results.
// Same _authUser cookie fallback pattern as completeItem.js.

import formidable from "formidable";
import fs         from "fs";
import { requireAthlete } from "@/lib/requireAthlete";

export const config = { api: { bodyParser: false } };

function asString(v) { return String(v ?? "").trim(); }

function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22")
      ? decodeURIComponent(raw) : raw;
    JSON.parse(decoded);
    return false;
  } catch { return true; }
}

function injectAuthFromField(req, field) {
  if (!field) return;
  req.cookies        = req.cookies || {};
  req.cookies.user   = field;
  req.headers        = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(field)}`;
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function deleteTempFile(path) {
  try { if (path) fs.unlinkSync(path); } catch {}
}

// Build internal base URL — works on local dev and Vercel production
function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "www.checkpeak.com";
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ── Parse multipart FIRST (same pattern as completeItem.js) ──────────────
  let fields, files;
  try {
    ({ fields, files } = await parseMultipart(req));
  } catch (e) {
    return res.status(400).json({ ok: false, error: `Could not parse upload: ${e.message}` });
  }

  const getValue = (key) => { const v = fields[key]; return Array.isArray(v) ? v[0] : (v ?? ""); };
  const getFile  = (key) => { const v = files[key];  return Array.isArray(v) ? v[0] : (v ?? null); };

  // ── Auth fallback for React Native ───────────────────────────────────────
  if (cookieMissingOrBroken(req)) {
    const authField = asString(getValue("_authUser") || getValue("authUser"));
    if (authField) injectAuthFromField(req, authField);
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ ok: false, error: auth?.error || "Unauthorized" });
  }

  const imageFile = getFile("image") || getFile("photo");
  if (!imageFile?.filepath) {
    return res.status(400).json({ ok: false, error: "Image is required" });
  }

  const base = siteUrl(req);
  let imageBuffer;
  try {
    imageBuffer = fs.readFileSync(imageFile.filepath);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Could not read uploaded image" });
  } finally {
    deleteTempFile(imageFile.filepath);
  }

  // ── Step 1: OCR via Textract ──────────────────────────────────────────────
  let extractedText = "";
  try {
    const ocrRes = await fetch(`${base}/api/ocr/textract`, {
      method:  "POST",
      headers: { "Content-Type": imageFile.mimetype || "image/jpeg" },
      body:    imageBuffer,
    });

    if (!ocrRes.ok) {
      const err = await ocrRes.json().catch(() => ({}));
      return res.status(500).json({ ok: false, error: err?.error || `OCR failed (${ocrRes.status})` });
    }

    const ocrData = await ocrRes.json();
    extractedText = String(ocrData?.text ?? "").trim();
  } catch (e) {
    return res.status(500).json({ ok: false, error: `OCR service error: ${e.message}` });
  }

  if (!extractedText) {
    return res.status(200).json({
      ok:               true,
      found:            false,
      text:             "",
      bannedSubstances: [],
      ingredients:      [],
      productName:      null,
      message:          "No text detected. Try taking a clearer photo, closer to the ingredients panel.",
    });
  }

  // ── Step 2: Check against banned substance database ───────────────────────
  try {
    const checkRes = await fetch(`${base}/api/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        text:      extractedText,
        userEmail: asString(auth.athlete?.email || auth.user?.email || ""),
      }),
    });

    const checkData = await checkRes.json().catch(() => ({}));

    if (!checkData?.found) {
      return res.status(200).json({
        ok:               true,
        found:            false,
        text:             extractedText,
        bannedSubstances: [],
        ingredients:      [],
        productName:      checkData?.productName || null,
        message:          "No substances matched in the database.",
      });
    }

    return res.status(200).json({
      ok:               true,
      found:            true,
      text:             extractedText,
      productName:      checkData.productName      || null,
      bannedSubstances: checkData.matchedBanned    || checkData.bannedSubstances || [],
      ingredients:      checkData.matchedIngredients || checkData.ingredients    || [],
      bannedDetails:    checkData.bannedDetails    || null,
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: `Check service error: ${e.message}` });
  }
}