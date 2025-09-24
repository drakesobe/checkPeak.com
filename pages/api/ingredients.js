// pages/api/ingredients.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(
  process.env.INGREDIENT_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { searchTerm } = req.body;
    if (!searchTerm || !searchTerm.trim()) {
      return res.status(400).json({ error: "Search term is required" });
    }

    const term = searchTerm.toLowerCase();

    // Fetch all records (can optimize later with Airtable filterByFormula)
    const records = await base(process.env.INGREDIENT_TABLE_NAME)
      .select()
      .all();

    // Filter server-side
    const filtered = records
      .map((r) => ({
        id: r.id,
        name: r.get("Name"),
        synonyms: r.get("Synonyms (Extended)") || r.get("Synonyms"),
        notes: r.get("Pharmacology Notes"),
        benefits: r.get("Benefits"),
        weaknesses: r.get("Weaknesses"),
        sources: r.get("Sources / References"),
      }))
      .filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(term)) ||
          (r.synonyms && r.synonyms.toLowerCase().includes(term))
      );

    res.status(200).json({ records: filtered });
  } catch (error) {
    console.error("Error fetching Airtable:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
