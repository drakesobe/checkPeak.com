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

  const text = req.body.text || req.body.ocrText;

  if (!text) {
    console.log("Incoming body:", req.body);
    return res.status(400).json({ error: "No text field in request body!" });
  }

  try {
    let ocrText = "";

    // Local image OCR
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

    // Normalize OCR text
    const normalizedOCRText = ocrText
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    console.log("Normalized OCR text (first 200 chars):", normalizedOCRText.slice(0, 200));

    // Fetch all Airtable records
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    // Match records based on Substance Name and Synonyms
    const matchedRecords = records.filter((rec) => {
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
        } catch (err) {
          return normalizedOCRText.includes(name);
        }
      });
    });

    // ✅ FIX: wrap matched records in fields object for frontend
    const results = matchedRecords.map((rec) => ({
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

    console.log("Matched records count:", results.length);
    results.forEach((r) => console.log("Matched:", r.fields["Substance Name"]));

    // Send results
    res.status(200).json({ ocrText, matchedRecords: results, records: results });
  } catch (err) {
    console.error("Check SmartStack API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
