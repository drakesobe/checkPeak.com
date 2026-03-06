// pages/api/org/nutrition/assign-plan.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) { return String(v ?? "").trim(); }

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  return new Airtable({ apiKey }).base(baseId)(tableNameOrId);
}

const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

const NUTRITION_API_KEY     = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID     = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME  ||
  "NutritionPlans";

// AthleteScans
const ATH_TOKEN = "AthleteToken";

// NutritionPlans
const PLAN_ATH_LINK   = "Athlete";
const PLAN_STATUS     = "Status";
const PLAN_CREATED_AT = "CreatedAt";
const PLAN_CREATED_BY = "CreatedBy";
const PLAN_PHASE      = "Phase";
const PLAN_DCAL       = "DailyCalories";
const PLAN_DPRO       = "DailyProtein";
const PLAN_DCARB      = "DailyCarbs";
const PLAN_DFAT       = "DailyFat";
const PLAN_PRESCRIPTION = "Prescription";

// Airtable single select — must match exactly (case-sensitive)
const PHASE_MAP = {
  surplus:     "Surplus",
  maintain:    "Maintain",
  cut:         "Cut",
  "game week": "Game Week",
  "bye week":  "Bye Week",
};

function normalizePhase(raw) {
  return PHASE_MAP[String(raw || "").toLowerCase().trim()] || "Maintain";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const { athleteToken, plan } = req.body || {};

  if (!asString(athleteToken)) {
    return res.status(400).json({ error: "athleteToken is required." });
  }
  if (!plan?.calories || !plan?.protein) {
    return res.status(400).json({ error: "plan.calories and plan.protein are required." });
  }

  const athleteTable = getTable(ATHLETE_API_KEY,   ATHLETE_BASE_ID,   ATHLETE_TABLE_NAME);
  const plansTable   = getTable(NUTRITION_API_KEY,  NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);

  if (!athleteTable) return res.status(500).json({ error: "Athlete Airtable not configured." });
  if (!plansTable)   return res.status(500).json({ error: "NutritionPlans Airtable not configured." });

  try {
    /* 1) Resolve athlete record */
    const safeTok    = escapeAirtableString(asString(athleteToken));
    const athleteRec = await athleteTable
      .select({ filterByFormula: `FIND('${safeTok}', ARRAYJOIN({${ATH_TOKEN}}&''))`, maxRecords: 1 })
      .firstPage()
      .then((xs) => xs?.[0] || null);

    if (!athleteRec?.id) {
      return res.status(404).json({ error: "Athlete not found.", athleteToken });
    }

    /* 2) Archive any existing active plans for this athlete */
    const existingFilter = `AND(
      FIND('${escapeAirtableString(athleteRec.id)}', ARRAYJOIN({${PLAN_ATH_LINK}}&'')),
      LOWER({${PLAN_STATUS}}&'')='active'
    )`;

    const existingPlans = await plansTable
      .select({ filterByFormula: existingFilter, maxRecords: 25 })
      .firstPage();

    // Archive in parallel — best effort, don't block
    await Promise.all(
      (existingPlans || []).map((r) =>
        plansTable.update(r.id, { [PLAN_STATUS]: "archived" }).catch(() => null)
      )
    );

    /* 3) Create new active plan */
    const orgName = asString(auth?.org?.name || auth?.user?.orgName || "");
    const nowISO  = new Date().toISOString();

    const newPlan = await plansTable.create({
      [PLAN_ATH_LINK]:    [athleteRec.id],
      [PLAN_STATUS]:      "active",
      [PLAN_CREATED_AT]:  nowISO,
      [PLAN_CREATED_BY]:  orgName,
      [PLAN_PHASE]:       normalizePhase(plan.phase),
      [PLAN_DCAL]:        String(Number(plan.calories) || 0),
      [PLAN_DPRO]:        String(Number(plan.protein)  || 0),
      [PLAN_DCARB]:       String(Number(plan.carbs)    || 0),
      [PLAN_DFAT]:        String(Number(plan.fat)      || 0),
      [PLAN_PRESCRIPTION]: asString(plan.notes),
    });

    return res.status(200).json({
      ok: true,
      planId:       newPlan.id,
      athleteToken,
      athleteRecId: athleteRec.id,
      archivedCount: existingPlans?.length || 0,
      plan: {
        phase:    normalizePhase(plan.phase),
        calories: Number(plan.calories),
        protein:  Number(plan.protein),
        carbs:    Number(plan.carbs)  || 0,
        fat:      Number(plan.fat)    || 0,
        notes:    asString(plan.notes),
      },
    });

  } catch (e) {
    console.error("[org/nutrition/assign-plan] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to assign plan.", airtable: { statusCode: e?.statusCode } });
  }
}