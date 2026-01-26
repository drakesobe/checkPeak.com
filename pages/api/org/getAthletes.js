// pages/api/org/getAthletes.js
import { requireOrg } from "@/lib/requireOrg";
import dns from "dns/promises";

function escapeAirtableString(str = "") {
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
 * Matches either:
 * - Token text
 * - Token lookup/array
 * - Organization linked recId array
 */
function buildFilterFormula({ orgToken, orgId }) {
  const parts = [];

  const safeToken = escapeAirtableString(orgToken || "");
  const safeOrgId = escapeAirtableString(orgId || "");

  if (safeToken) parts.push(`{Token}='${safeToken}'`);
  if (safeToken) parts.push(`FIND('${safeToken}', ARRAYJOIN({Token}))`);
  if (safeOrgId) parts.push(`FIND('${safeOrgId}', ARRAYJOIN({Organization}))`);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `OR(${parts.join(",")})`;
}

function toStr(v) {
  if (v === null || typeof v === "undefined") return "";
  return String(v);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({
      error: "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
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

  const orgToken = String(auth?.org?.token || "").trim();
  const orgId = String(auth?.org?.id || auth?.org?.orgId || auth?.orgId || "").trim();

  if (!orgToken && !orgId) {
    return res.status(401).json({
      error: "Organization token/orgId missing from session. Re-login and try again.",
    });
  }

  // DNS proof (optional)
  try {
    const lookedUp = await dns.lookup("api.airtable.com");
    console.log("[getAthletes] dns.lookup(api.airtable.com) ok:", lookedUp);
  } catch (e) {
    console.error("[getAthletes] dns.lookup(api.airtable.com) FAILED:", e?.code, e?.message);
    return res.status(502).json({
      error: "Unable to reach Airtable (DNS/network error).",
      code: e?.code || "DNS_LOOKUP_FAILED",
    });
  }

  try {
    const table = encodeURIComponent(ATHLETE_TABLE_NAME);
    const baseUrl = `https://api.airtable.com/v0/${ATHLETE_BASE_ID}/${table}`;

    const filterByFormula = buildFilterFormula({ orgToken, orgId });
    if (!filterByFormula) {
      return res.status(401).json({
        error: "Unable to build Airtable filter (missing orgToken/orgId). Re-login to org and try again.",
      });
    }

    const sortField = "CreatedAt";

    let offset = "";
    const all = [];
    const MAX_PAGES = 10;

    // ✅ Add the columns you need for “Team/Sport select”
    const FIELDS = [
      "Name",
      "Email",
      "CreatedAt",
      "Title",
      "Role",
      "Token",
      "Organization",

      // NEW — use these in your CreateWorkoutModal “Select team”
      "Sport",        // ex: football, basketball
      "Team",         // optional (if you have sub-teams like Varsity/JV)
      "Status",       // optional
      "LastUpdated",  // optional (for stale pill logic)
    ];

    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams();
      qs.set("filterByFormula", filterByFormula);
      qs.set("sort[0][field]", sortField);
      qs.set("sort[0][direction]", "desc");

      for (const f of FIELDS) qs.append("fields[]", f);
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
        const fields = r?.fields || {};
        all.push({
          id: r.id,

          name: toStr(fields.Name),
          email: toStr(fields.Email),
          createdAt: toStr(fields.CreatedAt),
          title: toStr(fields.Title),
          role: toStr(fields.Role),

          // NEW (safe even if column doesn’t exist)
          sport: toStr(fields.Sport), // this is what you’ll group by
          team: toStr(fields.Team),
          status: toStr(fields.Status),
          lastUpdated: toStr(fields.LastUpdated),

          // keep for debugging if needed
          token: fields.Token,
          organization: fields.Organization,
        });
      }

      offset = String(data?.offset || "");
      if (!offset) break;
    }

    // Optional: return distinct team/sport lists to power dropdowns
    const sports = Array.from(new Set(all.map((a) => String(a.sport || "").trim()).filter(Boolean))).sort();
    const teams = Array.from(new Set(all.map((a) => String(a.team || "").trim()).filter(Boolean))).sort();

    return res.status(200).json({ athletes: all, sports, teams });
  } catch (err) {
    console.error("[getAthletes] error:", err);

    if (isNetworkError(err)) {
      return res.status(502).json({
        error: "Unable to reach Airtable (DNS/network error).",
        code: err?.code || "NETWORK_ERROR",
        message: String(err?.message || ""),
      });
    }

    return res.status(500).json({
      error: "Failed to fetch athletes",
      details: { message: String(err?.message || "") },
    });
  }
}
