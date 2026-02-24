// pages/api/athlete/nutrition/checkins/create.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

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
  const base = new Airtable({ apiKey }).base(baseId);
  return base(tableNameOrId);
}

// Monday-start week in America/New_York, returned as YYYY-MM-DD
function nyWeekStartISO(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  const nyMid = new Date(`${y}-${m}-${day}T12:00:00`);
  const dow = nyMid.getDay(); // 0=Sun..6=Sat
  const diffToMon = (dow + 6) % 7; // Mon->0 ... Sun->6
  nyMid.setDate(nyMid.getDate() - diffToMon);

  const parts2 = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nyMid);

  const y2 = parts2.find((p) => p.type === "year")?.value;
  const m2 = parts2.find((p) => p.type === "month")?.value;
  const d2 = parts2.find((p) => p.type === "day")?.value;

  return `${y2}-${m2}-${d2}`;
}

/* ---------------- env ---------------- */

// NutritionCheckins table (target)
const NUTRITIONCHECKINS_API_KEY = process.env.NUTRITIONCHECKINS_API_KEY;
const NUTRITIONCHECKINS_BASE_ID = process.env.NUTRITIONCHECKINS_BASE_ID;
const NUTRITIONCHECKINS_TABLE =
  process.env.NUTRITIONCHECKINS_TABLE ||
  process.env.NUTRITIONCHECKINS_TABLE_NAME ||
  process.env.NUTRITIONCHECKINS_TABLE_ID ||
  "NutritionCheckins";

// AthleteScans base/table (to resolve athlete record id + org link)
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME; // must point to AthleteScans table

// Optional: NutritionPlans base/table (if you want to link the latest plan)
const NUTRITIONPLANS_API_KEY = process.env.NUTRITIONPLANS_API_KEY;
const NUTRITIONPLANS_BASE_ID = process.env.NUTRITIONPLANS_BASE_ID;
const NUTRITIONPLANS_TABLE =
  process.env.NUTRITIONPLANS_TABLE ||
  process.env.NUTRITIONPLANS_TABLE_NAME ||
  process.env.NUTRITIONPLANS_TABLE_ID ||
  "";

/* ---------------- Airtable field names (match your columns) ---------------- */

// NutritionCheckins fields
const CHK_CREATED_AT = "CreatedAt";
const CHK_ATHLETE_LINK = "AthleteName";      // LINK to AthleteScans ✅
const CHK_ORG_LINK = "Organization";         // LINK to Organizations ✅
const CHK_PLANS_LINK = "NutritonPlans";      // LINK to NutritionPlans ✅ (spelling matches your column)
const CHK_WEEK = "WeekStartISO";

const CHK_CAL = "CaloriesAdherencePct";
const CHK_PRO = "ProteinAdherencePct";
const CHK_CARBS = "CarbsAdherencePct";
const CHK_HYD = "HydrationAdherencePct";
const CHK_NOTES = "Notes";

// AthleteScans fields (these must match your AthleteScans table)
const ATH_TOKEN_FIELD = "AthleteToken";      // token field in AthleteScans
const ATH_ORG_LINK_FIELD = "Organization";   // link field on AthleteScans to Organizations (common pattern)

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

  const checkinsTable = getTable(
    NUTRITIONCHECKINS_API_KEY,
    NUTRITIONCHECKINS_BASE_ID,
    NUTRITIONCHECKINS_TABLE
  );

  if (!checkinsTable) {
    return res.status(500).json({
      error: "NutritionCheckins Airtable not configured.",
      missing: {
        NUTRITIONCHECKINS_API_KEY: !NUTRITIONCHECKINS_API_KEY,
        NUTRITIONCHECKINS_BASE_ID: !NUTRITIONCHECKINS_BASE_ID,
        NUTRITIONCHECKINS_TABLE: !NUTRITIONCHECKINS_TABLE,
      },
    });
  }

  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);
  if (!athleteTable) {
    return res.status(500).json({
      error: "Athlete Airtable not configured (needed to link AthleteName).",
      missing: {
        ATHLETE_API_KEY: !ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  const plansTable =
    NUTRITIONPLANS_API_KEY && NUTRITIONPLANS_BASE_ID && NUTRITIONPLANS_TABLE
      ? getTable(NUTRITIONPLANS_API_KEY, NUTRITIONPLANS_BASE_ID, NUTRITIONPLANS_TABLE)
      : null;

  try {
    const body = req.body || {};
    const weekStartISO = nyWeekStartISO(new Date());

    // Store as 0..100 integers
    const caloriesPct = clampInt(safeNum(body.caloriesPct ?? body.calories) ?? 0, 0, 100);
    const proteinPct = clampInt(safeNum(body.proteinPct ?? body.protein) ?? 0, 0, 100);
    const carbsPct = clampInt(safeNum(body.carbsPct ?? body.carbs) ?? 0, 0, 100);
    const hydrationPct = clampInt(safeNum(body.hydrationPct ?? body.hydration) ?? 0, 0, 100);
    const notes = asString(body.notes);

    // 1) Resolve AthleteScans record by AthleteToken
    const safeTok = escapeAirtableString(athleteToken);
    const athleteRec = await athleteTable
      .select({
        filterByFormula: `{${ATH_TOKEN_FIELD}}='${safeTok}'`,
        maxRecords: 1,
      })
      .firstPage()
      .then((xs) => (xs?.length ? xs[0] : null));

    if (!athleteRec?.id) {
      return res.status(404).json({
        error: "AthleteScans record not found for this AthleteToken.",
        athleteToken,
      });
    }

    // 2) Organization link should come from AthleteScans record (preferred)
    const orgLinks = Array.isArray(athleteRec.fields?.[ATH_ORG_LINK_FIELD])
      ? athleteRec.fields[ATH_ORG_LINK_FIELD]
      : [];

    if (!orgLinks.length) {
      return res.status(400).json({
        error:
          "Athlete record is missing Organization link. Link AthleteScans → Organizations so check-ins can inherit org.",
        athleteToken,
      });
    }

    // 3) Optionally resolve latest NutritionPlan record id to link
    // If you don’t want this yet, it’s fine — the field will just be omitted.
    let planLinkIds = [];
    if (plansTable) {
      // Common patterns: plan has AthleteToken, or an Athlete link
      // We'll try AthleteToken first.
      const plan = await plansTable
        .select({
          filterByFormula: `{AthleteToken}='${safeTok}'`,
          sort: [{ field: "CreatedAt", direction: "desc" }],
          maxRecords: 1,
        })
        .firstPage()
        .then((xs) => (xs?.length ? xs[0] : null));

      if (plan?.id) planLinkIds = [plan.id];
    }

    // 4) Upsert by (AthleteName link + WeekStartISO)
    const aId = escapeAirtableString(athleteRec.id);
    const w = escapeAirtableString(weekStartISO);

    const filterByFormula = `AND(
      FIND('${aId}', ARRAYJOIN({${CHK_ATHLETE_LINK}}&'')) > 0,
      {${CHK_WEEK}}='${w}'
    )`;

    const existing = await checkinsTable
      .select({ filterByFormula, maxRecords: 1 })
      .firstPage()
      .then((xs) => (xs?.length ? xs[0] : null));

    // fields we always write
    const fields = {
      [CHK_ATHLETE_LINK]: [athleteRec.id], // ✅ link AthleteName
      [CHK_ORG_LINK]: orgLinks,            // ✅ link Organization
      [CHK_WEEK]: weekStartISO,
      [CHK_CAL]: caloriesPct,
      [CHK_PRO]: proteinPct,
      [CHK_CARBS]: carbsPct,
      [CHK_HYD]: hydrationPct,
      [CHK_NOTES]: notes,
    };

    // link plan if found
    if (planLinkIds.length) {
      fields[CHK_PLANS_LINK] = planLinkIds;
    }

    // CreatedAt only on create (keeps history honest)
    const nowISO = new Date().toISOString();
    let record = null;

    if (existing?.id) {
      record = await checkinsTable.update(existing.id, fields);
    } else {
      record = await checkinsTable.create({
        ...fields,
        [CHK_CREATED_AT]: nowISO,
      });
    }

    return res.status(200).json({
      ok: true,
      weekStartISO,
      checkin: {
        id: record.id,
        athleteToken,
        athleteRecId: athleteRec.id,
        orgRecIds: orgLinks,
        planRecIds: planLinkIds,
        createdAt: existing?.id ? asString(existing.fields?.[CHK_CREATED_AT]) : nowISO,
        caloriesPct,
        proteinPct,
        carbsPct,
        hydrationPct,
        notes,
      },
    });
  } catch (e) {
    console.error("[athlete/nutrition/checkins/create] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to submit check-in.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}