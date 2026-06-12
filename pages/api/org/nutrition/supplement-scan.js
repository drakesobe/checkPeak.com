// pages/api/org/nutrition/supplement-scan.js
//
// Org-side banned substance scanner for SmartStack products.
//
// Flow:
//   1. If nutritionLabelUrl is provided → fetch image → Textract OCR → check-smartstack
//   2. Otherwise → check-smartstack with productName + category as text
//
// Calls existing proprietary endpoints:
//   /api/ocr/textract       (AWS Textract - returns { text })
//   /api/check-smartstack   (banned DB match - returns { bannedSubstances, ingredients })

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "www.checkpeak.com";
  return `${proto}://${host}`;
}

async function fetchImageBuffer(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CheckPeak/1.0)",
      "Accept":     "image/webp,image/avif,image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) throw new Error("URL does not point to an image");
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

async function runCheckSmartstack(base, ingredientsText) {
  const res = await fetch(`${base}/api/check-smartstack`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ingredientsText }),
  });
  if (!res.ok) throw new Error(`check-smartstack failed (${res.status})`);
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
  return extras ? `${name} — ${extras}` : name;
}

function formatResponse(checkData, source) {
  const banned = Array.isArray(checkData?.bannedSubstances) ? checkData.bannedSubstances : [];

  const hardBanned = banned.filter((b) => banSeverity(b) === "hard");
  const softBanned = banned.filter((b) => banSeverity(b) === "soft");

  if (hardBanned.length > 0) {
    return {
      status:  "flagged",
      summary: "Banned substance detected — do not prescribe to athlete",
      flags:   hardBanned.map(formatFlag),
      source,
    };
  }

  if (softBanned.length > 0) {
    return {
      status:  "caution",
      summary: "Contains monitored or limited substances — verify with athlete's governing body",
      flags:   softBanned.map(formatFlag),
      source,
    };
  }

  return {
    status:  "clear",
    summary: source === "label"
      ? "No flags detected — label scanned against your banned substance database"
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
      const ocrText = await ocrWithTextract(base, buffer, contentType);

      if (ocrText) {
        const checkData = await runCheckSmartstack(base, ocrText);
        return res.status(200).json(formatResponse(checkData, "label"));
      }

      // Textract read the image but found no text (e.g. image is a photo, not a clean label)
      return res.status(200).json({
        status:  "caution",
        summary: "Could not extract text from label — review ingredients manually before prescribing",
        flags:   [],
        source:  "label-ocr-empty",
      });
    } catch (err) {
      console.warn("[supplement-scan] Label OCR failed:", err.message);
      return res.status(200).json({
        status:  "caution",
        summary: "Could not read nutrition label — review ingredients manually before prescribing",
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
    summary: "No nutrition label on file — add a label to SmartStack for a full ingredient scan",
    flags:   [],
    source:  "no-label",
  });
}
