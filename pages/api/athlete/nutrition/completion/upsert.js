// pages/api/athlete/nutrition/completion/upsert.js
//
// FIX: React Native's networking layer mangles Cookie headers.
// Mobile client passes user JSON as _authUser in query string (GET)
// or request body (POST). We inject it into req.cookies before
// calling requireAthlete so auth works without any changes to requireAthlete.js.

import Airtable from "airtable";
import { requireAthlete } from "@/lib/requireAthlete";

function asString(v) {
  if (v === 0) return "0";
  return String(v ?? "").trim();
}

function safeJsonStringify(obj) {
  try { return JSON.stringify(obj); } catch { return ""; }
}

function safeJsonParse(s) {
  const raw = asString(s);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function isoMiddayUTCFromISODateOnly(dateISO) {
  return `${dateISO}T12:00:00.000Z`;
}

function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch:     { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner:    { mealDone: false, hydrationDone: false },
  };
}

function normalizeCompletion(input) {
  const base = makeEmptyCompletion();
  const c = input && typeof input === "object" ? input : {};
  for (const k of ["breakfast", "lunch", "afternoon", "dinner"]) {
    const row = c?.[k] || {};
    base[k] = { mealDone: Boolean(row.mealDone), hydrationDone: Boolean(row.hydrationDone) };
  }
  return base;
}

const NUTRITION_API_KEY          = process.env.NUTRITION_API_KEY;
const NUTRITION_BASE_ID          = process.env.NUTRITION_BASE_ID;
const NUTRITION_COMPLETIONS_TABLE = process.env.NUTRITION_COMPLETIONS_TABLE || "NutritionCompletions";

const ATHLETE_API_KEY    = process.env.ATHLETE_API_KEY;
const ATHLETE_BASE_ID    = process.env.ATHLETE_BASE_ID;
const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

const F_ATHLETE_LINK         = "Athlete";
const F_ATHLETE_TOKEN_DIRECT = "AthleteToken";
const F_DATE                 = "Date";
const F_JSON                 = "CompletionJson";
const F_UPDATED_AT           = "UpdatedAt";
const ATH_TOKEN              = "AthleteToken";
const ATH_EMAIL              = "Email";

// ── Auth cookie injection helper ─────────────────────────────────────────────
// Returns true if req.cookies.user is missing or fails JSON parse.
function cookieMissingOrBroken(req) {
  try {
    const raw = req?.cookies?.user || "";
    if (!raw) return true;
    const decoded = raw.includes("%7B") || raw.includes("%22")
      ? decodeURIComponent(raw) : raw;
    JSON.parse(decoded);
    return false;
  } catch {
    return true;
  }
}

function injectAuthFromField(req, authUserField) {
  if (!authUserField) return;
  req.cookies        = req.cookies || {};
  req.cookies.user   = authUserField;
  req.headers        = req.headers || {};
  req.headers.cookie = `user=${encodeURIComponent(authUserField)}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const method = String(req.method || "").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Auth fallback for React Native ────────────────────────────────────────
  // Mobile sends _authUser as query param (GET) or body field (POST) because
  // Cookie headers get mangled by RN's networking layer.
  if (cookieMissingOrBroken(req)) {
    const authUserField = asString(
      req.query?._authUser ||
      req.body?._authUser  ||
      ""
    );
    if (authUserField) injectAuthFromField(req, authUserField);
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) {
    return res.status(401).json({ error: auth?.error || "Unauthorized" });
  }

  if (!NUTRITION_API_KEY || !NUTRITION_BASE_ID) {
    return res.status(500).json({ error: "Nutrition completions Airtable not configured." });
  }
  if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
    return res.status(500).json({ error: "Athlete Airtable not configured." });
  }

  const athleteToken =
    asString(auth?.athlete?.AthleteToken) ||
    asString(auth?.athlete?.athleteToken) ||
    asString(auth?.user?.AthleteToken)    ||
    asString(auth?.user?.athleteToken);

  const athleteEmail =
    asString(auth?.athlete?.Email || auth?.athlete?.email ||
             auth?.user?.Email   || auth?.user?.email);

  const nutritionBase = new Airtable({ apiKey: NUTRITION_API_KEY }).base(NUTRITION_BASE_ID);
  const athleteBase   = new Airtable({ apiKey: ATHLETE_API_KEY   }).base(ATHLETE_BASE_ID);

  try {
    const date = asString(req.query?.date) || asString(req.body?.date) || "";
    if (!isISODateOnly(date)) {
      return res.status(400).json({ error: "date is required in YYYY-MM-DD format." });
    }

    // ── 1) Find athlete record ──────────────────────────────────────────────
    let athleteFilter = "";
    if (athleteToken) {
      athleteFilter = `FIND('${escapeAirtableString(athleteToken)}', ARRAYJOIN({${ATH_TOKEN}}&''))`;
    } else if (athleteEmail) {
      athleteFilter = `LOWER({${ATH_EMAIL}}&'')='${escapeAirtableString(athleteEmail.toLowerCase())}'`;
    } else {
      return res.status(401).json({ error: "Athlete session missing token/email." });
    }

    const foundAth   = await athleteBase(ATHLETE_TABLE_NAME)
      .select({ filterByFormula: athleteFilter, maxRecords: 1 })
      .firstPage();
    const athleteRec = foundAth?.[0] || null;

    if (!athleteRec?.id) {
      return res.status(404).json({ error: "Athlete record not found.", athleteEmail, athleteToken });
    }

    const resolvedToken = asString(athleteRec.fields?.[ATH_TOKEN]) || athleteToken;

    // ── 2) Find existing completion record ──────────────────────────────────
    const isoMidDay  = isoMiddayUTCFromISODateOnly(date);
    const safeToken  = escapeAirtableString(resolvedToken);

    const filter = `AND(
      {${F_ATHLETE_TOKEN_DIRECT}} = '${safeToken}',
      IS_SAME({${F_DATE}}, '${isoMidDay}', 'day')
    )`;

    const existing = await nutritionBase(NUTRITION_COMPLETIONS_TABLE)
      .select({ filterByFormula: filter, maxRecords: 1 })
      .firstPage()
      .then(xs => xs?.[0] || null);

    // ── GET: return current completion ──────────────────────────────────────
    if (method === "GET") {
      const completion = normalizeCompletion(
        safeJsonParse(existing?.fields?.[F_JSON]) || null
      );
      return res.status(200).json({
        ok:        true,
        date,
        athleteId: athleteRec.id,
        completion,
        hasRecord: Boolean(existing?.id),
      });
    }

    // ── POST: upsert completion ─────────────────────────────────────────────
    const completion = normalizeCompletion(req.body?.completion);
    const fields = {
      [F_ATHLETE_LINK]: [athleteRec.id],
      [F_DATE]:         isoMidDay,
      [F_JSON]:         safeJsonStringify(completion),
      [F_UPDATED_AT]:   new Date().toISOString(),
    };

    const saved = existing?.id
      ? await nutritionBase(NUTRITION_COMPLETIONS_TABLE).update(existing.id, fields)
      : await nutritionBase(NUTRITION_COMPLETIONS_TABLE).create(fields);

    return res.status(200).json({
      ok:        true,
      date,
      athleteId: athleteRec.id,
      completion,
      recordId:  saved?.id,
    });

  } catch (e) {
    console.error("[athlete/nutrition/completion/upsert] error:", e);
    return res.status(500).json({
      error:    e?.message || "Failed to save nutrition completion.",
      airtable: { statusCode: e?.statusCode },
    });
  }
}