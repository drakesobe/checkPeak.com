// pages/api/delete-account.js
// Permanently deletes an athlete account from Airtable.
// Requires: athleteId + password for confirmation.
// POST /api/delete-account

import Airtable from "airtable";
import bcrypt    from "bcryptjs";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { athleteId, password } = req.body;

  if (!athleteId || !password) {
    return res.status(400).json({ error: "Athlete ID and password are required." });
  }

  try {
    // Fetch the record
    const record = await base(process.env.ATHLETE_TABLE_NAME).find(athleteId);
    if (!record) {
      return res.status(404).json({ error: "Account not found." });
    }

    // Verify password before deleting — no one can delete without knowing it
    const storedHash = record.fields.Password;
    if (!storedHash) {
      return res.status(400).json({ error: "Cannot verify account credentials." });
    }

    const match = await bcrypt.compare(password, storedHash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect password. Account not deleted." });
    }

    // Delete the record
    await base(process.env.ATHLETE_TABLE_NAME).destroy(athleteId);

    return res.status(200).json({
      ok:      true,
      message: "Account deleted successfully.",
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
}