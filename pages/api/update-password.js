// pages/api/update-password.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { athleteId, currentPassword, newPassword } = req.body;

  if (!athleteId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Fetch athlete record
    const records = await base(process.env.ATHLETE_TABLE_NAME).find(athleteId);
    if (!records) {
      return res.status(404).json({ error: "Athlete not found." });
    }

    const storedPassword = records.fields.Password;
    const passwordMatches = await bcrypt.compare(currentPassword, storedPassword);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in Airtable
    const updated = await base(process.env.ATHLETE_TABLE_NAME).update([
      {
        id: athleteId,
        fields: {
          Password: hashedNewPassword,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      updated: updated[0].fields,
    });
  } catch (err) {
    console.error("Update password error:", err);
    return res.status(500).json({ error: "Failed to update password." });
  }
}
