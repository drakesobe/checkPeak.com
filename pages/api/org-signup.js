import Airtable from "airtable";
import bcrypt from "bcryptjs";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { orgName, contactName, email, password, token } = req.body;

  if (!orgName || !contactName || !email || !password || !token) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create organization record in Airtable
    const newOrg = await base("Users").create({
      Name: orgName,
      Email: email,
      Password: hashedPassword,
      Token: token,
      Title: "Organization",
      ContactName: contactName,
    });

    return res.status(200).json({
      success: true,
      orgId: newOrg.id,
      name: newOrg.fields.Name,
      email: newOrg.fields.Email,
      token: newOrg.fields.Token,
    });
  } catch (err) {
    console.error("Organization signup error:", err);
    return res.status(500).json({ error: "Failed to create organization." });
  }
}
