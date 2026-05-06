/**
 * /pages/api/check-smartstack.js
 *
 * Matches OCR'd label text against:
 *  - Banned Substances base
 *  - Ingredients base
 *
 * Banned + ingredient records loaded from static JSON at build time -
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

// ---------------------------------------------------------------------------
// Key fix: do NOT split on commas.
// "1,3-dimethylamylamine" must stay as one token so "1" never becomes a
// standalone term that matches "1 Scoop" in the label text.
// Only split on whitespace and a narrow set of structural separators.
// ---------------------------------------------------------------------------
function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lowered = normalizeText(text);
  const cleaned = lowered.replace(/[\n\r\t]+/g, " ");
  return cleaned
    // Split on structural separators ONLY - NOT commas, NOT hyphens
    .split(/[\s;\/\\\[\]\(\)\{\}"""''<>|@#\$%\^&\*_+=~`·•]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^\s*$/.test(t));
}

/* -------------------------------------------------------------------------- */
/* Noise token filter                                                         */
/* -------------------------------------------------------------------------- */

const NOISE_TOKENS = new Set([
  // Generic chemistry prefixes that appear in many compound names
  "methyl", "ethyl", "propyl", "butyl", "acetyl",
  "beta", "alpha", "gamma", "delta",
  // Generic nutrition / supplement words
  "acid", "acids", "salt", "salts",
  "sodium", "potassium", "calcium", "magnesium",
  "chloride", "citrate", "phosphate", "sulfate",
  "oxide", "hydroxide", "extract", "blend", "complex",
  // Units - should never match anything
  "mg", "mcg", "g", "iu", "ml",
  // Serving-size words common on labels
  "scoop", "scoops", "serving", "servings", "container",
  "per", "size", "amount",
]);

function isNoiseToken(t) {
  const s = String(t || "").toLowerCase().trim();
  if (!s)                       return true;   // empty
  if (NOISE_TOKENS.has(s))      return true;   // known noise word
  if (s.length < 4)             return true;   // too short - catches "1", "3", "n", etc.
  if (/^\d+$/.test(s))          return true;   // pure number
  if (/^\d+[a-z]{1,2}$/.test(s)) return true; // unit like "25mg", "50g"
  if (/^[a-z]{1,2}\d*$/.test(s)) return true; // single/double letter optionally followed by digits
  return false;
}

/* -------------------------------------------------------------------------- */
/* Phrase matching - for multi-word substance names                          */
/* -------------------------------------------------------------------------- */

function normalizeForPhraseMatch(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseInText(phrase = "", normalizedText = "") {
  const p = normalizeForPhraseMatch(phrase);
  // Require phrase to be meaningful - at least 6 chars and contain a letter
  if (!p || p.length < 6 || !/[a-z]/.test(p)) return false;
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
/* Word-boundary term matching                                                */
/* -------------------------------------------------------------------------- */

function termInText(term, normalized) {
  if (!term || !normalized) return false;
  const t = String(term).toLowerCase().trim();
  if (!t || t.length < 2) return false;
  // Pure digits never match - prevents "1" in "1,3-dimethyl" matching "1 Scoop"
  if (/^\d+$/.test(t)) return false;
  try {
    return new RegExp(`\\b${escapeRegex(t)}\\b`, "i").test(normalized);
  } catch {
    return normalized.includes(t);
  }
}

/* -------------------------------------------------------------------------- */
/* Strong match gate                                                          */
/*                                                                            */
/* A record only matches if:                                                  */
/*   - A full phrase match fires (e.g. "1,3-dimethylamylamine" in the text), */
/*     OR                                                                     */
/*   - At least one meaningful (non-noise) term of length >= 5 matches,      */
/*     OR                                                                     */
/*   - Two or more meaningful terms match (belt-and-suspenders)              */
/* -------------------------------------------------------------------------- */

function hasStrongMatch(matchedTerms = [], phraseHit = false) {
  if (phraseHit) return true;
  if (!matchedTerms?.length) return false;

  const meaningful = matchedTerms.filter((t) => !isNoiseToken(t));
  if (!meaningful.length) return false;

  // Single long term (>= 5 chars) is sufficient - catches "caffeine", "synephrine" etc.
  if (meaningful.some((t) => String(t).length >= 5)) return true;

  // Two or more shorter meaningful terms
  return meaningful.length >= 2;
}

/* -------------------------------------------------------------------------- */
/* Matching functions                                                         */
/* -------------------------------------------------------------------------- */

function matchAgainstBannedRecords(ingredientsText) {
  const normalized = normalizeText(ingredientsText);

  return BANNED_RECORDS.reduce((matches, rec) => {
    const fields    = rec.fields || {};
    const subName   = fields["Substance Name"] || "";

    // Phrase match on the full substance name - catches "1,3-dimethylamylamine" as a unit
    const phraseHit = phraseInText(subName, normalized);

    // Also phrase-match each synonym as a whole string
    const synPhraseHit = ["Synonyms", "Other Names", "Alt Names"].some((col) => {
      const v = fields?.[col];
      if (!v) return false;
      // Each synonym may be comma-separated - check each one as a phrase
      return String(v).split(/[,;\/\n]/).some((syn) => phraseInText(syn.trim(), normalized));
    });

    const matchedTerms = recordTerms(fields, ["Substance Name"])
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, phraseHit || synPhraseHit)) return matches;

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
  const normalized = normalizeText(ingredientsText);

  return INGREDIENT_RECORDS.reduce((matches, rec) => {
    const fields      = rec.fields || {};
    const primaryName = fields["Name"] || fields["Ingredient Name"] || "";

    const phraseHit = phraseInText(primaryName, normalized);

    const synPhraseHit = ["Synonyms", "Other Names"].some((col) => {
      const v = fields?.[col];
      if (!v) return false;
      return String(v).split(/[,;\/\n]/).some((syn) => phraseInText(syn.trim(), normalized));
    });

    const matchedTerms = recordTerms(fields, ["Name", "Ingredient Name"])
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, phraseHit || synPhraseHit)) return matches;

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
          sampleText:             text.slice(0, 300),
          totalBannedMatches:     bannedSubstances.length,
          totalIngredientMatches: ingredients.length,
        },
      }),
    });
  } catch (err) {
    console.error("[check-smartstack] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}