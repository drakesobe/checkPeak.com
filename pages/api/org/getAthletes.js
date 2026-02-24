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

function safeArray(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

function firstString(v) {
  if (Array.isArray(v)) return String(v[0] || "").trim();
  return String(v || "").trim();
}

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
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

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

  // dev-only DNS check
  if (process.env.NODE_ENV !== "production") {
    try {
      await dns.lookup("api.airtable.com");
    } catch (e) {
      console.error("[getAthletes] dns.lookup(api.airtable.com) FAILED:", e?.code, e?.message);
    }
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
     * ✅ IMPORTANT:
     * Only request fields that EXIST in AthleteScans.
     * Your table has "sport" (lowercase) and "Team" (capital T).
     * Do NOT request "Sport" if it doesn't exist.
     */
    const FIELDS = [
      "Name",
      "Email",
      "AthleteToken",
      "Role",
      "CreatedAt",
      "Organization",
      "Token",
      "sport", // ✅ real field
      "Team",  // ✅ real field
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
        const athleteToken = firstString(fields.AthleteToken);

        all.push({
          id: r.id,
          name: toStr(fields.Name),
          email: toStr(fields.Email),
          athleteToken,
          role: toStr(fields.Role),
          createdAt: toStr(fields.CreatedAt),
          sport: toStr(fields.sport),
          team: toStr(fields.Team),
          status: toStr(fields.Status),
          organization: safeArray(fields.Organization),
          token: fields.Token,
        });
      }

      offset = String(data?.offset || "");
      if (!offset) break;
    }

    debug.count = all.length;

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