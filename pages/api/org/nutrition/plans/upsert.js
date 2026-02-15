// pages/api/org/nutrition/plans/upsert.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function safeJsonStringify(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
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

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  const base = new Airtable({ apiKey }).base(baseId);
  return base(tableNameOrId);
}

function pickFirstNonEmptyString(...vals) {
  for (const v of vals) {
    const s = asString(v);
    if (s) return s;
  }
  return "";
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

/**
 * Normalize input into YYYY-MM-DD (NY timezone safe)
 * Accepts:
 * - "YYYY-MM-DD"
 * - ISO datetime
 * - any Date-parseable string
 */
function toISODateOnly(v) {
  const s = asString(v);
  if (!s) return "";
  if (isISODateOnly(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${dd}`;
}

/**
 * Convert YYYY-MM-DD into an ISO datetime at NY "noon" to avoid DST edge cases.
 * Airtable Date fields are happiest with ISO datetimes.
 */
function isoDateOnlyToNYNoonISO(isoDateOnly) {
  const d = asString(isoDateOnly);
  if (!isISODateOnly(d)) return "";
  const dt = new Date(`${d}T12:00:00-05:00`); // safe anchor; Airtable stores UTC anyway
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

/* ---------------- env ---------------- */

// NutritionPlans base/table
const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME ||
  process.env.NUTRITION_TABLE_ID ||
  "NutritionPlans";

// AthleteScans base/table (needed to link the plan to the athlete record)
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME; // AthleteScans

/* ---------------- Airtable field names (STRICT) ---------------- */

// AthleteScans
const ATH_TOKEN = "AthleteToken";
const ATH_ORG_TOKEN = "Token"; // org token stored on athlete record (text)

// NutritionPlans
const PLAN_ATH_LINK = "Athlete"; // linked to AthleteScans record
const PLAN_STATUS = "Status";
const PLAN_CREATED_AT = "CreatedAt";
const PLAN_CREATED_BY = "CreatedBy";

const PLAN_PHASE = "Phase";
const PLAN_DCAL = "DailyCalories";
const PLAN_DPRO = "DailyProtein";
const PLAN_DCARB = "DailyCarbs";
const PLAN_DFAT = "DailyFat";

// ✅ NEW: daily hydration summary field (rename if your column differs)
const PLAN_DHYDRATION = "DailyHydration";

const PLAN_JSON = "PlanJson";
const PLAN_PRESCRIPTION = "Prescription";

// ✅ Your actual Airtable column
const PLAN_META_EFFECTIVE_DATE = "Meta Effective Date";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

  const plansTable = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);
  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);

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

  if (!athleteTable) {
    return res.status(500).json({
      error: "AthleteScans Airtable not configured (needed to link Athlete).",
      missing: {
        ATHLETE_API_KEY: !ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  try {
    const body = req.body || {};

    const athleteToken = asString(body.athleteToken);
    const phase = asString(body.phase || "Maintain");
    const status = asString(body.status || "active").toLowerCase();
    const createdBy = asString(body.createdBy || "");
    const prescription = asString(body.prescription || "");

    // Daily macros come in under body.daily (numbers or strings)
    const daily = body.daily && typeof body.daily === "object" ? body.daily : {};

    // PlanJson may be object or string
    const planJsonRaw = body.planJson ?? null;
    const planJsonObj =
      planJsonRaw && typeof planJsonRaw === "object" ? planJsonRaw : safeJsonParse(planJsonRaw);

    if (!athleteToken) return res.status(400).json({ error: "athleteToken is required" });
    if (athleteToken.toUpperCase().startsWith("ORG-")) {
      return res.status(400).json({ error: "Expected AthleteToken (ATH-...), but received an ORG- token." });
    }

    /* ---------------- Effective date ---------------- */

    const effRaw =
      asString(body.metaEffectiveDate) ||
      asString(body.structured?.metaEffectiveDate) ||
      asString(body.planJson?.meta?.effectiveDate) ||
      asString(planJsonObj?.meta?.effectiveDate);

    const effectiveDate = toISODateOnly(effRaw); // YYYY-MM-DD or ""
    const effectiveDateISOForAirtable = effectiveDate ? isoDateOnlyToNYNoonISO(effectiveDate) : "";

    /* ---------------- 1) Find athlete record (must belong to org) ---------------- */

    const tok = escapeAirtableString(athleteToken);
    const ot = escapeAirtableString(orgToken);

    const athleteFilter = `AND(
      FIND('${ot}', ARRAYJOIN({${ATH_ORG_TOKEN}}&'')),
      FIND('${tok}', ARRAYJOIN({${ATH_TOKEN}}&''))
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

    /* ---------------- 2) Find latest ACTIVE plan for this athlete (update-or-create) ---------------- */

    const planAthMatch = `FIND('${escapeAirtableString(athleteRec.id)}', ARRAYJOIN({${PLAN_ATH_LINK}}&''))`;
    const latestActiveFilter = `AND(${planAthMatch}, LOWER({${PLAN_STATUS}}&'')='active')`;

    const existing = await plansTable
      .select({
        filterByFormula: latestActiveFilter,
        sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
        maxRecords: 1,
      })
      .firstPage()
      .then((xs) => (xs?.length ? xs[0] : null));

    /* ---------------- 3) Robust macro extraction ---------------- */

    const pjDaily = planJsonObj?.daily && typeof planJsonObj.daily === "object" ? planJsonObj.daily : {};

    const dailyCalories = pickFirstNonEmptyString(daily?.calories, pjDaily?.calories);
    const dailyProtein = pickFirstNonEmptyString(daily?.protein, pjDaily?.protein);
    const dailyCarbs = pickFirstNonEmptyString(daily?.carbs, pjDaily?.carbs);
    const dailyFat = pickFirstNonEmptyString(daily?.fat, pjDaily?.fat);

    // ✅ NEW: hydration (oz) — accept multiple possible keys
    const dailyHydrationOz = pickFirstNonEmptyString(
      daily?.hydrationOz,
      daily?.hydration,
      pjDaily?.hydrationOz,
      pjDaily?.hydration,
      pjDaily?.waterOz,
      pjDaily?.water
    );

    /* ---------------- 4) Merge PlanJson meta + daily ---------------- */

    const mergedPlanJson =
      planJsonObj && typeof planJsonObj === "object"
        ? {
            ...planJsonObj,
            meta: {
              ...(planJsonObj.meta && typeof planJsonObj.meta === "object" ? planJsonObj.meta : {}),
              ...(effectiveDate ? { effectiveDate } : {}),
            },
            daily: {
              ...(pjDaily && typeof pjDaily === "object" ? pjDaily : {}),
              ...(dailyCalories ? { calories: dailyCalories } : {}),
              ...(dailyProtein ? { protein: dailyProtein } : {}),
              ...(dailyCarbs ? { carbs: dailyCarbs } : {}),
              ...(dailyFat ? { fat: dailyFat } : {}),

              // ✅ NEW: always persist hydration in PlanJson
              ...(dailyHydrationOz ? { hydrationOz: dailyHydrationOz, hydration: dailyHydrationOz } : {}),
            },
          }
        : {
            meta: effectiveDate ? { effectiveDate } : {},
            daily: {
              calories: dailyCalories,
              protein: dailyProtein,
              carbs: dailyCarbs,
              fat: dailyFat,

              // ✅ NEW
              ...(dailyHydrationOz ? { hydrationOz: dailyHydrationOz, hydration: dailyHydrationOz } : {}),
            },
          };

    const planJsonString = safeJsonStringify(mergedPlanJson);

    /* ---------------- 5) Build Airtable fields ---------------- */

    const fields = {
      [PLAN_ATH_LINK]: [athleteRec.id],
      [PLAN_STATUS]: status || "active",
      [PLAN_PHASE]: phase,

      [PLAN_DCAL]: dailyCalories,
      [PLAN_DPRO]: dailyProtein,
      [PLAN_DCARB]: dailyCarbs,
      [PLAN_DFAT]: dailyFat,

      // ✅ NEW: write daily hydration to Airtable summary column
      [PLAN_DHYDRATION]: dailyHydrationOz,

      [PLAN_JSON]: planJsonString,
      [PLAN_PRESCRIPTION]: prescription,

      // meta
      [PLAN_CREATED_BY]: createdBy,
      [PLAN_CREATED_AT]: new Date().toISOString(),

      // ✅ Write a real ISO datetime for Airtable Date field reliability
      ...(effectiveDateISOForAirtable ? { [PLAN_META_EFFECTIVE_DATE]: effectiveDateISOForAirtable } : {}),
    };

    /* ---------------- 6) Save ---------------- */

    let saved;
    if (existing) saved = await plansTable.update(existing.id, fields);
    else saved = await plansTable.create(fields);

    return res.status(200).json({
      ok: true,
      plan: { id: saved.id, fields: saved.fields || {} },
      effectiveDate: effectiveDate || "",
      debug: {
        athleteToken,
        effectiveDate,
        effectiveDateISOForAirtable,
        dailyHydrationOz,
      },
    });
  } catch (e) {
    console.error("[nutrition/plans/upsert] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to upsert NutritionPlan.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}
