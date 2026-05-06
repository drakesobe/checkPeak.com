// pages/api/org/season-calendar/save.js
// POST { periods: [] } — saves the org's season calendar periods.
// Writes JSON to the "SeasonCalendar" Long Text field on the org's
// Organizations Airtable record, identified by session orgId.

import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function getBase() {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS_API_KEY or ORGANIZATIONS_BASE_ID env var missing.");
  }
  return new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
}

function sanitizePeriod(p) {
  return {
    id:     String(p?.id    || "").slice(0, 64),
    name:   String(p?.name  || "").slice(0, 120),
    type:   String(p?.type  || "season").slice(0, 40),
    start:  String(p?.start || "").slice(0, 10),
    end:    String(p?.end   || "").slice(0, 10),
    sports: Array.isArray(p?.sports)
      ? p.sports.map(s => String(s).slice(0, 40)).filter(Boolean)
      : [],
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  if (!orgId) {
    return res.status(400).json({ error: "No orgId on session — re-login." });
  }

  const { periods } = req.body || {};
  if (!Array.isArray(periods)) {
    return res.status(400).json({ error: "periods must be an array." });
  }

  // Sanitize and cap at 60 periods
  const clean = periods.slice(0, 60).map(sanitizePeriod);

  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    await getBase()(table).update(orgId, {
      SeasonCalendar: JSON.stringify(clean),
    });

    return res.status(200).json({ ok: true, periods: clean });
  } catch (e) {
    console.error("[season-calendar/save]", e?.message || e);
    return res.status(500).json({
      error: e?.message || "Failed to save season calendar.",
    });
  }
}