// pages/api/athlete-signup.js
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

  const { token, name, email, password } = req.body || {};

  // ✅ Token is NOT required
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required." });
  }

  try {
    const tableName = process.env.ATHLETE_TABLE_NAME;
    if (!tableName) {
      return res.status(500).json({ error: "ATHLETE_TABLE_NAME is not set." });
    }

    const emailLower = String(email).trim().toLowerCase();
    const safeEmail = escapeAirtableString(emailLower);

    // ✅ Prevent duplicate emails
    const existing = await base(tableName)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    // ✅ Hash password ON SERVER (send plain password from client)
    const hashedPassword = await bcrypt.hash(String(password), 10);

    const fields = {
      Name: String(name).trim(),
      Email: emailLower,
      Password: hashedPassword,
      Title: "Athlete",
      Created: new Date().toISOString(),
    };

    // ✅ Only store token if provided
    if (token && String(token).trim()) {
      fields.Token = String(token).trim();
    }

    const newAthlete = await base(tableName).create(fields);

    return res.status(200).json({
      success: true,
      athleteId: newAthlete.id,
      // token/org not required; return it only if present
      organization: fields.Token || null,
    });
  } catch (err) {
    console.error("Athlete signup error:", err);
    return res.status(500).json({ error: "Failed to create athlete." });
  }
}
