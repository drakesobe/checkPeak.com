// pages/api/org/templates/delete.js
// POST { id } - removes a template by ID.

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "No orgId on session." });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required." });

  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    const record  = await getBase()(table).find(orgId);
    const raw     = (record?.fields?.WorkoutTemplates || "").replace(/\\\_/g, "_");
    let templates = [];
    try { templates = JSON.parse(raw); } catch {}
    if (!Array.isArray(templates)) templates = [];

    const before = templates.length;
    templates    = templates.filter(t => t.id !== String(id));

    if (templates.length === before) {
      return res.status(404).json({ error: "Template not found." });
    }

    await getBase()(table).update(orgId, {
      WorkoutTemplates: JSON.stringify(templates),
    });

    return res.status(200).json({ ok: true, deleted: id });
  } catch (e) {
    console.error("[templates/delete]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to delete template." });
  }
}