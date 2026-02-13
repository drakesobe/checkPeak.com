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
const PLAN_DPRO = "DailyProtein"; // ✅ your real Airtable field name
const PLAN_DCARB = "DailyCarbs";  // ✅ your real Airtable field name
const PLAN_DFAT = "DailyFat";
const PLAN_JSON = "PlanJson";
const PLAN_PRESCRIPTION = "Prescription";

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
      planJsonRaw && typeof planJsonRaw === "object"
        ? planJsonRaw
        : safeJsonParse(planJsonRaw);

    if (!athleteToken) return res.status(400).json({ error: "athleteToken is required" });
    if (athleteToken.toUpperCase().startsWith("ORG-")) {
      return res.status(400).json({ error: "Expected AthleteToken (ATH-...), but received an ORG- token." });
    }

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

    /* ---------------- 3) Robust macro extraction ----------------
       Goal: Populate Airtable columns even if UI payload shifts.
       Priority:
       - body.daily.* (what your UI intends)
       - planJson.daily.* (fallback)
    -------------------------------------------------------------- */

    const pjDaily = planJsonObj?.daily && typeof planJsonObj.daily === "object" ? planJsonObj.daily : {};

    const dailyCalories = pickFirstNonEmptyString(daily?.calories, pjDaily?.calories);
    const dailyProtein  = pickFirstNonEmptyString(daily?.protein,  pjDaily?.protein); // ✅ DailyProtein
    const dailyCarbs    = pickFirstNonEmptyString(daily?.carbs,    pjDaily?.carbs);   // ✅ DailyCarbs
    const dailyFat      = pickFirstNonEmptyString(daily?.fat,      pjDaily?.fat);

    /* ---------------- 4) Build Airtable fields ---------------- */

    const fields = {
      [PLAN_ATH_LINK]: [athleteRec.id],
      [PLAN_STATUS]: status || "active",
      [PLAN_PHASE]: phase,

      // ✅ These are Single line text fields in Airtable: always store as strings
      [PLAN_DCAL]: dailyCalories,
      [PLAN_DPRO]: dailyProtein,
      [PLAN_DCARB]: dailyCarbs,
      [PLAN_DFAT]: dailyFat,

      [PLAN_JSON]: safeJsonStringify(planJsonRaw),
      [PLAN_PRESCRIPTION]: prescription,

      // meta
      [PLAN_CREATED_BY]: createdBy,
      [PLAN_CREATED_AT]: new Date().toISOString(),
    };

    /* ---------------- 5) Save ---------------- */

    let saved;
    if (existing) saved = await plansTable.update(existing.id, fields);
    else saved = await plansTable.create(fields);

    return res.status(200).json({
      ok: true,
      plan: { id: saved.id, fields: saved.fields || {} },

      // Helpful debug (safe to keep or remove)
      debug: {
        athleteToken,
        extractedDaily: {
          fromBody: {
            calories: asString(daily?.calories),
            protein: asString(daily?.protein),
            carbs: asString(daily?.carbs),
            fat: asString(daily?.fat),
          },
          fromPlanJson: {
            calories: asString(pjDaily?.calories),
            protein: asString(pjDaily?.protein),
            carbs: asString(pjDaily?.carbs),
            fat: asString(pjDaily?.fat),
          },
          finalFields: {
            DailyCalories: dailyCalories,
            DailyProtein: dailyProtein,
            DailyCarbs: dailyCarbs,
            DailyFat: dailyFat,
          },
        },
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
