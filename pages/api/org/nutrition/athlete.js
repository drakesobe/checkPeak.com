// pages/api/org/nutrition/athlete.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  const base = new Airtable({ apiKey }).base(baseId);
  return base(tableNameOrId);
}

/**
 * Lookup-safe match (works if field is text OR lookup/array)
 * Use this for AthleteToken lookups.
 */
function lookupSafeContains(fieldName, value) {
  const safe = escapeAirtableString(value);
  return `FIND('${safe}', ARRAYJOIN({${fieldName}}&''))>0`;
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  const raw = asString(value);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampPct(n) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function isoDateOnlyFromISODateTime(dt) {
  const s = asString(dt);
  if (!s) return "";
  // handles "2026-02-23T12:00:00.000Z" or Airtable timestamps
  return s.slice(0, 10);
}

// Monday week start in America/New_York, returned YYYY-MM-DD
function nyWeekStartISOFromDateISO(dateISO) {
  if (!dateISO || dateISO.length < 10) return "";
  // Use midday to avoid TZ edges
  const nyMid = new Date(`${dateISO.slice(0, 10)}T12:00:00`);

  // JS getDay(): 0=Sun,1=Mon,...6=Sat
  // Monday start
  const dow = nyMid.getDay();
  const diffToMon = (dow + 6) % 7;
  nyMid.setDate(nyMid.getDate() - diffToMon);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nyMid);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function completionToPcts(completionJson) {
  const c = completionJson && typeof completionJson === "object" ? completionJson : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];

  let mealDone = 0;
  let waterDone = 0;

  for (const k of keys) {
    if (Boolean(c?.[k]?.mealDone)) mealDone += 1;
    if (Boolean(c?.[k]?.hydrationDone)) waterDone += 1;
  }

  const mealPct = clampPct((mealDone / 4) * 100);
  const hydrationPct = clampPct((waterDone / 4) * 100);

  return {
    mealPct,
    hydrationPct,
    // If you want “total daily adherence”, you could also compute:
    totalPct: clampPct(((mealDone + waterDone) / 8) * 100),
  };
}

/* ---------------- env ---------------- */

// AthleteScans (roster)
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

// Nutrition base (plans + completions)
const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;

// NutritionPlans table
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME ||
  process.env.NUTRITION_TABLE_ID ||
  "NutritionPlans";

// NutritionCompletions table (IMPORTANT: set this to your tbl... id)
const NUTRITION_COMPLETIONS_TABLE =
  process.env.NUTRITION_COMPLETIONS_TABLE ||
  process.env.NUTRITION_COMPLETIONS_TABLE_NAME ||
  process.env.NUTRITION_COMPLETIONS_TABLE_ID ||
  "NutritionCompletions";

/* ---------------- STRICT field names ---------------- */

// AthleteScans
const ATH_NAME = "Name";
const ATH_EMAIL = "Email";
const ATH_TOKEN = "AthleteToken";
const ATH_ORG_TOKEN = "Token"; // org token stored on athlete record (text)

// NutritionPlans
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
const PLAN_ATH_TOKEN = "AthleteToken"; // lookup (per your schema)

// NutritionCompletions
const CMP_DATE = "Date"; // Date & Time
const CMP_ATH_TOKEN = "AthleteToken"; // lookup
const CMP_JSON = "CompletionJson";
const CMP_UPDATED_AT = "UpdatedAt";

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
  const completionsTable = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_COMPLETIONS_TABLE);

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

    // athlete must have org token + athlete token
    const athleteFilter = `AND(
      FIND('${escapeAirtableString(safeOrg)}', ARRAYJOIN({${ATH_ORG_TOKEN}}&''))>0,
      FIND('${escapeAirtableString(safeAthTok)}', ARRAYJOIN({${ATH_TOKEN}}&''))>0
    )`;

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

    /* ---------------- 2) Plans by AthleteToken lookup ---------------- */

    const planTokMatch = lookupSafeContains(PLAN_ATH_TOKEN, safeAthTok);
    const latestActiveFilter = `AND(${planTokMatch}, LOWER({${PLAN_STATUS}}&'')='active')`;

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
        phase: asString(f[PLAN_PHASE]),
        daily: {
          calories: f[PLAN_DCAL] ?? "",
          protein: f[PLAN_DPRO] ?? "",
          carbs: f[PLAN_DCARB] ?? "",
          fat: f[PLAN_DFAT] ?? "",
        },
        planJsonRaw: typeof f[PLAN_JSON] === "string" ? asString(f[PLAN_JSON]) : "",
        planJson: safeJsonParse(f[PLAN_JSON]),
        prescription: asString(f[PLAN_PRESCRIPTION]),
        status: asString(f[PLAN_STATUS]) || "active",
        createdAt: asString(f[PLAN_CREATED_AT]) || asString(latestRec._rawJson?.createdTime),
        createdBy: asString(f[PLAN_CREATED_BY]),
        archivedAt: asString(f[PLAN_ARCHIVED_AT]),
        archivedBy: asString(f[PLAN_ARCHIVED_BY]),
      };
    }

    // history: all by token
    const historyRecs = await plansTable
      .select({
        filterByFormula: planTokMatch,
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
        planJsonRaw: typeof f[PLAN_JSON] === "string" ? asString(f[PLAN_JSON]) : "",
        planJson: safeJsonParse(f[PLAN_JSON]),
        prescription: asString(f[PLAN_PRESCRIPTION]),
        status: asString(f[PLAN_STATUS]) || "",
        createdAt: asString(f[PLAN_CREATED_AT]) || asString(r._rawJson?.createdTime),
        createdBy: asString(f[PLAN_CREATED_BY]),
        archivedAt: asString(f[PLAN_ARCHIVED_AT]),
        archivedBy: asString(f[PLAN_ARCHIVED_BY]),
      };
    });

    /* ---------------- 3) Completions by AthleteToken lookup ---------------- */

    let completions = [];
    let completionsFilter = "";

    if (completionsTable) {
      completionsFilter = lookupSafeContains(CMP_ATH_TOKEN, safeAthTok);

      const compRecs = await completionsTable
        .select({
          filterByFormula: completionsFilter,
          sort: [{ field: CMP_UPDATED_AT, direction: "desc" }],
          maxRecords: 50,
        })
        .firstPage();

      completions = safeArr(compRecs).map((r) => {
        const f = r.fields || {};
        const dt = asString(f[CMP_DATE]) || asString(r._rawJson?.createdTime);
        const updatedAt = asString(f[CMP_UPDATED_AT]) || asString(r._rawJson?.createdTime);
        return {
          id: r.id,
          dateTime: dt,
          dateISO: isoDateOnlyFromISODateTime(dt),
          weekStartISO: nyWeekStartISOFromDateISO(isoDateOnlyFromISODateTime(dt)),
          updatedAt,
          completionJson: safeJsonParse(f[CMP_JSON]),
        };
      });
    }

    /**
     * Build "checkins" in the SAME SHAPE your org UI already expects.
     * We'll treat:
     * - mealDone % as Calories/Protein/Carbs adherence (same number for now)
     * - hydrationDone % as HydrationAdherencePct
     */
    const checkins = completions.map((c) => {
      const p = completionToPcts(c.completionJson);
      return {
        id: c.id,
        weekStartISO: c.weekStartISO || c.dateISO || "",
        createdAt: c.updatedAt || c.dateTime || "",
        caloriesPct: p.mealPct,
        proteinPct: p.mealPct,
        carbsPct: p.mealPct, // your UI might ignore this for now; kept for future
        hydrationPct: p.hydrationPct,
        notes: "",
        _source: "NutritionCompletions",
        _dateISO: c.dateISO,
        _totalPct: p.totalPct,
      };
    });

    return res.status(200).json({
      ok: true,
      athlete,
      latestPlan,
      plans,
      checkins,
      debug: {
        athleteFilter,
        planTokMatch,
        latestActiveFilter,
        completionsTable: NUTRITION_COMPLETIONS_TABLE,
        completionsFilter,
        completionsFetched: completions.length,
        weeksBuilt: checkins.length,
      },
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