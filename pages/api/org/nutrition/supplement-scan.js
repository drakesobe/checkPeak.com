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

function formatResponse(checkData, source) {
  const banned = Array.isArray(checkData?.bannedSubstances) ? checkData.bannedSubstances : [];

  if (banned.length > 0) {
    const flags = banned.map((b) => {
      const name    = b.fields?.["Substance Name"] || "Unknown substance";
      const banType = b.fields?.["Ban Type"] || "";
      const bannedBy = b.fields?.["Banned By"] || "";
      return banType || bannedBy
        ? `${name} — ${[banType, bannedBy].filter(Boolean).join(", ")}`
        : name;
    });
    return {
      status:  "flagged",
      summary: "Banned substance detected — do not recommend to athlete",
      flags,
      source,
    };
  }

  return {
    status:  "clear",
    summary: source === "label"
      ? "No flags detected — label scanned against WADA Prohibited List"
      : "No flags detected against WADA Prohibited List (name-based scan)",
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
  if (nutritionLabelUrl) {
    try {
      const { buffer, contentType } = await fetchImageBuffer(nutritionLabelUrl);
      const ocrText = await ocrWithTextract(base, buffer, contentType);

      if (ocrText) {
        const checkData = await runCheckSmartstack(base, ocrText);
        return res.status(200).json(formatResponse(checkData, "label"));
      }
      // OCR returned no text — fall through to name-based scan
    } catch (err) {
      console.warn("[supplement-scan] Label OCR failed, falling back to name scan:", err.message);
      // Fall through to name-based scan
    }
  }

  // ── Path 2: Product name + category → proprietary scan ────────────────────
  try {
    const text = `${productName} ${category || ""}`.trim();
    const checkData = await runCheckSmartstack(base, text);
    return res.status(200).json(formatResponse(checkData, "name"));
  } catch (err) {
    console.error("[supplement-scan] check-smartstack error:", err.message);
    return res.status(200).json({
      status:  "caution",
      summary: "Scanner unavailable — review label manually before prescribing",
      flags:   [],
      source:  "error",
    });
  }
}
