// pages/api/org/getAthletes.js
import { requireOrg } from "@/lib/requireOrg";
import dns from "dns/promises";

function escapeAirtableString(str = "") {
  // Airtable formula strings use single quotes; escape them.
  return String(str).replace(/'/g, "\\'");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function isNetworkError(err) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return (
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    msg.includes("getaddrinfo ENOTFOUND") ||
    msg.includes("EAI_AGAIN")
  );
}

/**
 * Build a filter formula that survives schema changes:
 * - If Token is text: {Token}='ORG-...'
 * - If Token is a lookup (array): FIND('ORG-...', ARRAYJOIN({Token}))
 * - If Organization is a linked record (array of recIds): FIND('recORG...', ARRAYJOIN({Organization}))
 *
 * We OR these together so it matches whichever model you're currently using.
 */
function buildFilterFormula({ orgToken, orgId }) {
  const parts = [];

  const safeToken = escapeAirtableString(orgToken || "");
  const safeOrgId = escapeAirtableString(orgId || "");

  // 1) Token as plain text (your original)
  if (safeToken) {
    parts.push(`{Token}='${safeToken}'`);
  }

  // 2) Token as lookup/array (common after linking orgs)
  if (safeToken) {
    parts.push(`FIND('${safeToken}', ARRAYJOIN({Token}))`);
  }

  // 3) Organization as linked record (preferred going forward)
  // This checks whether the org record id is present in the Organization links
  if (safeOrgId) {
    parts.push(`FIND('${safeOrgId}', ARRAYJOIN({Organization}))`);
  }

  if (parts.length === 0) return ""; // caller should handle
  if (parts.length === 1) return parts[0];
  return `OR(${parts.join(",")})`;
}

export default async function handler(req, res) {
  // Prevent caching so org dashboards always reflect latest state
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME; // can be table name OR table id

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({
      error:
        "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
      missing: {
        ATHLETE_API_KEY: !ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  const auth = requireOrg(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  // Keep your existing behavior (orgToken required), but ALSO use orgId when available.
  const orgToken = String(auth?.org?.token || "").trim();
  const orgId = String(
    auth?.org?.id || auth?.org?.orgId || auth?.orgId || ""
  ).trim();

  if (!orgToken && !orgId) {
    return res.status(401).json({
      error:
        "Organization token/orgId missing from session. Re-login and try again.",
    });
  }

  // Optional but extremely helpful: prove DNS works in the runtime
  // (If this fails, Airtable will never work from this environment.)
  try {
    const lookedUp = await dns.lookup("api.airtable.com");
    console.log("[getAthletes] dns.lookup(api.airtable.com) ok:", lookedUp);
  } catch (e) {
    console.error(
      "[getAthletes] dns.lookup(api.airtable.com) FAILED:",
      e?.code,
      e?.message
    );
    return res.status(502).json({
      error: "Unable to reach Airtable (DNS/network error).",
      code: e?.code || "DNS_LOOKUP_FAILED",
    });
  }

  try {
    // Airtable REST list records (pagination via offset)
    const table = encodeURIComponent(ATHLETE_TABLE_NAME);
    const baseUrl = `https://api.airtable.com/v0/${ATHLETE_BASE_ID}/${table}`;

    const filterByFormula = buildFilterFormula({ orgToken, orgId });
    if (!filterByFormula) {
      return res.status(401).json({
        error:
          "Unable to build Airtable filter (missing orgToken/orgId). Re-login to org and try again.",
      });
    }

    const sortField = "CreatedAt";

    let offset = "";
    const all = [];

    // Safety cap so you never infinite-loop
    const MAX_PAGES = 10;

    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams();
      qs.set("filterByFormula", filterByFormula);
      qs.set("sort[0][field]", sortField);
      qs.set("sort[0][direction]", "desc");

      // only fetch what you need
      qs.append("fields[]", "Name");
      qs.append("fields[]", "Email");
      qs.append("fields[]", "CreatedAt");
      qs.append("fields[]", "Title");
      qs.append("fields[]", "Role");
      qs.append("fields[]", "Token");
      qs.append("fields[]", "Organization");

      if (offset) qs.set("offset", offset);

      const url = `${baseUrl}?${qs.toString()}`;

      const atRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ATHLETE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const data = await safeJson(atRes);

      if (!atRes.ok) {
        console.error("[getAthletes] airtable http error:", atRes.status, data);
        // Airtable error, but our server is fine → 502 is appropriate
        return res.status(502).json({
          error: "Airtable request failed",
          status: atRes.status,
          details: data,
          debug: {
            filterByFormula,
            sortField,
            table: ATHLETE_TABLE_NAME,
            baseId: ATHLETE_BASE_ID,
          },
        });
      }

      const records = Array.isArray(data?.records) ? data.records : [];
      for (const r of records) {
        all.push({
          id: r.id,
          name: r?.fields?.Name || "",
          email: r?.fields?.Email || "",
          createdAt: r?.fields?.CreatedAt || "",
          title: r?.fields?.Title || "",
          role: r?.fields?.Role || "",
          // Keep these optional fields for debugging if needed:
          token: r?.fields?.Token,
          organization: r?.fields?.Organization,
        });
      }

      offset = String(data?.offset || "");
      if (!offset) break;
    }

    return res.status(200).json({ athletes: all });
  } catch (err) {
    console.error("[getAthletes] error:", err);

    // If this is DNS / network, return 502 with a clear signal
    if (isNetworkError(err)) {
      return res.status(502).json({
        error: "Unable to reach Airtable (DNS/network error).",
        code: err?.code || "NETWORK_ERROR",
        message: String(err?.message || ""),
      });
    }

    return res.status(500).json({
      error: "Failed to fetch athletes",
      details: {
        message: String(err?.message || ""),
      },
    });
  }
}
