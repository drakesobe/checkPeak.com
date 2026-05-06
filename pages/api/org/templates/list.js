// pages/api/org/templates/list.js
// GET — returns all workout templates for this org.
// Stored as JSON in the "WorkoutTemplates" Long Text field
// on the Organizations Airtable record. Same pattern as SeasonCalendar.
//
// First run: create a "WorkoutTemplates" Long Text field on your
// Organizations table in Airtable if it doesn't exist yet.

import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function getBase() {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS_API_KEY or ORGANIZATIONS_BASE_ID env var missing.");
  }
  return new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
}

function normalizeTemplate(t) {
  return {
    id:          String(t?.id          || ""),
    name:        String(t?.name        || "Untitled"),
    sport:       String(t?.sport       || ""),
    category:    String(t?.category    || "strength"),
    description: String(t?.description || ""),
    exercises:   Array.isArray(t?.exercises) ? t.exercises : [],
    createdAt:   String(t?.createdAt   || ""),
    updatedAt:   String(t?.updatedAt   || ""),
  };
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
  if (!orgId) return res.status(400).json({ error: "No orgId on session." });

  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    const record = await getBase()(table).find(orgId);
    const raw    = (record?.fields?.WorkoutTemplates || "")
      .replace(/\\\_/g, "_");  // same Airtable escape fix as SeasonCalendar

    let templates = [];
    if (raw) {
      try { templates = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(templates)) templates = [];

    return res.status(200).json({
      ok: true,
      templates: templates.map(normalizeTemplate),
    });
  } catch (e) {
    console.error("[templates/list]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to load templates." });
  }
}