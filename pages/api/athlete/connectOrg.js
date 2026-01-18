// pages/api/athlete/connectOrg.js
import Airtable from "airtable";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function normalizeToken(token) {
  return String(token || "").trim();
}

function readUserCookie(req) {
  try {
    const cookie = req.headers.cookie || "";
    const match = cookie.match(/(?:^|;\s*)user=([^;]+)/);
    if (!match) return null;
    const decoded = decodeURIComponent(match[1]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sessionUser = readUserCookie(req);
  if (!sessionUser?.id) return res.status(401).json({ error: "Unauthorized" });

  // Only athletes can connect orgs
  const role = String(sessionUser?.role || "").toLowerCase();
  if (!role.includes("athlete")) {
    return res.status(403).json({ error: "Only athletes can connect an organization" });
  }

  const { token } = req.body || {};
  const cleanToken = normalizeToken(token);

  // Always generic-ish errors to avoid token enumeration if you want; but for account UX, we can be direct.
  if (!cleanToken || cleanToken.length < 6) {
    return res.status(400).json({ error: "Please enter a valid organization code." });
  }

  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({ error: "Athletes Airtable not configured" });
  }
  if (!ORGANIZATIONS_API_KEY || !ORGANIZATIONS_BASE_ID || !ORGANIZATIONS_TABLE_NAME) {
    return res.status(500).json({ error: "Organizations Airtable not configured" });
  }

  try {
    const orgBase = new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(ORGANIZATIONS_BASE_ID);
    const athleteBase = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);

    const safeToken = escapeAirtableString(cleanToken);

    // Try both common token field names.
    const orgRecords = await orgBase(ORGANIZATIONS_TABLE_NAME)
      .select({
        filterByFormula: `OR({Token}='${safeToken}', {Token}='${safeToken}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (!orgRecords.length) {
      return res.status(404).json({ error: "Invalid organization code." });
    }

    const orgRecord = orgRecords[0];
    const orgFields = orgRecord.fields || {};
    const orgName = orgFields.Name || orgFields["Short Name"] || "Organization";

    // Update athlete: store org record id (best for relational link)
    // Your schema currently uses Organization as a string; if it's a linked record field,
    // Airtable expects an array: [orgRecord.id]
    // We'll try array first; if it errors in your Airtable schema, we can switch to string.
    const athleteId = sessionUser.id;

    await athleteBase(ATHLETE_TABLE_NAME).update(athleteId, {
      // If Organization is a linked record: use [orgRecord.id]
      Organization: [orgRecord.id],
      // Optional: also store a denormalized name field if you have one (safe to omit if field doesn't exist)
      // "Organization Name": orgName,
    });

    return res.status(200).json({
      ok: true,
      organization: {
        id: orgRecord.id,
        name: orgName,
      },
    });
  } catch (err) {
    console.error("[connectOrg] error:", err);
    return res.status(500).json({
      error: "Failed to connect organization",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
