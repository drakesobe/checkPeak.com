// pages/api/org/getAthletesByToken.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  const { token } = req.query || {};
  if (!token) return res.status(400).json({ error: "Missing token" });

  const ATHLETES_TABLE = process.env.ATHLETE_TABLE_NAME;
  if (!ATHLETES_TABLE) {
    return res.status(500).json({ error: "ATHLETE_TABLE_NAME is not set." });
  }

  try {
    const safeTok = escapeAirtableString(String(token).trim());

    const records = await base(ATHLETES_TABLE)
      .select({
        filterByFormula: `{Token}='${safeTok}'`,
        sort: [{ field: "CreatedAt", direction: "desc" }],
      })
      .firstPage();

    const athletes = records.map((r) => ({
      id: r.id,
      name: r.fields?.Name || "",
      email: r.fields?.Email || "",
      createdAt: r.fields?.CreatedAt || "",
      organization: r.fields?.Organization || "",
      token: r.fields?.Token || "",
      role: r.fields?.Role || "Athlete",
      title: r.fields?.Title || "Athlete",
    }));

    return res.status(200).json({ athletes });
  } catch (err) {
    console.error("[getAthletesByToken] error:", err);
    return res.status(500).json({ error: "Failed to fetch athletes." });
  }
}
