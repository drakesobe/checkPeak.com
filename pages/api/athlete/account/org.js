// pages/api/athlete/account/org.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function firstValue(v) {
  return Array.isArray(v) ? v[0] : v;
}

function pickFirst(fields, keys = []) {
  for (const k of keys) {
    const s = asString(firstValue(fields?.[k]));
    if (s) return s;
  }
  return "";
}

function safeJson(res, code, obj) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  return res.status(code).json(obj);
}

function envMissing() {
  return {
    ATHLETE_API_KEY: !process.env.ATHLETE_API_KEY,
    ATHLETE_BASE_ID: !process.env.ATHLETE_BASE_ID,
    ATHLETE_TABLE_NAME: !process.env.ATHLETE_TABLE_NAME,
  };
}

/**
 * AthleteScans shape (per your description):
 * - AthleteToken (single line text) ✅
 * - CreatedAt (single line text ISO) ✅
 * - Token (single line text) -> ORG-... ✅ (org code)
 * - Organization (link to Organizations) ✅ (array of record ids)
 * - (optional) Organization Name lookup ✅ (if you have it)
 */
const FIELDS = {
  athleteToken: "AthleteToken",
  createdAt: "CreatedAt",

  // ✅ your actual fields:
  orgToken: "Token",           // org code stored on the scan row
  orgLink: "Organization",     // linked record(s) to Organizations table

  // Optional lookups (if you have them, this gives you the org name without extra calls)
  orgNameLookups: ["Organization Name", "OrgName", "Org Name", "OrganizationName"],
};

const base =
  process.env.ATHLETE_API_KEY && process.env.ATHLETE_BASE_ID
    ? new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("X-Route", "athlete/account/org");

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET") return safeJson(res, 405, { error: "Method not allowed" });

  const missing = envMissing();
  if (missing.ATHLETE_API_KEY || missing.ATHLETE_BASE_ID || missing.ATHLETE_TABLE_NAME) {
    return safeJson(res, 500, {
      error: "AthleteScans Airtable not configured for /api/athlete/account/org",
      missing,
    });
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) return safeJson(res, 401, { error: auth?.error || "Unauthorized" });

  // Token-only (no email fallback)
  const athleteToken = asString(auth?.athlete?.AthleteToken);
  if (!athleteToken) return safeJson(res, 400, { error: "AthleteToken missing in session cookie" });

  const TABLE = process.env.ATHLETE_TABLE_NAME;

  try {
    const records = await base(TABLE)
      .select({
        maxRecords: 1,
        filterByFormula: `{${FIELDS.athleteToken}}='${escapeAirtableString(athleteToken)}'`,
        sort: [{ field: FIELDS.createdAt, direction: "desc" }],
      })
      .firstPage();

    const rec = records?.[0];
    if (!rec) return safeJson(res, 404, { error: "No AthleteScans found for this AthleteToken" });

    const f = rec.fields || {};

    // Org token (ORG-XXXX) from scan row
    const orgToken = asString(firstValue(f[FIELDS.orgToken]));

    // Org link is an array of record IDs; pick first
    const orgLinkRaw = f[FIELDS.orgLink];
    const orgId = asString(firstValue(orgLinkRaw)); // record id of Organizations table (if linked)

    // Org name: best effort from lookup(s) if present
    const orgName = pickFirst(f, FIELDS.orgNameLookups);

    return safeJson(res, 200, {
      ok: true,
      org: {
        name: orgName, // may be ""
        id: orgId,     // may be ""
        token: orgToken, // may be ""
      },
      debug: {
        hasOrgToken: Boolean(orgToken),
        hasOrgId: Boolean(orgId),
        hasOrgName: Boolean(orgName),
      },
    });
  } catch (err) {
    console.error("[athlete/account/org] airtable error:", err);
    return safeJson(res, 500, {
      error: "Failed to load athlete org info from AthleteScans",
      airtable: { statusCode: err?.statusCode, error: err?.error, message: err?.message },
    });
  }
}