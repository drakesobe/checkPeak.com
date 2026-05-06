// pages/api/org/athletes/bulk-update.js
// POST { ids: string[], fields: { sport?, phone?, ... } }
// Updates a set of athlete records with the provided scalar fields.
// Only whitelisted fields are written - no arbitrary data reaches Airtable.

import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base } from "@/lib/airtableOrgWorkoutConfig";

function chunk(arr, n = 10) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Only these fields can be bulk-updated from the client.
// Add more here as needed - never pass raw fields through directly.
const ALLOWED_FIELDS = {
  sport:  v => ({ sport: String(v || "").toLowerCase().trim() }),
  phone:  v => ({ Phone: String(v || "").trim() }),
  status: v => ({ Status: String(v || "").trim() }),
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const { ids, fields } = req.body || {};

  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: "ids[] is required" });
  }
  if (!fields || typeof fields !== "object" || !Object.keys(fields).length) {
    return res.status(400).json({ error: "fields object is required" });
  }
  if (ids.length > 200) {
    return res.status(400).json({ error: "Maximum 200 records per bulk update" });
  }

  // Build the Airtable field patch - only allowed fields pass through
  const airtableFields = {};
  for (const [key, value] of Object.entries(fields)) {
    const builder = ALLOWED_FIELDS[key];
    if (builder) Object.assign(airtableFields, builder(value));
  }

  if (!Object.keys(airtableFields).length) {
    return res.status(400).json({ error: "No valid fields to update. Allowed: " + Object.keys(ALLOWED_FIELDS).join(", ") });
  }

  try {
    const b       = base();
    const table   = b(AT.tables.athletes);
    let   updated = 0;

    for (const batch of chunk(ids, 10)) {
      const updates = batch.map(id => ({ id: String(id).trim(), fields: airtableFields }));
      await table.update(updates);
      updated += batch.length;
    }

    return res.status(200).json({ ok: true, updated });
  } catch (e) {
    console.error("[athletes/bulk-update]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to update athletes" });
  }
}