/**
 * /pages/api/check-smartstack
 *
 * Improved version:
 * - Phrase-level matching (no more "one"/"acid" false positives).
 * - Lightweight in-memory caching of Airtable records.
 * - Still returns matchedBanned + matchedIngredients with Nutrient Antagonism, Benefits, Weaknesses, etc.
 * - Safe debug info for easier troubleshooting.
 */

import Airtable from "airtable";

/* --------------------
   Airtable clients
   -------------------- */
const bannedBase =
  process.env.BANNED_API_KEY && process.env.BANNED_BASE_ID
    ? new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
        process.env.BANNED_BASE_ID
      )
    : null;

const ingredientsBase =
  process.env.INGREDIENT_API_KEY && process.env.INGREDIENT_BASE_ID
    ? new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(
        process.env.INGREDIENT_BASE_ID
      )
    : null;

/* --------------------
   Simple in-memory caches
   (per warm lambda / Node process)
   -------------------- */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let bannedRecordsCache = null;
let ingredientRecordsCache = null;
let lastBannedFetch = 0;
let lastIngredientFetch = 0;

async function fetchAllAirtableRecordsUsingClient(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");

  const pageSize = 100;
  const all = await baseInstance(tableName)
    .select({ view: "Grid view", pageSize })
    .all();

  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

async function getCachedBannedRecords() {
  const configured = bannedBase && process.env.BANNED_TABLE_NAME;
  if (!configured) return [];

  const now = Date.now();
  if (
    bannedRecordsCache &&
    now - lastBannedFetch < CACHE_TTL_MS &&
    bannedRecordsCache.length
  ) {
    return bannedRecordsCache;
  }

  const fresh = await fetchAllAirtableRecordsUsingClient(
    bannedBase,
    process.env.BANNED_TABLE_NAME
  );
  bannedRecordsCache = fresh;
  lastBannedFetch = now;
  return fresh;
}

async function getCachedIngredientRecords() {
  const configured = ingredientsBase && process.env.INGREDIENT_TABLE_NAME;
  if (!configured) return [];

  const now = Date.now();
  if (
    ingredientRecordsCache &&
    now - lastIngredientFetch < CACHE_TTL_MS &&
    ingredientRecordsCache.length
  ) {
    return ingredientRecordsCache;
  }

  const fresh = await fetchAllAirtableRecordsUsingClient(
    ingredientsBase,
    process.env.INGREDIENT_TABLE_NAME
  );
  ingredientRecordsCache = fresh;
  lastIngredientFetch = now;
  return fresh;
}

/* --------------------
   Helpers
   -------------------- */

const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build candidate phrases from a record:
 * - primary fields: e.g. "Substance Name", "Name", "Ingredient Name"
 * - synonym fields: e.g. "Synonyms", "Synonyms (Extended)"
 * We keep full phrases instead of exploding into tiny tokens.
 */
function buildCandidatePhrases(fields = {}, primaryKeys = [], synonymKeys = []) {
  const phrases = [];

  // Primary names
  for (const key of primaryKeys) {
    const v = fields?.[key];
    if (!v) continue;
    const str = String(v).trim();
    if (str) phrases.push(str);
  }

  // Synonyms (comma/semicolon/pipe/newline separated)
  for (const key of synonymKeys) {
    const v = fields?.[key];
    if (!v) continue;
    String(v)
      .split(/[;,\/\|\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => phrases.push(s));
  }

  // De-duplicate (case-insensitive)
  const out = [];
  const seen = new Set();
  for (const p of phrases) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

const STOP_WORDS = new Set([
  // very generic words that cause false positives:
  "one",
  "two",
  "three",
  "four",
  "five",
  "acid",
  "salt",
  "hydrate",
  "anhydrous",
  "powder",
  "extract",
  "root",
  "leaf",
  "seed",
  "mg",
  "mcg",
  "g",
]);

function isSignalPhrase(phrase = "") {
  const clean = phrase.toLowerCase().trim();

  if (!clean) return false;
  if (clean.length < 4) return false; // avoid tiny tokens
  if (/^[0-9.\-]+$/.test(clean)) return false; // purely numeric
  if (STOP_WORDS.has(clean)) return false;

  return true;
}

/**
 * Given candidate phrases and the full OCR text (lowercased),
 * return which phrases actually appear in the text.
 */
function findMatchedPhrases(phrases = [], textLower = "") {
  if (!textLower) return [];
  const matched = [];

  for (const phrase of phrases) {
    if (!isSignalPhrase(phrase)) continue;
    const needle = phrase.toLowerCase();

    // basic substring match first for speed
    if (!textLower.includes(needle)) continue;

    // optional regex (kept simple; no word-boundary trickiness around punctuation-heavy names)
    try {
      const rx = new RegExp(escapeRegex(phrase), "i");
      if (rx.test(textLower)) {
        matched.push(phrase);
      }
    } catch {
      // if regex fails, rely on the substring match
      matched.push(phrase);
    }
  }

  return matched;
}

/* --------------------
   Airtable matching
   -------------------- */

async function matchAgainstBannedRecords(ingredientsText) {
  const configured = bannedBase && process.env.BANNED_TABLE_NAME;
  if (!configured) return [];

  const textLower = String(ingredientsText || "").toLowerCase();
  if (!textLower) return [];

  const rawRecords = await getCachedBannedRecords();
  const matches = [];

  for (const rec of rawRecords) {
    const fields = rec.fields || {};
    const phrases = buildCandidatePhrases(
      fields,
      ["Substance Name"],
      ["Synonyms"]
    );
    const matchedTerms = findMatchedPhrases(phrases, textLower);

    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          "Substance Name": fields["Substance Name"] || "",
          Synonyms: fields["Synonyms"] || "",
          Category: fields["Category"] || "",
          "Banned By": fields["Banned By"] || "",
          "Ban Type": fields["Ban Type"] || "",
          "Dosage Limit": fields["Dosage Limit"] || "",
          "Source / Citation": fields["Source / Citation"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
        },
        matchedTerms,
      });
    }
  }

  console.log(`[check-smartstack] Banned Matches Found: ${matches.length}`);
  return matches;
}

async function matchAgainstIngredientRecords(ingredientsText) {
  if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME) {
    throw new Error("Ingredients Airtable not configured");
  }

  const textLower = String(ingredientsText || "").toLowerCase();
  if (!textLower) return [];

  const rawRecords = await getCachedIngredientRecords();
  const matches = [];

  for (const rec of rawRecords) {
    const fields = rec.fields || {};
    const phrases = buildCandidatePhrases(
      fields,
      ["Name", "Ingredient Name"],
      ["Synonyms (Extended)", "Synonyms"]
    );
    const matchedTerms = findMatchedPhrases(phrases, textLower);

    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          Name: fields["Name"] || "",
          "Ingredient Name": fields["Ingredient Name"] || "",
          "Synonyms (Extended)":
            fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
          "Sources / References": fields["Sources / References"] || "",
        },
        matchedTerms,
      });
    }
  }

  console.log(
    `[check-smartstack] Ingredient Matches Found: ${matches.length}`
  );
  return matches;
}

/* --------------------
   Main Handler
   -------------------- */

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed. Use POST." });

  // no caching of results at the HTTP layer
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const body = req.body || {};
    let { text, ocrText } = body;
    const rawText = (text || ocrText || "").trim();

    const debug = {
      airtable: {
        bannedConfigured: Boolean(
          bannedBase && process.env.BANNED_TABLE_NAME
        ),
        ingredientsConfigured: Boolean(
          ingredientsBase && process.env.INGREDIENT_TABLE_NAME
        ),
      },
    };

    if (!rawText) {
      debug.note = "No OCR/text provided";
      return res
        .status(400)
        .json({ error: "No text provided for OCR check.", debug });
    }

    let matchedIngredients = [];
    let matchedBanned = [];

    // Ingredients
    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
    } catch (err) {
      console.error("[check-smartstack] Error matching ingredients:", err);
      debug.airtableIngredientError = String(err?.message || err);
      matchedIngredients = [];
    }

    // Banned
    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
    } catch (err) {
      console.error("[check-smartstack] Error matching banned substances:", err);
      debug.airtableBannedError = String(err?.message || err);
      matchedBanned = [];
    }

    // Enrich banned substances with ingredient info where names/synonyms overlap
    if (matchedBanned.length && matchedIngredients.length) {
      const ingByName = new Map();

      for (const ing of matchedIngredients) {
        const fields = ing.fields || {};
        const baseName = (fields["Name"] || fields["Ingredient Name"] || "")
          .toString()
          .trim()
          .toLowerCase();

        if (baseName) ingByName.set(baseName, ing);

        const syns = (
          fields["Synonyms (Extended)"] ||
          fields["Synonyms"] ||
          ""
        ).toString();
        syns
          .split(/[;,\/\|\(\)\[\]\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => {
            const key = s.toLowerCase();
            if (!ingByName.has(key)) ingByName.set(key, ing);
          });
      }

      matchedBanned = matchedBanned.map((b) => {
        const fields = b.fields || {};
        const nameKey = (fields["Substance Name"] || "")
          .toString()
          .trim()
          .toLowerCase();

        const linkedIng = ingByName.get(nameKey);
        if (!linkedIng) return b;

        const enriched = { ...b, fields: { ...fields } };
        const ingFields = linkedIng.fields || {};

        enriched.fields["Benefits"] =
          enriched.fields["Benefits"] || ingFields["Benefits"] || "";
        enriched.fields["Weaknesses"] =
          enriched.fields["Weaknesses"] || ingFields["Weaknesses"] || "";
        enriched.fields["Nutrient Antagonism"] =
          enriched.fields["Nutrient Antagonism"] ||
          ingFields["Nutrient Antagonism"] ||
          "";

        return enriched;
      });
    }

    console.log("[check-smartstack] ✅ Matches Summary:", {
      banned: matchedBanned.length,
      ingredients: matchedIngredients.length,
    });

    return res.status(200).json({
      found: true,
      ocrText: rawText,
      matchedBanned,
      matchedIngredients,
      debug: {
        ...debug,
        totalBannedMatches: matchedBanned.length,
        totalIngredientMatches: matchedIngredients.length,
      },
    });
  } catch (err) {
    console.error("[check-smartstack] Unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: String(err?.message || err),
    });
  }
}
