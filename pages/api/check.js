// pages/api/check.js
/**
 * /pages/api/check.js
 *
 * Accepts POST:
 *   { text?, ocrText?, ingredientsText? }          - direct text flow (SmartStack / NutritionModal)
 *   { barcode?, isBarcodeFlow?, text?, ocrText? }  - barcode flow (BarcodeUpload / BarcodeChecker)
 *
 * Optional: { userEmail?, scanId?, debug? }
 *
 * Banned substances + ingredients are loaded from static JSON files at
 * import time - zero Airtable calls per scan request.
 */

import bannedRecordsRaw      from "../../data/banned.json"      assert { type: "json" };
import ingredientRecordsRaw  from "../../data/ingredients.json" assert { type: "json" };
import { supabaseAdmin as db } from "@/lib/supabase";

const BANNED_RECORDS     = bannedRecordsRaw;
const INGREDIENT_RECORDS = ingredientRecordsRaw;

const DEFAULT_FETCH_TIMEOUT = 10000;

async function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}


// ---------------------------------------------------------------------------
// Text normalization + matching
// ---------------------------------------------------------------------------

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// KEY FIX: Do NOT split on commas or periods.
// "1,3-dimethylamylamine" must stay as one token so "1" never becomes a
// standalone term that matches "1 Scoop" on a label.
// Only split on whitespace and structural bracket/quote separators.
// ---------------------------------------------------------------------------
function splitToTerms(text) {
  if (!text) return [];
  return normalizeText(text)
    .replace(/\b(ma|made|with|contains|ingredients|ingredient|organic)\b/gi, " ")
    .split(/[\s;\/\\\[\]\(\)\{\}"""''<>|@#$%^&*_+=~`·•]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

// ---------------------------------------------------------------------------
// Noise token filter
// ---------------------------------------------------------------------------

const NOISE_TOKENS = new Set([
  // Chemistry fragments that appear in many compound names
  "methyl", "ethyl", "propyl", "butyl", "acetyl", "phenyl", "dimethyl",
  "beta", "alpha", "gamma", "delta",
  // Generic food/supplement words
  "acid", "acids", "salt", "salts", "powder", "powders",
  "sodium", "potassium", "calcium", "magnesium", "iron",
  "chloride", "citrate", "phosphate", "sulfate", "malate", "tartrate",
  "oxide", "hydroxide", "extract", "blend", "complex", "concentrate",
  "protein", "peptide", "enzyme", "enzymes", "culture", "cultures",
  "milk", "cheese", "whey", "lactose", "casein", "sugar", "glucose",
  "oil", "fat", "fiber", "starch", "flour", "water",
  "color", "colour", "flavor", "flavors", "flavour", "spice", "spices",
  "green", "red", "blue", "yellow", "white", "black",
  // Units
  "mg", "mcg", "g", "iu", "ml",
  // Label structure words
  "scoop", "scoops", "serving", "servings", "container",
  "per", "size", "amount", "other", "natural", "artificial",
  "contains", "ingredients", "ingredient",
]);

function isNoiseToken(t) {
  const s = String(t || "").toLowerCase().trim();
  if (!s)                         return true;
  if (NOISE_TOKENS.has(s))        return true;
  if (s.length < 5)               return true;  // raised from 4 - kills "spice","green","chi" etc.
  if (/^\d+$/.test(s))            return true;  // pure number
  if (/^\d+[a-z]{1,2}$/.test(s)) return true;  // unit like "25mg"
  if (/^[a-z]{1,3}\d*$/.test(s)) return true;  // 1-3 letter token
  return false;
}

// ---------------------------------------------------------------------------
// Phrase matching - complete phrase must appear verbatim in text
// ---------------------------------------------------------------------------

function normalizeForPhrase(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseInText(phrase = "", normalizedText = "") {
  const p = normalizeForPhrase(phrase);
  // Must be at least 6 chars and contain a letter - "K2" or "spice" alone won't qualify
  if (!p || p.length < 6 || !/[a-z]/.test(p)) return false;
  return normalizeForPhrase(normalizedText).includes(p);
}

// ---------------------------------------------------------------------------
// Record term extraction
//
// CRITICAL: Synonyms are only used for PHRASE matching (whole synonym string).
// They are NOT split into tokens for individual word matching.
// This prevents "Chi Powder" → ["chi","powder"] → "powder" matching "ONION POWDER".
// Only the primary substance/ingredient name is split into tokens.
// ---------------------------------------------------------------------------

function primaryTerms(fields = {}, primaryFields = ["Name", "Ingredient Name"]) {
  const terms = new Set();
  for (const key of primaryFields) {
    const v = fields?.[key];
    if (v) splitToTerms(String(v)).forEach((t) => terms.add(t));
  }
  // Do NOT add synonym tokens here - synonyms are phrase-matched only
  return Array.from(terms);
}

function synonymPhrases(fields = {}) {
  const phrases = [];
  for (const col of ["Synonyms", "Synonyms (Extended)", "Depositor-Supplied Synonyms", "Other Names", "Alt Names"]) {
    const v = fields?.[col];
    if (!v) continue;
    String(v).split(/[,;\n]/).forEach((s) => {
      const trimmed = s.trim();
      if (trimmed) phrases.push(trimmed);
    });
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// Term-in-text check
// ---------------------------------------------------------------------------

function termInText(term = "", normalizedText = "") {
  if (!term || term.length < 2) return false;
  if (/^\d+$/.test(term))       return false;
  try {
    return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

// ---------------------------------------------------------------------------
// Short-term allowlist
//
// Some legitimate substance/ingredient names are short (< 7 chars) and must
// still match as standalone tokens - e.g. "zinc", "dmaa", "dhea", "hgh".
// Explicitly allowlisted so they pass the length gate.
//
// Do NOT add generic food words here (salt, acid, green, powder etc.) -
// those belong in NOISE_TOKENS above.
// ---------------------------------------------------------------------------

const SHORT_TERM_ALLOWLIST = new Set([
  // Banned substances with short names
  "dmaa", "dmha", "dmba", "dmae",
  "dhea", "dheas",
  "hgh", "hcg", "epo", "igf",
  "thc", "cbd", "cbn", "thcv",
  "lsd", "ghb", "gbl",
  "aicar", "sarms", "sarm",
  // Short ingredient names that are meaningful identifiers
  "zinc", "iodine",
  "nac",    // N-Acetyl Cysteine
  "atp", "gaba",
  "5-htp", "egcg",
]);

// ---------------------------------------------------------------------------
// Strong match gate
//
// A record matches ONLY if:
//   (A) The full substance/ingredient name phrase appears verbatim, OR
//   (B) A full synonym phrase (whole string) appears verbatim, OR
//   (C) A primary name token matches AND is either:
//         >= 7 chars  (e.g. "caffeine", "synephrine", "ephedrine"), OR
//         in SHORT_TERM_ALLOWLIST  (e.g. "zinc", "dmaa", "dhea")
//
// Synonym tokens are NEVER used - only full synonym phrases.
// This prevents "Chi Powder" → "powder" matching "ONION POWDER".
// ---------------------------------------------------------------------------

function hasStrongMatch(primaryMatchedTerms = [], primaryPhraseHit = false, synPhraseHit = false) {
  if (primaryPhraseHit || synPhraseHit) return true;
  if (!primaryMatchedTerms?.length) return false;
  const meaningful = primaryMatchedTerms.filter((t) => !isNoiseToken(t));
  if (!meaningful.length) return false;
  return meaningful.some((t) => {
    const s = String(t).toLowerCase();
    return s.length >= 7 || SHORT_TERM_ALLOWLIST.has(s);
  });
}

// ---------------------------------------------------------------------------
// Matching functions
// ---------------------------------------------------------------------------

function matchAgainstBannedRecords(ingredientsText) {
  const normalized = normalizeText(ingredientsText);

  return BANNED_RECORDS.reduce((matches, rec) => {
    const fields  = rec.fields || {};
    const subName = fields["Substance Name"] || "";

    // (A) Full substance name as phrase
    const primaryPhraseHit = phraseInText(subName, normalized);

    // (B) Each synonym as a complete phrase - NOT individual tokens
    const syns = synonymPhrases(fields);
    const synPhraseHit = syns.some((syn) => phraseInText(syn, normalized));

    // (C) Primary name tokens only (no synonym tokens)
    const matchedTerms = primaryTerms(fields, ["Substance Name"])
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, primaryPhraseHit, synPhraseHit)) return matches;

    // What actually triggered the match - for display
    const triggerTerms = primaryPhraseHit
      ? [subName]
      : synPhraseHit
        ? syns.filter((syn) => phraseInText(syn, normalized))
        : matchedTerms;

    matches.push({
      id: rec.id,
      fields: {
        "Substance Name":      fields["Substance Name"]      || fields["Name"] || "",
        Synonyms:              fields["Synonyms"]             || "",
        "Ban Type":            fields["Ban Type"]             || "",
        "Banned By":           fields["Banned By"]            || "",
        "Dosage Limit":        fields["Dosage Limit"]         || "",
        Notes:                 fields["Notes"]                || "",
        "Source / Citation":   fields["Source / Citation"]   || "",
        Benefits:              fields["Benefits"]             || "",
        Weaknesses:            fields["Weaknesses"]           || "",
        "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
      },
      matchedTerms: triggerTerms,
    });
    return matches;
  }, []);
}

function matchAgainstIngredientRecords(ingredientsText) {
  const normalized = normalizeText(ingredientsText);

  return INGREDIENT_RECORDS.reduce((matches, rec) => {
    const fields      = rec.fields || {};
    const primaryName = fields["Name"] || fields["Ingredient Name"] || "";

    const primaryPhraseHit = phraseInText(primaryName, normalized);

    const syns = synonymPhrases(fields);
    const synPhraseHit = syns.some((syn) => phraseInText(syn, normalized));

    const matchedTerms = primaryTerms(fields, ["Name", "Ingredient Name"])
      .filter((t) => !isNoiseToken(t) && termInText(t, normalized));

    if (!hasStrongMatch(matchedTerms, primaryPhraseHit, synPhraseHit)) return matches;

    const triggerTerms = primaryPhraseHit
      ? [primaryName]
      : synPhraseHit
        ? syns.filter((syn) => phraseInText(syn, normalized))
        : matchedTerms;

    matches.push({
      id: rec.id,
      fields: {
        Name:                   fields["Name"]                  || fields["Ingredient Name"] || "",
        "PubChem CID":          fields["PubChem CID"]          || "",
        "Synonyms (Extended)":  fields["Synonyms (Extended)"]  || fields["Synonyms"] || "",
        "Pharmacology Notes":   fields["Pharmacology Notes"]   || "",
        Benefits:               fields["Benefits"]              || "",
        Weaknesses:             fields["Weaknesses"]            || "",
        "Nutrient Antagonism":  fields["Nutrient Antagonism"]  || "",
        "Sources / References": fields["Sources / References"] || "",
      },
      matchedTerms: triggerTerms,
    });
    return matches;
  }, []);
}

// ---------------------------------------------------------------------------
// UPC helpers - unchanged
// ---------------------------------------------------------------------------

function calculateUPCACheckDigit(upcaWithoutChecksum) {
  if (!upcaWithoutChecksum || !/^\d{11}$/.test(upcaWithoutChecksum)) return null;
  const digits = upcaWithoutChecksum.split("").map(Number);
  let odd = 0, even = 0;
  for (let i = 0; i < digits.length; i++) {
    if ((i + 1) % 2 === 1) odd += digits[i];
    else                   even += digits[i];
  }
  const mod = (odd * 3 + even) % 10;
  return mod === 0 ? "0" : String(10 - mod);
}

function convertUPCEtoUPCA(upceRaw) {
  if (!upceRaw) return null;
  let s = String(upceRaw).replace(/\D/g, "");
  if (!/^\d{6,8}$/.test(s)) return null;
  let numberSystem = "0", payload = "";
  if      (s.length === 8) { numberSystem = s.charAt(0); payload = s.slice(1, 7); }
  else if (s.length === 7) { numberSystem = "0";          payload = s.slice(0, 6); }
  else                     { numberSystem = "0";          payload = s; }
  if (!/^\d{6}$/.test(payload)) return null;
  const [d0, d1, d2, d3, d4, d5] = payload.split("");
  const last = d5;
  let base = null;
  if (["0","1","2"].includes(last)) base = `${numberSystem}${d0}${d1}${last}0000${d2}${d3}${d4}`;
  else if (last === "3")            base = `${numberSystem}${d0}${d1}${d2}00000${d3}${d4}`;
  else if (last === "4")            base = `${numberSystem}${d0}${d1}${d2}${d3}00000${d4}`;
  else                              base = `${numberSystem}${d0}${d1}${d2}${d3}${d4}0000${last}`;
  if (!/^\d{11}$/.test(base)) return null;
  const check = calculateUPCACheckDigit(base);
  return check ? base + check : null;
}

function normalizeToUPCA(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\s+/g, "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 13 && digits.startsWith("0")) digits = digits.substring(1);
  if (digits.length === 12) return digits;
  if (digits.length === 11) { const c = calculateUPCACheckDigit(digits); return c ? digits + c : null; }
  if (digits.length >= 6 && digits.length <= 8) return convertUPCEtoUPCA(digits);
  return null;
}

function generateBarcodeCandidates(rawBarcode) {
  if (rawBarcode == null) return [];
  const rawStr     = String(rawBarcode).trim();
  const digitsOnly = rawStr.replace(/\D/g, "");
  const set        = new Set();
  const normalized = normalizeToUPCA(rawStr);
  if (normalized) set.add(normalized);
  if (digitsOnly)  set.add(digitsOnly);
  if (digitsOnly.length === 12) set.add("0" + digitsOnly);
  if (digitsOnly.length === 13 && digitsOnly.startsWith("0")) set.add(digitsOnly.substring(1));
  if (digitsOnly.length >= 6 && digitsOnly.length <= 8) {
    const expanded = convertUPCEtoUPCA(digitsOnly);
    if (expanded) set.add(expanded);
  }
  if (digitsOnly.length === 11) {
    const check = calculateUPCACheckDigit(digitsOnly);
    if (check) set.add(digitsOnly + check);
  }
  set.add(rawStr);
  return Array.from(set).slice(0, 12);
}

// ---------------------------------------------------------------------------
// Nutritionix helpers - unchanged
// ---------------------------------------------------------------------------

function extractExplicitIngredients(food = {}) {
  if (!food) return null;
  for (const c of [food.ingredient_statement, food.nf_ingredient_statement, food.ingredients_text, food.ingredient_list]) {
    if (c && typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function extractNutritionFromFood(f = {}) {
  const nutrition = {};
  for (const k of Object.keys(f || {})) {
    if (k.startsWith("nf_")) nutrition[k.replace(/^nf_/, "")] = f[k];
  }
  return nutrition;
}

function flattenNutritionixForDisplay(itemOrJson) {
  if (!itemOrJson) return "";
  const parts = [];
  const foods = Array.isArray(itemOrJson?.foods) ? itemOrJson.foods : [itemOrJson];
  for (const f of foods) {
    const names = [f.food_name, f.brand_name, f.item_name].filter(Boolean);
    if (names.length) parts.push(`NAME: ${names.join(" / ")}`);
    const ing = extractExplicitIngredients(f);
    if (ing) parts.push(`INGREDIENTS: ${ing}`);
    const nut = extractNutritionFromFood(f);
    if (Object.keys(nut).length) {
      parts.push(`NUTRITION: ${Object.entries(nut).map(([k,v]) => `${k}: ${v}`).join(" | ")}`);
    }
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// External providers - unchanged
// ---------------------------------------------------------------------------

async function tryOpenFoodFacts(upcCandidate) {
  try {
    const resp = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upcCandidate)}.json`,
      { method: "GET", headers: { Accept: "application/json" } }, 8000
    );
    if (!resp.ok) return { ok: false, provider: "openfoodfacts", status: resp.status };
    const json = await resp.json();
    if (!json || json.status !== 1 || !json.product) return { ok: false, provider: "openfoodfacts", raw: json };
    const p = json.product;
    let ingredientsText = p.ingredients_text || p.ingredients_text_en || "";
    if (!ingredientsText && Array.isArray(p.ingredients)) {
      ingredientsText = p.ingredients.map((i) => i?.text).filter(Boolean).join(", ");
    }
    return {
      ok: !!(ingredientsText || p.nutriments),
      provider: "openfoodfacts",
      productName: p.product_name || p.generic_name || p.product_name_en || null,
      ingredientsText: ingredientsText.trim() || null,
      nutrition: p.nutriments || null,
      raw: p,
    };
  } catch (err) {
    return { ok: false, provider: "openfoodfacts", error: String(err) };
  }
}

async function tryNutritionix(upcCandidate) {
  const appId  = process.env.NUTRITIONIX_APP_ID  || null;
  const appKey = process.env.NUTRITIONIX_APP_KEY || null;
  if (!appId || !appKey) return { ok: false, provider: "nutritionix", reason: "no-api-key" };
  let v2Json = null, v1Json = null, productName = null, mergedNutrition = {}, explicitIngredients = null;
  try {
    const resp = await fetchWithTimeout("https://trackapi.nutritionix.com/v2/search/item", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-id": appId, "x-app-key": appKey },
      body: JSON.stringify({ upc: String(upcCandidate) }),
    }, 9000);
    if (resp.ok) {
      v2Json = await resp.json();
      if (Array.isArray(v2Json.foods) && v2Json.foods.length) {
        const f = v2Json.foods[0];
        productName         = productName         || f.food_name || f.brand_name || f.item_name || null;
        explicitIngredients = explicitIngredients || extractExplicitIngredients(f);
        mergedNutrition     = { ...mergedNutrition, ...extractNutritionFromFood(f) };
      }
    }
  } catch (e) { console.warn("[/api/check] Nutritionix v2 error:", String(e)); }
  try {
    const resp = await fetchWithTimeout(
      `https://api.nutritionix.com/v1_1/item?upc=${encodeURIComponent(String(upcCandidate))}&appId=${encodeURIComponent(appId)}&appKey=${encodeURIComponent(appKey)}`,
      { method: "GET", headers: { Accept: "application/json" } }, 9000
    );
    if (resp.ok) {
      v1Json = await resp.json();
      productName         = productName         || (v1Json.brand_name ? `${v1Json.brand_name} - ${v1Json.item_name || ""}`.trim() : v1Json.item_name || null);
      explicitIngredients = explicitIngredients || extractExplicitIngredients(v1Json);
      for (const k of Object.keys(v1Json || {})) {
        if (k.startsWith("nf_")) mergedNutrition[k.replace(/^nf_/, "")] = v1Json[k];
      }
    }
  } catch (e) { console.warn("[/api/check] Nutritionix v1 error:", String(e)); }
  return {
    ok: !!(v1Json || v2Json),
    provider: "nutritionix",
    productName,
    ingredientsText: explicitIngredients || null,
    nutrition: Object.keys(mergedNutrition).length ? mergedNutrition : null,
    raw: { v1: v1Json || null, v2: v2Json || null },
  };
}

async function tryUSDA(upcCandidate) {
  try {
    const key = process.env.USDA_API_KEY;
    if (!key) return { ok: false, provider: "usda", reason: "no-api-key" };
    const resp = await fetchWithTimeout(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(String(upcCandidate))}&api_key=${encodeURIComponent(key)}&pageSize=5`,
      { method: "GET", headers: { Accept: "application/json" } }, 9000
    );
    if (!resp.ok) return { ok: false, provider: "usda", status: resp.status };
    const json = await resp.json();
    if (!Array.isArray(json?.foods) || !json.foods.length) return { ok: false, provider: "usda", raw: json };
    const ingredientsText = json.foods.map((f) => f.ingredients || f.foodDescription || "").filter(Boolean).join(" ").trim() || null;
    const productName     = json.foods.map((f) => f.description || f.foodName || "").filter(Boolean)[0] || null;
    const nutrition = {};
    for (const f of json.foods) {
      if (Array.isArray(f.foodNutrients)) {
        for (const n of f.foodNutrients) {
          const name = String(n.nutrientName || n.name || "");
          const value = n.value ?? n.amount ?? null;
          const unit  = n.unitName || n.unit || "";
          if (name && value != null && !nutrition[name]) nutrition[name] = { value, unit };
        }
      }
    }
    return {
      ok: !!(ingredientsText || Object.keys(nutrition).length),
      provider: "usda", productName, ingredientsText,
      nutrition: Object.keys(nutrition).length ? nutrition : null,
      raw: json,
    };
  } catch (err) {
    return { ok: false, provider: "usda", error: String(err) };
  }
}

async function tryFoodRepo(upcCandidate) {
  try {
    const key = process.env.FOODREPO_API_KEY;
    if (!key) return { ok: false, provider: "foodrepo", reason: "no-api-key" };
    const resp = await fetchWithTimeout(
      `https://www.foodrepo.org/api/v3/products/${encodeURIComponent(String(upcCandidate))}`,
      { method: "GET", headers: { Authorization: `Token token=${key}` } }, 9000
    );
    if (!resp.ok) return { ok: false, provider: "foodrepo", status: resp.status };
    const json  = await resp.json();
    const attrs = json?.data?.attributes || {};
    return {
      ok: !!(attrs.ingredients_text || attrs.nutritional_values),
      provider: "foodrepo",
      productName:     attrs.name || attrs.display_name || null,
      ingredientsText: attrs.ingredients_text || attrs.ingredients || null,
      nutrition:       attrs.nutritional_values || attrs.nutriments || null,
      raw: json,
    };
  } catch (err) {
    return { ok: false, provider: "foodrepo", error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed. Use POST." });

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const body = req.body || {};

    // ---------------------------------------------------------------------------
    // Accept text from multiple field names so both flows work:
    //   - BarcodeUpload / OCRUpload:  { text } or { ocrText }
    //   - NutritionModal / SmartStack: { ingredientsText }
    // ---------------------------------------------------------------------------
    let directText = (
      body.text            ||
      body.ocrText         ||
      body.ingredientsText ||
      ""
    ).trim();

    const isBarcodeFlow = Boolean(body.isBarcodeFlow) || (body.barcode != null);
    const barcodeRaw    = body.barcode != null ? String(body.barcode) : null;

    const debug = {
      isBarcodeFlow,
      barcodeOriginal:  barcodeRaw,
      directTextLength: directText.length,
      candidates:       [],
      externalAttempts: [],
      candidateResults: [],
      bannedRecords:     BANNED_RECORDS.length,
        ingredientRecords: INGREDIENT_RECORDS.length,
    };

    let structured = {
      productName:     null,
      ingredientsText: directText || null,
      nutrition:       null,
      rawNutritionix:  null,
    };

    // ── Barcode flow ────────────────────────────────────────────────────────
    if (isBarcodeFlow && barcodeRaw) {
      const digitsOnly = String(barcodeRaw).replace(/\D/g, "");
      if (!digitsOnly) {
        return res.status(400).json({ error: "Barcode contains no digits", debug });
      }

      const candidates = generateBarcodeCandidates(barcodeRaw);
      debug.candidates = candidates.slice();

      let bestCandidate = null;
      let bestScore     = -1;

      for (const cand of candidates) {
        const per = { candidate: cand, productName: null, ingredientsText: null, nutrition: null };

        const providers = [
          { fn: tryOpenFoodFacts, name: "openfoodfacts" },
          { fn: tryNutritionix,   name: "nutritionix"   },
          { fn: tryUSDA,          name: "usda"           },
          { fn: tryFoodRepo,      name: "foodrepo"       },
        ];

        for (const p of providers) {
          try {
            const result = await p.fn(cand);
            debug.externalAttempts.push({
              candidate: cand, provider: p.name,
              ok:   !!(result?.ok),
              note: result?.reason || result?.status || result?.note || result?.error || null,
            });
            if (!result) continue;
            if (p.name === "nutritionix") structured.rawNutritionix = structured.rawNutritionix || result.raw || null;
            if (result.productName    && !per.productName)    per.productName    = result.productName;
            if (result.ingredientsText && !per.ingredientsText) per.ingredientsText = result.ingredientsText;
            if (result.nutrition) {
              per.nutrition = per.nutrition || {};
              for (const k of Object.keys(result.nutrition)) {
                if (!per.nutrition[k]) per.nutrition[k] = result.nutrition[k];
              }
            }
          } catch (err) {
            debug.externalAttempts.push({ candidate: cand, provider: p.name, ok: false, note: String(err) });
          }
        }

        const ingText  = (per.ingredientsText || "").trim();
        const nutCount = per.nutrition ? Object.keys(per.nutrition).length : 0;
        const score    = ingText.length + nutCount * 50;

        debug.candidateResults.push({
          candidate: cand, hasIngredients: !!ingText,
          ingredientsLength: ingText.length, nutritionFieldCount: nutCount,
          score, productNamePreview: per.productName || null,
        });

        if ((ingText || nutCount > 0) && score > bestScore) {
          bestScore     = score;
          bestCandidate = per;
        }
      }

      if (!bestCandidate) {
        return res.status(200).json({
          found:   false,
          message: "We couldn't find product data for that barcode. Try a clearer photo, check the barcode, or enter ingredients manually.",
          debug,
        });
      }

      structured.productName     = structured.productName     || bestCandidate.productName     || null;
      structured.ingredientsText = structured.ingredientsText || bestCandidate.ingredientsText || null;
      structured.nutrition       = structured.nutrition       || bestCandidate.nutrition       || null;
    }
    // ── End barcode flow ────────────────────────────────────────────────────

    // ---------------------------------------------------------------------------
    // For direct text flow (SmartStack / NutritionModal) - no barcode involved.
    // structured.ingredientsText is already set from directText above.
    // We only gate on "no text AND no nutrition" so direct text always proceeds.
    // ---------------------------------------------------------------------------
    const hasIngredients = !!(structured.ingredientsText?.trim());
    const hasNutrition   = !!(structured.nutrition && Object.keys(structured.nutrition).length);

    if (!hasIngredients && !hasNutrition) {
      return res.status(200).json({
        found:   false,
        message: isBarcodeFlow
          ? "We couldn't find product data for that barcode. Try a clearer photo, check the barcode, or enter ingredients manually."
          : "No ingredient text provided.",
        debug,
      });
    }

    const matchingText = (structured.ingredientsText || "").trim();

    // ── Matching ────────────────────────────────────────────────────────────
    let matchedBanned      = matchingText ? matchAgainstBannedRecords(matchingText)     : [];
    let matchedIngredients = matchingText ? matchAgainstIngredientRecords(matchingText) : [];
    debug.totalBannedMatches     = matchedBanned.length;
    debug.totalIngredientMatches = matchedIngredients.length;

    // ── Enrich banned matches from ingredient DB ────────────────────────────
    if (matchedBanned.length && matchedIngredients.length) {
      const ingByName = new Map();
      for (const ing of matchedIngredients) {
        const name = String(ing.fields?.["Name"] || "").trim().toLowerCase();
        if (name) ingByName.set(name, ing);
        const syns = String(ing.fields?.["Synonyms (Extended)"] || ing.fields?.["Synonyms"] || "");
        syns.split(/[;,\/\|\(\)\[\]\n]/).map((s) => s.trim()).filter(Boolean)
          .forEach((s) => ingByName.set(s.toLowerCase(), ing));
      }
      matchedBanned = matchedBanned.map((b) => {
        const bName  = String(b.fields?.["Substance Name"] || "").trim().toLowerCase();
        const source = ingByName.get(bName);
        if (!source) return b;
        return {
          ...b,
          fields: {
            ...b.fields,
            Benefits:              b.fields["Benefits"]              || source.fields?.Benefits              || "",
            Weaknesses:            b.fields["Weaknesses"]            || source.fields?.Weaknesses            || "",
            "Nutrient Antagonism": b.fields["Nutrient Antagonism"]   || source.fields?.["Nutrient Antagonism"] || "",
          },
        };
      });
    }

    // ── bannedDetails counts ────────────────────────────────────────────────
    const bannedDetails = matchedBanned.reduce(
      (acc, b) => {
        const bt = String(b.fields?.["Ban Type"] || "").toLowerCase();
        if      (bt.includes("prohibited") || bt.includes("in-competition") || bt.includes("banned")) acc.ProhibitedCount++;
        else if (bt.includes("limited")    || bt.includes("out of competition") || bt.includes("threshold")) acc.LimitedCount++;
        else acc.OtherBannedCount++;
        return acc;
      },
      { ProhibitedCount: 0, LimitedCount: 0, OtherBannedCount: 0 }
    );

    // ── Save to Supabase scans ──────────────────────────────────────────────
    if (body.userEmail) {
      try {
        const now = new Date();
        const { error: scanErr } = await db.from("scans").insert({
          user_email:      body.userEmail,
          scan_name:       structured.productName
            ? `${structured.productName} (${now.toLocaleString("en-US", { hour12: false })})`
            : `Scan - ${now.toLocaleString("en-US", { hour12: false })}`,
          scan_date:       now.toISOString(),
          stack_details:   matchingText || "No ingredient text captured",
          results_summary: `Prohibited: ${bannedDetails.ProhibitedCount}, Limited: ${bannedDetails.LimitedCount}, Other: ${bannedDetails.OtherBannedCount}`,
          banned_details:  bannedDetails,
        });
        debug.scansSaveSuccess = !scanErr;
        if (scanErr) debug.scansSaveError = String(scanErr?.message || scanErr);
      } catch (err) {
        console.error("[/api/check] Failed to save scan:", err);
        debug.scansSaveError = String(err?.message || err);
      }
    }

    // ── Response ────────────────────────────────────────────────────────────
    return res.status(200).json({
      found:           true,
      ocrText:         matchingText || flattenNutritionixForDisplay(structured.rawNutritionix?.v2 || structured.rawNutritionix?.v1) || null,
      productName:     structured.productName     || null,
      ingredientsText: structured.ingredientsText || null,
      nutritionFacts:  structured.nutrition       || null,
      matchedBanned,
      matchedIngredients,
      bannedDetails,
      // Also expose under smartstack field names so NutritionModal works without changes
      bannedSubstances: matchedBanned,
      ingredients:      matchedIngredients,
      debug: {
        ...debug,
        totalBannedMatches:     matchedBanned.length,
        totalIngredientMatches: matchedIngredients.length,
      },
    });

  } catch (err) {
    console.error("[/api/check] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}