// pages/api/org/season-calendar/get.js
// GET — returns the org's saved season calendar periods.
// Reads the "SeasonCalendar" Long Text field on the Organizations Airtable record.

import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function getBase() {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS_API_KEY or ORGANIZATIONS_BASE_ID env var missing.");
  }
  return new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  if (!orgId) {
    return res.status(400).json({ error: "No orgId on session — re-login." });
  }

  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    const record = await getBase()(table).find(orgId);
    const raw    = record?.fields?.SeasonCalendar || "";

    let periods = [];
    if (raw) {
      try { periods = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(periods)) periods = [];

    return res.status(200).json({ ok: true, periods });
  } catch (e) {
    console.error("[season-calendar/get]", e?.message || e);
    // Return empty rather than crashing — calendar still works without periods
    return res.status(200).json({ ok: true, periods: [], warning: e?.message });
  }
}