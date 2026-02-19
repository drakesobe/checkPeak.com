// pages/api/org/nutrition/todaySummary.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

/* ---------------- helpers ---------------- */

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  const base = new Airtable({ apiKey }).base(baseId);
  return base(tableNameOrId);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
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

// AthleteScans base/table
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME; // AthleteScans

/* ---------------- Airtable field names (STRICT) ---------------- */

// AthleteScans
const ATH_TOKEN = "AthleteToken";
const ATH_ORG_TOKEN = "Token";
const ATH_NAME = "Name";
const ATH_EMAIL = "Email";

// NutritionPlans
const PLAN_ATH_LINK = "Athlete";
const PLAN_STATUS = "Status";
const PLAN_CREATED_AT = "CreatedAt";
const PLAN_DHYDRATION = "DailyHydration"; // your field

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

  if (!athleteTable) {
    return res.status(500).json({
      error: "AthleteScans Airtable not configured.",
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
    const ot = escapeAirtableString(orgToken);

    // 1) Fetch athletes for this org
    const athleteFilter = `FIND('${ot}', ARRAYJOIN({${ATH_ORG_TOKEN}}&''))`;

    const athletes = await athleteTable
      .select({
        filterByFormula: athleteFilter,
        maxRecords: 500,
      })
      .all()
      .then((recs) =>
        (recs || []).map((r) => ({
          id: r.id,
          token: asString(r.get(ATH_TOKEN)),
          name: asString(r.get(ATH_NAME)),
          email: asString(r.get(ATH_EMAIL)),
        }))
      );

    const athleteIds = new Set(athletes.map((a) => a.id));

    // 2) Fetch active nutrition plans (org-agnostic) then intersect by linked athlete ids
    const activePlans = await plansTable
      .select({
        filterByFormula: `LOWER({${PLAN_STATUS}}&'')='active'`,
        sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
        maxRecords: 500,
      })
      .all()
      .then((recs) =>
        (recs || []).map((r) => ({
          id: r.id,
          athleteLinks: safeArray(r.get(PLAN_ATH_LINK)),
          hydration: asString(r.get(PLAN_DHYDRATION)),
        }))
      );

    // Map athleteId -> plan info (latest active wins due to sort desc)
    const athleteToPlan = new Map();
    for (const p of activePlans) {
      for (const aid of p.athleteLinks) {
        if (!athleteIds.has(aid)) continue;
        if (!athleteToPlan.has(aid)) athleteToPlan.set(aid, p);
      }
    }

    const totalAthletes = athletes.length;
    const withPlan = athleteToPlan.size;
    const missingPlan = totalAthletes - withPlan;

    // Hydration target coverage among those with plans
    let hydrationSetCount = 0;
    for (const [aid, plan] of athleteToPlan.entries()) {
      if (asString(plan?.hydration)) hydrationSetCount += 1;
    }

    // Top “needs nutrition plan” list (for quick actions)
    const needsList = athletes
      .filter((a) => !athleteToPlan.has(a.id))
      .slice(0, 8)
      .map((a) => ({
        token: a.token,
        name: a.name,
        email: a.email,
      }));

    return res.status(200).json({
      ok: true,
      summary: {
        totalAthletes,
        withPlan,
        missingPlan,
        hydrationSetCount,
      },
      needsList,
    });
  } catch (e) {
    console.error("[org/nutrition/todaySummary] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to load nutrition summary.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}
