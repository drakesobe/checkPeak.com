/**
 * /pages/api/check-smartstack
 *
 * Enhanced to include "Nutrient Antagonism" for both Banned Substances and Ingredients.
 * Includes enriched cross-linking and full debug output.
 */

import Airtable from "airtable";

const DEFAULT_FETCH_TIMEOUT = 10000;

async function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

/* --------------------
   Airtable clients
   -------------------- */
const bannedBase =
  process.env.BANNED_API_KEY && process.env.BANNED_BASE_ID
    ? new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(process.env.BANNED_BASE_ID)
    : null;

const ingredientsBase =
  process.env.INGREDIENT_API_KEY && process.env.INGREDIENT_BASE_ID
    ? new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(process.env.INGREDIENT_BASE_ID)
    : null;

async function fetchAllAirtableRecordsUsingClient(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");
  const pageSize = 100;
  const all = await baseInstance(tableName).select({ view: "Grid view", pageSize }).all();
  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

/* --------------------
   Helpers
   -------------------- */
const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const cleaned = lower.replace(/\b(ma|made|with|contains|ingredients|ingredient|organic)\b/gi, " ");
  const rawTerms = cleaned.split(/[.,;:\/\\\[\]\(\)\{\}"“”‘’<>|@#\$%\^&\*_+=~`·•]/);
  return rawTerms.map((t) => t.trim()).filter((t) => t.length > 1);
}

function recordTerms(fields = {}, primaryFields = ["Name", "Ingredient Name"]) {
  const terms = new Set();
  for (const key of primaryFields) {
    const v = fields?.[key];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }
  const synonymCols = ["Synonyms", "Synonyms (Extended)", "Depositor-Supplied Synonyms"];
  for (const col of synonymCols) {
    const v = fields?.[col];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }
  return Array.from(terms);
}

function termInText(term = "", normalizedText = "") {
  if (!term || term.length < 2 || /^[0-9]+$/.test(term)) return false;
  try {
    const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    return rx.test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

/* --------------------
   Airtable matching
   -------------------- */
async function matchAgainstBannedRecords(ingredientsText) {
  if (!bannedBase || !process.env.BANNED_TABLE_NAME) return [];
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");
  const rawRecords = await fetchAllAirtableRecordsUsingClient(bannedBase, process.env.BANNED_TABLE_NAME);
  const matches = [];

  for (const rec of rawRecords) {
    const fields = rec.fields || {};
    const candidates = recordTerms(fields, ["Substance Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

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
  if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME)
    throw new Error("Ingredients Airtable not configured");
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");
  const raw = await fetchAllAirtableRecordsUsingClient(ingredientsBase, process.env.INGREDIENT_TABLE_NAME);
  const matches = [];

  for (const rec of raw) {
    const fields = rec.fields || {};
    const candidates = recordTerms(fields, ["Name", "Ingredient Name"]);
    const matchedTerms = [];

    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          Name: fields["Name"] || "",
          "Synonyms (Extended)": fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
          "Sources / References": fields["Sources / References"] || "",
        },
        matchedTerms,
      });
    }
  }

  console.log(`[check-smartstack] Ingredient Matches Found: ${matches.length}`);
  return matches;
}

/* --------------------
   Main Handler
   -------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed. Use POST." });

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const body = req.body || {};
    let { text, ocrText } = body;
    const rawText = (text || ocrText || "").trim();

    const debug = {
      airtable: {
        bannedConfigured: Boolean(bannedBase && process.env.BANNED_TABLE_NAME),
        ingredientsConfigured: Boolean(ingredientsBase && process.env.INGREDIENT_TABLE_NAME),
      },
    };

    if (!rawText) {
      debug.note = "No OCR/text provided";
      return res.status(400).json({ error: "No text provided for OCR check.", debug });
    }

    // Match against Airtable
    let matchedIngredients = [];
    let matchedBanned = [];

    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
    } catch (err) {
      console.error("[check-smartstack] Error matching ingredients:", err);
      debug.airtableIngredientError = String(err?.message || err);
    }

    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
    } catch (err) {
      console.error("[check-smartstack] Error matching banned substances:", err);
      debug.airtableBannedError = String(err?.message || err);
    }

    // Enrich banned substances with ingredient info (shared nutrient antagonism)
    if (matchedBanned.length && matchedIngredients.length) {
      const ingByName = new Map();
      for (const ing of matchedIngredients) {
        const name = (ing.fields?.["Name"] || "").toString().trim().toLowerCase();
        if (name) ingByName.set(name, ing);
        const syns = (ing.fields?.["Synonyms (Extended)"] || ing.fields?.["Synonyms"] || "").toString();
        syns
          .split(/[;,\/\|\(\)\[\]\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => ingByName.set(s.toLowerCase(), ing));
      }

      matchedBanned = matchedBanned.map((b) => {
        const bName = (b.fields?.["Substance Name"] || "").toString().trim().toLowerCase();
        const maybe = ingByName.get(bName);
        if (maybe) {
          const enriched = { ...b };
          enriched.fields["Benefits"] = enriched.fields["Benefits"] || maybe.fields?.Benefits || "";
          enriched.fields["Weaknesses"] = enriched.fields["Weaknesses"] || maybe.fields?.Weaknesses || "";
          enriched.fields["Nutrient Antagonism"] =
            enriched.fields["Nutrient Antagonism"] ||
            maybe.fields?.["Nutrient Antagonism"] ||
            "";
          return enriched;
        }
        return b;
      });
    }

    // Debug summary
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
