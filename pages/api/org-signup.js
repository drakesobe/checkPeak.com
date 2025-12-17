// pages/api/org-signup.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function makeOrgToken() {
  // ORG-7F2C9A-18B3D0
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORG-${a}-${b}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    name,
    email,
    password,
    contactName = "",
    phoneNumber = "",
    website = "",
    address = "",
    notes = "",
    type = "Organization",
  } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Organization name, email, and password are required.",
    });
  }

  const ORGS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

  if (!ORGS_API_KEY || !ORGS_BASE_ID || !ORGS_TABLE) {
    return res.status(500).json({
      error:
        "Organizations Airtable not configured. Check ORGANIZATIONS_API_KEY, ORGANIZATIONS_BASE_ID, ORGANIZATIONS_TABLE_NAME.",
      missing: {
        ORGANIZATIONS_API_KEY: !ORGS_API_KEY,
        ORGANIZATIONS_BASE_ID: !ORGS_BASE_ID,
        ORGANIZATIONS_TABLE_NAME: !ORGS_TABLE,
      },
    });
  }

  const orgBase = new Airtable({ apiKey: ORGS_API_KEY }).base(ORGS_BASE_ID);

  try {
    const emailLower = normalizeEmail(email);
    const safeEmail = escapeAirtableString(emailLower);

    // 1) Prevent duplicate org emails (you confirmed you are using {Email})
    const existing = await orgBase(ORGS_TABLE)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length) {
      return res.status(409).json({
        error: "An organization with this email already exists.",
      });
    }

    // 2) Generate token (and sanity-check uniqueness)
    let token = makeOrgToken();
    const safeToken = escapeAirtableString(token);

    const tokenDup = await orgBase(ORGS_TABLE)
      .select({
        filterByFormula: `{Token}='${safeToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (tokenDup.length) {
      token = makeOrgToken();
    }

    // 3) Hash password
    const hashedPassword = await bcrypt.hash(String(password), 10);

    /**
     * IMPORTANT:
     * Airtable returned:
     * UNKNOWN_FIELD_NAME: "Contact Email"
     *
     * So we DO NOT write "Contact Email" at all.
     * (If you want it, create a real editable field named exactly "Contact Email" in Airtable.)
     */
    const fields = {
      Name: String(name).trim(),
      Email: emailLower,
      Password: hashedPassword,
      Token: token,

      // Optional columns you listed (write only ones that exist)
      Type: String(type || "Organization").trim(),
      "Contact Name": String(contactName || "").trim(),
      "Phone Number": String(phoneNumber || "").trim(),
      Website: String(website || "").trim(),
      Address: String(address || "").trim(),
      Notes: String(notes || "").trim(),
      Status: "Active",
    };

    // Remove empty strings
    Object.keys(fields).forEach((k) => {
      if (fields[k] === "") delete fields[k];
    });

    const created = await orgBase(ORGS_TABLE).create(fields);

    return res.status(200).json({
      success: true,
      orgId: created.id,
      token,
    });
  } catch (err) {
    console.error("[org-signup] Airtable error:", err);

    return res.status(500).json({
      error: "Failed to create organization.",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
