// pages/api/athlete/nutrition/completion/upsert.js
import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

/* ---------------- helpers ---------------- */

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function safeJsonStringify(obj) {
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

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

/**
 * Airtable "Date (Date and Time)" field: always store a full ISO string.
 * Midday UTC avoids timezone rollovers (date shifting).
 */
function isoMiddayUTCFromISODateOnly(dateISO) {
  return `${dateISO}T12:00:00.000Z`;
}

function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch: { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner: { mealDone: false, hydrationDone: false },
  };
}

function normalizeCompletion(input) {
  const base = makeEmptyCompletion();
  const c = input && typeof input === "object" ? input : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];

  for (const k of keys) {
    const row = c?.[k] || {};
    base[k] = {
      mealDone: Boolean(row.mealDone),
      hydrationDone: Boolean(row.hydrationDone),
    };
  }
  return base;
}

/* ---------------- env ---------------- */

const NUTRITION_API_KEY = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID = process.env.NUTRITION_BASE_ID;

const NUTRITION_COMPLETIONS_TABLE =
  process.env.NUTRITION_COMPLETIONS_TABLE || "NutritionCompletions";

const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

// field names
const F_ATHLETE_LINK = "Athlete";
const F_DATE = "Date"; // Airtable field type: Date & Time
const F_JSON = "CompletionJson";
const F_UPDATED_AT = "UpdatedAt";

/* ---------------- handler ---------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req, res);
  if (!auth?.ok) return;

  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID || !NUTRITION_COMPLETIONS_TABLE) {
    return res.status(500).json({
      error: "Nutrition completions Airtable not configured.",
      missing: {
        NUTRITION_API_KEY: !NUTRITION_API_KEY,
        NUTRITION_BASE_ID: !NUTRITION_BASE_ID,
        NUTRITION_COMPLETIONS_TABLE: !NUTRITION_COMPLETIONS_TABLE,
      },
    });
  }

  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({
      error: "Athlete Airtable not configured (needed to link Athlete).",
      missing: {
        ATHLETE_API_KEY: !ATHLETE_API_KEY,
        ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
        ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
      },
    });
  }

  const athlete = auth?.athlete || auth?.user || {};
  const athleteEmail = asString(athlete?.Email || athlete?.email || "");
  if (!athleteEmail) return res.status(401).json({ error: "Athlete session missing email." });

  const nutritionBase = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);
  const athleteBase = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);

  try {
    const method = String(req.method || "").toUpperCase();

    // Date can come from query or body (YYYY-MM-DD)
    const date = asString(req.query?.date) || asString(req.body?.date) || "";

    if (!isISODateOnly(date)) {
      return res.status(400).json({ error: "date is required in YYYY-MM-DD format." });
    }

    // 1) Find athlete record id in Athlete table (by email)
    const safeEmail = escapeAirtableString(athleteEmail.toLowerCase());
    const foundAth = await athleteBase(ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email}&'')='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    const athleteRec = foundAth?.[0] || null;
    if (!athleteRec?.id) {
      return res.status(404).json({ error: "Athlete record not found.", athleteEmail });
    }

    // 2) Find existing completion record for (athleteRec.id + date)
    // IMPORTANT: {Date} is Date+Time. We must match on the date portion.
    const aId = escapeAirtableString(athleteRec.id);
    const d = escapeAirtableString(date);

    const filter = `AND(
      FIND('${aId}', ARRAYJOIN({${F_ATHLETE_LINK}}&'')) > 0,
      DATETIME_FORMAT({${F_DATE}}, 'YYYY-MM-DD')='${d}'
    )`;

    const existing = await nutritionBase(NUTRITION_COMPLETIONS_TABLE)
      .select({ filterByFormula: filter, maxRecords: 1 })
      .firstPage()
      .then((xs) => (xs?.length ? xs[0] : null));

    // GET = read only
    if (method === "GET") {
      const completion = normalizeCompletion(safeJsonParse(existing?.fields?.[F_JSON]) || null);

      return res.status(200).json({
        ok: true,
        date,
        athleteId: athleteRec.id,
        completion,
        hasRecord: Boolean(existing?.id),
      });
    }

    // POST = upsert
    if (method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const completionIn = req.body?.completion;
    const completion = normalizeCompletion(completionIn);

    const fields = {
      [F_ATHLETE_LINK]: [athleteRec.id],
      // Store as full ISO datetime because Airtable field is Date+Time
      [F_DATE]: isoMiddayUTCFromISODateOnly(date),
      [F_JSON]: safeJsonStringify(completion),
      [F_UPDATED_AT]: new Date().toISOString(),
    };

    let saved;
    if (existing?.id) {
      saved = await nutritionBase(NUTRITION_COMPLETIONS_TABLE).update(existing.id, fields);
    } else {
      saved = await nutritionBase(NUTRITION_COMPLETIONS_TABLE).create(fields);
    }

    return res.status(200).json({
      ok: true,
      date,
      athleteId: athleteRec.id,
      completion,
      recordId: saved?.id,
    });
  } catch (e) {
    console.error("[athlete/nutrition/completion/upsert] error:", e);
    return res.status(500).json({
      error: e?.message || "Failed to save nutrition completion.",
      airtable: {
        statusCode: e?.statusCode,
        message: e?.message,
        error: e?.error,
      },
    });
  }
}