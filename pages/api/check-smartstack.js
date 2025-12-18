/**
 * /pages/api/check-smartstack.js
 *
 * SmartStack scan matcher
 * - Matches OCR'd label text against:
 *    • Banned Substances base
 *    • Ingredients base
 * - Enriches with Benefits / Weaknesses / Nutrient Antagonism when present in fields
 * - Uses in-memory caching for Airtable to reduce latency and API usage
 * - Adds "strong match" rules to reduce false positives (e.g. 7a-Methyl-19-nortestosterone)
 */

import Airtable from "airtable";

/* -------------------------------------------------------------------------- */
/*  Airtable base clients                                                     */
/* -------------------------------------------------------------------------- */

const BANNED_API_KEY = process.env.BANNED_API_KEY;
const BANNED_BASE_ID = process.env.BANNED_BASE_ID;
const BANNED_TABLE_NAME = process.env.BANNED_TABLE_NAME;

const INGREDIENT_API_KEY = process.env.INGREDIENT_API_KEY;
const INGREDIENT_BASE_ID = process.env.INGREDIENT_BASE_ID;
const INGREDIENT_TABLE_NAME = process.env.INGREDIENT_TABLE_NAME;

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
/*  Simple in-memory caches                                                   */
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
/*  Text helpers                                                              */
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

/**
 * Split OCR text into normalized "terms" (tokens).
 */
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
/*  Noise token controls + phrase matching (reduces false positives)           */
/* -------------------------------------------------------------------------- */

const NOISE_TOKENS = new Set([
  "methyl",
  "ethyl",
  "propyl",
  "butyl",
  "acetyl",
  "beta",
  "alpha",
  "gamma",
  "delta",
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
  "mg",
  "mcg",
  "g",
  "iu",
]);

function isNoiseToken(t) {
  const s = String(t || "").toLowerCase().trim();
  if (!s) return true;
  if (NOISE_TOKENS.has(s)) return true;
  if (s.length < 3) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^\d+[a-z]?$/.test(s)) return true; // 7a, 19, etc.
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

function phraseInText(phrase = "", normalizedText = "") {
  const p = normalizeForPhraseMatch(phrase);
  if (!p || p.length < 6) return false;

  const n = normalizeForPhraseMatch(normalizedText);
  return n.includes(p);
}

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

function termInText(term, normalized) {
  if (!term || !normalized) return false;

  const t = String(term).toLowerCase().trim();
  if (!t || t.length < 2) return false;

  try {
    const rx = new RegExp(`\\b${escapeRegex(t)}\\b`, "i");
    return rx.test(normalized);
  } catch {
    return normalized.includes(t);
  }
}

function hasStrongMatch(matchedTerms = [], phraseHit = false) {
  if (phraseHit) return true;
  if (!matchedTerms || matchedTerms.length === 0) return false;

  const meaningful = matchedTerms.filter((t) => !isNoiseToken(t));
  if (meaningful.length === 0) return false;

  const veryDistinctive = meaningful.filter((t) => String(t).length >= 10);
  if (veryDistinctive.length > 0) return true;

  return meaningful.length >= 2;
}

/* -------------------------------------------------------------------------- */
/*  Airtable matching                                                         */
/* -------------------------------------------------------------------------- */

async function matchAgainstBannedRecords(ingredientsText) {
  if (!bannedBase || !BANNED_TABLE_NAME) return [];

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
      phraseHit,
    });
  }

  console.log(`[check-smartstack] Banned Matches Found: ${matches.length}`);
  return matches;
}

async function matchAgainstIngredientRecords(ingredientsText) {
  if (!ingredientsBase || !INGREDIENT_TABLE_NAME) return [];

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
      phraseHit,
    });
  }

  console.log(
    `[check-smartstack] Ingredient Matches Found: ${matches.length}`
  );
  return matches;
}

/* -------------------------------------------------------------------------- */
/*  Main Handler                                                              */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ error: "Method not allowed. Use POST for this endpoint." });
  }

  try {
    const body = req.body || {};

    // ✅ Backward-compatible input keys
    const ingredientsText =
      body.ingredientsText ??
      body.ocrText ??
      body.text ??
      body.ingredients ??
      body.rawText ??
      "";

    const wantDebug = Boolean(body.debug);

    if (!ingredientsText || String(ingredientsText).trim().length < 2) {
      return res.status(400).json({
        error: "Missing ingredientsText",
        // Helpful for debugging what the frontend is actually sending
        receivedKeys: Object.keys(body || {}),
      });
    }

    const matchedBanned = await matchAgainstBannedRecords(ingredientsText);
    const matchedIngredients = await matchAgainstIngredientRecords(
      ingredientsText
    );

    // ✅ Backward-compatible response keys (what your NutritionModal expects)
    // plus newer names for other parts of the app if needed.
    return res.status(200).json({
      matchedBanned,
      matchedIngredients,

      bannedSubstances: matchedBanned,
      ingredients: matchedIngredients,

      debug: wantDebug
        ? {
            receivedKeys: Object.keys(body || {}),
            sampleText: String(ingredientsText).slice(0, 300),
            totalBannedMatches: matchedBanned.length,
            totalIngredientMatches: matchedIngredients.length,
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
