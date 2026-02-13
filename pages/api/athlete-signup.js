// pages/api/athlete-signup.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// 🔒 Immutable, system-generated AthleteToken
function generateAthleteToken() {
  return (
    "ATH-" +
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );
}

/* ------------------------------------------------------------------ */
/* Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, name, email, password } = req.body || {};

  // Token optional; rest required
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required." });
  }

  /* ---------------------------------------------------------------- */
  /* Athletes Airtable (your table is AthleteScans per your schema)    */
  /* ---------------------------------------------------------------- */

  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({
      error:
        "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
    });
  }

  const athleteBase = new Airtable({ apiKey: ATHLETE_API_KEY }).base(
    ATHLETE_BASE_ID
  );

  /* ---------------------------------------------------------------- */
  /* Organizations Airtable (token validation)                         */
  /* ---------------------------------------------------------------- */

  const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

  const canValidateToken = Boolean(
    ORGANIZATIONS_API_KEY && ORGANIZATIONS_BASE_ID && ORGANIZATIONS_TABLE_NAME
  );

  const orgBase = canValidateToken
    ? new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(
        ORGANIZATIONS_BASE_ID
      )
    : null;

  try {
    const emailLower = normalizeEmail(email);
    const safeEmail = escapeAirtableString(emailLower);

    /* -------------------------------------------------------------- */
    /* 1) Prevent duplicate email                                     */
    /* -------------------------------------------------------------- */

    const existing = await athleteBase(ATHLETE_TABLE_NAME)
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

    /* -------------------------------------------------------------- */
    /* 2) Validate org token (if provided)                            */
    /* -------------------------------------------------------------- */

    const tokenNorm = token ? String(token).trim() : "";
    let orgRecord = null;
    let orgName = null;

    if (tokenNorm) {
      if (!canValidateToken) {
        return res.status(500).json({
          error:
            "Organizations Airtable not configured for token linking. Set ORGANIZATIONS_* env vars.",
        });
      }

      const safeToken = escapeAirtableString(tokenNorm);

      const orgRecords = await orgBase(ORGANIZATIONS_TABLE_NAME)
        .select({
          filterByFormula: `{Token}='${safeToken}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (!orgRecords.length) {
        return res.status(400).json({
          error:
            "Invalid organization token. Please verify the token with your organization.",
        });
      }

      orgRecord = orgRecords[0];
      orgName = orgRecord.fields?.Name || null;
    }

    /* -------------------------------------------------------------- */
    /* 3) Hash password                                               */
    /* -------------------------------------------------------------- */

    const hashedPassword = await bcrypt.hash(String(password), 10);

    /* -------------------------------------------------------------- */
    /* 4) Generate AthleteToken                                       */
    /* -------------------------------------------------------------- */

    const athleteToken = generateAthleteToken();

    /* -------------------------------------------------------------- */
    /* 5) Create athlete record (matches your AthleteScans columns)   */
    /* -------------------------------------------------------------- */

    const now = new Date().toISOString();

    const fields = {
      Name: String(name).trim(),
      Email: emailLower,
      Password: hashedPassword,

      // 🔒 NEW
      AthleteToken: athleteToken,

      Title: "Athlete",
      Role: "Athlete",
      Type: "Athlete",

      // You said you have Created and CreatedAt; we keep CreatedAt as before
      CreatedAt: now,

      // Optional metadata (safe even if blank in Airtable)
      Source: "signup",
    };

    // ✅ Correct linked-record assignment for Organization
    if (orgRecord) {
      fields.Organization = [orgRecord.id]; // linked record requires array of record IDs
      fields.Token = tokenNorm; // org token text field in AthleteScans
    }

    const created = await athleteBase(ATHLETE_TABLE_NAME).create(fields);

    return res.status(200).json({
      success: true,
      athleteId: created.id,
      athleteToken, // return for session use
      organization: orgName || null,
      token: tokenNorm || null,
      tokenValidated: Boolean(orgRecord),
    });
  } catch (err) {
    console.error("[athlete-signup] Airtable error:", err);

    return res.status(500).json({
      error: "Failed to create athlete.",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
