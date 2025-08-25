import Airtable from "airtable";
import { ratelimiter } from "../../lib/ratelimiter";
import fs from "fs";
import path from "path";
import Tesseract from "tesseract.js";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!ratelimiter(req, res, "check")) return;

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    let ocrText = "";

    // SmartStack image path handling
    if (text.startsWith("/uploads/")) {
      const localPath = path.join(process.cwd(), "public", text);
      if (!fs.existsSync(localPath))
        return res.status(400).json({ error: "Local image not found at " + localPath });

      // Browser-safe Tesseract usage
      const { data } = await Tesseract.recognize(localPath, "eng", { logger: undefined });
      ocrText = data.text;
    } else {
      ocrText = text; // Normal text input
    }

    const normalizedOCRText = ocrText.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").toLowerCase();

    // Airtable lookup
    const records = await base(process.env.AIRTABLE_TABLE_NAME).select({ view: "Grid view" }).all();
    const matchedRecords = records.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ].map((s) => s.trim().toLowerCase());

      return names.some((name) => {
        if (!name || name.length < 2 || /^[0-9]+$/.test(name)) return false;

        try {
          const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          return regex.test(normalizedOCRText);
        } catch {
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

    res.status(200).json({ ocrText, records: results });
  } catch (err) {
    console.error("Check API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
