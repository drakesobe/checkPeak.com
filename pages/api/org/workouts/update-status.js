// pages/api/org/workouts/update-status.js
// POST { id: string, status: string }
// Updates the Status field on a DailyWorkout Airtable record.
// Auth: same session cookie pattern as create.js / range.js

import Airtable from "airtable";

const VALID_STATUSES = ["assigned", "complete", "draft", "archived"];

function getBase() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    throw new Error("Airtable env vars not configured");
  }
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID);
}

function getOrgId(req) {
  // Mirror your existing auth pattern — adjust to match your session/cookie field names
  try {
    const raw  = req.cookies?.["apex_session"] || req.cookies?.["session"] || "";
    const sess = raw ? JSON.parse(Buffer.from(raw.split(".")[1] || "{}", "base64").toString()) : {};
    return sess?.orgId || sess?.OrgId || sess?.organizationId || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, status } = req.body || {};

  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ error: "id is required" });
  }
  if (!status || !VALID_STATUSES.includes(String(status).toLowerCase())) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const base   = getBase();
    const table  = process.env.AIRTABLE_WORKOUTS_TABLE || "DailyWorkouts";
    const record = await base(table).find(String(id).trim());

    // Verify this workout belongs to the org making the request
    const recordOrgId = record?.fields?.OrgId || record?.fields?.orgId || record?.fields?.Organization?.[0] || "";
    if (recordOrgId && String(recordOrgId) !== String(orgId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updated = await base(table).update(String(id).trim(), {
      Status: String(status).toLowerCase(),
    });

    return res.status(200).json({
      ok:      true,
      id:      updated.id,
      status:  updated.fields?.Status,
    });
  } catch (e) {
    console.error("[update-status]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to update workout status" });
  }
}