// pages/api/check.js
//
// POST { text | ocrText | ingredientsText }  -> check free text (SmartStack, NutritionModal, shared scans)
// POST { barcode, isBarcodeFlow }            -> look up the product, then check its ingredient list
// Optional: { saveScan: true } saves to the signed-in user's scan history.

import { checkText, saveScan, sessionEmail, getSupplementData, BANNED_LIST_MISSING } from "@/lib/supplementCheck";
import { lookupBarcode } from "@/lib/productLookup";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });
  const data = await getSupplementData();
  if (!data) return res.status(503).json({ error: BANNED_LIST_MISSING });

  try {
    const body = req.body || {};
    const isBarcodeFlow = Boolean(body.isBarcodeFlow) || body.barcode != null;

    let productName = null;
    let ingredientsText = String(body.text || body.ocrText || body.ingredientsText || "").trim();
    let lookup = null;

    if (isBarcodeFlow) {
      if (!String(body.barcode ?? "").replace(/\D/g, "")) {
        return res.status(400).json({ error: "Barcode contains no digits" });
      }
      lookup = await lookupBarcode(body.barcode);
      if (!lookup.valid) {
        return res.status(200).json({ found: false, invalid: true, message: "That isn't a valid barcode number. Check the digits and try again." });
      }
      if (!lookup.found) {
        return res.status(200).json({
          found: false,
          barcode: lookup.barcode,
          productName: lookup.productName,
          message: lookup.productName
            ? `We found "${lookup.productName}" but its ingredient list isn't in any product database. Scan the label instead.`
            : "This barcode isn't in the product databases we use. Scan the label instead.",
        });
      }
      productName = lookup.productName;
      ingredientsText = lookup.ingredientsText;
    }

    if (!ingredientsText) {
      return res.status(200).json({ found: false, message: "No ingredient text provided." });
    }

    const source = !isBarcodeFlow ? "text" : lookup.provider === "checkpeak" ? "community" : "barcode";
    const result = checkText(ingredientsText, data, { source });

    let saved = false;
    if (body.saveScan === true) {
      ({ saved } = await saveScan({
        email: sessionEmail(req),
        productName,
        ingredientsText,
        bannedDetails: result.bannedDetails,
      }));
    }

    return res.status(200).json({
      found:              true,
      source:             isBarcodeFlow ? "barcode" : "text",
      provider:           lookup?.provider || null,
      barcode:            lookup?.barcode || null,
      ocrText:            ingredientsText,
      productName,
      ingredientsText,
      verdict:            result.verdict,
      matchedBanned:      result.matchedBanned,
      matchedIngredients: result.matchedIngredients,
      bannedDetails:      result.bannedDetails,
      // SmartStack / NutritionModal field names
      bannedSubstances:   result.matchedBanned,
      ingredients:        result.matchedIngredients,
      saved,
      ...(body.debug ? { debug: { attempts: lookup?.attempts || [] } } : {}),
    });
  } catch (err) {
    console.error("[/api/check] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
