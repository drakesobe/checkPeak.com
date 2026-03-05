/**
 * /pages/api/check-smartstack.js
 *
 * Matches OCR'd label text against:
 *  - Banned Substances base
 *  - Ingredients base
 *
 * Banned + ingredient records loaded from static JSON at build time —
 * zero Airtable calls per request. Run `npm run sync-db` after updating
 * either Airtable table to regenerate the JSON and redeploy.
 *
 * Response:
 *  {
 *    bannedSubstances: Array<{ id, fields, matchedTerms }>,
 *    ingredients: Array<{ id, fields, matchedTerms }>,
 *    debug?: { sampleText, totalBannedMatches, totalIngredientMatches }
 *  }
 */

import bannedRecordsRaw     from "../../data/banned.json"      assert { type: "json" };
import ingredientRecordsRaw from "../../data/ingredients.json" assert { type: "json" };

// Static records — shape: [{ id, fields }]
// Loaded once at module init, never fetched at runtime.
const BANNED_RECORDS     = bannedRecordsRaw;
const INGREDIENT_RECORDS = ingredientRecordsRaw;

/* -------------------------------------------------------------------------- */
/* Text helpers                                                               */
/* -------------------------------------------------------------------------- */

function escapeRegex(string = "") {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lowered = normalizeText(text);
  const cleaned = lowered.replace(/[\n\r\t]+/g, " ");
  return cleaned
    .split(/[.,;:\/\\\[\]\(\)\{\}"""''<>|@#\$%\^&\*_+=~`·•\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^\s*$/.test(t));
}

/* -------------------------------------------------------------------------- */
/* Noise tokens + phrase matching                                             */
/* -------------------------------------------------------------------------- */

const NOISE_TOKENS = new Set([
  "methyl", "ethyl", "propyl", "butyl", "acetyl",
  "beta", "alpha", "gamma", "delta",
  "acid", "acids", "salt", "salts",
  "sodium", "potassium", "calcium", "magnesium",
  "chloride", "citrate", "phosphate", "sulfate",
  "oxide", "hydroxide", "extract", "blend", "complex",
  "mg", "mcg", "g", "iu",
]);

function isNoiseToken(t) {
  const s = String(t || "").toLowerCase().trim();
  if (!s || NOISE_TOKENS.has(s)) return true;
  if (s.length < 3) return true;
  if (/^\d+$/.test(s)) return true;
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

function phraseInText(phrase = "", normalizedText = "") {
  const p = normalizeForPhraseMatch(phrase);
  if (!p || p.length < 6) return false;
  return normalizeForPhraseMatch(normalizedText).includes(p);
}

/* -------------------------------------------------------------------------- */
/* Record term extraction                                                     */
/* -------------------------------------------------------------------------- */

function recordTerms(fields = {}, primaryFields = ["Name", "Ingredient Name"]) {
  const terms = new Set();
  for (const key of primaryFields) {
    const v = fields?.[key];
    if (v) splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }
  for (const col of ["Synonyms", "Other Names", "Alt Names", "Alternate Names", "Synonym"]) {
    const v = fields?.[col];
    if (v) splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
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
    return new RegExp(`\\b${escapeRegex(t)}\\b`, "i").test(normalized);
  } catch {
    return normalized.includes(t);
  }
}

function hasStrongMatch(matchedTerms = [], phraseHit = false) {
  if (phraseHit) return true;
  if (!matchedTerms?.length) return false;
  const meaningful = matchedTerms.filter((t) => !isNoiseToken(t));
  if (!meaningful.length) return false;
  if (meaningful.some((t) => String(t).length >= 10)) return true;
  return meaningful.length >= 2;
}

/* -------------------------------------------------------------------------- */
/* Matching functions — synchronous, no network calls                        */
/* -------------------------------------------------------------------------- */

function matchAgainstBannedRecords(ingredientsText) {
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");

  return BANNED_RECORDS.reduce((matches, rec) => {
    const fields      = rec.fields || {};
    const phraseHit   = phraseInText(fields["Substance Name"] || "", normalized);
    const matchedTerms = recordTerms(fields, ["Substance Name"])
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, phraseHit)) return matches;

    matches.push({
      id: rec.id,
      fields: {
        "Substance Name":      fields["Substance Name"]      || "",
        Synonyms:              fields["Synonyms"]             || "",
        Category:              fields["Category"]             || "",
        "Ban Type":            fields["Ban Type"]             || fields["Banned Status"] || "",
        Notes:                 fields["Notes"]                || "",
        Source:                fields["Source"]               || "",
        Link:                  fields["Link"]                 || "",
        Benefits:              fields["Benefits"]             || "",
        Weaknesses:            fields["Weaknesses"]           || "",
        "Nutrient Antagonism": fields["Nutrient Antagonism"]  || "",
      },
      matchedTerms,
    });
    return matches;
  }, []);
}

function matchAgainstIngredientRecords(ingredientsText) {
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");

  return INGREDIENT_RECORDS.reduce((matches, rec) => {
    const fields      = rec.fields || {};
    const primaryName = fields["Name"] || fields["Ingredient Name"] || "";
    const phraseHit   = phraseInText(primaryName, normalized);
    const matchedTerms = recordTerms(fields, ["Name", "Ingredient Name"])
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, phraseHit)) return matches;

    matches.push({
      id: rec.id,
      fields: {
        Name:                  fields["Name"]                 || "",
        "Ingredient Name":     fields["Ingredient Name"]      || "",
        Synonyms:              fields["Synonyms"]             || "",
        Benefits:              fields["Benefits"]             || "",
        Weaknesses:            fields["Weaknesses"]           || "",
        "Nutrient Antagonism": fields["Nutrient Antagonism"]  || "",
        Notes:                 fields["Notes"]                || "",
        Source:                fields["Source"]               || "",
        Link:                  fields["Link"]                 || "",
      },
      matchedTerms,
    });
    return matches;
  }, []);
}

/* -------------------------------------------------------------------------- */
/* Main handler                                                               */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    const { ingredientsText = "", debug: wantDebug = false } = req.body || {};

    const text = String(ingredientsText || "").trim();
    if (!text || text.length < 2)
      return res.status(400).json({ error: "Missing ingredientsText" });

    const bannedSubstances = matchAgainstBannedRecords(text);
    const ingredients      = matchAgainstIngredientRecords(text);

    console.log(`[check-smartstack] Banned: ${bannedSubstances.length} | Ingredients: ${ingredients.length}`);

    return res.status(200).json({
      bannedSubstances,
      ingredients,
      ...(wantDebug && {
        debug: {
          sampleText:              text.slice(0, 300),
          totalBannedMatches:      bannedSubstances.length,
          totalIngredientMatches:  ingredients.length,
        },
      }),
    });
  } catch (err) {
    console.error("[check-smartstack] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}