// pages/api/org/updateAthleteMeta.js
// PATCH /api/org/updateAthleteMeta
// Body: { athleteId: string, sport?: string }
//
// Updates a single record in the AthleteScans table.
// athleteId must be the Airtable record ID (rec…).

import Airtable from "airtable";

// ── AthleteScans table credentials ───────────────────────────────────────────
// Matches the env vars in your .env for the AthleteScans DB
const API_KEY = process.env.ATHLETE_API_KEY;
const BASE_ID = process.env.ATHLETE_BASE_ID;   // appspE640Pggw1VP9
const TABLE   = process.env.ATHLETE_TABLE_NAME; // tblyfqbVBXKR7jPEz

// ── Airtable field name map ───────────────────────────────────────────────────
// Right-hand side must exactly match the column name in Airtable (case-sensitive).
// Your "sport" column is a Single Select field called "sport".
const FIELD_MAP = {
  sport: "sport",
};

function getBase() {
  if (!API_KEY || !BASE_ID || !TABLE) {
    throw new Error(
      "Missing AthleteScans credentials. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME in .env."
    );
  }
  return new Airtable({ apiKey: API_KEY }).base(BASE_ID);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed. Use PATCH." });
  }

  const { athleteId, sport } = req.body || {};

  // Validate
  if (!athleteId || typeof athleteId !== "string" || !athleteId.startsWith("rec")) {
    return res.status(400).json({
      error: "athleteId is required and must be a valid Airtable record ID (rec…).",
    });
  }

  if (sport === undefined) {
    return res.status(400).json({ error: "No fields provided to update." });
  }

  if (typeof sport !== "string") {
    return res.status(400).json({ error: "sport must be a string." });
  }

  // Build Airtable fields — empty string clears the single-select cell
  const fields = {
    [FIELD_MAP.sport]: sport.trim() || null,
  };

  try {
    const base = getBase();
    await base(TABLE).update([{ id: athleteId, fields }]);

    return res.status(200).json({ ok: true, athleteId, sport: sport.trim() });
  } catch (err) {
    console.error("[updateAthleteMeta] Airtable error:", err);

    const message =
      err?.message ||
      err?.error   ||
      "Failed to update athlete record.";

    const status = message.toLowerCase().includes("not found") ? 422 : 500;
    return res.status(status).json({ error: message });
  }
}