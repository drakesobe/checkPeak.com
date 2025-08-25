import Airtable from "airtable";
import { ratelimiter } from "../../lib/ratelimiter";
import fs from "fs";
import path from "path";
import Tesseract from "tesseract.js";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ratelimiter(req, res, "check")) return;

  // Accept both `text` and `ocrText` for backward compatibility
  const text = req.body.text || req.body.ocrText;

  if (!text) {
    console.log("Incoming body:", req.body);
    return res.status(400).json({ error: "No text field in request body!" });
  }

  try {
    let ocrText = "";

    // Check if this is a SmartStack local image path
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
      // Normal site scan: just use the text string from input
      ocrText = text;
    }

    // Normalize OCR text: collapse spaces, remove line breaks, lowercase
    const normalizedOCRText = ocrText
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    console.log("Normalized OCR text:", normalizedOCRText.slice(0, 200), "...");

    // Airtable lookup
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    const matchedRecords = records.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ].map((s) => s.trim().toLowerCase());

      // Match if any name exists in OCR text
      return names.some((name) => {
        if (!name) return false;
        if (name.length < 2) return false; // skip short tokens
        if (/^[0-9]+$/.test(name)) return false; // skip numbers only

        try {
          const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          return regex.test(normalizedOCRText);
        } catch (err) {
          // fallback substring match
          return normalizedOCRText.includes(name);
        }
      });
    });

    const results = matchedRecords.map((rec) => ({
      id: rec.id,
      fields: {
        "Substance Name": rec.get("Substance Name") || "",
        Synonyms: rec.get("Synonyms") || "",
        "Banned By": rec.get("Banned By") || "",
        "Ban Type": rec.get("Ban Type") || "",
        "Dosage Limit": rec.get("Dosage Limit") || "",
        Notes: rec.get("Notes") || "",
        "Source / Citation": rec.get("Source / Citation") || "",
      },
    }));

    console.log("Matched records count:", results.length);

    res.status(200).json({ ocrText, records: results });
  } catch (err) {
    console.error("Check SmartStack API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
