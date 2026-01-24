import Airtable from "airtable";

/**
 * ORG Workouts Range
 * GET /api/org/workouts/range?start=YYYY-MM-DD&end=YYYY-MM-DD&sport=Basketball
 *
 * Returns calendar summaries for the week grid.
 */

const MAP = {
  // Tables
  ORGS_TABLE: process.env.ORGANIZATIONS_TABLE_NAME || "Organizations",
  DAILY_TABLE: process.env.DAILYWORKOUTS_TABLE_NAME || "DailyWorkout",

  // Org
  ORG_TOKEN_FIELD: process.env.ORGANIZATION_TOKEN_FIELD || "Token",
  DAILY_ORG_LINK_FIELD: "Organization", // linked to Organizations
  DAILY_ATHLETES_LINK_FIELD: "Athlete", // linked to AthleteScans (array of record ids)

  // DailyWorkout fields (you likely have these already; add Sport if missing)
  DAILY_DATE_FIELD: "Date",
  DAILY_TITLE_FIELD: "Title",
  DAILY_STATUS_FIELD: "Status",
  DAILY_SPORT_FIELD: "Sport", // add in Airtable if not present
  DAILY_ITEMS_LINK_FIELD: "WorkoutItems", // optional linked field (if present)
};

function requireOrgToken(req) {
  const token = String(req.headers["x-org-token"] || "").trim();
  if (!token) return { ok: false, error: "Missing x-org-token" };
  return { ok: true, token };
}

function nyISO(v) {
  // just ensure YYYY-MM-DD shape
  return String(v || "").trim().slice(0, 10);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

async function getOrgRecordId(base, token) {
  const f = MAP.ORG_TOKEN_FIELD;
  const rows = await base(MAP.ORGS_TABLE)
    .select({
      maxRecords: 1,
      filterByFormula: `{${f}}="${token.replace(/"/g, '\\"')}"`,
    })
    .firstPage();

  return rows?.[0]?.id || "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.DAILYWORKOUTS_API_KEY || !process.env.DAILYWORKOUTS_BASE_ID) {
    return res.status(500).json({ error: "Missing DAILYWORKOUTS_API_KEY or DAILYWORKOUTS_BASE_ID" });
  }

  const auth = requireOrgToken(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const start = nyISO(req.query?.start);
  const end = nyISO(req.query?.end);
  const sport = String(req.query?.sport || "").trim();

  if (!start || !end) return res.status(400).json({ error: "start and end are required (YYYY-MM-DD)" });

  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);

  try {
    const orgId = await getOrgRecordId(base, auth.token);
    if (!orgId) return res.status(404).json({ error: "Organization not found for token." });

    // Date range formula: IS_AFTER({Date}, start-1) AND IS_BEFORE({Date}, end+1)
    // Airtable date strings accept "YYYY-MM-DD"
    const parts = [];
    parts.push(`FIND("${orgId}", ARRAYJOIN({${MAP.DAILY_ORG_LINK_FIELD}}&""))`);
    parts.push(`IS_AFTER({${MAP.DAILY_DATE_FIELD}}, "${start}", "day")`);
    parts.push(`IS_BEFORE({${MAP.DAILY_DATE_FIELD}}, "${end}", "day")`);

    if (sport) parts.push(`{${MAP.DAILY_SPORT_FIELD}}="${sport.replace(/"/g, '\\"')}"`);

    const formula = `AND(${parts.join(",")})`;

    const rows = await base(MAP.DAILY_TABLE)
      .select({
        filterByFormula: formula,
        maxRecords: 250,
        sort: [{ field: MAP.DAILY_DATE_FIELD, direction: "asc" }],
      })
      .firstPage();

    const workouts = (rows || []).map((rec) => {
      const f = rec.fields || {};
      const athletes = safeArray(f[MAP.DAILY_ATHLETES_LINK_FIELD]);
      const items = safeArray(f[MAP.DAILY_ITEMS_LINK_FIELD]); // may be empty if field not on table
      const date = f[MAP.DAILY_DATE_FIELD] ? String(f[MAP.DAILY_DATE_FIELD]).slice(0, 10) : "";

      return {
        id: rec.id,
        Date: date,
        Title: f[MAP.DAILY_TITLE_FIELD] || "Workout",
        Status: f[MAP.DAILY_STATUS_FIELD] || "assigned",
        Sport: f[MAP.DAILY_SPORT_FIELD] || "",
        athleteCount: athletes.length,
        itemCount: items.length, // quick summary; detailed items come from /day endpoint
      };
    });

    return res.status(200).json({ workouts });
  } catch (e) {
    console.error("[api/org/workouts/range] error:", e);
    return res.status(500).json({ error: "Failed to load workouts range." });
  }
}
