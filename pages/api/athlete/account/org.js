// pages/api/athlete/account/org.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function asString(v) { return String(v ?? "").trim(); }
function escapeAirtableString(str = "") { return String(str).replace(/'/g, "\\'"); }
function firstValue(v) { return Array.isArray(v) ? v[0] : v; }

function safeJson(res, code, obj) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  return res.status(code).json(obj);
}

/**
 * GET /api/athlete/account/org
 *
 * Looks up the athlete's connected organization directly from the Athletes table.
 * Uses athlete's id or email from the session cookie — NOT AthleteToken.
 *
 * Athletes table fields expected:
 *   - Email              (single line text)
 *   - Organization       (linked record → Organizations table, array of record IDs)
 *   - Token              (single line text — org token copied on connect for dashboard compat)
 *   - Organization Name  (lookup from Organizations.Name — optional but ideal)
 *
 * If Organization Name lookup isn't set up in Airtable, we do a second fetch
 * to the Organizations table using the linked record ID to get the name.
 */

const ORG_NAME_LOOKUPS = ["Organization Name", "OrgName", "Org Name", "OrganizationName"];

function pickFirst(fields, keys) {
  for (const k of keys) {
    const s = asString(firstValue(fields?.[k]));
    if (s) return s;
  }
  return "";
}

function envCheck() {
  return {
    ATHLETE_API_KEY:        !process.env.ATHLETE_API_KEY,
    ATHLETE_BASE_ID:        !process.env.ATHLETE_BASE_ID,
    ATHLETE_TABLE_NAME:     !process.env.ATHLETE_TABLE_NAME,
  };
}

function orgEnvCheck() {
  return (
    process.env.ORGANIZATIONS_API_KEY &&
    process.env.ORGANIZATIONS_BASE_ID &&
    process.env.ORGANIZATIONS_TABLE_NAME
  );
}

export default async function handler(req, res) {
  res.setHeader("X-Route", "athlete/account/org");

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return safeJson(res, 405, { error: "Method not allowed" });
  }

  const missing = envCheck();
  if (missing.ATHLETE_API_KEY || missing.ATHLETE_BASE_ID || missing.ATHLETE_TABLE_NAME) {
    return safeJson(res, 500, { error: "Athletes Airtable not configured.", missing });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = requireAthlete(req);
  if (!auth?.ok) return safeJson(res, 401, { error: auth?.error || "Unauthorized" });

  const athlete = auth.athlete || {};

  // Identify the athlete: prefer id, fall back to email.
  // requireAthlete reads from the HttpOnly cookie which has id/Email/role.
  const athleteId    = asString(athlete.id || athlete.Id || athlete.athleteId || "");
  const athleteEmail = asString(
    athlete.Email || athlete.email ||
    athlete.athleteEmail || ""
  ).toLowerCase();

  if (!athleteId && !athleteEmail) {
    return safeJson(res, 400, {
      error: "Cannot identify athlete — session cookie is missing id and email. Log out and back in.",
    });
  }

  const TABLE    = process.env.ATHLETE_TABLE_NAME;
  const athBase  = new Airtable({ apiKey: process.env.ATHLETE_API_KEY })
    .base(process.env.ATHLETE_BASE_ID);

  try {
    // ── 1) Fetch athlete row from Athletes table ──────────────────────────
    let athleteRecord = null;

    if (athleteId) {
      // Fastest path — fetch by Airtable record ID directly
      try {
        athleteRecord = await athBase(TABLE).find(athleteId);
      } catch {
        // If id isn't a valid Airtable record ID, fall through to email lookup
        athleteRecord = null;
      }
    }

    if (!athleteRecord && athleteEmail) {
      const rows = await athBase(TABLE)
        .select({
          maxRecords: 1,
          filterByFormula: `LOWER({Email})='${escapeAirtableString(athleteEmail)}'`,
        })
        .firstPage();
      athleteRecord = rows?.[0] || null;
    }

    if (!athleteRecord) {
      return safeJson(res, 404, { error: "Athlete record not found." });
    }

    const f = athleteRecord.fields || {};

    // ── 2) Extract org info from the athlete row ──────────────────────────

    // Token field on athlete row = org token (written by connectOrg for dashboard compat)
    const orgToken = asString(firstValue(f["Token"]));

    // Organization is a linked record field — array of org record IDs
    const orgLinkRaw = f["Organization"];
    const orgRecordId = asString(firstValue(orgLinkRaw));

    // Check for a Name lookup field first (saves an extra API call)
    const orgNameFromLookup = pickFirst(f, ORG_NAME_LOOKUPS);

    // ── 3) If no name from lookup, fetch from Organizations table ─────────
    let orgName = orgNameFromLookup;
    let orgId   = orgRecordId;

    if (!orgName && orgRecordId && orgEnvCheck()) {
      try {
        const orgBase = new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
          .base(process.env.ORGANIZATIONS_BASE_ID);

        const orgRecord = await orgBase(process.env.ORGANIZATIONS_TABLE_NAME).find(orgRecordId);
        orgName = asString(orgRecord?.fields?.Name || orgRecord?.fields?.name || "");
      } catch (e) {
        console.warn("[athlete/account/org] org name lookup failed (non-fatal):", e?.message);
      }
    }

    // ── 4) If still no org record ID but we have a token, look up by token ──
    // Handles the case where Organization linked field isn't set but Token was written.
    if (!orgId && orgToken && orgEnvCheck()) {
      try {
        const orgBase = new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
          .base(process.env.ORGANIZATIONS_BASE_ID);

        const orgRows = await orgBase(process.env.ORGANIZATIONS_TABLE_NAME)
          .select({
            maxRecords: 1,
            filterByFormula: `LOWER({Token})='${escapeAirtableString(orgToken.toLowerCase())}'`,
          })
          .firstPage();

        if (orgRows?.[0]) {
          orgId   = orgRows[0].id;
          orgName = orgName || asString(orgRows[0].fields?.Name || "");
        }
      } catch (e) {
        console.warn("[athlete/account/org] token→org lookup failed (non-fatal):", e?.message);
      }
    }

    return safeJson(res, 200, {
      ok: true,
      org: {
        name:  orgName,   // "" if not found
        id:    orgId,     // "" if not found
        token: orgToken,  // "" if not found
      },
      debug: {
        resolvedBy:  athleteId ? "id" : "email",
        hasOrgToken: Boolean(orgToken),
        hasOrgId:    Boolean(orgId),
        hasOrgName:  Boolean(orgName),
      },
    });

  } catch (err) {
    console.error("[athlete/account/org] error:", err);
    return safeJson(res, 500, {
      error: "Failed to load athlete org info.",
      airtable: { statusCode: err?.statusCode, error: err?.error, message: err?.message },
    });
  }
}