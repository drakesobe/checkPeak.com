// pages/api/athlete-signup.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, name, email, password } = req.body;
  if (!token || !name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create athlete record
    const newAthlete = await base(process.env.ATHLETE_TABLE_NAME).create({
      Name: name,
      Email: email,
      Password: hashedPassword,
      Token: token,
      Title: "Athlete",
    });

    return res.status(200).json({
      success: true,
      athleteId: newAthlete.id,
      organization: token,
    });
  } catch (err) {
    console.error("Athlete signup error:", err);
    return res.status(500).json({ error: "Failed to create athlete." });
  }
}
