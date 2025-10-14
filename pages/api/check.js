// pages/api/check.js
/**
 * /pages/api/check.js
 *
 * Accepts POST { text?, ocrText?, barcode?, labelImage?, isBarcodeFlow? }
 *
 * Behavior:
 *  - Normalize barcode into UPC-A candidate(s).
 *  - For each candidate, query providers in this order:
 *      1) OpenFoodFacts
 *      2) Nutritionix (v2 POST + v1 GET; combine both results)
 *      3) USDA (if configured)
 *      4) FoodRepo (if configured)
 *    For a candidate we attempt all providers and merge their outputs; Nutritionix
 *    returned data is always captured (v2+v1 combined) even if partial.
 *  - If we get either ingredientsText OR nutrition facts from any provider,
 *    we consider the candidate successful and stop trying other candidates.
 *  - If still no text found, DO NOT run OCR automatically. Return helpful debug.
 *  - If ingredients/nutrition found, match normalized ingredient text
 *    against Airtable banned/ingredient tables (if configured).
 *
 * Response includes:
 *  { found: boolean, message?, ocrText?, productName?, ingredientsText?, nutritionFacts?,
 *    matchedBanned?, matchedIngredients?, debug }
 */

import Airtable from "airtable";
import Tesseract from "tesseract.js"; // kept in case OCR is re-enabled later

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
   Airtable clients (if configured)
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
   Helpers: text normalization + matching
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
  if (!term) return false;
  if (term.length < 2) return false;
  if (/^[0-9]+$/.test(term)) return false;
  try {
    const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    return rx.test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

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
          "Substance Name": fields["Substance Name"] || fields["Name"] || "",
          Synonyms: fields["Synonyms"] || "",
          "Ban Type": fields["Ban Type"] || "",
          "Banned By": fields["Banned By"] || "",
          "Dosage Limit": fields["Dosage Limit"] || "",
          Notes: fields["Notes"] || "",
          "Source / Citation": fields["Source / Citation"] || "",
        },
        matchedTerms,
      });
    }
  }
  return matches;
}

async function matchAgainstIngredientRecords(ingredientsText) {
  if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME) throw new Error("Ingredients Airtable not configured");
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
          Name: fields["Name"] || fields["Ingredient Name"] || "",
          "PubChem CID": fields["PubChem CID"] || "",
          "Synonyms (Extended)": fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          "Pharmacology Notes": fields["Pharmacology Notes"] || "",
          "Benefits": fields["Benefits"] || "",
          "Weaknesses": fields["Weaknesses"] || "",
          "Nutrient Antagonism": fields["Nutrient Antagonism"] || "",
          "Sources / References": fields["Sources / References"] || "",
        },
        matchedTerms,
      });
    }
  }
  return matches;
}

/* --------------------
   UPC normalization & UPC-E expansion
   -------------------- */
function calculateUPCACheckDigit(upcaWithoutChecksum) {
  if (!upcaWithoutChecksum || !/^\d{11}$/.test(upcaWithoutChecksum)) return null;
  const digits = upcaWithoutChecksum.split("").map(Number);
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < digits.length; i++) {
    if ((i + 1) % 2 === 1) oddSum += digits[i];
    else evenSum += digits[i];
  }
  const total = oddSum * 3 + evenSum;
  const mod = total % 10;
  return mod === 0 ? "0" : String(10 - mod);
}

function convertUPCEtoUPCA(upceRaw) {
  if (!upceRaw) return null;
  let s = String(upceRaw).replace(/\D/g, "");
  if (!/^\d{6,7,8}$/.test(s)) return null;

  let numberSystem = "0";
  let payload = "";

  if (s.length === 8) {
    numberSystem = s.charAt(0);
    payload = s.slice(1, 7);
  } else if (s.length === 7) {
    numberSystem = "0";
    payload = s.slice(0, 6);
  } else if (s.length === 6) {
    numberSystem = "0";
    payload = s;
  }

  if (!/^\d{6}$/.test(payload)) return null;
  const [d0, d1, d2, d3, d4, d5] = payload.split("");
  const last = d5;

  let upcaWithoutChecksum = null;

  if (["0", "1", "2"].includes(last)) {
    upcaWithoutChecksum = `${numberSystem}${d0}${d1}${last}0000${d2}${d3}${d4}`;
  } else if (last === "3") {
    upcaWithoutChecksum = `${numberSystem}${d0}${d1}${d2}00000${d3}${d4}`;
  } else if (last === "4") {
    upcaWithoutChecksum = `${numberSystem}${d0}${d1}${d2}${d3}00000${d4}`;
  } else {
    upcaWithoutChecksum = `${numberSystem}${d0}${d1}${d2}${d3}${d4}0000${last}`;
  }

  if (!/^\d{11}$/.test(upcaWithoutChecksum)) return null;
  const check = calculateUPCACheckDigit(upcaWithoutChecksum);
  if (check === null) return null;
  return upcaWithoutChecksum + check;
}

function normalizeToUPCA(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, "");
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 13 && digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  if (digits.length === 12) return digits;
  if (digits.length === 11) {
    const c = calculateUPCACheckDigit(digits);
    if (c) return digits + c;
    return null;
  }

  if (digits.length === 6 || digits.length === 7 || digits.length === 8) {
    const expanded = convertUPCEtoUPCA(digits);
    if (expanded) return expanded;
  }

  return null;
}

function generateBarcodeCandidates(rawBarcode) {
  if (rawBarcode === undefined || rawBarcode === null) return [];
  const rawStr = String(rawBarcode).trim();
  const digitsOnly = rawStr.replace(/\D/g, "");
  const set = new Set();

  const normalized = normalizeToUPCA(rawStr);
  if (normalized) set.add(normalized);
  if (digitsOnly) set.add(digitsOnly);
  if (digitsOnly.length === 12) set.add("0" + digitsOnly);
  if (digitsOnly.length === 13 && digitsOnly.startsWith("0")) set.add(digitsOnly.substring(1));
  if (digitsOnly.length === 6 || digitsOnly.length === 7 || digitsOnly.length === 8) {
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

/* --------------------
   Provider-specific extraction helpers
   -------------------- */

function extractNutritionFromNutritionixFood(f = {}) {
  const nutrition = {};
  for (const k of Object.keys(f || {})) {
    if (k.startsWith("nf_")) {
      const shortKey = k.replace(/^nf_/, "");
      nutrition[shortKey] = f[k];
    }
  }
  return nutrition;
}

/*
  extractIngredientsFromNutritionixFood:
  Robust extractor that tries many possible fields/nested shapes.
  It returns a best-effort ingredient string or null.
*/
function extractIngredientsFromNutritionixFood(chosen = {}) {
  if (!chosen) return null;

  const possible = [];

  // Common fields and variants
  possible.push(chosen.ingredient_statement || null); // documented field
  possible.push(chosen.nf_ingredient_statement || null); // older variant
  possible.push(chosen.ingredients_text || null);
  possible.push(chosen.ingredient_list || null);
  possible.push(chosen.ingredients || null);

  // Nested food object
  if (chosen?.food) {
    possible.push(chosen.food.ingredient_statement || null);
    possible.push(chosen.food.ingredients_text || null);
    possible.push(chosen.food.ingredients || null);
  }

  // If chosen is an array of items
  if (Array.isArray(chosen)) {
    possible.push(
      chosen
        .map((c) => c.ingredient_statement || c.nf_ingredient_statement || c.ingredients_text || "")
        .filter(Boolean)
        .join(", ")
    );
  }

  // If ingredients is an array of {text}
  if (!possible.some(Boolean) && Array.isArray(chosen.ingredients)) {
    possible.push(chosen.ingredients.map((i) => (i && i.text) || "").filter(Boolean).join(", "));
  }

  for (const p of possible) {
    if (!p) continue;
    const s = (typeof p === "string" ? p : String(p)).trim();
    if (s) return s;
  }

  return null;
}

/*
  flattenNutritionixRawToText:
  Given a raw v2/v1 Nutritionix object, extract readable text labels including
  nutrition facts fields, ingredient statements, and common name fields.
  This attempts to capture "everything" Nutritionix provides in a readable form.
*/
function flattenNutritionixRawToText(itemOrJson) {
  if (!itemOrJson) return "";
  const parts = [];

  // If this is a top-level response (v2 search) with foods array:
  if (itemOrJson && Array.isArray(itemOrJson.foods)) {
    for (const f of itemOrJson.foods) {
      // capture common name fields
      const names = [f.food_name, f.brand_name, f.brand_name_item_name, f.item_name].filter(Boolean);
      if (names.length) parts.push(`NAME: ${names.join(" / ")}`);

      // ingredient statements
      const ing = extractIngredientsFromNutritionixFood(f);
      if (ing) parts.push(`INGREDIENTS: ${ing}`);

      // nutrition nf_ fields
      const nut = extractNutritionFromNutritionixFood(f);
      if (nut && Object.keys(nut).length) {
        const nutParts = Object.keys(nut).map((k) => `${k}: ${nut[k]}`);
        parts.push(`NUTRITION: ${nutParts.join(" | ")}`);
      }

      // fallback: any raw text fields
      const fallbackFields = ["serving_size", "serving_qty", "serving_unit", "serving_weight_grams"];
      for (const ff of fallbackFields) {
        if (f[ff]) parts.push(`${ff}: ${String(f[ff])}`);
      }
    }
    return parts.join("\n\n");
  }

  // If this is a single item (v1 result or single food object)
  const obj = itemOrJson || {};
  const topNames = [obj.brand_name, obj.item_name, obj.food_name, obj.display_name].filter(Boolean);
  if (topNames.length) parts.push(`NAME: ${topNames.join(" / ")}`);

  const ing = extractIngredientsFromNutritionixFood(obj);
  if (ing) parts.push(`INGREDIENTS: ${ing}`);

  const nut = extractNutritionFromNutritionixFood(obj);
  if (nut && Object.keys(nut).length) {
    const nutParts = Object.keys(nut).map((k) => `${k}: ${nut[k]}`);
    parts.push(`NUTRITION: ${nutParts.join(" | ")}`);
  }

  if (obj.ingredient_statement) parts.push(`INGREDIENT_STATEMENT: ${obj.ingredient_statement}`);
  if (obj.ingredients_text) parts.push(`INGREDIENTS_TEXT: ${obj.ingredients_text}`);

  return parts.join("\n\n");
}

/* --------------------
   External providers (structured)
   Each returns:
   { ok: boolean, provider: 'name', productName?, ingredientsText?, nutrition?, raw?, note? }
   -------------------- */

/* --------------------
   OpenFoodFacts
   -------------------- */
async function tryOpenFoodFacts(upcCandidate) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upcCandidate)}.json`;
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 8000);
    if (!resp.ok) return { ok: false, provider: "openfoodfacts", status: resp.status };
    const json = await resp.json();
    if (!json || json.status !== 1 || !json.product) return { ok: false, provider: "openfoodfacts", raw: json };
    const p = json.product;
    const productName = p.product_name || p.generic_name || p.product_name_en || null;

    let ingredientsText = p.ingredients_text || p.ingredients_text_en || "";
    if (!ingredientsText && Array.isArray(p.ingredients)) {
      ingredientsText = p.ingredients.map((i) => i?.text).filter(Boolean).join(", ");
    }
    if (!ingredientsText && p.ingredients_from_or_that_may_be_from_palm_oil) {
      ingredientsText = p.ingredients_from_or_that_may_be_from_palm_oil;
    }

    const nutrition = p.nutriments || null;

    const ok = !!(ingredientsText || nutrition);
    return {
      ok,
      provider: "openfoodfacts",
      productName,
      ingredientsText: (ingredientsText || "").trim() || null,
      nutrition,
      raw: p,
    };
  } catch (err) {
    return { ok: false, provider: "openfoodfacts", error: String(err) };
  }
}

/* --------------------
   Nutritionix Combined (v2 + v1)
   Returns combined object with v2 and v1 raw responses and merged fields.
   Always returns any data found from Nutritionix so the main loop can merge.
   -------------------- */
async function tryNutritionix(upcCandidate) {
  const appId =
    process.env.NUTRITIONIX_APP_ID ||
    process.env.NUTRITIONIX_APPID ||
    null;
  const appKey =
    process.env.NUTRITIONIX_APP_KEY ||
    process.env.NUTRITIONIX_APP_KEY ||
    null;

  if (!appId || !appKey) return { ok: false, provider: "nutritionix", reason: "no-api-key" };

  try {
    let v2Json = null;
    let v1Json = null;
    let rawTextV2 = "";
    let rawTextV1 = "";
    let productName = null;
    let mergedNutrition = {};
    let explicitIngredients = null;

    // ---- v2 attempt ----
    try {
      const url = `https://trackapi.nutritionix.com/v2/search/item`;
      const resp = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-id": appId,
            "x-app-key": appKey,
          },
          body: JSON.stringify({ upc: String(upcCandidate) }),
        },
        9000
      );

      if (resp.ok) {
        v2Json = await resp.json();
        rawTextV2 = flattenNutritionixRawToText(v2Json);
        if (Array.isArray(v2Json.foods) && v2Json.foods.length) {
          const f = v2Json.foods[0];
          productName = productName || (f.food_name || f.brand_name || f.item_name || null);
          mergedNutrition = { ...mergedNutrition, ...extractNutritionFromNutritionixFood(f) };
          explicitIngredients =
            explicitIngredients ||
            f.ingredient_statement ||
            f.nf_ingredient_statement ||
            f.ingredients_text ||
            null;
        }
      }
    } catch (v2err) {
      console.warn("[/api/check] Nutritionix v2 error:", String(v2err));
    }

    // ---- v1 fallback ----
    try {
      const urlV1 = `https://api.nutritionix.com/v1_1/item?upc=${encodeURIComponent(String(upcCandidate))}&appId=${encodeURIComponent(
        appId
      )}&appKey=${encodeURIComponent(appKey)}`;
      const respV1 = await fetchWithTimeout(urlV1, { method: "GET", headers: { Accept: "application/json" } }, 9000);
      if (respV1.ok) {
        v1Json = await respV1.json();
        rawTextV1 = flattenNutritionixRawToText(v1Json) || "";
        productName = productName || (v1Json.brand_name ? `${v1Json.brand_name} - ${v1Json.item_name || ""}`.trim() : v1Json.item_name || null);

        // Extract v1 nutrition fields
        for (const k of Object.keys(v1Json || {})) {
          if (k.startsWith("nf_")) mergedNutrition[k.replace(/^nf_/, "")] = v1Json[k];
        }

        explicitIngredients =
          explicitIngredients ||
          v1Json.ingredient_statement ||
          v1Json.nf_ingredient_statement ||
          v1Json.ingredients_text ||
          null;
      }
    } catch (v1err) {
      console.warn("[/api/check] Nutritionix v1 error:", String(v1err));
    }

    const combinedText = [rawTextV1, rawTextV2].filter(Boolean).join("\n\n--- Nutritionix Combined ---\n\n");

    const combinedData = {
      ok: !!(v1Json || v2Json),
      provider: "nutritionix",
      productName: productName || null,
      // prefer explicit ingredient statements if present, otherwise provide flattened combined text
      ingredientsText: explicitIngredients || (combinedText ? combinedText : null),
      nutrition: mergedNutrition && Object.keys(mergedNutrition).length ? mergedNutrition : null,
      raw: { v1: v1Json || null, v2: v2Json || null },
      note: !v1Json && !v2Json ? "no-response-from-nutritionix" : "nutritionix-v1-v2-combined",
    };

    return combinedData;
  } catch (err) {
    return { ok: false, provider: "nutritionix", error: String(err) };
  }
}

/* --------------------
   USDA
   -------------------- */
async function tryUSDA(upcCandidate) {
  try {
    const key = process.env.USDA_API_KEY;
    if (!key) return { ok: false, provider: "usda", reason: "no-api-key" };
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(String(upcCandidate))}&api_key=${encodeURIComponent(
      key
    )}&pageSize=5`;
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 9000);
    if (!resp.ok) return { ok: false, provider: "usda", status: resp.status };
    const json = await resp.json();
    if (!json || !Array.isArray(json.foods) || json.foods.length === 0) return { ok: false, provider: "usda", raw: json };
    const foods = json.foods;
    const ingredientTexts = foods.map((f) => f.ingredients || f.foodDescription || f.description || "").filter(Boolean);
    const ingredientsText = ingredientTexts.join(" ").trim() || null;

    const nutrition = {};
    for (const f of foods) {
      if (Array.isArray(f.foodNutrients)) {
        for (const n of f.foodNutrients) {
          const name = (n.nutrientName || n.name || n.nutrient || "").toString();
          if (!name) continue;
          const value = n.value ?? n.amount ?? null;
          const unit = n.unitName || n.unit || n.unit_name || "";
          if (value !== null && value !== undefined) {
            if (!nutrition[name]) nutrition[name] = { value, unit };
          }
        }
      }
    }

    const productName = foods.map((f) => f.description || f.foodName || "").filter(Boolean)[0] || null;

    return {
      ok: !!(ingredientsText || Object.keys(nutrition).length),
      provider: "usda",
      productName,
      ingredientsText,
      nutrition: Object.keys(nutrition).length ? nutrition : null,
      raw: json,
    };
  } catch (err) {
    return { ok: false, provider: "usda", error: String(err) };
  }
}

/* --------------------
   FoodRepo
   -------------------- */
async function tryFoodRepo(upcCandidate) {
  try {
    const key = process.env.FOODREPO_API_KEY;
    if (!key) return { ok: false, provider: "foodrepo", reason: "no-api-key" };
    const url = `https://www.foodrepo.org/api/v3/products/${encodeURIComponent(String(upcCandidate))}`;
    const resp = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Authorization: `Token token=${key}` } },
      9000
    );
    if (!resp.ok) return { ok: false, provider: "foodrepo", status: resp.status };
    const json = await resp.json();
    const attrs = json?.data?.attributes || {};
    const ingredientsText = attrs.ingredients_text || attrs.ingredients || null;
    const nutrition = attrs.nutritional_values || attrs.nutriments || null;
    const productName = attrs.name || attrs.display_name || null;
    return {
      ok: !!(ingredientsText || nutrition),
      provider: "foodrepo",
      productName,
      ingredientsText,
      nutrition,
      raw: json,
    };
  } catch (err) {
    return { ok: false, provider: "foodrepo", error: String(err) };
  }
}

/* --------------------
   Main handler
   -------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  // no-cache headers
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const body = req.body || {};
    let { text, barcode, ocrText, labelImage } = body;

    // prefer explicit 'text' or 'ocrText' if provided
    text = (text || ocrText || "").trim();

    // determine barcode flow
    const isBarcodeFlowFlag = Boolean(body.isBarcodeFlow === true);
    const isBarcodeFlow = isBarcodeFlowFlag || (barcode !== undefined && barcode !== null);
    const barcodeRaw = barcode !== undefined && barcode !== null ? String(barcode) : null;

    const debug = {
      isBarcodeFlow,
      isBarcodeFlowFlag,
      barcodeOriginal: barcodeRaw,
      candidates: [],
      externalAttempts: [],
      fetchedFrom: null,
      fetchedCandidate: null,
      fetchedTextPreview: null,
      fetchedProductName: null,
      fetchedNutritionPreview: null,
      airtable: {
        bannedConfigured: Boolean(bannedBase && process.env.BANNED_TABLE_NAME),
        ingredientsConfigured: Boolean(ingredientsBase && process.env.INGREDIENT_TABLE_NAME),
      },
    };

    // structured result holder
    let structured = {
      productName: null,
      ingredientsText: text || null, // if UI passed text already, take that first
      nutrition: null,
      rawProvider: null,
      providerName: null,
      rawNutritionix: null,
      rawText: text || "",
    };

    if (isBarcodeFlow && barcodeRaw) {
      console.log("[/api/check] Raw barcode:", barcodeRaw);

      const digitsOnly = String(barcodeRaw).replace(/\D/g, "");
      if (!digitsOnly) {
        debug.error = "barcode contains no digits after stripping non-digits";
        console.warn("[/api/check] barcode contains no digits, aborting:", barcodeRaw);
        return res.status(400).json({ error: "Barcode contains no digits", debug });
      }

      const candidates = generateBarcodeCandidates(barcodeRaw);
      debug.candidates = candidates.slice();
      console.log("[/api/check] Candidates:", debug.candidates);

      // For each candidate, attempt all providers and merge results (Nutritionix v2+v1 captured)
      outer: for (const cand of candidates) {
        console.log("[/api/check] Starting candidate:", cand);

        // per-candidate holder for merging providers for this candidate
        const perCandidate = {
          productName: null,
          ingredientsText: null,
          nutrition: null,
          rawProviders: {},
        };

        const providers = [
          { fn: tryOpenFoodFacts, name: "openfoodfacts" },
          { fn: tryNutritionix, name: "nutritionix" },
          { fn: tryUSDA, name: "usda" },
          { fn: tryFoodRepo, name: "foodrepo" },
        ];

        for (const p of providers) {
          try {
            console.log(`[/api/check] Trying ${p.name} candidate:`, cand);
            const result = await p.fn(cand);

            debug.externalAttempts.push({
              candidate: cand,
              provider: p.name,
              ok: !!(result && result.ok),
              note: result?.reason || result?.status || result?.note || result?.error || null,
            });

            // store raw result for debug/inspection
            perCandidate.rawProviders[p.name] = result?.raw ?? null;

            if (!result) {
              console.log(`[/api/check] ${p.name} returned no object for candidate:`, cand);
              continue;
            }

            // Nutritionix: always capture v1 & v2 combined data if available.
            if (p.name === "nutritionix") {
              structured.rawNutritionix = structured.rawNutritionix || result.raw || null;

              if (result.productName && !perCandidate.productName) perCandidate.productName = result.productName;
              if (result.ingredientsText && !perCandidate.ingredientsText) perCandidate.ingredientsText = result.ingredientsText;
              if (result.nutrition) {
                perCandidate.nutrition = perCandidate.nutrition || {};
                for (const k of Object.keys(result.nutrition || {})) {
                  if (!perCandidate.nutrition[k]) perCandidate.nutrition[k] = result.nutrition[k];
                }
              }

              console.log(`[/api/check] nutritionix produced data for candidate ${cand}: productName=${!!perCandidate.productName}, ingredients=${!!perCandidate.ingredientsText}, nutrition=${!!perCandidate.nutrition}`);
              // Continue to other providers to augment
              continue;
            }

            // For non-nutritionix providers (openfoodfacts/usda/foodrepo), prefer ingredientsText or nutrition
            if (result.productName && !perCandidate.productName) perCandidate.productName = result.productName;
            if (result.ingredientsText && !perCandidate.ingredientsText) perCandidate.ingredientsText = result.ingredientsText;
            if (result.nutrition) {
              perCandidate.nutrition = perCandidate.nutrition || {};
              for (const k of Object.keys(result.nutrition || {})) {
                if (!perCandidate.nutrition[k]) perCandidate.nutrition[k] = result.nutrition[k];
              }
            }

            if (result.ok && (result.ingredientsText || (result.nutrition && Object.keys(result.nutrition).length))) {
              console.log(`[/api/check] ${p.name} returned usable data for candidate:`, cand);
            } else {
              console.log(`[/api/check] ${p.name} returned no useful structured ingredients/nutrition for candidate:`, cand);
            }
          } catch (err) {
            console.error(`[/api/check] Error calling provider ${p.name} for candidate ${cand}:`, err);
            debug.externalAttempts.push({
              candidate: cand,
              provider: p.name,
              ok: false,
              note: String(err),
            });
            // continue to next provider
          }
        } // end providers loop

        // Merge perCandidate into structured (preferring explicit ingredient statements)
        if (perCandidate.productName && !structured.productName) structured.productName = perCandidate.productName;
        if (perCandidate.ingredientsText && !structured.ingredientsText) {
          structured.ingredientsText = perCandidate.ingredientsText;
          structured.rawProvider = structured.rawProvider || (perCandidate.rawProviders && Object.keys(perCandidate.rawProviders).find(k => perCandidate.rawProviders[k]));
          structured.providerName = structured.providerName || "merged";
          if (!debug.fetchedFrom) {
            debug.fetchedFrom = "merged";
            debug.fetchedCandidate = cand;
            debug.fetchedTextPreview = (structured.ingredientsText || "").slice(0, 400);
            debug.fetchedProductName = structured.productName || null;
          }
        }

        // Merge nutrition
        if (perCandidate.nutrition && Object.keys(perCandidate.nutrition).length) {
          structured.nutrition = structured.nutrition || {};
          for (const k of Object.keys(perCandidate.nutrition)) {
            if (!structured.nutrition[k]) structured.nutrition[k] = perCandidate.nutrition[k];
          }
          if (!debug.fetchedFrom) {
            debug.fetchedFrom = "merged-nutrition";
            debug.fetchedCandidate = cand;
            debug.fetchedNutritionPreview = Object.keys(structured.nutrition).slice(0, 10);
          }
        }

        // If we've got ingredientsText OR nutrition now (nutrition qualifies too), stop trying other candidates
        if ((structured.ingredientsText && structured.ingredientsText.trim()) || (structured.nutrition && Object.keys(structured.nutrition).length)) {
          console.log("[/api/check] Found ingredients/raw text or nutrition for candidate:", cand);
          break outer; // stop trying other candidates
        }

        // If no ingredientsText and no nutrition, continue to next candidate
        console.log("[/api/check] Candidate provided no ingredients or nutrition, continuing to next candidate:", cand);
      } // end candidate loop
    } // end barcode flow

    // If we still have no provider-sourced ingredients/nutrition, do NOT run OCR here automatically.
    if (!(structured.ingredientsText && structured.ingredientsText.trim()) && !(structured.nutrition && Object.keys(structured.nutrition).length)) {
      debug.note = debug.note || "no-ingredient-text-or-nutrition-from-providers";
      return res.status(200).json({
        found: false,
        message:
          "We couldn't find product data for that barcode in our databases. Try a clearer photo, check the barcode, or enter the product/ingredients manually.",
        debug,
      });
    }

    // We have ingredient/raw text and/or nutrition — proceed to matching against Airtable (use ingredientsText OR flattened nutritionix text)
    const rawText = String(structured.ingredientsText || structured.rawText || "").trim();
    console.log("[/api/check] Final ingredient/raw text (preview):", rawText.slice(0, 300));

    // Match against Airtable banned + ingredient DBs
    let matchedBanned = [];
    try {
      if (rawText) {
        matchedBanned = await matchAgainstBannedRecords(rawText);
      } else {
        matchedBanned = [];
      }
      debug.totalBannedMatches = matchedBanned.length;
    } catch (err) {
      console.error("[/api/check] Error matching banned records:", err);
      debug.airtableBannedError = String(err?.message || err);
    }

    let matchedIngredients = [];
    try {
      if (rawText) {
        matchedIngredients = await matchAgainstIngredientRecords(rawText);
      } else {
        matchedIngredients = [];
      }
      debug.totalIngredientMatches = matchedIngredients.length;
    } catch (err) {
      console.error("[/api/check] Error matching ingredients DB:", err);
      debug.airtableIngredientError = String(err?.message || err);
      if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME) {
        return res.status(500).json({ error: "Ingredients Airtable not configured (set INGREDIENT_* env vars).", debug });
      }
    }

    // Enrich banned matches using ingredient DB when possible
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
            enriched.fields["Nutrient Antagonism"] || maybe.fields?.["Nutrient Antagonism"] || "";
          return enriched;
        }
        return b;
      });
    }

    // Return success + structured data
    return res.status(200).json({
      found: true,
      // ocrText field preserves ingredient text (or flattened text) for UI highlight
      ocrText: structured.ingredientsText || (structured.rawNutritionix ? flattenNutritionixRawToText(structured.rawNutritionix?.v2 || structured.rawNutritionix?.v1 || {}) : null),
      productName: structured.productName || null,
      ingredientsText: structured.ingredientsText || null,
      nutritionFacts: structured.nutrition || null,
      matchedBanned,
      matchedIngredients,
      debug: {
        ...debug,
        totalBannedMatches: matchedBanned.length,
        totalIngredientMatches: matchedIngredients.length,
      },
    });
  } catch (err) {
    console.error("[/api/check] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
