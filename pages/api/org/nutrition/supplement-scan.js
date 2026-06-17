// pages/api/org/nutrition/supplement-scan.js
//
// Org-side banned substance scanner for SmartStack products.
//
// Flow:
//   1. nutritionLabelUrl present → fetch image → Textract OCR → /api/check
//   2. No label → return caution (name-only scanning produces false positives)
//
// Uses /api/check (same engine as pages/ocr.js) - synonyms are phrase-matched
// only, not tokenized, which avoids false positives like "Other Anti-estrogens"
// matching on generic words in product names.

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "www.checkpeak.com";
  return `${proto}://${host}`;
}

// Formats AWS Textract accepts for DetectDocumentText
const TEXTRACT_SUPPORTED = ["image/jpeg", "image/jpg", "image/png", "image/tiff", "application/pdf"];

function isTextractSupported(contentType = "") {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  return TEXTRACT_SUPPORTED.includes(ct);
}

async function fetchImageBuffer(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CheckPeak/1.0)",
      // Explicitly exclude WebP/AVIF - Textract doesn't support them.
      // CDNs respect this and serve JPEG/PNG when available.
      "Accept": "image/jpeg,image/png,image/tiff,application/pdf,image/*;q=0.5",
    },
  });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const ct = (res.headers.get("content-type") || "").split(";")[0].trim();
  if (!ct.startsWith("image/") && ct !== "application/pdf") {
    throw new Error("URL does not point to an image");
  }
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: ct };
}

async function ocrWithTextract(base, imageBuffer, contentType) {
  const res = await fetch(`${base}/api/ocr/textract`, {
    method:  "POST",
    headers: { "Content-Type": contentType || "image/jpeg" },
    body:    imageBuffer,
  });
  if (!res.ok) throw new Error(`Textract failed (${res.status})`);
  const data = await res.json();
  return String(data?.text ?? "").trim();
}

async function runCheck(base, text) {
  const res = await fetch(`${base}/api/check`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`check failed (${res.status})`);
  return await res.json();
}

// Mirrors the ProhibitedCount / LimitedCount split in /api/check.js line 734.
// "prohibited", "in-competition", "banned" → hard ban → flagged
// "limited", "threshold", "out of competition", "monitored", or blank → soft → caution
function banSeverity(b) {
  const bt = String(b.fields?.["Ban Type"] || "").toLowerCase();
  if (bt.includes("prohibited") || bt.includes("in-competition") || bt.includes("banned")) return "hard";
  return "soft";
}

function formatFlag(b) {
  const name    = b.fields?.["Substance Name"] || "Unknown substance";
  const banType = b.fields?.["Ban Type"]       || "";
  const by      = b.fields?.["Banned By"]      || "";
  const limit   = b.fields?.["Dosage Limit"]   || "";
  const extras  = [banType, by, limit].filter(Boolean).join(", ");
  return extras ? `${name} - ${extras}` : name;
}

function formatResponse(checkData, source) {
  // /api/check returns matchedBanned; /api/check-smartstack used bannedSubstances
  const banned = Array.isArray(checkData?.matchedBanned) ? checkData.matchedBanned
               : Array.isArray(checkData?.bannedSubstances) ? checkData.bannedSubstances
               : [];

  const hardBanned = banned.filter((b) => banSeverity(b) === "hard");
  const softBanned = banned.filter((b) => banSeverity(b) === "soft");

  if (hardBanned.length > 0) {
    return {
      status:  "flagged",
      summary: "Banned substance detected - do not prescribe to athlete",
      flags:   hardBanned.map(formatFlag),
      source,
    };
  }

  if (softBanned.length > 0) {
    return {
      status:  "caution",
      summary: "Contains monitored or limited substances - verify with athlete's governing body",
      flags:   softBanned.map(formatFlag),
      source,
    };
  }

  return {
    status:  "clear",
    summary: source === "label"
      ? "No flags detected - label scanned against your banned substance database"
      : "No flags detected against your banned substance database (name-based scan)",
    flags: [],
    source,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productName, category, nutritionLabelUrl } = req.body || {};

  if (!productName) {
    return res.status(400).json({ error: "productName is required" });
  }

  const base = siteUrl(req);

  // ── Path 1: Nutrition label URL → OCR → proprietary scan ──────────────────
  // check-smartstack is built for ingredient list text, not product names.
  // Only run it when we have actual label text from Textract.
  if (nutritionLabelUrl) {
    try {
      const { buffer, contentType } = await fetchImageBuffer(nutritionLabelUrl);

      if (!isTextractSupported(contentType)) {
        return res.status(200).json({
          status:  "caution",
          summary: `Label is ${contentType} - Textract requires JPEG or PNG. Update the label URL in SmartStack.`,
          flags:   [],
          source:  "label-unsupported-format",
        });
      }

      const ocrText = await ocrWithTextract(base, buffer, contentType);

      if (ocrText) {
        const checkData = await runCheck(base, ocrText);
        return res.status(200).json(formatResponse(checkData, "label"));
      }

      // Textract read the image but found no text (e.g. image is a photo, not a clean label)
      return res.status(200).json({
        status:  "caution",
        summary: "Could not extract text from label - review ingredients manually before prescribing",
        flags:   [],
        source:  "label-ocr-empty",
      });
    } catch (err) {
      console.warn("[supplement-scan] Label OCR failed:", err.message);
      return res.status(200).json({
        status:  "caution",
        summary: "Could not read nutrition label - review ingredients manually before prescribing",
        flags:   [],
        source:  "label-error",
      });
    }
  }

  // ── Path 2: No label on file ───────────────────────────────────────────────
  // Running check-smartstack against a product name produces false positives
  // because the matcher is tuned for ingredient list text. Return caution and
  // prompt the coach to add the nutrition label URL to SmartStack instead.
  return res.status(200).json({
    status:  "caution",
    summary: "No nutrition label on file - add a label to SmartStack for a full ingredient scan",
    flags:   [],
    source:  "no-label",
  });
}
