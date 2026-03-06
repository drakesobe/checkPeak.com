// pages/api/org/workouts/delete.js
// POST { id: string }
// Hard-deletes the DailyWorkout Airtable record by ID.
// Org ownership is verified before deletion.
// Auth: same session cookie pattern as create.js / range.js

import Airtable from "airtable";

function getBase() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    throw new Error("Airtable env vars not configured");
  }
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID);
}

function getOrgId(req) {
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

  const { id } = req.body || {};

  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ error: "id is required" });
  }

  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const base  = getBase();
    const table = process.env.AIRTABLE_WORKOUTS_TABLE || "DailyWorkouts";

    // Fetch first to verify ownership before deleting
    const record = await base(table).find(String(id).trim());

    const recordOrgId = record?.fields?.OrgId || record?.fields?.orgId || record?.fields?.Organization?.[0] || "";
    if (recordOrgId && String(recordOrgId) !== String(orgId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    await base(table).destroy(String(id).trim());

    return res.status(200).json({ ok: true, deleted: id });
  } catch (e) {
    console.error("[workouts/delete]", e?.message || e);
    // Airtable throws a specific error when record is not found
    if (e?.statusCode === 404 || String(e?.message || "").includes("not found")) {
      return res.status(404).json({ error: "Workout not found" });
    }
    return res.status(500).json({ error: e?.message || "Failed to delete workout" });
  }
}