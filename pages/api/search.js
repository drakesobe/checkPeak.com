// pages/api/search.js
import Airtable from "airtable";
import { rateLimiter } from "../../lib/rateLimiter"; // use relative path

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimiter(req, res)) return;

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required" });

  try {
    const lowerQuery = query.toLowerCase();

    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    // Filter by Substance Name, Synonyms, or Banned By
    const matchedRecords = records.filter((rec) => {
      const substanceName = rec.get("Substance Name") || "";
      const synonyms = rec.get("Synonyms") || "";
      const bannedBy = rec.get("Banned By") || "";

      return (
        substanceName.toLowerCase().includes(lowerQuery) ||
        synonyms.toLowerCase().includes(lowerQuery) ||
        bannedBy.toLowerCase().includes(lowerQuery)
      );
    });

    console.log("Search matchedRecords:", matchedRecords.map(r => r.fields)); // debug

    // Normalize records for OCRResults
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
  } catch (error) {
    console.error("Search API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
