// pages/api/org/workouts/range.js
import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function nyISO(v) {
  return String(v || "").trim().slice(0, 10);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function esc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

function normLower(v) {
  return String(v || "").trim().toLowerCase();
}

function parseSportsList(q) {
  const raw = String(q || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normLower).filter(Boolean);
    } catch {}
  }
  return raw.split(/[,|]/g).map(normLower).filter(Boolean);
}

function envMissing() {
  return {
    DAILYWORKOUTS_API_KEY:  !process.env.DAILYWORKOUTS_API_KEY,
    DAILYWORKOUTS_BASE_ID:  !process.env.DAILYWORKOUTS_BASE_ID,
    DAILYWORKOUTS_TABLE_ID: !process.env.DAILYWORKOUTS_TABLE_ID,
  };
}

function inclusiveDateRangeFormula(dateField, start, end) {
  return `AND(
    OR(IS_SAME({${dateField}}, "${esc(start)}", "day"), IS_AFTER({${dateField}},  "${esc(start)}", "day")),
    OR(IS_SAME({${dateField}}, "${esc(end)}",   "day"), IS_BEFORE({${dateField}}, "${esc(end)}",   "day"))
  )`;
}

function buildOrgCandidates(user) {
  const orgId    = String(user?.org?.id || user?.orgId || user?.OrgId || "").trim();
  const orgToken = String(user?.org?.token || user?.Token || user?.token || "").trim();
  const orgName  = String(
    user?.org?.name || user?.org?.Name || user?.orgName ||
    user?.OrgName   || user?.organizationName || user?.["Organization Name"] || ""
  ).trim();
  const candidates = [orgName, orgToken, orgId].filter(Boolean);
  return { orgId, orgToken, orgName, candidates };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missing = envMissing();
  if (missing.DAILYWORKOUTS_API_KEY || missing.DAILYWORKOUTS_BASE_ID || missing.DAILYWORKOUTS_TABLE_ID) {
    return res.status(500).json({ error: "DailyWorkouts Airtable env vars missing.", missing });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const { orgId, orgToken, orgName, candidates } = buildOrgCandidates(user);

  const start       = nyISO(req.query?.start);
  const end         = nyISO(req.query?.end);
  const sportSingle = normLower(req.query?.sport);
  const sportsList  = parseSportsList(req.query?.sports);
  const sportsUsed  = sportsList.length ? sportsList : sportSingle ? [sportSingle] : [];

  if (!start || !end) {
    return res.status(400).json({ error: "start and end are required (YYYY-MM-DD)" });
  }
  if (!candidates.length) {
    return res.status(400).json({
      error: "Missing org identity on session (need orgName, orgToken, or orgId).",
      debug: { has_orgId: Boolean(orgId), has_orgToken: Boolean(orgToken), has_orgName: Boolean(orgName) },
    });
  }

  const base     = new Airtable({ apiKey: process.env.DAILYWORKOUTS_API_KEY }).base(process.env.DAILYWORKOUTS_BASE_ID);
  const TABLE_ID = process.env.DAILYWORKOUTS_TABLE_ID;

  const DAILY_ORG_LINK_FIELD      = "Organization";
  const DAILY_ATHLETES_LINK_FIELD = "Athlete";
  const DAILY_DATE_FIELD          = "Date";
  const DAILY_TITLE_FIELD         = "Title";
  const DAILY_STATUS_FIELD        = "Status";
  const DAILY_SPORT_FIELD         = "Sport";
  const DAILY_ITEMS_LINK_FIELD    = "WorkoutItems";

  const orgJoin  = `ARRAYJOIN({${DAILY_ORG_LINK_FIELD}}&"")`;
  const orgMatch = candidates.length === 1
    ? `FIND("${esc(candidates[0])}", ${orgJoin})`
    : `OR(${candidates.map(c => `FIND("${esc(c)}", ${orgJoin})`).join(",")})`;

  const dateRange = inclusiveDateRangeFormula(DAILY_DATE_FIELD, start, end);

  let sportMatch = "";
  if (sportsUsed.length === 1) {
    sportMatch = `LOWER({${DAILY_SPORT_FIELD}}&"")="${esc(sportsUsed[0])}"`;
  } else if (sportsUsed.length > 1) {
    sportMatch = `OR(${sportsUsed.map(s => `LOWER({${DAILY_SPORT_FIELD}}&"")="${esc(s)}"`).join(",")})`;
  }

  const parts   = [orgMatch, dateRange];
  if (sportMatch) parts.push(sportMatch);
  const formula = `AND(${parts.join(",")})`;

  try {
    const rows = await base(TABLE_ID)
      .select({
        filterByFormula: formula,
        maxRecords:      500,
        sort:            [{ field: DAILY_DATE_FIELD, direction: "asc" }],
      })
      .firstPage();

    const rawWorkouts = (rows || []).map((rec) => {
      const f       = rec.fields || {};
      const athletes = safeArray(f[DAILY_ATHLETES_LINK_FIELD]);
      const items    = safeArray(f[DAILY_ITEMS_LINK_FIELD]);
      const date     = f[DAILY_DATE_FIELD] ? String(f[DAILY_DATE_FIELD]).slice(0, 10) : "";

      return {
        id:           rec.id,
        Date:         date,
        Title:        f[DAILY_TITLE_FIELD]  || "Workout",
        Status:       f[DAILY_STATUS_FIELD] || "assigned",
        Sport:        f[DAILY_SPORT_FIELD]  || "",
        athleteCount: athletes.length,
        athleteToken: String(f.AthleteToken || "").trim(),
        itemCount:    items.length,
      };
    });

    /* ── Athlete name enrichment ──────────────────────────────────────────
       Fetch the org's athlete roster using {Token} field (not Organization
       linked field - Athletes table uses Token, a plain text field).
       Build a token→name map and attach athleteName to each workout.
    ── */
    let tokenToName = new Map();

    if (
      orgToken &&
      process.env.ATHLETE_API_KEY &&
      process.env.ATHLETE_BASE_ID &&
      process.env.ATHLETE_TABLE_NAME
    ) {
      try {
        const athleteBase = new Airtable({ apiKey: process.env.ATHLETE_API_KEY })
          .base(process.env.ATHLETE_BASE_ID);

        const athleteFilter = `FIND("${esc(orgToken)}", ARRAYJOIN({Token}&""))>0`;

        const athRecs = await athleteBase(process.env.ATHLETE_TABLE_NAME)
          .select({
            filterByFormula: athleteFilter,
            fields:          ["Name", "AthleteToken"],
            maxRecords:      2000,
          })
          .all();

        tokenToName = new Map(
          (athRecs || [])
            .filter(r => r.fields?.AthleteToken && r.fields?.Name)
            .map(r => [String(r.fields.AthleteToken).trim(), String(r.fields.Name).trim()])
        );
      } catch (athErr) {
        // Non-fatal - cards still render without names
        console.warn("[range] athlete name lookup failed:", athErr?.message);
      }
    }

    const workouts = rawWorkouts.map(w => ({
      ...w,
      athleteName: (w.athleteToken ? tokenToName.get(w.athleteToken) : null) || null,
    }));

    // ---- Diagnostics ----
    const orgOnlyRows  = await base(TABLE_ID).select({ filterByFormula: orgMatch,                        maxRecords: 5, sort: [{ field: DAILY_DATE_FIELD, direction: "desc" }] }).firstPage();
    const orgDateRows  = await base(TABLE_ID).select({ filterByFormula: `AND(${orgMatch},${dateRange})`, maxRecords: 5 }).firstPage();
    const orgSportRows = sportMatch
      ? await base(TABLE_ID).select({ filterByFormula: `AND(${orgMatch},${sportMatch})`, maxRecords: 5 }).firstPage()
      : [];

    const debug = {
      orgId, orgToken, orgName, orgCandidates: candidates,
      start, end, sportSingle, sportsList, sportsUsed,
      orgMatch, sportMatch, formula,
      athleteNamesLoaded: tokenToName.size,
      checks: {
        orgOnly_count_atLeast:    orgOnlyRows.length,
        orgAndDate_count_atLeast: orgDateRows.length,
        orgAndSport_count_atLeast: orgSportRows.length,
        final_count:              workouts.length,
      },
      sampleOrgOnly: (orgOnlyRows || []).map(r => ({
        id:           r.id,
        Date:         r.fields?.[DAILY_DATE_FIELD],
        Sport:        r.fields?.[DAILY_SPORT_FIELD],
        Organization: r.fields?.[DAILY_ORG_LINK_FIELD],
        Title:        r.fields?.[DAILY_TITLE_FIELD],
        Status:       r.fields?.[DAILY_STATUS_FIELD],
      })),
    };

    return res.status(200).json({ workouts, debug });
  } catch (err) {
    console.error("[api/org/workouts/range] error:", err);
    const status = err?.statusCode || err?.status || 500;
    if (status === 401 || status === 403) {
      return res.status(status).json({ error: "Airtable authorization error. Verify DAILYWORKOUTS_API_KEY scopes." });
    }
    return res.status(500).json({
      error: "Failed to load workouts range.",
      details: err?.message || String(err),
      debug: { orgId, orgToken, orgName, candidates, start, end, sportSingle, sportsList, sportsUsed, formula },
    });
  }
}