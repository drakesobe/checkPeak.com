// pages/api/athlete/scanner/scan.js
//
// Mobile supplement scanner endpoint.
// Accepts a multipart label photo, reads it with Claude vision, and checks it against the banned database.
// Same _authUser cookie fallback pattern as completeItem.js.

import formidable from "formidable";
import fs         from "fs";
import { requireAthlete } from "@/lib/requireAthlete";
import { extractLabel } from "@/lib/labelVision";
import { checkLabel, saveScan, getSupplementData, BANNED_LIST_MISSING } from "@/lib/supplementCheck";
import { hourlyLimit } from "@/lib/ratelimiter";

const SUPPORTED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

  const data = await getSupplementData();
  if (!data) return res.status(503).json({ ok: false, error: BANNED_LIST_MISSING });
  if (!hourlyLimit(req, res, "label-scan-mobile", 60)) return;

  let imageBuffer;
  try {
    imageBuffer = fs.readFileSync(imageFile.filepath);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Could not read uploaded image" });
  } finally {
    deleteTempFile(imageFile.filepath);
  }

  const mediaType = SUPPORTED_MEDIA.includes(imageFile.mimetype) ? imageFile.mimetype : "image/jpeg";

  let extraction;
  try {
    extraction = await extractLabel([{ data: imageBuffer.toString("base64"), mediaType }]);
  } catch (e) {
    console.error("[athlete/scanner/scan] extraction failed:", e);
    return res.status(502).json({ ok: false, error: "We couldn't read the label right now. Please try again." });
  }

  if (!extraction.readable) {
    return res.status(200).json({
      ok:               true,
      found:            false,
      text:             "",
      bannedSubstances: [],
      ingredients:      [],
      productName:      extraction.product_name,
      message:          extraction.unreadable_reason || "No ingredient list found. Take a clear photo of the ingredients panel.",
    });
  }

  const result = checkLabel(extraction, data);
  const productName = [extraction.brand, extraction.product_name].filter(Boolean).join(" ") || null;

  await saveScan({
    email:           asString(auth.athlete?.email || auth.user?.email || "").toLowerCase(),
    productName,
    ingredientsText: result.ingredientsText,
    bannedDetails:   result.bannedDetails,
  });

  return res.status(200).json({
    ok:                   true,
    found:                true,
    text:                 result.ingredientsText,
    productName,
    bannedSubstances:     result.matchedBanned,
    ingredients:          result.matchedIngredients,
    bannedDetails:        result.bannedDetails,
    verdict:              result.verdict,
    extractedIngredients: result.ingredients,
    certifications:       extraction.certifications,
  });
}