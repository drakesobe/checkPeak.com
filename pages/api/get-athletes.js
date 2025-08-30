// pages/api/get-athletes.js
import Airtable from "airtable";

// --- Dedicated env vars for AthleteScans
const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // --- Organization is passed as query param or fallback
  const organization = req.query.org || "Default University";

  try {
    const records = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `{Organization}='${organization}'`,
        sort: [{ field: "Name", direction: "asc" }],
      })
      .all();

    res.status(200).json({ athletes: records });
  } catch (err) {
    console.error("Get Athletes API error:", err);
    res.status(500).json({ error: "Failed to fetch athletes" });
  }
}
