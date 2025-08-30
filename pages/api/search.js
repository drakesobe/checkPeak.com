import Airtable from "airtable";
import { ratelimiter } from "../../lib/ratelimiter";

// Initialize Airtable with correct env vars for Banned Substances
const base = new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
  process.env.BANNED_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Enhanced rate limiter
  if (!ratelimiter(req, res, "search")) return;

  const { query } = req.body;
  if (!query || query.trim().length < 2)
    return res.status(400).json({ error: "Query is required and must be at least 2 characters" });

  try {
    const lowerQuery = query.toLowerCase();

    // Fetch all records from the banned substances table
    const records = await base(process.env.BANNED_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    // Filter by partial matches in substance name, synonyms, or banned by
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

    // Map to clean JSON
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
