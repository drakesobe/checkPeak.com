// pages/api/check.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Escape regex special characters safely
const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    const lowerText = text.toLowerCase();

    // Fetch all records from Airtable table
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    // Filter records: check Substance Name + Synonyms against OCR text
    const matchedRecords = records.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ].map((s) => s.trim());

      return names.some((name) => {
        if (!name) return false;
        const safeName = escapeRegex(name);
        try {
          const regex = new RegExp(`\\b${safeName}\\b`, "i"); // whole-word match, case-insensitive
          return regex.test(lowerText);
        } catch (err) {
          return lowerText.includes(name.toLowerCase());
        }
      });
    });

    // Map to same structure as SmartStack expects
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
    console.error("Check API error:", err);
    res.status(500).json({ error: "Internal server error", records: [] });
  }
}
