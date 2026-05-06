// pages/api/org/workouts/update.js
// POST { id: string, title?: string, date?: string, sport?: string, status?: string }
// Updates editable fields on a DailyWorkout Airtable record.
// Auth: same session cookie pattern as create.js / range.js

import Airtable from "airtable";

const VALID_STATUSES = ["assigned", "complete", "draft", "archived"];

// Map of sport display names → Airtable field values (extend as needed)
const VALID_SPORTS = [
  "swimming", "dryland", "weights", "yoga", "recovery",
  "cardio", "cycling", "running", "crossfit", "other",
];

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

  const { id, title, date, sport, status } = req.body || {};

  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ error: "id is required" });
  }

  // Build the fields object - only include keys that were actually sent
  const fields = {};

  if (title !== undefined) {
    const t = String(title).trim();
    if (!t) return res.status(400).json({ error: "title cannot be empty" });
    fields.Title = t;
  }

  if (date !== undefined) {
    // Expect ISO date string YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date).trim())) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    fields.Date = String(date).trim();
  }

  if (sport !== undefined) {
    const s = String(sport).trim().toLowerCase();
    fields.Sport = s;
  }

  if (status !== undefined) {
    const s = String(status).trim().toLowerCase();
    if (!VALID_STATUSES.includes(s)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    fields.Status = s;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No updatable fields provided" });
  }

  const orgId = getOrgId(req);
  if (!orgId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const base   = getBase();
    const table  = process.env.AIRTABLE_WORKOUTS_TABLE || "DailyWorkouts";
    const record = await base(table).find(String(id).trim());

    // Verify ownership
    const recordOrgId =
      record?.fields?.OrgId ||
      record?.fields?.orgId ||
      record?.fields?.Organization?.[0] || "";
    if (recordOrgId && String(recordOrgId) !== String(orgId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updated = await base(table).update(String(id).trim(), fields);

    return res.status(200).json({
      ok:     true,
      id:     updated.id,
      fields: {
        title:  updated.fields?.Title,
        date:   updated.fields?.Date,
        sport:  updated.fields?.Sport,
        status: updated.fields?.Status,
      },
    });
  } catch (e) {
    console.error("[workouts/update]", e?.message || e);
    if (e?.statusCode === 404 || String(e?.message || "").includes("not found")) {
      return res.status(404).json({ error: "Workout not found" });
    }
    return res.status(500).json({ error: e?.message || "Failed to update workout" });
  }
}