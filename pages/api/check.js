// pages/api/check.js
import Airtable from "airtable";
import { rateLimiter } from "../../lib/rateLimiter"; // Make sure this path is correct

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Apply rate limiter
  if (!rateLimiter(req, res)) return;

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    const lowerText = text.toLowerCase();

    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    const matchedRecords = records.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ].map((s) => s.trim().toLowerCase());

      return names.some((name) => name && lowerText.includes(name));
    });

    // Normalize fields for OCRResults
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

    res.status(200).json({ records: results });
  } catch (err) {
    console.error("Check API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
