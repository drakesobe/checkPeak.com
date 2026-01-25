// pages/api/org/workouts/range.js
import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

/**
 * ORG Workouts Range (cookie session-based)
 * GET /api/org/workouts/range?start=YYYY-MM-DD&end=YYYY-MM-DD&sport=Basketball
 *
 * - Uses HttpOnly cookie session (requireOrgSideUser)
 * - Filters DailyWorkouts by:
 *   - Organization linked record contains orgId from session
 *   - Date in [start, end] inclusive
 *   - Optional Sport (normalized to lowercase)
 */

function nyISO(v) {
  return String(v || "").trim().slice(0, 10);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function escapeQuotes(s) {
  return String(s || "").replace(/"/g, '\\"');
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY: !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID: !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
  };
}

// Inclusive date range in Airtable formulas:
// OR(IS_SAME(Date,start), IS_AFTER(Date,start))
// AND
// OR(IS_SAME(Date,end), IS_BEFORE(Date,end))
function inclusiveDateRangeFormula(dateField, start, end) {
  return `AND(
    OR(
      IS_SAME({${dateField}}, "${escapeQuotes(start)}", "day"),
      IS_AFTER({${dateField}}, "${escapeQuotes(start)}", "day")
    ),
    OR(
      IS_SAME({${dateField}}, "${escapeQuotes(end)}", "day"),
      IS_BEFORE({${dateField}}, "${escapeQuotes(end)}", "day")
    )
  )`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();
  if (missing.DAILYWORKOUTS_API_KEY || missing.DAILYWORKOUTS_BASE_ID || missing.DAILYWORKOUTS_TABLE_ID) {
    return res.status(500).json({
      error: "DailyWorkouts Airtable env vars missing.",
      missing,
    });
  }

  // ✅ Cookie session auth (no x-org-token)
  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  if (!orgId) {
    return res.status(400).json({
      error:
        "Missing orgId on session user payload. Ensure your org login sets orgId (Organization record id) in the cookie session.",
    });
  }

  const start = nyISO(req.query?.start);
  const end = nyISO(req.query?.end);
  const sportRaw = String(req.query?.sport || "").trim();
  const sport = sportRaw ? sportRaw.toLowerCase() : "";

  if (!start || !end) {
    return res.status(400).json({ error: "start and end are required (YYYY-MM-DD)" });
  }

  // Airtable config
  const base = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(
    process.env.DAILYWORKOUTS_BASE_ID
  );

  // Your DailyWorkouts table + fields
  const TABLE_ID = process.env.DAILYWORKOUTS_TABLE_ID;

  const DAILY_ORG_LINK_FIELD = "Organization"; // linked record field in DailyWorkouts
  const DAILY_ATHLETES_LINK_FIELD = "Athlete"; // linked athletes
  const DAILY_DATE_FIELD = "Date";
  const DAILY_TITLE_FIELD = "Title";
  const DAILY_STATUS_FIELD = "Status";
  const DAILY_SPORT_FIELD = "Sport";
  const DAILY_ITEMS_LINK_FIELD = "WorkoutItems"; // optional

  try {
    // Org match: linked record array contains orgId
    const orgMatch = `FIND("${escapeQuotes(orgId)}", ARRAYJOIN({${DAILY_ORG_LINK_FIELD}}&""))`;

    const dateRange = inclusiveDateRangeFormula(DAILY_DATE_FIELD, start, end);

    const parts = [orgMatch, dateRange];

    // Sport filter (Airtable value is lowercase)
    if (sport) {
      parts.push(`LOWER({${DAILY_SPORT_FIELD}}&"")="${escapeQuotes(sport)}"`);
    }

    const formula = `AND(${parts.join(",")})`;

    const rows = await base(TABLE_ID)
      .select({
        filterByFormula: formula,
        maxRecords: 500,
        sort: [{ field: DAILY_DATE_FIELD, direction: "asc" }],
      })
      .firstPage();

    const workouts = (rows || []).map((rec) => {
      const f = rec.fields || {};
      const athletes = safeArray(f[DAILY_ATHLETES_LINK_FIELD]);
      const items = safeArray(f[DAILY_ITEMS_LINK_FIELD]);
      const date = f[DAILY_DATE_FIELD] ? String(f[DAILY_DATE_FIELD]).slice(0, 10) : "";

      return {
        id: rec.id,
        Date: date,
        Title: f[DAILY_TITLE_FIELD] || "Workout",
        Status: f[DAILY_STATUS_FIELD] || "assigned",
        Sport: f[DAILY_SPORT_FIELD] || "",
        athleteCount: athletes.length,
        itemCount: items.length,
      };
    });

    return res.status(200).json({ workouts });
  } catch (err) {
    console.error("[api/org/workouts/range] error:", err);

    const status = err?.statusCode || err?.status || 500;

    // If Airtable denies access, return the real status (don’t mask as 500)
    if (status === 401 || status === 403) {
      return res.status(status).json({
        error:
          "Airtable authorization error. Verify DAILYWORKOUTS_API_KEY has access to the DAILYWORKOUTS base/table and correct scopes.",
      });
    }

    return res.status(500).json({ error: "Failed to load workouts range." });
  }
}
