// pages/api/athlete/nutrition/checkins/create.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/* ---------------- helpers ---------------- */

function asString(v) { return String(v ?? "").trim(); }

function safeNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getTable(apiKey, baseId, tableNameOrId) {
  if (!apiKey || !baseId || !tableNameOrId) return null;
  return new Airtable({ apiKey }).base(baseId)(tableNameOrId);
}

function nyWeekStartISO(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);

  const y   = parts.find((p) => p.type === "year")?.value;
  const m   = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  const nyMid = new Date(`${y}-${m}-${day}T12:00:00`);
  const diffToMon = (nyMid.getDay() + 6) % 7;
  nyMid.setDate(nyMid.getDate() - diffToMon);

  const p2  = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(nyMid);

  return `${p2.find((p) => p.type === "year")?.value}-${p2.find((p) => p.type === "month")?.value}-${p2.find((p) => p.type === "day")?.value}`;
}

/* ---------------- env ---------------- */

const NUTRITIONCHECKINS_API_KEY = process.env.NUTRITIONCHECKINS_API_KEY;
const NUTRITIONCHECKINS_BASE_ID = process.env.NUTRITIONCHECKINS_BASE_ID;
const NUTRITIONCHECKINS_TABLE   =
  process.env.NUTRITIONCHECKINS_TABLE      ||
  process.env.NUTRITIONCHECKINS_TABLE_NAME ||
  process.env.NUTRITIONCHECKINS_TABLE_ID   ||
  "NutritionCheckins";

const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

const NUTRITIONPLANS_API_KEY = process.env.NUTRITIONPLANS_API_KEY;
const NUTRITIONPLANS_BASE_ID = process.env.NUTRITIONPLANS_BASE_ID;
const NUTRITIONPLANS_TABLE   =
  process.env.NUTRITIONPLANS_TABLE      ||
  process.env.NUTRITIONPLANS_TABLE_NAME ||
  process.env.NUTRITIONPLANS_TABLE_ID   || "";

/* ---------------- field names ---------------- */

const CHK_CREATED_AT   = "CreatedAt";
const CHK_ATHLETE_LINK = "AthleteName";
const CHK_ORG_LINK     = "Organization";
const CHK_PLANS_LINK   = "NutritonPlans"; // typo matches Airtable column
const CHK_WEEK         = "WeekStartISO";
const CHK_CAL          = "CaloriesAdherencePct";
const CHK_PRO          = "ProteinAdherencePct";
const CHK_CARBS        = "CarbsAdherencePct";
const CHK_HYD          = "HydrationAdherencePct";
const CHK_NOTES        = "Notes";

const ATH_TOKEN_FIELD   = "AthleteToken";
const ATH_ORG_LINK_FIELD = "Organization";

// NutritionPlans — Athlete is a LINKED RECORD field, not a text field.
// Must use FIND+ARRAYJOIN to match, NOT exact equality.
const PLAN_ATH_LINK  = "Athlete";
const PLAN_STATUS    = "Status";
const PLAN_CREATED_AT = "CreatedAt";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req, res);
  if (!auth?.ok) return;

  const athleteToken = asString(
    auth?.athlete?.athleteToken || auth?.athlete?.token || auth?.athlete?.AthleteToken
  );

  if (!athleteToken || !athleteToken.toUpperCase().startsWith("ATH-")) {
    return res.status(401).json({ error: "AthleteToken missing from session." });
  }

  const checkinsTable = getTable(NUTRITIONCHECKINS_API_KEY, NUTRITIONCHECKINS_BASE_ID, NUTRITIONCHECKINS_TABLE);
  const athleteTable  = getTable(ATHLETE_API_KEY,           ATHLETE_BASE_ID,           ATHLETE_TABLE_NAME);
  const plansTable    = NUTRITIONPLANS_API_KEY && NUTRITIONPLANS_BASE_ID && NUTRITIONPLANS_TABLE
    ? getTable(NUTRITIONPLANS_API_KEY, NUTRITIONPLANS_BASE_ID, NUTRITIONPLANS_TABLE)
    : null;

  if (!checkinsTable) return res.status(500).json({ error: "NutritionCheckins Airtable not configured." });
  if (!athleteTable)  return res.status(500).json({ error: "Athlete Airtable not configured." });

  try {
    const body          = req.body || {};
    const weekStartISO  = nyWeekStartISO(new Date());

    const caloriesPct  = clampInt(safeNum(body.caloriesPct ?? body.calories)  ?? 0, 0, 100);
    const proteinPct   = clampInt(safeNum(body.proteinPct  ?? body.protein)   ?? 0, 0, 100);
    const carbsPct     = clampInt(safeNum(body.carbsPct    ?? body.carbs)     ?? 0, 0, 100);
    const hydrationPct = clampInt(safeNum(body.hydrationPct ?? body.hydration) ?? 0, 0, 100);
    const notes        = asString(body.notes);

    /* 1) Resolve athlete record */
    const safeTok  = escapeAirtableString(athleteToken);
    const athleteRec = await athleteTable
      .select({ filterByFormula: `{${ATH_TOKEN_FIELD}}='${safeTok}'`, maxRecords: 1 })
      .firstPage()
      .then((xs) => xs?.[0] || null);

    if (!athleteRec?.id) {
      return res.status(404).json({ error: "AthleteScans record not found for this AthleteToken.", athleteToken });
    }

    /* 2) Org links — soft-fail: warn but don't block the check-in */
    const orgLinks = Array.isArray(athleteRec.fields?.[ATH_ORG_LINK_FIELD])
      ? athleteRec.fields[ATH_ORG_LINK_FIELD]
      : [];

    const orgWarning = orgLinks.length === 0
      ? "Athlete record missing Organization link — check-in saved without org."
      : null;

    /* 3) Resolve latest plan by linked record ID (ARRAYJOIN, not exact match)
       FIX: was using {AthleteToken}='...' which fails on LOOKUP fields.
       Now uses FIND+ARRAYJOIN on the Athlete linked record field. */
    let planLinkIds = [];
    if (plansTable) {
      const planFilter = `AND(
        FIND('${escapeAirtableString(athleteRec.id)}', ARRAYJOIN({${PLAN_ATH_LINK}}&'')),
        LOWER({${PLAN_STATUS}}&'')='active'
      )`;
      const plan = await plansTable
        .select({ filterByFormula: planFilter, sort: [{ field: PLAN_CREATED_AT, direction: "desc" }], maxRecords: 1 })
        .firstPage()
        .then((xs) => xs?.[0] || null);

      if (plan?.id) planLinkIds = [plan.id];
    }

    /* 4) Upsert by (AthleteName link + WeekStartISO) */
    const aId   = escapeAirtableString(athleteRec.id);
    const w     = escapeAirtableString(weekStartISO);
    const filterByFormula = `AND(
      FIND('${aId}', ARRAYJOIN({${CHK_ATHLETE_LINK}}&'')) > 0,
      {${CHK_WEEK}}='${w}'
    )`;

    const existing = await checkinsTable
      .select({ filterByFormula, maxRecords: 1 })
      .firstPage()
      .then((xs) => xs?.[0] || null);

    const fields = {
      [CHK_ATHLETE_LINK]: [athleteRec.id],
      ...(orgLinks.length ? { [CHK_ORG_LINK]: orgLinks } : {}),
      [CHK_WEEK]:  weekStartISO,
      [CHK_CAL]:   caloriesPct,
      [CHK_PRO]:   proteinPct,
      [CHK_CARBS]: carbsPct,
      [CHK_HYD]:   hydrationPct,
      [CHK_NOTES]: notes,
      ...(planLinkIds.length ? { [CHK_PLANS_LINK]: planLinkIds } : {}),
    };

    const nowISO = new Date().toISOString();
    const record = existing?.id
      ? await checkinsTable.update(existing.id, fields)
      : await checkinsTable.create({ ...fields, [CHK_CREATED_AT]: nowISO });

    return res.status(200).json({
      ok: true,
      weekStartISO,
      ...(orgWarning ? { warning: orgWarning } : {}),
      checkin: {
        id:            record.id,
        athleteToken,
        athleteRecId:  athleteRec.id,
        orgRecIds:     orgLinks,
        planRecIds:    planLinkIds,
        createdAt:     existing?.id ? asString(existing.fields?.[CHK_CREATED_AT]) : nowISO,
        caloriesPct,
        proteinPct,
        carbsPct,
        hydrationPct,
        notes,
      },
    });

  } catch (e) {
    console.error("[athlete/nutrition/checkins/create] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to submit check-in.", airtable: { statusCode: e?.statusCode } });
  }
}