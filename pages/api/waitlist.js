// pages/api/waitlist.js
import Airtable from "airtable";

const {
  ATHLETE_API_KEY,
  ATHLETE_BASE_ID,
  ATHLETE_TABLE_NAME,
} = process.env;

// Guard so you see issues in logs if env is missing
if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
  console.warn(
    "[waitlist] Missing Airtable env vars. Check ATHLETE_API_KEY / ATHLETE_BASE_ID / ATHLETE_TABLE_NAME."
  );
}

const base =
  ATHLETE_API_KEY && ATHLETE_BASE_ID
    ? new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID)
    : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!base) {
    return res
      .status(500)
      .json({ error: "Airtable is not configured on the server." });
  }

  try {
    const {
      email,
      name,
      source,
      role,
      organization,
    } = req.body || {};

    // Basic validation
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    const safeEmail = String(email).trim();
    const safeName = (name || "").trim();
    const safeSource = (source || "homepage-request-access").trim();
    const safeRole = (role || "Athlete").toString().trim();
    const safeOrg = (organization || "").trim();
    const createdAt = new Date().toISOString();

    // Map to Airtable fields.
    // Make sure these columns exist in your ATHLETE_TABLE_NAME:
    // - Email (text)
    // - Name (text)
    // - Role (text or single select)
    // - Organization (text)
    // - Source (text)
    // - Type (single select; e.g. Waitlist / EarlyAccess)
    // - CreatedAt (date/time)
    await base(ATHLETE_TABLE_NAME).create([
      {
        fields: {
          Email: safeEmail,
          Name: safeName || undefined,
          Role: safeRole || undefined,
          Organization: safeOrg || undefined,
          Source: safeSource,
          Type: "EarlyAccess",
          CreatedAt: createdAt,
        },
      },
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[waitlist] Airtable error:", err);
    return res
      .status(500)
      .json({ error: "Failed to submit request. Please try again." });
  }
}
