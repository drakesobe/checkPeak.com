// pages/api/scan/label.js
// POST { images: [{ data: base64, mediaType }], barcode? } -> label read by Claude, checked against the banned database.
// If a barcode is included (one the lookup couldn't find), a signed-in user's result is saved for that barcode.

import { extractLabel, MAX_IMAGES } from "@/lib/labelVision";
import { checkLabel, saveScan, sessionEmail, getSupplementData, BANNED_LIST_MISSING } from "@/lib/supplementCheck";
import { hourlyLimit } from "@/lib/ratelimiter";
import { saveCommunityBarcode } from "@/lib/productLookup";

// Vercel rejects request bodies over 4.5 MB; the client compresses photos to stay under it.
export const config = { api: { bodyParser: { sizeLimit: "4.5mb" } } };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const data = await getSupplementData();
  if (!data) return res.status(503).json({ error: BANNED_LIST_MISSING });

  const email = sessionEmail(req);
  if (!hourlyLimit(req, res, email ? "label-scan-user" : "label-scan-anon", email ? 60 : 15)) return;

  const images = Array.isArray(req.body?.images) ? req.body.images : [];
  if (!images.length) return res.status(400).json({ error: "Add at least one photo of the label." });
  if (images.length > MAX_IMAGES) return res.status(400).json({ error: `Use up to ${MAX_IMAGES} photos per scan.` });
  if (images.some((i) => typeof i?.data !== "string" || !i.data || typeof i?.mediaType !== "string")) {
    return res.status(400).json({ error: "One of the photos couldn't be read. Try adding it again." });
  }

  let extraction;
  try {
    extraction = await extractLabel(images);
  } catch (err) {
    console.error("[scan/label] extraction failed:", err);
    return res.status(502).json({ error: "We couldn't read the label right now. Please try again in a moment." });
  }

  if (!extraction.readable) {
    return res.status(200).json({
      found: false,
      productName: extraction.product_name,
      message: extraction.unreadable_reason || "We couldn't find an ingredient list in these photos. Take a clear, straight-on photo of the back panel.",
    });
  }

  const result = checkLabel(extraction, data);
  const productName = [extraction.brand, extraction.product_name].filter(Boolean).join(" ") || null;

  const [{ saved }, learnedBarcode] = await Promise.all([
    saveScan({ email, productName, ingredientsText: result.ingredientsText, bannedDetails: result.bannedDetails }),
    // A barcode that wasn't in any database gets this label's ingredient list for next time
    req.body?.barcode
      ? saveCommunityBarcode({ barcode: req.body.barcode, productName, ingredientsText: result.ingredientsText, email })
      : false,
  ]);

  return res.status(200).json({
    found:              true,
    source:             "label",
    productName,
    verdict:            result.verdict,
    ingredients:        result.ingredients,
    ingredientsText:    result.ingredientsText,
    blends:            extraction.proprietary_blends,
    certifications:     extraction.certifications,
    excludedMentions:   extraction.excluded_mentions,
    matchedBanned:      result.matchedBanned,
    matchedIngredients: result.matchedIngredients,
    bannedDetails:      result.bannedDetails,
    saved,
    learnedBarcode,
  });
}
