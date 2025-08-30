// pages/api/athlete-signup.js
import Airtable from "airtable";

// --- Dedicated env vars for AthleteScans table
const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, name, email } = req.body;
  if (!token || !name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // --- Look for existing athlete by token
    const [athlete] = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `{Token}='${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!athlete) return res.status(404).json({ error: "Invalid token" });

    // --- Update athlete record with Name, Email, and clear Token
    await base(process.env.ATHLETE_TABLE_NAME).update([
      {
        id: athlete.id,
        fields: {
          Name: name,
          Email: email,
          Token: "",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      athleteId: athlete.id,
      organization: athlete.fields.Organization || "",
    });
  } catch (err) {
    console.error("Signup API error:", err);
    res.status(500).json({ error: "Failed to sign up athlete" });
  }
}
