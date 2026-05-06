// pages/api/org/nutrition/bulk-assign-plan.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) { return String(v ?? "").trim(); }
function safeArr(v)  { return Array.isArray(v) ? v : []; }

function escapeAirtable(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function lookupSafeContains(field, value) {
  return `FIND('${escapeAirtable(value)}', ARRAYJOIN({${field}}&''))>0`;
}

function normalizePhase(raw) {
  const s = asString(raw).toLowerCase();
  const PHASE_MAP = {
    surplus:   "Surplus",
    bulk:      "Surplus",
    maintain:  "Maintain",
    cut:       "Cut",
    "game week": "Game Week",
    gameweek:  "Game Week",
    "bye week": "Bye Week",
    byeweek:   "Bye Week",
  };
  return PHASE_MAP[s] || "Maintain";
}

function getTable(apiKey, baseId, tableName) {
  if (!apiKey || !baseId || !tableName) return null;
  return new Airtable({ apiKey }).base(baseId)(tableName);
}

const NUTRITION_API_KEY    = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID    = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME  ||
  process.env.NUTRITION_TABLE_ID    ||
  "NutritionPlans";

const PLAN_ATH_TOKEN = "AthleteToken";
const PLAN_STATUS    = "Status";
const PLAN_CREATED_AT  = "CreatedAt";
const PLAN_ARCHIVED_AT = "ArchivedAt";
const PLAN_DCAL  = "DailyCalories";
const PLAN_DPRO  = "DailyProtein";
const PLAN_DCARB = "DailyCarbs";
const PLAN_DFAT  = "DailyFat";
const PLAN_PHASE = "Phase";
const PLAN_PRESCRIPTION = "Prescription";
const PLAN_PLAN_JSON    = "PlanJson";

// Assign one plan - archive existing active, create new active
async function assignOnePlan({ plansTable, athleteToken, plan, createdBy }) {
  const tokFilter = lookupSafeContains(PLAN_ATH_TOKEN, athleteToken);
  const activeFilter = `AND(${tokFilter}, LOWER({${PLAN_STATUS}}&'')='active')`;

  // 1) Archive existing active plans
  const existing = await plansTable
    .select({ filterByFormula: activeFilter, maxRecords: 25 })
    .firstPage();

  if (existing?.length) {
    const now = new Date().toISOString();
    await Promise.all(
      existing.map((r) =>
        plansTable.update(r.id, {
          [PLAN_STATUS]:      "archived",
          [PLAN_ARCHIVED_AT]: now,
        })
      )
    );
  }

  // 2) Build PlanJson
  const daily = {
    calories: Number(plan.calories) || 0,
    protein:  Number(plan.protein)  || 0,
    carbs:    Number(plan.carbs)    || 0,
    fat:      Number(plan.fat)      || 0,
  };

  const planJson = JSON.stringify({ daily, phase: plan.phase, notes: { macros: plan.notes || "" } });

  const prescription = [
    `Phase: ${plan.phase}`,
    `Daily: ${daily.calories} cal · ${daily.protein}g protein · ${daily.carbs}g carbs · ${daily.fat}g fat`,
    plan.notes ? `Notes: ${plan.notes}` : null,
  ].filter(Boolean).join("\n");

  // 3) Create new active plan
  const fields = {
    [PLAN_ATH_TOKEN]:    athleteToken,
    [PLAN_STATUS]:       "active",
    [PLAN_PHASE]:        normalizePhase(plan.phase),
    [PLAN_DCAL]:         String(daily.calories),
    [PLAN_DPRO]:         String(daily.protein),
    [PLAN_DCARB]:        String(daily.carbs),
    [PLAN_DFAT]:         String(daily.fat),
    [PLAN_PLAN_JSON]:    planJson,
    [PLAN_PRESCRIPTION]: prescription,
    [PLAN_CREATED_AT]:   new Date().toISOString(),
  };

  const created = await plansTable.create(fields);
  return { id: created.id };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const { athleteTokens, plan } = req.body || {};

  if (!safeArr(athleteTokens).length) {
    return res.status(400).json({ error: "athleteTokens array is required." });
  }
  if (!plan?.calories && !plan?.protein) {
    return res.status(400).json({ error: "plan must include at least calories and protein." });
  }

  const plansTable = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);
  if (!plansTable) {
    return res.status(500).json({ error: "NutritionPlans Airtable not configured." });
  }

  const createdBy = asString(auth?.org?.name || auth?.org?.token || "org");
  const tokens    = safeArr(athleteTokens).map(asString).filter(Boolean);

  // Process sequentially to avoid Airtable rate limits
  const results = [];
  for (const token of tokens) {
    try {
      const r = await assignOnePlan({ plansTable, athleteToken: token, plan, createdBy });
      results.push({ athleteToken: token, ok: true, planId: r.id });
    } catch (e) {
      results.push({ athleteToken: token, ok: false, error: e?.message || "Failed" });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed    = results.filter((r) => !r.ok).length;

  return res.status(200).json({ ok: true, succeeded, failed, results });
}