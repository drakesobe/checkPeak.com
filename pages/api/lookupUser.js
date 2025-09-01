// pages/api/lookupUser.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.query;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const emailLower = email.toLowerCase();

    // --- Check Athletes table
    const athleteRecords = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email})='${emailLower}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (athleteRecords.length) {
      const athlete = athleteRecords[0].fields;
      const match = await bcrypt.compare(password, athlete.Password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      return res.status(200).json({
        user: {
          id: athleteRecords[0].id,
          ...athlete,
          role: "Athlete",
        },
      });
    }

    // --- Check Users/Orgs table (same base)
    const orgRecords = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email})='${emailLower}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (orgRecords.length) {
      const org = orgRecords[0].fields;
      const match = await bcrypt.compare(password, org.Password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      return res.status(200).json({
        user: {
          id: orgRecords[0].id,
          ...org,
          role: "Organization",
        },
      });
    }

    return res.status(404).json({ error: "User not found" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to lookup user" });
  }
}
