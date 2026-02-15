// pages/api/athlete/nutrition/today.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/* ---------------- helpers ---------------- */

function asString(v) {
  return String(v ?? "").trim();
}

function normalizeEmail(v) {
  return asString(v).toLowerCase();
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

function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickFromAuth(auth, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = auth;
    for (const part of parts) cur = cur?.[part];
    const s = asString(cur);
    if (s) return s;
  }
  return "";
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

// Returns YYYY-MM-DD in America/New_York
function nyISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/**
 * Convert any date-like input into YYYY-MM-DD in NY timezone.
 * Works for:
 * - "YYYY-MM-DD"
 * - ISO datetime like "2026-02-15T17:00:00.000Z"
 * - Date-parsable strings
 */
function toISODateOnlyNY(v) {
  const s = asString(v);
  if (!s) return "";
  if (isISODateOnly(s)) return s;

  // Fast path: ISO datetime
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

/* ---------------- env ---------------- */

// AthleteScans
const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

// NutritionPlans
const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;
const NUTRITION_PLANS_TABLE =
  process.env.NUTRITION_PLANS_TABLE ||
  process.env.NUTRITION_TABLE_NAME ||
  process.env.NUTRITION_TABLE_ID ||
  "NutritionPlans";

/* ---------------- Airtable field names ---------------- */

// AthleteScans
const ATH_EMAIL = "Email";
const ATH_TOKEN = "AthleteToken";

// NutritionPlans
const PLAN_STATUS = "Status";
const PLAN_CREATED_AT = "CreatedAt";
const PLAN_CREATED_BY = "CreatedBy";

const PLAN_PHASE = "Phase";
const PLAN_DCAL = "DailyCalories";
const PLAN_DPRO = "DailyProtein";
const PLAN_DCARB = "DailyCarbs";
const PLAN_DFAT = "DailyFat";
const PLAN_JSON = "PlanJson";
const PLAN_PRESCRIPTION = "Prescription";

// ✅ Lookup field in NutritionPlans (lookup may be array/string; ARRAYJOIN handles both)
const PLAN_ATH_TOKEN_LOOKUP = "AthleteToken";

// ✅ Single line text like 2026-02-15T17:00:00.000Z
const PLAN_META_EFFECTIVE_DATE = "Meta Effective Date";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireAthlete(req, res);
  if (!auth?.ok) return;

  // date can come from athlete/today selectedDate
  const dateQ = asString(req.query?.date);
  const selectedDate = isISODateOnly(dateQ) ? dateQ : nyISODate(); // YYYY-MM-DD

  const athleteTable = getTable(ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME);
  const plansTable = getTable(NUTRITION_API_KEY, NUTRITION_BASE_ID, NUTRITION_PLANS_TABLE);

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

  try {
    /* ---------------- 1) Find athlete record + token ---------------- */

    let athleteToken = pickFromAuth(auth, [
      "athlete.athleteToken",
      "athlete.AthleteToken",
      "athleteToken",
      "user.athleteToken",
      "user.AthleteToken",
      "user.athlete_token",
    ]);

    const athleteEmail = normalizeEmail(
      pickFromAuth(auth, ["athlete.email", "athlete.Email", "user.email", "user.Email", "email", "Email"])
    );

    let athleteRec = null;

    // prefer token lookup
    if (athleteToken) {
      const safeTok = escapeAirtableString(athleteToken);
      const filter = `FIND('${safeTok}', ARRAYJOIN({${ATH_TOKEN}}&''))`;
      athleteRec = await athleteTable
        .select({ filterByFormula: filter, maxRecords: 1 })
        .firstPage()
        .then((xs) => (xs?.length ? xs[0] : null));
    }

    // fallback email only to recover token
    if (!athleteRec) {
      if (!athleteEmail) {
        return res.status(401).json({
          error: "Athlete session missing AthleteToken and Email.",
          debug: { selectedDate },
        });
      }

      const filter = `LOWER({${ATH_EMAIL}}&'')='${escapeAirtableString(athleteEmail)}'`;
      athleteRec = await athleteTable
        .select({ filterByFormula: filter, maxRecords: 1 })
        .firstPage()
        .then((xs) => (xs?.length ? xs[0] : null));

      if (!athleteRec) {
        return res.status(404).json({
          error: "Athlete not found (by session email).",
          debug: { athleteEmail, selectedDate },
        });
      }

      athleteToken = asString(athleteRec.fields?.[ATH_TOKEN]);
    }

    if (!athleteToken) {
      return res.status(500).json({
        error: "Athlete record found but AthleteToken is missing/blank in Airtable.",
        debug: { athleteId: athleteRec?.id, athleteEmail, selectedDate },
      });
    }

    /* ---------------- 2) Fetch ACTIVE plans for this athleteToken (LOOKUP FIELD) ---------------- */

    const safeTok = escapeAirtableString(athleteToken);

    // AthleteToken is a LOOKUP field on NutritionPlans, so treat as array-ish and ARRAYJOIN it.
    const tokMatch = `FIND('${safeTok}', ARRAYJOIN({${PLAN_ATH_TOKEN_LOOKUP}}&''))`;
    const activeFilter = `AND(${tokMatch}, LOWER({${PLAN_STATUS}}&'')='active')`;

    const activeRecs = await plansTable
      .select({
        filterByFormula: activeFilter,
        sort: [{ field: PLAN_CREATED_AT, direction: "desc" }],
        maxRecords: 25,
      })
      .firstPage();

    const candidates = safeArr(activeRecs).map((r) => {
      const f = r.fields || {};
      const planJsonRaw = asString(f[PLAN_JSON]);
      const planJson = safeJsonParse(planJsonRaw);

      // ✅ Effective date: prefer Meta Effective Date column, fallback to PlanJson.meta.effectiveDate
      const rawEff =
        asString(f[PLAN_META_EFFECTIVE_DATE]) || asString(planJson?.meta?.effectiveDate) || "";

      const effectiveDate = toISODateOnlyNY(rawEff); // YYYY-MM-DD or ""

      const createdAt = asString(f[PLAN_CREATED_AT]) || asString(r._rawJson?.createdTime);

      return {
        id: r.id,
        fields: f,
        planJsonRaw,
        planJson,
        effectiveDate,
        createdAt,
      };
    });

    /* ---------------- 3) Choose plan effective for selectedDate ----------------
       Rule:
       - If effectiveDate missing => treat as always effective (legacy)
       - else => effectiveDate <= selectedDate
    --------------------------------------------------------------------------- */

    const effective = candidates.filter((p) => {
      if (!p.effectiveDate) return true;
      return p.effectiveDate <= selectedDate;
    });

    const picked = effective[0] || null;

    // next upcoming = earliest plan whose effectiveDate > selectedDate (candidates already newest-first;
    // we’ll scan all and pick the soonest > selectedDate)
    let upcoming = null;
    for (const p of candidates) {
      if (!p.effectiveDate) continue;
      if (p.effectiveDate > selectedDate) {
        if (!upcoming || p.effectiveDate < upcoming.effectiveDate) upcoming = p;
      }
    }

    if (!picked) {
      return res.status(200).json({
        ok: true,
        selectedDate,
        athleteToken,
        athleteEmail,
        latestPlan: null,
        nextPlan: upcoming
          ? { effectiveDate: upcoming.effectiveDate, createdAt: upcoming.createdAt }
          : null,
        message: upcoming
          ? `No plan is effective on ${selectedDate}. Next plan starts ${upcoming.effectiveDate}.`
          : `No active plan is effective on ${selectedDate}.`,
        debug: {
          filterByFormula: activeFilter,
          candidateCount: candidates.length,
          note: "Using NutritionPlans AthleteToken LOOKUP for matching (stable).",
        },
      });
    }

    const f = picked.fields;

    const latestPlan = {
      id: picked.id,
      phase: asString(f[PLAN_PHASE]),
      daily: {
        calories: f[PLAN_DCAL] ?? "",
        protein: f[PLAN_DPRO] ?? "",
        carbs: f[PLAN_DCARB] ?? "",
        fat: f[PLAN_DFAT] ?? "",
      },
      planJsonRaw: picked.planJsonRaw,
      planJson: picked.planJson,
      prescription: asString(f[PLAN_PRESCRIPTION]),
      status: asString(f[PLAN_STATUS]) || "active",
      createdAt: picked.createdAt,
      createdBy: asString(f[PLAN_CREATED_BY]),
      effectiveDate: picked.effectiveDate || "",
    };

    return res.status(200).json({
      ok: true,
      selectedDate,
      athleteToken,
      athleteEmail,
      latestPlan,
      nextPlan: upcoming
        ? { effectiveDate: upcoming.effectiveDate, createdAt: upcoming.createdAt }
        : null,
    });
  } catch (e) {
    console.error("[api/athlete/nutrition/today] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to load athlete nutrition plan.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}
