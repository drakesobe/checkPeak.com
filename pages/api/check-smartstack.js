// pages/api/check-smartstack.js
import Airtable from "airtable";
import { ratelimiter } from "../../lib/ratelimiter";
import fs from "fs";
import path from "path";
import Tesseract from "tesseract.js";

// --- Airtable bases
const affiliateBase = new Airtable({ apiKey: process.env.AFFILIATE_API_KEY }).base(
  process.env.AFFILIATE_BASE_ID
);
const bannedBase = new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
  process.env.BANNED_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ratelimiter(req, res, "check")) return;

  const text = req.body.text || req.body.ocrText;
  if (!text) {
    console.log("Incoming body:", req.body);
    return res.status(400).json({ error: "No text field in request body!" });
  }

  try {
    let ocrText = "";

    // --- Local image OCR
    if (text.startsWith("/uploads/")) {
      const localPath = path.join(process.cwd(), "public", text);
      if (!fs.existsSync(localPath)) {
        return res.status(400).json({ error: "Local image not found at " + localPath });
      }

      console.log("Performing OCR on local image:", localPath);

      const { data } = await Tesseract.recognize(localPath, "eng", {
        logger: (m) =>
          console.log("OCR:", m.status, m.progress ? m.progress.toFixed(2) : null),
      });

      ocrText = data.text;
    } else {
      // --- Normal site scan: just use the text string from input
      ocrText = text;
    }

    // --- Normalize OCR text
    const normalizedOCRText = ocrText
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    console.log("Normalized OCR text (first 200 chars):", normalizedOCRText.slice(0, 200));

    // --- Fetch Affiliate Products and Banned Substances
    const [affiliateRecords, bannedRecords] = await Promise.all([
      affiliateBase(process.env.AFFILIATE_TABLE_NAME).select({ view: "Grid view" }).all(),
      bannedBase(process.env.BANNED_TABLE_NAME).select({ view: "Grid view" }).all(),
    ]);

    // --- Match Banned Substances against OCR
    const matchedBanned = bannedRecords.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ].map((s) => s.trim().toLowerCase());

      return names.some((name) => {
        if (!name || name.length < 2) return false;
        if (/^[0-9]+$/.test(name)) return false;

        try {
          const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          return regex.test(normalizedOCRText);
        } catch {
          return normalizedOCRText.includes(name);
        }
      });
    });

    const bannedResults = matchedBanned.map((rec) => ({
      id: rec.id,
      fields: {
        "Substance Name": rec.get("Substance Name") || "",
        "Ban Type": rec.get("Ban Type") || "",
        "Synonyms": rec.get("Synonyms") || "",
        "Banned By": rec.get("Banned By") || "",
        "Dosage Limit": rec.get("Dosage Limit") || "",
        "Notes": rec.get("Notes") || "",
        "Source / Citation": rec.get("Source / Citation") || "",
      },
    }));

    console.log("Matched banned count:", bannedResults.length);
    bannedResults.forEach((r) => console.log("Matched banned:", r.fields["Substance Name"]));

    // --- Wrap Affiliate Products for frontend
    const affiliateResults = affiliateRecords.map((record) => {
      const f = record.fields || {};

      // Supplements array
      let supplements = [];
      if (Array.isArray(f["Supplements"])) supplements = f["Supplements"];
      else if (typeof f["Supplements"] === "string")
        supplements = f["Supplements"]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

      // Price & servings
      const priceNumber = parseFloat(f["Price"] || 0);
      const servings = f["Servings"] || "";

      // Nutrition label
      const nutritionLabel = f["Nutrition Label URL"] || "";

      // Affiliate link
      const affiliateLink =
        f["Lo. Amazon/Stripe Link"] ||
        f["Sh. Amazon/Stripe Link"] ||
        f["AffiliateLink"] ||
        "";

      // Image URL
      const imageUrl = f["Image URL"] || "";

      // Rating
      const rating = parseFloat(f["Rating"]) || null;

      // Value Rating from Airtable
      let valueScore = parseFloat(f["Value Rating"]) || null;

      // Fallback: calculate valueScore from servings / price
      if (!valueScore && priceNumber && servings) {
        const servingsNumber = parseFloat(servings) || 1;
        valueScore = (servingsNumber / priceNumber) * 10; // scale factor for badge
      }

      return {
        id: record.id,
        name: f["Product Name"] || "No Name",
        category: f["Category"] || "Misc",
        supplements,
        notes: `Servings: ${servings || "N/A"} • Price: $${priceNumber.toFixed(2)}`,
        affiliateLink,
        imageUrl,
        nutritionLabel,
        rating,
        valueScore,
        rawFields: f,
      };
    });

    // --- Send results
    res.status(200).json({
      ocrText,
      matchedBanned: bannedResults,
      affiliateRecords: affiliateResults,
    });
  } catch (err) {
    console.error("Check SmartStack API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
