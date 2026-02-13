// pages/api/org/getPrescriptionsForAthlete.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) {
  return String(v ?? "").trim();
}

function normalizeEmail(v) {
  return asString(v).toLowerCase();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

/* ---------------- Airtable base ---------------- */

const base =
  process.env.PRESCRIPTIONS_API_KEY && process.env.PRESCRIPTIONS_BASE_ID
    ? new Airtable({ apiKey: process.env.PRESCRIPTIONS_API_KEY }).base(process.env.PRESCRIPTIONS_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const org = requireOrg(req, res);
    if (!org) return;

    if (!base) {
      return res.status(500).json({
        error: "Missing Airtable config (PRESCRIPTIONS_API_KEY / PRESCRIPTIONS_BASE_ID).",
      });
    }

    const athleteToken = asString(req.query?.athleteToken);
    const athleteEmail = normalizeEmail(req.query?.athleteEmail);

    if (!athleteToken && !athleteEmail) {
      return res.status(400).json({ error: "athleteToken is required (preferred). athleteEmail is legacy fallback." });
    }

    // ✅ Build filter: TOKEN-first, else EMAIL
    // IMPORTANT: Update field names below to match your Airtable schema exactly.
    // Common ones: {AthleteToken} or {athleteToken} or {Athlete Token}
    const filterByFormula = athleteToken
      ? `{AthleteToken}='${escapeAirtableString(athleteToken)}'`
      : `{AthleteEmail}='${escapeAirtableString(athleteEmail)}'`;

    // If you also need org scoping, add AND() with your org field here, e.g.:
    // const filterByFormula = `AND(${tokenOrEmailFormula}, FIND('${org.orgId}', ARRAYJOIN({Organization}&'')) > 0)`

    const TABLE = process.env.PRESCRIPTIONS_TABLE_ID || "Prescriptions";

    const records = await base(TABLE)
      .select({
        filterByFormula,
        sort: [{ field: "CreatedAt", direction: "desc" }], // adjust if your field differs
        maxRecords: 50,
      })
      .firstPage();

    const prescriptions = records.map((r) => ({
      id: r.id,
      title: r.get("Title") || r.get("title") || "",
      prescription: r.get("Prescription") || r.get("prescription") || "",
      createdAt: r.get("CreatedAt") || r.get("createdAt") || r._rawJson?.createdTime || "",
      createdBy: r.get("CreatedBy") || r.get("createdBy") || "",
    }));

    return res.status(200).json({
      ok: true,
      prescriptions,
      debug: {
        used: athleteToken ? "athleteToken" : "athleteEmail",
        athleteToken: athleteToken || "",
        athleteEmail: athleteEmail || "",
        filterByFormula,
      },
    });
  } catch (err) {
    console.error("[getPrescriptionsForAthlete] error:", err);
    return res.status(500).json({ error: "Server error", detail: err?.message || String(err) });
  }
}
