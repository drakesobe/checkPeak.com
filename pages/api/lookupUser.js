// pages/api/lookupUser.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

// Athlete Airtable connection
const baseAthlete = new Airtable({
  apiKey: process.env.ATHLETE_API_KEY,
}).base(process.env.ATHLETE_BASE_ID);

// Organization Airtable connection (same base as athletes)
const baseUsers = new Airtable({
  apiKey: process.env.ATHLETE_API_KEY,
}).base(process.env.ATHLETE_BASE_ID);

export default async function handler(req, res) {
  const { email, password } = req.query;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    // --- 1. Check Athletes table
    const athleteRecords = await baseAthlete(process.env.ATHLETE_TABLE_NAME)
      .select({ filterByFormula: `{Email}='${email}'`, maxRecords: 1 })
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

    // --- 2. Check Orgs table
    const orgRecords = await baseUsers("Users")
      .select({ filterByFormula: `{Email}='${email}'`, maxRecords: 1 })
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
    console.error("Lookup user error:", err);
    return res.status(500).json({ error: "Failed to lookup user" });
  }
}
