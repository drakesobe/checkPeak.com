// pages/api/athlete/nutrition/plan.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

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
  return new Airtable({ apiKey }).base(baseId)(tableNameOrId);
}

function tokenMatchFormula(fieldName, tokenValue) {
  const safeTok = escapeAirtableString(tokenValue);
  return `FIND('${safeTok}', ARRAYJOIN({${fieldName}}&''))`;
}

function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;

  // First attempt — clean parse
  try { return JSON.parse(raw); }
  catch { /* fall through */ }

  // Second attempt — strip invalid JSON escape sequences
  // (e.g. \_ in Amazon image URLs) then retry
  try {
    const sanitized = raw.replace(/\\([^"\\\/bfnrtu])/g, "$1");
    return JSON.parse(sanitized);
  } catch {
    return null;
  }
}

/* ---------------- env ---------------- */

const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

const NUTRITION_API_KEY     = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID     = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME  ||
  process.env.NUTRITION_TABLE_ID    ||
  "NutritionPlans";

/* ---------------- field names ---------------- */

const ATH_NAME  = "Name";
const ATH_EMAIL = "Email";
const ATH_TOKEN = "AthleteToken";

const PLAN_ATH_LINK   = "Athlete";
const PLAN_STATUS     = "Status";
const PLAN_CREATED_AT = "CreatedAt";
const PLAN_CREATED_BY = "CreatedBy";
const PLAN_ARCHIVED_AT = "ArchivedAt";
const PLAN_ARCHIVED_BY = "ArchivedBy";

const PLAN_PHASE      = "Phase";
const PLAN_DCAL       = "DailyCalories";
const PLAN_DPRO       = "DailyProtein";
const PLAN_DCARB      = "DailyCarbs";
const PLAN_DFAT       = "DailyFat";
const PLAN_DHYDRATION = "DailyHydration";
const PLAN_JSON       = "PlanJson";
const PLAN_PRESCRIPTION = "Prescription";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req, res);
  if (!auth?.ok) return;

  const sessionTok = asString(
    auth?.athlete?.athleteToken ||
    auth?.athlete?.token        ||
    auth?.athlete?.AthleteToken
  );
  const sessionEmail = asString(auth?.athlete?.email || auth?.athlete?.Email);

  if (!sessionTok || !sessionTok.toUpperCase().startsWith("ATH-")) {
    return res.status(401).json({ error: "AthleteToken missing from session." });
  }

  const qTok = asString(req.query?.athleteToken);
  if (qTok && qTok !== sessionTok) {
    return res.status(403).json({ error: "Forbidden: token mismatch." });
  }

  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);
  const plansTable   = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);

  if (!athleteTable) return res.status(500).json({ error: "Athletes Airtable not configured.", missing: { ATHLETE_API_KEY: !ATHLETE_API_KEY, ATHLETE_BASE_ID: !ATHLETE_BASE_ID, ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME } });
  if (!plansTable)   return res.status(500).json({ error: "NutritionPlans Airtable not configured.", missing: { NUTRITION_API_KEY: !NUTRITION_API_KEY, NUTRITION_BASE_ID: !NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE: !NUTRITION_PLANS_TABLE } });

  try {
    /* 1) Find athlete record */
    const athleteRec = await athleteTable
      .select({ filterByFormula: tokenMatchFormula(ATH_TOKEN, sessionTok), maxRecords: 1 })
      .firstPage()
      .then((xs) => xs?.length ? xs[0] : null);

    if (!athleteRec) {
      return res.status(404).json({ error: "Athlete record not found." });
    }

    const af = athleteRec.fields || {};
    const athlete = {
      id:           athleteRec.id,
      name:         asString(af[ATH_NAME]) || "Athlete",
      email:        asString(af[ATH_EMAIL]) || sessionEmail,
      athleteToken: asString(af[ATH_TOKEN]) || sessionTok,
    };

    /* 2) Latest active plan */
    const planAthMatch      = `FIND('${escapeAirtableString(athleteRec.id)}', ARRAYJOIN({${PLAN_ATH_LINK}}&''))`;
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
        id:    latestRec.id,
        phase: asString(f[PLAN_PHASE]),
        daily: {
          calories:    f[PLAN_DCAL]       ?? "",
          protein:     f[PLAN_DPRO]       ?? "",
          carbs:       f[PLAN_DCARB]      ?? "",
          fat:         f[PLAN_DFAT]       ?? "",
          hydrationOz: f[PLAN_DHYDRATION] ?? "",
        },
        planJsonRaw:  asString(f[PLAN_JSON]),
        planJson:     safeJsonParse(f[PLAN_JSON]),
        prescription: asString(f[PLAN_PRESCRIPTION]),
        status:       asString(f[PLAN_STATUS]) || "active",
        createdAt:    asString(f[PLAN_CREATED_AT]) || asString(latestRec._rawJson?.createdTime),
        createdBy:    asString(f[PLAN_CREATED_BY]),
        archivedAt:   asString(f[PLAN_ARCHIVED_AT]),
        archivedBy:   asString(f[PLAN_ARCHIVED_BY]),
      };
    }

    return res.status(200).json({ ok: true, athlete, latestPlan });

  } catch (e) {
    console.error("[athlete/nutrition/plan] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to load nutrition plan.",
      airtable: { statusCode: e?.statusCode, message: e?.message, error: e?.error },
    });
  }
}