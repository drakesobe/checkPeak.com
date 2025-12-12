// pages/api/lookupUser.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const ATHLETES_TABLE = process.env.ATHLETE_TABLE_NAME;
  const ORGS_TABLE = process.env.ORGS_TABLE_NAME; // optional

  if (!ATHLETES_TABLE) {
    return res.status(500).json({ error: "ATHLETE_TABLE_NAME is not set." });
  }

  try {
    const emailLower = String(email).trim().toLowerCase();
    const safeEmail = escapeAirtableString(emailLower);

    // ---- Athletes
    const athleteRecords = await base(ATHLETES_TABLE)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (athleteRecords.length) {
      const record = athleteRecords[0];
      const athlete = record.fields || {};
      const storedHash = athlete.Password || "";

      const match = await bcrypt.compare(String(password), String(storedHash));
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const user = { id: record.id, ...athlete, role: "Athlete" };
      delete user.Password;

      return res.status(200).json({ user });
    }

    // ---- Orgs/Admins (optional)
    if (ORGS_TABLE) {
      const orgRecords = await base(ORGS_TABLE)
        .select({
          filterByFormula: `LOWER({Email})='${safeEmail}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (orgRecords.length) {
        const record = orgRecords[0];
        const org = record.fields || {};
        const storedHash = org.Password || "";

        const match = await bcrypt.compare(String(password), String(storedHash));
        if (!match) return res.status(401).json({ error: "Invalid credentials" });

        const user = { id: record.id, ...org, role: "Organization" };
        delete user.Password;

        return res.status(200).json({ user });
      }
    }

    return res.status(404).json({ error: "User not found" });
  } catch (err) {
    console.error("lookupUser error:", err);
    return res.status(500).json({ error: "Failed to lookup user" });
  }
}
