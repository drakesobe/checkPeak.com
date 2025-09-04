// pages/api/get-athlete.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Athlete ID is required" });
  }

  try {
    const record = await base(process.env.ATHLETE_TABLE_NAME).find(id);

    if (!record) {
      return res.status(404).json({ error: "Athlete not found" });
    }

    // Normalize the athlete record
    const athlete = {
      id: record.id,
      Name: record.fields.Name || "",
      Email: record.fields.Email || "",
      Organization: record.fields.Organization || "",
      Title: record.fields.Title || "",
      Phone: record.fields.Phone || "",
      Created: record.fields.Created || "",
      Token: record.fields.Token || "",
    };

    res.status(200).json({ athlete });
  } catch (err) {
    console.error("Get Athlete API error:", err);
    res.status(500).json({ error: "Failed to fetch athlete" });
  }
}
