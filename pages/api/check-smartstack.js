/**
 * /pages/api/check-smartstack.js
 *
 * Matches OCR'd label text against:
 *  - Banned Substances base
 *  - Ingredients base
 *
 * Response:
 *  {
 *    bannedSubstances: Array<{ id, fields, matchedTerms }>,
 *    ingredients: Array<{ id, fields, matchedTerms }>,
 *    debug?: { sampleText, totalBannedMatches, totalIngredientMatches }
 *  }
 *
 * Key behaviors:
 *  - Noise-token filtering + phrase-first matching to reduce false positives
 *  - Strong-match guard:
 *      ✅ phrase match OR
 *      ✅ 2+ meaningful tokens OR
 *      ✅ 1 distinctive token (len >= 10)
 *  - In-memory caching to reduce Airtable calls
 *  - Cache-Control: no-store
 */

import Airtable from "airtable";

/* -------------------------------------------------------------------------- */
/* Airtable env                                                               */
/* -------------------------------------------------------------------------- */

const BANNED_API_KEY = process.env.BANNED_API_KEY;
const BANNED_BASE_ID = process.env.BANNED_BASE_ID;
const BANNED_TABLE_NAME = process.env.BANNED_TABLE_NAME;

const INGREDIENT_API_KEY = process.env.INGREDIENT_API_KEY;
const INGREDIENT_BASE_ID = process.env.INGREDIENT_BASE_ID;
const INGREDIENT_TABLE_NAME = process.env.INGREDIENT_TABLE_NAME;

// Log warnings early if env vars are missing
if (!BANNED_API_KEY || !BANNED_BASE_ID || !BANNED_TABLE_NAME) {
  console.warn(
    "[check-smartstack] Missing BANNED env vars. Check BANNED_API_KEY / BANNED_BASE_ID / BANNED_TABLE_NAME."
  );
}
if (!INGREDIENT_API_KEY || !INGREDIENT_BASE_ID || !INGREDIENT_TABLE_NAME) {
  console.warn(
    "[check-smartstack] Missing INGREDIENT env vars. Check INGREDIENT_API_KEY / INGREDIENT_BASE_ID / INGREDIENT_TABLE_NAME."
  );
}

const bannedBase =
  BANNED_API_KEY && BANNED_BASE_ID
    ? new Airtable({ apiKey: BANNED_API_KEY }).base(BANNED_BASE_ID)
    : null;

const ingredientsBase =
  INGREDIENT_API_KEY && INGREDIENT_BASE_ID
    ? new Airtable({ apiKey: INGREDIENT_API_KEY }).base(INGREDIENT_BASE_ID)
    : null;

/* -------------------------------------------------------------------------- */
/* In-memory caching                                                          */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

let bannedCache = { ts: 0, data: null };
let ingredientCache = { ts: 0, data: null };

function isCacheFresh(cacheObj) {
  return cacheObj?.ts && Date.now() - cacheObj.ts < CACHE_TTL_MS;
}

async function getBannedRecords() {
  if (isCacheFresh(bannedCache) && Array.isArray(bannedCache.data)) {
    return bannedCache.data;
  }
  if (!bannedBase || !BANNED_TABLE_NAME) return [];

  const all = await bannedBase(BANNED_TABLE_NAME).select({}).all();
  bannedCache = { ts: Date.now(), data: all };
  return all;
}

async function getIngredientRecords() {
  if (isCacheFresh(ingredientCache) && Array.isArray(ingredientCache.data)) {
    return ingredientCache.data;
  }
  if (!ingredientsBase || !INGREDIENT_TABLE_NAME) return [];

  const all = await ingredientsBase(INGREDIENT_TABLE_NAME).select({}).all();
  ingredientCache = { ts: Date.now(), data: all };
  return all;
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                               */
/* -------------------------------------------------------------------------- */

function escapeRegex(string = "") {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-") // normalize unicode hyphens
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lowered = normalizeText(text);
  const cleaned = lowered.replace(/[\n\r\t]+/g, " ");
  const rawTerms = cleaned.split(
    /[.,;:\/\\\[\]\(\)\{\}"“”‘’<>|@#\$%\^&\*_+=~`·•\s]+/
  );

  return rawTerms
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^\s*$/.test(t));
}

/* -------------------------------------------------------------------------- */
/* Noise tokens + phrase matching                                             */
/* -------------------------------------------------------------------------- */

const NOISE_TOKENS = new Set([
  // Chemistry fragments that create false positives
  "methyl",
  "ethyl",
  "propyl",
  "butyl",
  "acetyl",
  "beta",
  "alpha",
  "gamma",
  "delta",
  // Generic label words / forms
  "acid",
  "acids",
  "salt",
  "salts",
  "sodium",
  "potassium",
  "calcium",
  "magnesium",
  "chloride",
  "citrate",
  "phosphate",
  "sulfate",
  "oxide",
  "hydroxide",
  "extract",
  "blend",
  "complex",
  // Units
  "mg",
  "mcg",
  "g",
  "iu",
]);

function isNoiseToken(t) {
  const s = String(t || "").toLowerCase().trim();
  if (!s) return true;

  // common noisy words
  if (NOISE_TOKENS.has(s)) return true;

  // too short is usually meaningless
  if (s.length < 3) return true;

  // pure numeric
  if (/^\d+$/.test(s)) return true;

  // mostly numeric patterns like "7a", "19", etc.
  if (/^\d+[a-z]?$/.test(s)) return true;

  return false;
}

function normalizeForPhraseMatch(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Phrase-first matching:
 * We normalize both phrase + OCR text similarly and use includes().
 * This is stronger than token-by-token for multiword names.
 */
function phraseInText(phrase = "", normalizedText = "") {
  const p = normalizeForPhraseMatch(phrase);
  if (!p || p.length < 6) return false;

  const n = normalizeForPhraseMatch(normalizedText);
  return n.includes(p);
}

/* -------------------------------------------------------------------------- */
/* Record term extraction                                                     */
/* -------------------------------------------------------------------------- */

function recordTerms(fields = {}, primaryFields = ["Name", "Ingredient Name"]) {
  const terms = new Set();

  for (const key of primaryFields) {
    const v = fields?.[key];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }

  const synonymCols = [
    "Synonyms",
    "Other Names",
    "Alt Names",
    "Alternate Names",
    "Synonym",
  ];

  for (const col of synonymCols) {
    const v = fields?.[col];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }

  return Array.from(terms);
}

/* -------------------------------------------------------------------------- */
/* Matching logic                                                             */
/* -------------------------------------------------------------------------- */

function termInText(term, normalized) {
  if (!term || !normalized) return false;

  const t = String(term).toLowerCase().trim();
  if (!t || t.length < 2) return false;

  try {
    // word boundary match prevents partial hits
    const rx = new RegExp(`\\b${escapeRegex(t)}\\b`, "i");
    return rx.test(normalized);
  } catch {
    // fallback
    return normalized.includes(t);
  }
}

/**
 * Strong match guard:
 * - phraseHit: immediate pass
 * - else: require >=2 meaningful tokens OR 1 distinctive token len>=10
 */
function hasStrongMatch(matchedTerms = [], phraseHit = false) {
  if (phraseHit) return true;
  if (!matchedTerms || matchedTerms.length === 0) return false;

  const meaningful = matchedTerms.filter((t) => !isNoiseToken(t));
  if (meaningful.length === 0) return false;

  const veryDistinctive = meaningful.filter((t) => String(t).length >= 10);
  if (veryDistinctive.length > 0) return true;

  return meaningful.length >= 2;
}

async function matchAgainstBannedRecords(ingredientsText) {
  const tokens = splitNormalizedTextToTerms(ingredientsText);
  const normalized = tokens.join(" ");

  const rawRecords = await getBannedRecords();
  const matches = [];

  for (const rec of rawRecords) {
    const fields = rec.fields || {};

    const substanceName = fields["Substance Name"] || "";
    const phraseHit = phraseInText(substanceName, normalized);

    const candidates = recordTerms(fields, ["Substance Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (isNoiseToken(t)) continue;
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    if (!hasStrongMatch(matchedTerms, phraseHit)) continue;

    matches.push({
      id: rec.id,
      fields: {
        "Substance Name": fields["Substance Name"] || "",
        Synonyms: fields["Synonyms"] || "",
        Category: fields["Category"] || "",
        "Ban Type": fields["Ban Type"] || fields["Banned Status"] || "",
        Notes: fields["Notes"] || "",
        Source: fields["Source"] || "",
        Link: fields["Link"] || "",
        Benefits: fields["Benefits"] || "",
        Weaknesses: fields["Weaknesses"] || "",
        "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
      },
      matchedTerms,
    });
  }

  console.log(`[check-smartstack] Banned Matches Found: ${matches.length}`);
  return matches;
}

async function matchAgainstIngredientRecords(ingredientsText) {
  const tokens = splitNormalizedTextToTerms(ingredientsText);
  const normalized = tokens.join(" ");

  const raw = await getIngredientRecords();
  const matches = [];

  for (const rec of raw) {
    const fields = rec.fields || {};

    const primaryName = fields["Name"] || fields["Ingredient Name"] || "";
    const phraseHit = phraseInText(primaryName, normalized);

    const candidates = recordTerms(fields, ["Name", "Ingredient Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (isNoiseToken(t)) continue;
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    if (!hasStrongMatch(matchedTerms, phraseHit)) continue;

    matches.push({
      id: rec.id,
      fields: {
        Name: fields["Name"] || "",
        "Ingredient Name": fields["Ingredient Name"] || "",
        Synonyms: fields["Synonyms"] || "",
        Benefits: fields["Benefits"] || "",
        Weaknesses: fields["Weaknesses"] || "",
        "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
        Notes: fields["Notes"] || "",
        Source: fields["Source"] || "",
        Link: fields["Link"] || "",
      },
      matchedTerms,
    });
  }

  console.log(`[check-smartstack] Ingredient Matches Found: ${matches.length}`);
  return matches;
}

/* -------------------------------------------------------------------------- */
/* Main handler                                                               */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { ingredientsText = "", debug: wantDebug = false } = req.body || {};

    const text = String(ingredientsText || "").trim();
    if (!text || text.length < 2) {
      return res.status(400).json({ error: "Missing ingredientsText" });
    }

    // Optional: fail loudly if Airtable is not configured
    if (!bannedBase || !ingredientsBase) {
      return res.status(500).json({
        error:
          "Airtable is not configured on the server. Check env vars for BANNED_* and INGREDIENT_*.",
      });
    }

    const bannedSubstances = await matchAgainstBannedRecords(text);
    const ingredients = await matchAgainstIngredientRecords(text);

    return res.status(200).json({
      bannedSubstances,
      ingredients,
      debug: wantDebug
        ? {
            sampleText: text.slice(0, 300),
            totalBannedMatches: bannedSubstances.length,
            totalIngredientMatches: ingredients.length,
          }
        : undefined,
    });
  } catch (err) {
    console.error("[check-smartstack] Unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: String(err?.message || err),
    });
  }
}
