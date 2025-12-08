/**
 * /pages/api/check-smartstack.js
 *
 * SmartStack scan matcher
 * - Matches OCR'd label text against:
 *    • Banned Substances base
 *    • Ingredients base
 * - Enriches banned substances with ingredient Benefits / Weaknesses / Nutrient Antagonism
 * - Uses in-memory caching for Airtable to reduce latency and API usage
 * - Adds "strong match" rules to reduce false positives (e.g. 7a-Methyl-19-nortestosterone)
 */

import Airtable from "airtable";

/* -------------------------------------------------------------------------- */
/*  Airtable base clients                                                     */
/* -------------------------------------------------------------------------- */

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

const BANNED_TABLE_NAME = process.env.BANNED_TABLE_NAME;
const INGREDIENT_TABLE_NAME = process.env.INGREDIENT_TABLE_NAME;

/* -------------------------------------------------------------------------- */
/*  Simple in-memory caching for Airtable .all()                              */
/* -------------------------------------------------------------------------- */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const bannedRecordsCache = {
  records: null,
  fetchedAt: 0,
};

const ingredientRecordsCache = {
  records: null,
  fetchedAt: 0,
};

async function fetchAllAirtableRecordsUsingClient(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");

  const pageSize = 100;
  const all = await baseInstance(tableName)
    .select({ view: "Grid view", pageSize })
    .all();

  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

async function getBannedRecords() {
  if (!bannedBase || !BANNED_TABLE_NAME) return [];
  const now = Date.now();
  if (
    bannedRecordsCache.records &&
    now - bannedRecordsCache.fetchedAt < CACHE_TTL_MS
  ) {
    return bannedRecordsCache.records;
  }
  const fresh = await fetchAllAirtableRecordsUsingClient(
    bannedBase,
    BANNED_TABLE_NAME
  );
  bannedRecordsCache.records = fresh;
  bannedRecordsCache.fetchedAt = now;
  return fresh;
}

async function getIngredientRecords() {
  if (!ingredientsBase || !INGREDIENT_TABLE_NAME) return [];
  const now = Date.now();
  if (
    ingredientRecordsCache.records &&
    now - ingredientRecordsCache.fetchedAt < CACHE_TTL_MS
  ) {
    return ingredientRecordsCache.records;
  }
  const fresh = await fetchAllAirtableRecordsUsingClient(
    ingredientsBase,
    INGREDIENT_TABLE_NAME
  );
  ingredientRecordsCache.records = fresh;
  ingredientRecordsCache.fetchedAt = now;
  return fresh;
}

/* -------------------------------------------------------------------------- */
/*  Text helpers                                                              */
/* -------------------------------------------------------------------------- */

const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalize an OCR string into "terms":
 *  - Lowercase
 *  - Strip some boilerplate words
 *  - Split on punctuation / special chars / whitespace
 *  - Return non-empty tokens
 */
function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();

  const cleaned = lower.replace(
    /\b(ma|made|with|contains|containing|ingredients|ingredient|organic)\b/gi,
    " "
  );

  const rawTerms = cleaned.split(
    /[.,;:\/\\\[\]\(\)\{\}"“”‘’<>|@#\$%\^&\*_+=~`·•\s]+/
  );

  return rawTerms
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !/^\s*$/.test(t));
}

/**
 * Build candidate "terms" for a record.
 * We look at:
 *  - Primary fields (Name / Ingredient Name / Substance Name)
 *  - Synonym columns
 */
function recordTerms(fields = {}, primaryFields = ["Name", "Ingredient Name"]) {
  const terms = new Set();

  for (const key of primaryFields) {
    const v = fields?.[key];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }

  const synonymCols = [
    "Synonyms",
    "Synonyms (Extended)",
    "Depositor-Supplied Synonyms",
  ];
  for (const col of synonymCols) {
    const v = fields?.[col];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }

  return Array.from(terms);
}

/**
 * Check if a candidate term appears in the normalized text.
 * - Reject very short tokens and pure numbers
 * - Prefer word boundary matches
 */
function termInText(term = "", normalizedText = "") {
  if (!term) return false;

  const normalized = String(normalizedText || "").toLowerCase();
  const t = String(term || "").toLowerCase().trim();

  // Skip tiny tokens and pure numbers
  if (t.length < 2) return false;
  if (/^[0-9]+$/.test(t)) return false;

  try {
    const rx = new RegExp(`\\b${escapeRegex(t)}\\b`, "i");
    return rx.test(normalized);
  } catch {
    // fallback
    return normalized.includes(t);
  }
}

/**
 * Given matchedTerms for a record, decide if this is a "strong enough" match
 * to keep. This is where we filter out noisy single-token hits like "methyl".
 */
function hasStrongMatch(matchedTerms = []) {
  if (!matchedTerms || matchedTerms.length === 0) return false;

  // At least one long-ish distinctive token (e.g. "nortestosterone", "citrulline")
  const strongTerms = matchedTerms.filter(
    (t) => t && t.length >= 6 && !/^[0-9]+$/.test(t)
  );

  if (strongTerms.length > 0) return true;

  // Otherwise require at least 2 tokens to match before we trust it
  return matchedTerms.length >= 2;
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
    const candidates = recordTerms(fields, ["Substance Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    // 🔒 Strong match guard to reduce false positives
    if (!hasStrongMatch(matchedTerms)) {
      continue;
    }

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

  console.log(
    `[check-smartstack] Banned Matches Found: ${matches.length}`
  );
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
    const candidates = recordTerms(fields, ["Name", "Ingredient Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    // 🔒 Strong match guard here as well
    if (!hasStrongMatch(matchedTerms)) {
      continue;
    }

    matches.push({
      id: rec.id,
      fields: {
        Name: fields["Name"] || "",
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

  // No caching at HTTP level – results depend on request body
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
        bannedConfigured: Boolean(bannedBase && BANNED_TABLE_NAME),
        ingredientsConfigured: Boolean(
          ingredientsBase && INGREDIENT_TABLE_NAME
        ),
      },
    };

    if (!rawText) {
      debug.note = "No OCR/text provided";
      return res
        .status(400)
        .json({ error: "No text provided for SmartStack check.", debug });
    }

    let matchedIngredients = [];
    let matchedBanned = [];

    // Run ingredient + banned matching in parallel
    try {
      [matchedIngredients, matchedBanned] = await Promise.all([
        matchAgainstIngredientRecords(rawText).catch((err) => {
          console.error("[check-smartstack] Error matching ingredients:", err);
          debug.airtableIngredientError = String(err?.message || err);
          return [];
        }),
        matchAgainstBannedRecords(rawText).catch((err) => {
          console.error("[check-smartstack] Error matching banned:", err);
          debug.airtableBannedError = String(err?.message || err);
          return [];
        }),
      ]);
    } catch (err) {
      // Should not happen because of per-branch catches, but keep a guard
      console.error("[check-smartstack] Parallel match error:", err);
    }

    // Enrich banned substances with ingredient-level info when the names overlap
    if (matchedBanned.length && matchedIngredients.length) {
      const ingByName = new Map();

      for (const ing of matchedIngredients) {
        const fields = ing.fields || {};
        const name = (fields["Name"] || "").toString().trim().toLowerCase();
        if (name) ingByName.set(name, ing);

        const syns = (
          fields["Synonyms (Extended)"] ||
          fields["Synonyms"] ||
          ""
        ).toString();
        syns
          .split(/[;,\/\|\(\)\[\]\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => ingByName.set(s.toLowerCase(), ing));
      }

      matchedBanned = matchedBanned.map((b) => {
        const fields = b.fields || {};
        const bName = (fields["Substance Name"] || "")
          .toString()
          .trim()
          .toLowerCase();

        const maybe = ingByName.get(bName);
        if (!maybe) return b;

        const enriched = { ...b, fields: { ...fields } };
        const ingFields = maybe.fields || {};

        enriched.fields["Benefits"] =
          enriched.fields["Benefits"] || ingFields["Benefits"] || "";
        enriched.fields["Weaknesses"] =
          enriched.fields["Weaknesses"] ||
          ingFields["Weaknesses"] ||
          "";
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
