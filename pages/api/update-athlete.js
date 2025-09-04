// pages/api/update-athlete.js
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { athleteId, updates } = req.body;

  if (!athleteId || !updates) {
    return res.status(400).json({ error: "Missing athleteId or updates" });
  }

  try {
    const updated = await base(process.env.ATHLETE_TABLE_NAME).update([
      {
        id: athleteId,
        fields: updates,
      },
    ]);

    return res.status(200).json({
      success: true,
      updated: updated[0].fields,
    });
  } catch (err) {
    console.error("Update athlete error:", err);
    return res.status(500).json({ error: "Failed to update athlete." });
  }
}
