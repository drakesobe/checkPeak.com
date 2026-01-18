// pages/api/athlete/connectOrg.js
import Airtable from "airtable";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function normalizeToken(token) {
  return String(token || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, email } = req.body || {};
    const cleanToken = normalizeToken(token);
    const cleanEmail = normalizeEmail(email);

    if (!cleanToken) return res.status(400).json({ error: "Organization code is required." });
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    // ---- ENV ----
    const ORG_API_KEY = process.env.ORGANIZATIONS_API_KEY;
    const ORG_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const ORG_TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

    const ATH_API_KEY = process.env.ATHLETE_API_KEY;
    const ATH_BASE_ID = process.env.ATHLETE_BASE_ID;
    const ATH_TABLE = process.env.ATHLETE_TABLE_NAME;

    if (!ORG_API_KEY || !ORG_BASE_ID || !ORG_TABLE) {
      return res.status(500).json({ error: "Organizations Airtable not configured." });
    }
    if (!ATH_API_KEY || !ATH_BASE_ID || !ATH_TABLE) {
      return res.status(500).json({ error: "Athletes Airtable not configured." });
    }

    const orgBase = new Airtable({ apiKey: ORG_API_KEY }).base(ORG_BASE_ID);
    const athBase = new Airtable({ apiKey: ATH_API_KEY }).base(ATH_BASE_ID);

    // ---- 1) Find org by Token ----
    const safeToken = escapeAirtableString(cleanToken.toLowerCase());
    const orgRecords = await orgBase(ORG_TABLE)
      .select({
        filterByFormula: `LOWER({Token})='${safeToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!orgRecords.length) {
      return res.status(404).json({ error: "Invalid organization code." });
    }

    const orgRecord = orgRecords[0];
    const orgName = orgRecord.fields?.Name || "Organization";

    // ---- 2) Find athlete by Email ----
    const safeEmail = escapeAirtableString(cleanEmail);
    const athleteRecords = await athBase(ATH_TABLE)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!athleteRecords.length) {
      return res.status(404).json({ error: "Athlete not found." });
    }

    const athleteRecord = athleteRecords[0];

    // ---- 3) Update linked record field ----
    // IMPORTANT: linked record fields must be an ARRAY of record IDs
    await athBase(ATH_TABLE).update([
      {
        id: athleteRecord.id,
        fields: {
          Organization: [orgRecord.id],
        },
      },
    ]);

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
