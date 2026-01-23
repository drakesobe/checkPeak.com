// pages/api/athlete/connectOrg.js
import Airtable from "airtable";

/**
 * connectOrg
 * Athlete connects to an Organization via org Token/code.
 *
 * ✅ Fix for your new Airtable schema:
 * - Athletes.Organization is now a LINKED RECORD to Organizations
 *   -> must be set as [orgRecordId]
 *
 * ✅ ALSO FIX for your current org dashboard / filtering:
 * - Your org-side getAthletes currently filters athletes by {Token} = orgToken
 * - If we only set the linked Organization field, org dashboard may still show 0
 * - So we ALSO write Athlete.Token = orgToken (keeps compatibility + easy querying)
 *
 * ✅ Security improvements:
 * - Prefer athlete identity from the HttpOnly "user" cookie if present
 * - Only fall back to req.body.email if no cookie is present
 *
 * ✅ UX improvements:
 * - Return org { id, name, token } so the client can persist it to localStorage/UI
 * - Best-effort update of the HttpOnly cookie "user" to include org info
 *   (so server-side endpoints relying on the cookie can see the new org)
 */

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function normalizeToken(token) {
  return String(token || "").trim();
}

// ---- cookie helpers (best-effort) ----
function parseCookieHeader(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join("="));
    return acc;
  }, {});
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function readUserCookie(req) {
  // Next.js pages/api often exposes req.cookies, but we support raw header too.
  let raw = req?.cookies?.user;

  if (!raw) {
    const header = req?.headers?.cookie || "";
    if (header) {
      const cookies = parseCookieHeader(header);
      raw = cookies.user;
    }
  }

  if (!raw || typeof raw !== "string") return null;

  const decoded =
    raw.includes("%7B") || raw.includes("%22") ? decodeURIComponent(raw) : raw;

  return safeJsonParse(decoded);
}

function setUserCookie(res, sessionUser) {
  const value = encodeURIComponent(JSON.stringify(sessionUser));
  const isProd = process.env.NODE_ENV === "production";

  const parts = [
    `user=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800", // 7 days
  ];
  if (isProd) parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ---- Prefer cookie identity (more secure) ----
    const sessionUser = readUserCookie(req);

    const { token, email } = req.body || {};
    const cleanToken = normalizeToken(token);

    // If cookie exists, use that email; otherwise use body email
    const cookieEmail = normalizeEmail(sessionUser?.Email || sessionUser?.email || "");
    const cleanEmail = cookieEmail || normalizeEmail(email);

    if (!cleanToken) {
      return res.status(400).json({ error: "Organization code is required." });
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({
        error:
          "Valid email is required. Please log out and log back in, then try again.",
      });
    }

    // Optional: enforce that cookie user is an Athlete (if cookie exists)
    if (sessionUser?.role || sessionUser?.Role) {
      const r = String(sessionUser.role || sessionUser.Role || "")
        .trim()
        .toLowerCase();
      // treat anything containing "ath" as athlete
      const isAth = r === "athlete" || r.includes("ath");
      if (!isAth) {
        return res.status(403).json({ error: "Only athletes can connect an organization." });
      }
    }

    // ---- ENV ----
    const ORG_API_KEY = process.env.ORGANIZATIONS_API_KEY;
    const ORG_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
    const ORG_TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

    const ATH_API_KEY = process.env.ATHLETE_API_KEY;
    const ATH_BASE_ID = process.env.ATHLETE_BASE_ID;
    const ATH_TABLE = process.env.ATHLETE_TABLE_NAME; // name OR table id

    if (!ORG_API_KEY || !ORG_BASE_ID || !ORG_TABLE) {
      return res.status(500).json({ error: "Organizations Airtable not configured." });
    }
    if (!ATH_API_KEY || !ATH_BASE_ID || !ATH_TABLE) {
      return res.status(500).json({ error: "Athletes Airtable not configured." });
    }

    const orgBase = new Airtable({ apiKey: ORG_API_KEY }).base(ORG_BASE_ID);
    const athBase = new Airtable({ apiKey: ATH_API_KEY }).base(ATH_BASE_ID);

    // ---- 1) Find org by Token ----
    // IMPORTANT: We LOWER() both sides so tokens are case-insensitive
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
    const orgName = String(orgRecord.fields?.Name || "Organization").trim();

    // This is the org token stored on the org record (source of truth)
    const orgToken = String(orgRecord.fields?.Token || "").trim();

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

    // ---- 3) Update athlete record ----
    // ✅ Linked record requires [orgRecord.id]
    // ✅ Also set Token so org dashboards that filter by {Token} keep working
    // NOTE: if orgToken is empty for some reason, we still link Organization.
    const updateFields = {
      Organization: [orgRecord.id],
      ...(orgToken ? { Token: orgToken } : {}),
    };

    await athBase(ATH_TABLE).update([
      {
        id: athleteRecord.id,
        fields: updateFields,
      },
    ]);

    // ---- 4) Best-effort: update the HttpOnly cookie user payload ----
    // So after refresh, server-side reads can see org info (and your UI can also re-hydrate if desired).
    try {
      if (sessionUser && cleanEmail === cookieEmail) {
        const nextSession = {
          ...sessionUser,
          // keep both styles for compatibility
          OrgName: orgName,
          OrganizationName: orgName,
          organizationName: orgName,
          OrganizationId: orgRecord.id,
          organizationId: orgRecord.id,
          ...(orgToken ? { Token: orgToken } : {}),
        };

        // Remove empties
        Object.keys(nextSession).forEach((k) => {
          if (nextSession[k] === "" || nextSession[k] == null) delete nextSession[k];
        });

        setUserCookie(res, nextSession);
      }
    } catch (e) {
      console.warn("[connectOrg] cookie update failed (non-fatal):", e?.message || e);
    }

    return res.status(200).json({
      ok: true,
      athlete: {
        id: athleteRecord.id,
        email: cleanEmail,
      },
      organization: {
        id: orgRecord.id,
        name: orgName,
        token: orgToken || "", // helpful for client/localStorage + legacy endpoints
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
