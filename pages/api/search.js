// pages/api/search.js
import Airtable from "airtable";

/**
 * Search API - v2
 *
 * Changes from v1:
 *
 * 1. SERVER-SIDE FILTERING
 *    Was: fetchAllRecords() - pulled every row into memory, then filtered in JS.
 *    Now: filterByFormula passed directly to Airtable so only matching rows
 *    are transferred. Dramatically faster and avoids rate limit issues under
 *    real traffic.
 *
 * 2. MAP-BASED INGREDIENT LOOKUP
 *    Was: findIngredientMatch() ran a .find() loop over all ingredients for
 *    every banned record - O(n²) complexity.
 *    Now: ingredients are indexed into a Map keyed by lowercase name before
 *    the merge step - O(1) lookup per banned record.
 *
 * 3. PROPER NULL HANDLING
 *    Was: banType: banned.fields["Ban Type"] || "" - empty string is falsy
 *    but inconsistent with ingredient records which used null.
 *    Now: all optional fields use ?? null so the frontend gets a consistent
 *    null when a field is absent.
 *
 * 4. INPUT SANITIZATION
 *    Was: query string used directly in Airtable formula with no escaping.
 *    Now: sanitizeForFormula() strips characters that could break the formula
 *    string before interpolation.
 *
 * 5. PARALLEL FETCHING
 *    Was: banned and ingredient queries ran sequentially (implicit await chain).
 *    Now: Promise.all() runs both Airtable queries in parallel - roughly 2x
 *    faster on cold requests.
 *
 * 6. FIELD NORMALIZATION IN ONE PLACE
 *    normalizeRecord() is the single source of truth for mapping Airtable
 *    field names to the shape the frontend expects. Easier to maintain when
 *    Airtable column names change.
 */

// ---------------------------------------------------------------------------
// Airtable clients - one per base
// ---------------------------------------------------------------------------

const bannedBase = new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
  process.env.BANNED_BASE_ID
);

const ingredientBase = new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(
  process.env.INGREDIENT_BASE_ID
);

// ---------------------------------------------------------------------------
// Input sanitization
//
// Airtable formulas use single-quoted strings. A raw apostrophe or backslash
// in the query would break the formula and potentially expose unintended rows.
// We strip anything that isn't alphanumeric, space, hyphen, comma, or period.
// ---------------------------------------------------------------------------

function sanitizeForFormula(query = "") {
  return String(query)
    .trim()
    .replace(/[^a-zA-Z0-9\s\-,.()+]/g, "")
    .slice(0, 100); // hard cap - no query needs to be longer than this
}

// ---------------------------------------------------------------------------
// Airtable formula builder
//
// Builds an OR() formula that checks the name field AND the synonyms field
// for a case-insensitive substring match. SEARCH() returns the 0-based index
// of the match (or blank if not found), so we compare with >= 0.
//
// Example output for query "DMAA":
//   OR(
//     SEARCH('dmaa', LOWER({Substance Name})) >= 0,
//     SEARCH('dmaa', LOWER({Synonyms})) >= 0
//   )
// ---------------------------------------------------------------------------

function buildBannedFormula(query) {
  const q = sanitizeForFormula(query).toLowerCase();
  return (
    `OR(` +
    `FIND('${q}', LOWER({Substance Name})) > 0,` +
    `FIND('${q}', LOWER({Synonyms})) > 0` +
    `)`
  );
}

function buildIngredientFormula(query) {
  const q = sanitizeForFormula(query).toLowerCase();
  return (
    `OR(` +
    `FIND('${q}', LOWER({Name})) > 0,` +
    `FIND('${q}', LOWER({Synonyms (Extended)})) > 0` +
    `)`
  );
}

// ---------------------------------------------------------------------------
// Airtable fetchers - server-side filtered
// ---------------------------------------------------------------------------

async function fetchBannedMatches(query) {
  const formula = buildBannedFormula(query);
  const records = await bannedBase(process.env.BANNED_TABLE_NAME)
    .select({ filterByFormula: formula, view: "Grid view" })
    .all();
  return records.map((rec) => ({ id: rec.id, fields: rec.fields }));
}

async function fetchIngredientMatches(query) {
  const formula = buildIngredientFormula(query);
  const records = await ingredientBase(process.env.INGREDIENT_TABLE_NAME)
    .select({ filterByFormula: formula, view: "Grid view" })
    .all();
  return records.map((rec) => ({ id: rec.id, fields: rec.fields }));
}

// ---------------------------------------------------------------------------
// Record normalization
//
// Single source of truth for mapping Airtable field names → frontend shape.
// Both banned and ingredient records are normalized to the same structure so
// the frontend doesn't need to handle two different shapes.
// ---------------------------------------------------------------------------

function normalizeBannedRecord(rec, ingredientMap) {
  const f = rec.fields;
  const name = (f["Substance Name"] ?? "").trim();

  // O(1) ingredient lookup via Map keyed by lowercase name
  const ing = ingredientMap.get(name.toLowerCase()) ?? null;

  return {
    id:           rec.id,
    // Core identity
    name,
    synonyms:     f["Synonyms"]          ?? null,
    bannedBy:     f["Banned By"]          ?? null,
    banType:      f["Ban Type"]           ?? null,  // null = not banned
    dosageLimit:  f["Dosage Limit"]       ?? null,
    notes:        f["Notes"]              ?? null,
    source:       f["Source / Citation"]  ?? null,
    // Enriched from ingredient table if a match exists
    benefits:     ing?.fields["Benefits"]            ?? null,
    weaknesses:   ing?.fields["Weaknesses"]          ?? null,
    antagonisms:  ing?.fields["Nutrient Antagonism"] ?? null,
  };
}

function normalizeIngredientRecord(rec) {
  const f = rec.fields;
  return {
    id:           rec.id,
    name:         (f["Name"] ?? "").trim(),
    synonyms:     f["Synonyms (Extended)"]   ?? null,
    bannedBy:     null,
    banType:      null,
    dosageLimit:  null,
    notes:        f["Pharmacology Notes"]    ?? null,
    source:       f["Sources / References"]  ?? null,
    benefits:     f["Benefits"]              ?? null,
    weaknesses:   f["Weaknesses"]            ?? null,
    antagonisms:  f["Nutrient Antagonism"]   ?? null,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body ?? {};

  // Validate
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return res
      .status(400)
      .json({ error: "Query is required and must be at least 2 characters." });
  }

  // Sanitize early - reject if nothing remains after sanitization
  const sanitized = sanitizeForFormula(query);
  if (sanitized.length < 2) {
    return res
      .status(400)
      .json({ error: "Query contains unsupported characters. Please use letters and numbers." });
  }

  try {
    // FIX 5: Run both Airtable queries in parallel instead of sequentially
    const [bannedRecords, ingredientRecords] = await Promise.all([
      fetchBannedMatches(sanitized),
      fetchIngredientMatches(sanitized),
    ]);

    // FIX 2: Build ingredient lookup Map - O(1) per lookup vs O(n) per lookup
    // Keyed by lowercase name for case-insensitive matching
    const ingredientMap = new Map(
      ingredientRecords.map((rec) => [
        (rec.fields["Name"] ?? "").toLowerCase().trim(),
        rec,
      ])
    );

    // Normalize banned records (enriched with ingredient data where available)
    const normalizedBanned = bannedRecords.map((rec) =>
      normalizeBannedRecord(rec, ingredientMap)
    );

    // Build a Set of banned substance names so we can exclude duplicates
    // from the ingredient results (same substance shouldn't appear twice)
    const bannedNameSet = new Set(
      normalizedBanned.map((r) => r.name.toLowerCase())
    );

    // Normalize ingredient records - exclude any already covered by banned
    const normalizedIngredients = ingredientRecords
      .filter((rec) => !bannedNameSet.has((rec.fields["Name"] ?? "").toLowerCase().trim()))
      .map(normalizeIngredientRecord);

    // Banned first, then ingredients
    const results = [...normalizedBanned, ...normalizedIngredients];

    return res.status(200).json({ records: results });

  } catch (err) {
    console.error("[search API] Error:", err);

    // Don't leak internal error details to the client
    return res.status(500).json({
      error: "Search is temporarily unavailable. Please try again shortly.",
    });
  }
}