// pages/api/org/nutrition/plans/upsert.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

// Recursively strip invalid JSON escape sequences (e.g. \_ in Amazon image URLs).
// JSON only allows: \" \\ \/ \b \f \n \r \t \uXXXX
// Any other \X is reduced to just X so JSON.stringify produces valid output.
function sanitizeForJson(obj) {
  if (typeof obj === "string") {
    return obj.replace(/\\([^"\\\/bfnrtu])/g, "$1");
  }
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeForJson(v);
    return out;
  }
  return obj;
}

function safeJsonStringify(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  try { return JSON.stringify(sanitizeForJson(obj)); } catch { return ""; }
}

function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;

  // First attempt - clean parse
  try { return JSON.parse(raw); }
  catch { /* fall through */ }

  // Second attempt - strip invalid escape sequences then retry
  try {
    const sanitized = raw.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    return JSON.parse(sanitized);
  } catch {
    return null;
  }
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  return new Airtable({ apiKey }).base(baseId)(tableNameOrId);
}

function pickFirstNonEmptyString(...vals) {
  for (const v of vals) { const s = asString(v); if (s) return s; }
  return "";
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function toISODateOnly(v) {
  const s = asString(v);
  if (!s) return "";
  if (isISODateOnly(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const y  = parts.find((p) => p.type === "year")?.value;
  const m  = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${dd}`;
}

function isoDateOnlyToNYNoonISO(isoDateOnly) {
  const d = asString(isoDateOnly);
  if (!isISODateOnly(d)) return "";
  const dt = new Date(`${d}T12:00:00-05:00`);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function normalizePlanStatusInput(v) {
  const s = asString(v).toLowerCase();
  if (!s) return "active";
  if (s === "active")   return "active";
  if (s === "no plan" || s === "no_plan" || s === "noplan") return "no_plan";
  if (s === "inactive") return "inactive";
  if (s === "draft")    return "draft";
  return s.replace(/\s+/g, "_");
}

/* ---------------- optional mirrors ---------------- */
const ENABLE_TOKEN_TEXT_MIRROR          = false;
const ENABLE_EFFECTIVE_DATE_TEXT_MIRROR = false;

/* ---------------- env ---------------- */
const NUTRITION_API_KEY     = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID     = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME  ||
  process.env.NUTRITION_TABLE_ID    ||
  "NutritionPlans";

const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

/* ---------------- field names ---------------- */
const ATH_TOKEN     = "AthleteToken";
const ATH_ORG_TOKEN = "Token";

const PLAN_ATH_LINK    = "Athlete";
const PLAN_STATUS      = "Status";
const PLAN_CREATED_AT  = "CreatedAt";
const PLAN_UPDATED_AT  = "UpdatedAt";
const PLAN_ARCHIVED_AT = "ArchivedAt";
const PLAN_CREATED_BY  = "CreatedBy";

const PLAN_PHASE      = "Phase";
const PLAN_DCAL       = "DailyCalories";
const PLAN_DPRO       = "DailyProtein";
const PLAN_DCARB      = "DailyCarbs";
const PLAN_DFAT       = "DailyFat";
const PLAN_DHYDRATION = "DailyHydration";

const PLAN_JSON                = "PlanJson";
const PLAN_PRESCRIPTION        = "Prescription";
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

  const plansTable   = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);
  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);

  if (!plansTable) {
    return res.status(500).json({
      error: "NutritionPlans Airtable not configured.",
      missing: {
        NUTRITION_API_KEY:     !NUTRITION_API_KEY,
        NUTRITION_BASE_ID:     !NUTRITION_BASE_ID,
        NUTRITION_PLANS_TABLE: !NUTRITION_PLANS_TABLE,
      },
    });
  }

  if (!athleteTable) {
    return res.status(500).json({
      error: "AthleteScans Airtable not configured (needed to link Athlete).",
      missing: {
        ATHLETE_API_KEY:    !ATHLETE_API_KEY,
        ATHLETE_BASE_ID:    !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  try {
    const body = req.body || {};

    const athleteToken = asString(body.athleteToken);
    const phase        = asString(body.phase || "Maintain");
    const status       = normalizePlanStatusInput(body.status || "active");
    const createdBy    = asString(body.createdBy || "");
    const prescription = asString(body.prescription || "");

    const daily       = body.daily && typeof body.daily === "object" ? body.daily : {};
    const planJsonRaw = body.planJson ?? null;
    const planJsonObj = planJsonRaw && typeof planJsonRaw === "object"
      ? planJsonRaw
      : safeJsonParse(planJsonRaw);

    if (!athleteToken) return res.status(400).json({ error: "athleteToken is required" });
    if (athleteToken.toUpperCase().startsWith("ORG-")) {
      return res.status(400).json({ error: "Expected AthleteToken (ATH-...), received an ORG- token." });
    }

    /* ── effective date ── */
    const effRaw =
      asString(body.metaEffectiveDate) ||
      asString(body.structured?.metaEffectiveDate) ||
      asString(body.planJson?.meta?.effectiveDate) ||
      asString(planJsonObj?.meta?.effectiveDate);

    const effectiveDate               = toISODateOnly(effRaw);
    const effectiveDateISOForAirtable = effectiveDate ? isoDateOnlyToNYNoonISO(effectiveDate) : "";

    /* ── 1) find athlete (must belong to org) ── */
    const tok = escapeAirtableString(athleteToken);
    const ot  = escapeAirtableString(orgToken);

    const athleteFilter = `AND(
      FIND('${ot}', ARRAYJOIN({${ATH_ORG_TOKEN}}&'')),
      FIND('${tok}', ARRAYJOIN({${ATH_TOKEN}}&''))
    )`;

    const athleteRec = await athleteTable
      .select({ filterByFormula: athleteFilter, maxRecords: 1 })
      .firstPage()
      .then((xs) => xs?.length ? xs[0] : null);

    if (!athleteRec) {
      return res.status(404).json({
        error: "Athlete not found for this organization.",
        debug: { athleteFilter },
      });
    }

    /* ── 2) find all existing active plans for this athlete ── */
    const planAthMatch       = `FIND('${escapeAirtableString(athleteRec.id)}', ARRAYJOIN({${PLAN_ATH_LINK}}&''))`;
    const latestActiveFilter = `AND(${planAthMatch}, LOWER({${PLAN_STATUS}}&'')='active')`;

    const existingActive = await plansTable
      .select({
        filterByFormula: latestActiveFilter,
        sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
        maxRecords: 25,
      })
      .firstPage();

    /* ── 3) archive all existing active plans ── */
    const now = new Date().toISOString();

    if (existingActive?.length) {
      await Promise.all(
        existingActive.map((r) =>
          plansTable.update(r.id, {
            [PLAN_STATUS]:      "archived",
            [PLAN_ARCHIVED_AT]: now,
            [PLAN_UPDATED_AT]:  now,
          })
        )
      );
    }

    /* ── 4) macro extraction ── */
    const pjDaily = planJsonObj?.daily && typeof planJsonObj.daily === "object"
      ? planJsonObj.daily : {};

    const dailyCalories    = pickFirstNonEmptyString(daily?.calories,    pjDaily?.calories);
    const dailyProtein     = pickFirstNonEmptyString(daily?.protein,     pjDaily?.protein);
    const dailyCarbs       = pickFirstNonEmptyString(daily?.carbs,       pjDaily?.carbs);
    const dailyFat         = pickFirstNonEmptyString(daily?.fat,         pjDaily?.fat);
    const dailyHydrationOz = pickFirstNonEmptyString(
      daily?.hydrationOz, daily?.hydration,
      pjDaily?.hydrationOz, pjDaily?.hydration, pjDaily?.waterOz, pjDaily?.water
    );

    /* ── 5) merge and sanitize PlanJson before storing ── */
    const mergedPlanJson = planJsonObj && typeof planJsonObj === "object"
      ? {
          ...planJsonObj,
          meta: {
            ...(typeof planJsonObj.meta === "object" ? planJsonObj.meta : {}),
            ...(effectiveDate ? { effectiveDate } : {}),
          },
          daily: {
            ...(typeof pjDaily === "object" ? pjDaily : {}),
            ...(dailyCalories    ? { calories:    dailyCalories    } : {}),
            ...(dailyProtein     ? { protein:     dailyProtein     } : {}),
            ...(dailyCarbs       ? { carbs:       dailyCarbs       } : {}),
            ...(dailyFat         ? { fat:         dailyFat         } : {}),
            ...(dailyHydrationOz ? { hydrationOz: dailyHydrationOz, hydration: dailyHydrationOz } : {}),
          },
        }
      : {
          meta:  effectiveDate ? { effectiveDate } : {},
          daily: {
            calories: dailyCalories, protein: dailyProtein,
            carbs: dailyCarbs, fat: dailyFat,
            ...(dailyHydrationOz ? { hydrationOz: dailyHydrationOz, hydration: dailyHydrationOz } : {}),
          },
        };

    // safeJsonStringify runs sanitizeForJson first - strips \_ and other
    // invalid escape sequences from Amazon URLs before writing to Airtable.
    const planJsonString = safeJsonStringify(mergedPlanJson);

    /* ── 6) always create a fresh active plan ── */
    const fields = {
      [PLAN_ATH_LINK]:  [athleteRec.id],
      [PLAN_STATUS]:     status || "active",
      [PLAN_PHASE]:      phase,

      [PLAN_DCAL]:       dailyCalories,
      [PLAN_DPRO]:       dailyProtein,
      [PLAN_DCARB]:      dailyCarbs,
      [PLAN_DFAT]:       dailyFat,
      [PLAN_DHYDRATION]: dailyHydrationOz,

      [PLAN_JSON]:         planJsonString,
      [PLAN_PRESCRIPTION]: prescription,
      [PLAN_CREATED_BY]:   createdBy,

      [PLAN_CREATED_AT]: now,
      [PLAN_UPDATED_AT]: now,

      ...(effectiveDateISOForAirtable
        ? { [PLAN_META_EFFECTIVE_DATE]: effectiveDateISOForAirtable }
        : {}),
    };

    if (ENABLE_TOKEN_TEXT_MIRROR) fields["AthleteTokenText"] = athleteToken;
    if (ENABLE_EFFECTIVE_DATE_TEXT_MIRROR && effectiveDate)
      fields["Meta Effective Date ISO"] = effectiveDate;

    const saved = await plansTable.create(fields);

    return res.status(200).json({
      ok: true,
      plan:          { id: saved.id, fields: saved.fields || {} },
      effectiveDate: effectiveDate || "",
      archivedCount: existingActive?.length || 0,
      debug: {
        athleteToken,
        athleteId:                  athleteRec.id,
        archivedPlanIds:            (existingActive || []).map((r) => r.id),
        status,
        effectiveDate,
        effectiveDateISOForAirtable,
        dailyHydrationOz,
      },
    });
  } catch (e) {
    console.error("[nutrition/plans/upsert] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to upsert NutritionPlan.",
      airtable: { statusCode: e?.statusCode, message: e?.message, error: e?.error },
    });
  }
}