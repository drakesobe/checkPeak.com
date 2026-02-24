// pages/api/org/nutrition/table.js
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
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(100, x));
}

function isoDateOnlyFromISODateTime(dt) {
  const s = asString(dt);
  if (!s) return "";
  return s.slice(0, 10);
}

// Monday week start in America/New_York, returned YYYY-MM-DD
function nyWeekStartISOFromDateISO(dateISO) {
  if (!dateISO || dateISO.length < 10) return "";
  const nyMid = new Date(`${dateISO.slice(0, 10)}T12:00:00`);
  const dow = nyMid.getDay(); // 0=Sun,1=Mon,...6=Sat
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

/**
 * CompletionJson shape:
 * {
 *  breakfast:{mealDone:boolean, hydrationDone:boolean},
 *  lunch:{...},
 *  afternoon:{...},
 *  dinner:{...}
 * }
 */
function completionJsonToPcts(completionJson) {
  const c = completionJson && typeof completionJson === "object" ? completionJson : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];

  let mealDone = 0;
  let hydrationDone = 0;

  for (const k of keys) {
    if (Boolean(c?.[k]?.mealDone)) mealDone += 1;
    if (Boolean(c?.[k]?.hydrationDone)) hydrationDone += 1;
  }

  const mealPct = clampPct((mealDone / 4) * 100);
  const hydrationPct = clampPct((hydrationDone / 4) * 100);

  // total out of 8 toggles (4 meal + 4 hydration)
  const totalPct = clampPct(((mealDone + hydrationDone) / 8) * 100);

  return { mealPct, hydrationPct, totalPct };
}

/* ---------------- env ---------------- */

// AthleteScans (roster)
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

// Nutrition base (plans + completions)
const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;

// Plans table
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME ||
  process.env.NUTRITION_TABLE_ID ||
  "NutritionPlans";

// Completions table
const NUTRITION_COMPLETIONS_TABLE =
  process.env.NUTRITION_COMPLETIONS_TABLE ||
  process.env.NUTRITION_COMPLETIONS_TABLE_NAME ||
  process.env.NUTRITION_COMPLETIONS_TABLE_ID ||
  "NutritionCompletions";

// Configurable plan fields (from env)
const PLAN_ATH_TOKEN = process.env.NUTRITION_TOKEN_FIELD || "AthleteToken";
const PLAN_STATUS = process.env.NUTRITION_STATUS_FIELD || "Status";
const PLAN_CREATED_AT = process.env.NUTRITION_CREATEDAT_FIELD || "CreatedAt";

// Completion fields (per your schema)
const CMP_DATE = "Date";
const CMP_ATH_TOKEN = "AthleteToken";
const CMP_JSON = "CompletionJson";
const CMP_UPDATED_AT = "UpdatedAt";

// AthleteScans strict fields (from your working athlete endpoint)
const ATH_NAME = "Name";
const ATH_EMAIL = "Email";
const ATH_TOKEN = "AthleteToken";
const ATH_ORG_TOKEN = "Token";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const orgToken = asString(auth?.org?.token);
  if (!orgToken) return res.status(401).json({ error: "Org token missing from session." });

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

  if (!completionsTable) {
    return res.status(500).json({
      error: "NutritionCompletions Airtable not configured.",
      missing: {
        NUTRITION_API_KEY: !NUTRITION_API_KEY,
        NUTRITION_BASE_ID: !NUTRITION_BASE_ID,
        NUTRITION_COMPLETIONS_TABLE: !NUTRITION_COMPLETIONS_TABLE,
      },
    });
  }

  try {
    /* ---------------- 1) Roster: athletes for this org ---------------- */

    const athleteFilter = lookupSafeContains(ATH_ORG_TOKEN, orgToken);

    // Only request fields we KNOW exist. Optional fields may not exist.
    const athleteRecs = await athleteTable
      .select({
        filterByFormula: athleteFilter,
        fields: [ATH_NAME, ATH_EMAIL, ATH_TOKEN, ATH_ORG_TOKEN],
        maxRecords: 2000,
      })
      .firstPage();

    const roster = safeArr(athleteRecs).map((r) => {
      const f = r.fields || {};

      // Optional fields (ONLY read if present; do not request them)
      const team = asString(f.Team ?? f["Team"]);
      const sport = asString(f.Sport ?? f["Sport"]);
      const position = asString(f.Position ?? f["Position"]);
      const year = asString(f.Year ?? f["Year"]);
      const orgName = asString(f.OrgName ?? f["OrgName"] ?? f.OrganizationName ?? f["OrganizationName"]);

      return {
        athleteRecId: r.id,
        athleteToken: asString(f[ATH_TOKEN]),
        athleteName: asString(f[ATH_NAME]) || "Athlete",
        athleteEmail: asString(f[ATH_EMAIL]),
        team,
        sport,
        position,
        year,
        orgName,
      };
    });

    /* ---------------- helpers: concurrency ---------------- */

    async function mapLimit(items, limit, fn) {
      const results = new Array(items.length);
      let i = 0;

      async function worker() {
        while (i < items.length) {
          const idx = i++;
          results[idx] = await fn(items[idx], idx);
        }
      }

      const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
      await Promise.all(workers);
      return results;
    }

    /* ---------------- 2) Join latest plan + completion by AthleteToken lookup ---------------- */

    const rows = await mapLimit(roster, 8, async (ath) => {
      const tok = asString(ath.athleteToken);

      if (!tok) {
        return {
          ...ath,
          plan: null,
          completion: null,
          rollup: { last7Avg: null, last14Avg: null, streakDays: null, missedThisWeek: false },
          adherenceAvg: null,
        };
      }

      // ---- Latest plan by AthleteToken lookup (prefer active, fallback to newest) ----
      const planTokMatch = lookupSafeContains(PLAN_ATH_TOKEN, tok);

      const planRecs = await plansTable
        .select({
          filterByFormula: planTokMatch,
          sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
          maxRecords: 10,
        })
        .firstPage();

      const pickPlan = (recs) => {
        const list = safeArr(recs);
        if (!list.length) return null;

        const normalizeStatus = (s) => asString(s).toLowerCase().replace(/\s+/g, " ").trim();
        const active = list.find((r) => normalizeStatus(r?.fields?.[PLAN_STATUS]) === "active");
        return active || list[0];
      };

      const latestPlanRec = pickPlan(planRecs);
      const pf = latestPlanRec?.fields || {};

      const plan = latestPlanRec
        ? {
            phase: asString(pf.Phase),
            status: asString(pf[PLAN_STATUS]) || "",
            effectiveDate: asString(pf.EffectiveDate),
            daily: {
              calories: asString(pf.DailyCalories ?? pf.Calories ?? ""),
              protein: asString(pf.DailyProtein ?? pf.Protein ?? ""),
              carbs: asString(pf.DailyCarbs ?? pf.Carbs ?? ""),
              fat: asString(pf.DailyFat ?? pf.Fat ?? ""),
              hydrationOz: asString(pf.HydrationOz ?? pf.DailyHydration ?? pf.Hydration ?? ""),
            },
            createdAt: asString(pf[PLAN_CREATED_AT]) || asString(latestPlanRec?._rawJson?.createdTime),
            createdBy: asString(pf.CreatedBy),
          }
        : null;

      // ---- Latest completion by AthleteToken lookup (Date first, then UpdatedAt) ----
      const completionsFilter = lookupSafeContains(CMP_ATH_TOKEN, tok);

      const compRecs = await completionsTable
        .select({
          filterByFormula: completionsFilter,
          sort: [
            { field: CMP_DATE, direction: "desc" },
            { field: CMP_UPDATED_AT, direction: "desc" },
          ],
          maxRecords: 1,
        })
        .firstPage();

      const c = compRecs?.[0] || null;
      const cf = c?.fields || {};

      const rawJson = safeJsonParse(cf[CMP_JSON]) || {};
      const pcts = completionJsonToPcts(rawJson);

      const dt = asString(cf[CMP_DATE]) || asString(c?._rawJson?.createdTime);
      const dateISO = isoDateOnlyFromISODateTime(dt);
      const weekStartISO = nyWeekStartISOFromDateISO(dateISO);

      const completion = c
        ? {
            updatedAt: asString(cf[CMP_UPDATED_AT]) || asString(c?._rawJson?.createdTime),
            dateISO,
            weekStartISO,

            totalPct: pcts.totalPct,
            mealPct: pcts.mealPct,
            hydrationPct: pcts.hydrationPct,

            // macros not available (CompletionJson only has meal/hydration)
            caloriesPct: null,
            proteinPct: null,
            carbsPct: null,

            notes: asString(cf.AttachmentSummary ?? ""),
          }
        : null;

      return {
        ...ath,
        plan,
        completion,
        rollup: { last7Avg: null, last14Avg: null, streakDays: null, missedThisWeek: false },
        adherenceAvg: clampPct(completion?.totalPct),
      };
    });

    // Optional debug: /api/org/nutrition/table?debug=1
    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: {
          athleteFilter,
          rosterCount: roster.length,
          plansTable: NUTRITION_PLANS_TABLE,
          completionsTable: NUTRITION_COMPLETIONS_TABLE,
          planTokenField: PLAN_ATH_TOKEN,
          planStatusField: PLAN_STATUS,
          planCreatedAtField: PLAN_CREATED_AT,
        },
        rows,
      });
    }

    return res.status(200).json({ ok: true, rows });
  } catch (e) {
    console.error("[nutrition/table] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to load org nutrition table.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}