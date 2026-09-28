// pages/api/org/nutrition/supplement-scan.js
//
// Coach-side banned substance check for a SmartStack product before prescribing it.
//   1. nutritionLabelUrl present -> read the label image with Claude vision -> check against the banned database
//   2. No label -> caution (a product name alone can't be screened reliably)

import { requireOrgSideUser } from "@/lib/requireUser";
import { extractLabel } from "@/lib/labelVision";
import { checkLabel, getSupplementData } from "@/lib/supplementCheck";
import { hourlyLimit } from "@/lib/ratelimiter";

const SUPPORTED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function fetchLabelImage(imageUrl) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:") throw new Error("Label URL must use https");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CheckPeak/1.0)",
      Accept: "image/jpeg,image/png,image/webp,image/*;q=0.5",
    },
  });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
  const mediaType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mediaType };
}

function formatFlag(b) {
  const f = b.fields || {};
  const extras = [f["Ban Type"], f["Banned By"], f["Dosage Limit"]].filter(Boolean).join(", ");
  return extras ? `${f["Substance Name"]} - ${extras}` : f["Substance Name"];
}

const STATUS = { flagged: "flagged", review: "caution", no_match: "clear" };
const SUMMARY = {
  flagged:  "Banned substance detected - do not prescribe to athlete",
  review:   "Contains restricted substances or undisclosed blend amounts - verify with the athlete's governing body",
  no_match: "No flags detected - label checked against your banned substance database",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;
  if (!hourlyLimit(req, res, "supplement-scan-org", 120)) return;

  const { productName, nutritionLabelUrl } = req.body || {};
  if (!productName) return res.status(400).json({ error: "productName is required" });

  const data = await getSupplementData();
  if (!data) {
    return res.status(200).json({
      status:  "caution",
      summary: "Banned substance list unavailable - review ingredients manually before prescribing",
      flags:   [],
      source:  "list-unavailable",
    });
  }

  if (!nutritionLabelUrl) {
    return res.status(200).json({
      status:  "caution",
      summary: "No nutrition label on file - add a label to SmartStack for a full ingredient scan",
      flags:   [],
      source:  "no-label",
    });
  }

  try {
    const { buffer, mediaType } = await fetchLabelImage(nutritionLabelUrl);
    if (!SUPPORTED_MEDIA.includes(mediaType) || buffer.length > MAX_IMAGE_BYTES) {
      return res.status(200).json({
        status:  "caution",
        summary: "Label image is an unsupported format or too large - update the label image in SmartStack",
        flags:   [],
        source:  "label-unsupported-format",
      });
    }

    const extraction = await extractLabel([{ data: buffer.toString("base64"), mediaType }]);
    if (!extraction.readable) {
      return res.status(200).json({
        status:  "caution",
        summary: "Could not read an ingredient list from the label - review ingredients manually before prescribing",
        flags:   [],
        source:  "label-ocr-empty",
      });
    }

    const { verdict, matchedBanned } = checkLabel(extraction, data);
    return res.status(200).json({
      status:  STATUS[verdict.status],
      summary: SUMMARY[verdict.status],
      flags:   matchedBanned.map(formatFlag),
      certifications: verdict.certifications,
      source:  "label",
    });
  } catch (err) {
    console.warn("[supplement-scan] Label check failed:", err.message);
    return res.status(200).json({
      status:  "caution",
      summary: "Could not read nutrition label - review ingredients manually before prescribing",
      flags:   [],
      source:  "label-error",
    });
  }
}
