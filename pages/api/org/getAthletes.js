// pages/api/org/getAthletes.js
import { requireOrg } from "@/lib/requireOrg";
import dns from "dns/promises";

function escapeFormulaString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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

function toStr(v) {
  if (v === null || typeof v === "undefined") return "";
  return String(v);
}

// Make sure values are always arrays for safe ARRAYJOIN usage
function safeArray(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

// Lookup-safe: if a field sometimes comes back as an array, take the first value
function firstString(v) {
  if (Array.isArray(v)) return String(v[0] || "").trim();
  return String(v || "").trim();
}

/**
 * Build a filter formula that can survive schema quirks:
 * - Org link field "Organization" may be linked-record array (record IDs)
 * - Org token field on athlete record "Token" may be a text field OR could be a lookup/array
 *
 * We check:
 * 1) linked org record id
 * 2) token exact match
 * 3) token contained in ARRAYJOIN for lookup/array cases
 */
function buildFilterFormula({ orgToken, orgRecordId }) {
  const parts = [];
  const t = escapeFormulaString(orgToken || "");
  const oid = escapeFormulaString(orgRecordId || "");

  if (oid) parts.push(`FIND('${oid}', ARRAYJOIN({Organization}&""))`);
  if (t) parts.push(`{Token}='${t}'`);
  if (t) parts.push(`FIND('${t}', ARRAYJOIN({Token}&""))`);

  const uniq = Array.from(new Set(parts)).filter(Boolean);
  if (!uniq.length) return "";
  if (uniq.length === 1) return uniq[0];
  return `OR(${uniq.join(",")})`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME; // table name or table id

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({
      error: "AthleteScans Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
      missing: {
        ATHLETE_API_KEY: !ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const orgToken = String(auth?.org?.token || auth?.org?.Token || auth?.token || "").trim();
  const orgRecordId = String(auth?.org?.id || auth?.org?.orgId || auth?.orgId || "").trim();

  if (!orgToken && !orgRecordId) {
    return res.status(401).json({ error: "Organization token/orgId missing from session. Re-login and try again." });
  }

  // DNS proof (helps you distinguish Airtable downtime vs your code)
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

  const debug = {
    table: ATHLETE_TABLE_NAME,
    baseId: ATHLETE_BASE_ID,
    orgTokenPresent: Boolean(orgToken),
    orgRecordIdPresent: Boolean(orgRecordId),
    orgToken,
    orgRecordId,
    filterByFormula: "",
    fieldsRequested: [],
    pages: [],
    count: 0,
  };

  try {
    const table = encodeURIComponent(ATHLETE_TABLE_NAME);
    const baseUrl = `https://api.airtable.com/v0/${ATHLETE_BASE_ID}/${table}`;

    const filterByFormula = buildFilterFormula({ orgToken, orgRecordId });
    debug.filterByFormula = filterByFormula;

    if (!filterByFormula) {
      return res.status(401).json({
        error: "Unable to build Airtable filter (missing orgToken/orgId). Re-login and try again.",
        debug,
      });
    }

    /**
     * ✅ Key fix:
     * Always include AthleteToken so the Nutrition Queue can navigate by token.
     */
    const FIELDS = [
      "Name",
      "Email",
      "AthleteToken", // ✅ required (may be lookup array)
      "Role",
      "CreatedAt",
      "Organization",
      "Token",
      "sport",
      "Team",
      "Status",
    ];
    debug.fieldsRequested = FIELDS;

    const sortField = "CreatedAt";

    let offset = "";
    const all = [];
    const MAX_PAGES = 10;

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

      debug.pages.push({
        page,
        ok: atRes.ok,
        status: atRes.status,
        records: Array.isArray(data?.records) ? data.records.length : 0,
        hasOffset: Boolean(data?.offset),
      });

      if (!atRes.ok) {
        console.error("[getAthletes] airtable http error:", atRes.status, data);
        return res.status(502).json({
          error: "Airtable request failed",
          status: atRes.status,
          details: data,
          debug,
        });
      }

      const records = Array.isArray(data?.records) ? data.records : [];
      for (const r of records) {
        const fields = r?.fields || {};

        const athleteToken = firstString(fields.AthleteToken); // ✅ lookup-safe canonical string

        all.push({
          id: r.id, // ✅ AthleteScans record id (critical for NutritionPlans linking)
          name: toStr(fields.Name),
          email: toStr(fields.Email),
          athleteToken, // ✅ canonical
          role: toStr(fields.Role),
          createdAt: toStr(fields.CreatedAt),
          sport: toStr(fields.sport),
          team: toStr(fields.Team),
          status: toStr(fields.Status),

          // raw linkage for debugging
          organization: safeArray(fields.Organization),
          token: fields.Token, // could be text or array/lookup
        });
      }

      offset = String(data?.offset || "");
      if (!offset) break;
    }

    debug.count = all.length;

    // Optional: tidy sorts for UI filters
    const sports = Array.from(new Set(all.map((a) => String(a.sport || "").trim()).filter(Boolean))).sort();
    const teams = Array.from(new Set(all.map((a) => String(a.team || "").trim()).filter(Boolean))).sort();

    return res.status(200).json({ athletes: all, sports, teams, debug });
  } catch (err) {
    console.error("[getAthletes] error:", err);

    if (isNetworkError(err)) {
      return res.status(502).json({
        error: "Unable to reach Airtable (DNS/network error).",
        code: err?.code || "NETWORK_ERROR",
        message: String(err?.message || ""),
        debug,
      });
    }

    return res.status(500).json({
      error: "Failed to fetch athletes",
      details: { message: String(err?.message || "") },
      debug,
    });
  }
}
