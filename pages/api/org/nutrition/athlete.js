// pages/api/org/nutrition/athlete.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  const base = new Airtable({ apiKey }).base(baseId);
  return base(tableNameOrId);
}

/**
 * Works for Airtable fields that might be:
 * - string
 * - array (lookup / multiple values)
 * - linked record array
 */
function tokenMatchFormula(fieldName, tokenValue) {
  const safeTok = escapeAirtableString(tokenValue);
  return `FIND('${safeTok}', ARRAYJOIN({${fieldName}}&''))`;
}

function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ---------------- env ---------------- */

// AthleteScans (roster)
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME; // AthleteScans table id

// NutritionPlans (new system)
const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME ||
  process.env.NUTRITION_TABLE_ID ||
  "NutritionPlans";

// NutritionCheckins (existing)
const NUTRITIONCHECKINS_API_KEY = process.env.NUTRITIONCHECKINS_API_KEY;
const NUTRITIONCHECKINS_BASE_ID = process.env.NUTRITIONCHECKINS_BASE_ID;
const NUTRITIONCHECKINS_TABLE =
  process.env.NUTRITIONCHECKINS_TABLE ||
  process.env.NUTRITIONCHECKINS_TABLE_NAME ||
  process.env.NUTRITIONCHECKINS_TABLE_ID ||
  "NutritionCheckins";

/* ---------------- STRICT Airtable field names ---------------- */

// AthleteScans
const ATH_NAME = "Name";
const ATH_EMAIL = "Email";
const ATH_TOKEN = "AthleteToken";
const ATH_ORG_TOKEN = "Token"; // org token stored on athlete record (text)

// NutritionPlans
const PLAN_ATH_LINK = "Athlete"; // linked record -> AthleteScans
const PLAN_STATUS = "Status";
const PLAN_CREATED_AT = "CreatedAt";
const PLAN_CREATED_BY = "CreatedBy";
const PLAN_ARCHIVED_AT = "ArchivedAt";
const PLAN_ARCHIVED_BY = "ArchivedBy";

const PLAN_PHASE = "Phase";
const PLAN_DCAL = "DailyCalories";
const PLAN_DPRO = "DailyProtein";
const PLAN_DCARB = "DailyCarbs";
const PLAN_DFAT = "DailyFat";
const PLAN_JSON = "PlanJson";
const PLAN_PRESCRIPTION = "Prescription";

// NutritionCheckins
const CHK_ATH_TOKEN = "AthleteToken";
const CHK_WEEK = "WeekStartISO";
const CHK_CREATED_AT = "CreatedAt";
const CHK_CAL = "CaloriesAdherencePct";
const CHK_PRO = "ProteinAdherencePct";
const CHK_HYD = "HydrationAdherencePct";
const CHK_NOTES = "Notes";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  const athleteToken = asString(req.query?.athleteToken);
  if (!athleteToken) return res.status(400).json({ error: "athleteToken is required" });

  if (athleteToken.toUpperCase().startsWith("ORG-")) {
    return res.status(400).json({
      error: "Expected AthleteToken (ATH-...), but received an ORG- token.",
    });
  }

  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);
  const plansTable = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);
  const chkTable = getTable(NUTRITIONCHECKINS_API_KEY, NUTRITIONCHECKINS_BASE_ID, NUTRITIONCHECKINS_TABLE);

  if (!athleteTable) {
    return res.status(500).json({
      error: "Athletes (AthleteScans) Airtable not configured.",
      missing: {
        ATHLETE_API_KEY: !ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  if (!plansTable) {
    return res.status(500).json({
      error: "NutritionPlans Airtable not configured.",
      missing: {
        NUTRITION_API_KEY: !NUTRITION_API_KEY,
        NUTRITION_BASE_ID: !NUTRITION_BASE_ID,
        NUTRITION_PLANS_TABLE: !NUTRITION_PLANS_TABLE,
      },
    });
  }

  try {
    const safeOrg = asString(orgToken);
    const safeAthTok = asString(athleteToken);

    /* ---------------- 1) Athlete (must belong to org) ---------------- */

    // ✅ Membership: athlete record has org Token text field
    // ✅ AthleteToken can be lookup array -> tokenMatchFormula handles it
    const athleteFilter = `AND(${tokenMatchFormula(ATH_ORG_TOKEN, safeOrg)}, ${tokenMatchFormula(
      ATH_TOKEN,
      safeAthTok
    )})`;

    const athleteRec = await athleteTable
      .select({ filterByFormula: athleteFilter, maxRecords: 1 })
      .firstPage()
      .then((xs) => (xs?.length ? xs[0] : null));

    if (!athleteRec) {
      return res.status(404).json({
        error: "Athlete not found for this organization.",
        debug: { athleteFilter },
      });
    }

    const af = athleteRec.fields || {};
    const athlete = {
      id: athleteRec.id,
      name: asString(af[ATH_NAME]) || "Athlete",
      email: asString(af[ATH_EMAIL]),
      athleteToken: asString(af[ATH_TOKEN]),
    };

    /* ---------------- 2) NutritionPlans: latest ACTIVE + history ---------------- */

    // Linked record field contains record ids (array)
    const planAthMatch = `FIND('${escapeAirtableString(athleteRec.id)}', ARRAYJOIN({${PLAN_ATH_LINK}}&''))`;

    // Latest ACTIVE plan
    const latestActiveFilter = `AND(${planAthMatch}, LOWER({${PLAN_STATUS}}&'')='active')`;

    const latestActiveRecs = await plansTable
      .select({
        filterByFormula: latestActiveFilter,
        sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
        maxRecords: 1,
      })
      .firstPage();

    const latestRec = latestActiveRecs?.[0] || null;

    let latestPlan = null;
    if (latestRec) {
      const f = latestRec.fields || {};
      latestPlan = {
        id: latestRec.id,

        // New structured fields
        phase: asString(f[PLAN_PHASE]),
        daily: {
          calories: f[PLAN_DCAL] ?? "",
          protein: f[PLAN_DPRO] ?? "",
          carbs: f[PLAN_DCARB] ?? "",
          fat: f[PLAN_DFAT] ?? "",
        },
        planJsonRaw: asString(f[PLAN_JSON]),
        planJson: safeJsonParse(f[PLAN_JSON]),

        // Human readable
        prescription: asString(f[PLAN_PRESCRIPTION]),

        // Meta
        status: asString(f[PLAN_STATUS]) || "active",
        createdAt: asString(f[PLAN_CREATED_AT]) || asString(latestRec._rawJson?.createdTime),
        createdBy: asString(f[PLAN_CREATED_BY]),
        archivedAt: asString(f[PLAN_ARCHIVED_AT]),
        archivedBy: asString(f[PLAN_ARCHIVED_BY]),
      };
    }

    // History: include active + archived, newest first
    // (You can raise/lower this number later)
    const historyFilter = planAthMatch;

    const historyRecs = await plansTable
      .select({
        filterByFormula: historyFilter,
        sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
        maxRecords: 25,
      })
      .firstPage();

    const plans = safeArr(historyRecs).map((r) => {
      const f = r.fields || {};
      return {
        id: r.id,
        phase: asString(f[PLAN_PHASE]),
        daily: {
          calories: f[PLAN_DCAL] ?? "",
          protein: f[PLAN_DPRO] ?? "",
          carbs: f[PLAN_DCARB] ?? "",
          fat: f[PLAN_DFAT] ?? "",
        },
        planJsonRaw: asString(f[PLAN_JSON]),
        planJson: safeJsonParse(f[PLAN_JSON]),
        prescription: asString(f[PLAN_PRESCRIPTION]),
        status: asString(f[PLAN_STATUS]) || "",
        createdAt: asString(f[PLAN_CREATED_AT]) || asString(r._rawJson?.createdTime),
        createdBy: asString(f[PLAN_CREATED_BY]),
        archivedAt: asString(f[PLAN_ARCHIVED_AT]),
        archivedBy: asString(f[PLAN_ARCHIVED_BY]),
      };
    });

    /* ---------------- 3) Checkins (STRICT AthleteToken) ---------------- */

    let checkins = [];
    if (chkTable) {
      const chkFilter = tokenMatchFormula(CHK_ATH_TOKEN, safeAthTok);

      const chkRecs = await chkTable
        .select({
          filterByFormula: chkFilter,
          sort: [{ field: CHK_WEEK, direction: "desc" }],
          maxRecords: 30,
        })
        .firstPage();

      checkins = safeArr(chkRecs).map((r) => {
        const f = r.fields || {};
        return {
          id: r.id,
          weekStartISO: asString(f[CHK_WEEK]),
          createdAt: asString(f[CHK_CREATED_AT]) || asString(r._rawJson?.createdTime),
          caloriesPct: Number(f[CHK_CAL] || 0),
          proteinPct: Number(f[CHK_PRO] || 0),
          hydrationPct: Number(f[CHK_HYD] || 0),
          notes: asString(f[CHK_NOTES]),
        };
      });
    }

    return res.status(200).json({
      ok: true,
      athlete,

      // Keep this name for your existing UI
      latestPlan,

      // New: plan history for UI upgrades
      plans,

      checkins,
    });
  } catch (e) {
    console.error("[nutrition/athlete] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to load athlete nutrition profile.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}
