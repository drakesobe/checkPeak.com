// pages/api/check.js
/**
 * /pages/api/check.js
 *
 * Accepts POST { text?, ocrText?, barcode?, labelImage?, isBarcodeFlow? }
 *
 * Behavior:
 *  - Normalize barcode into UPC-A candidate(s) (handles EAN-13 -> UPC-A,
 *    UPC-E -> UPC-A expansion, 11-digit -> add check digit).
 *  - For each candidate, query providers in this order:
 *      1) OpenFoodFacts
 *      2) Nutritionix (v2 POST, fallback v1_1)
 *      3) USDA (if configured)
 *      4) FoodRepo (if configured)
 *    Stop when a provider returns ingredient text or nutrition data.
 *  - If still no text found, DO NOT run OCR automatically. Instead return
 *    a friendly "no product data found" response with debug so the UI can
 *    present a user-friendly message and options.
 *  - If ingredients/nutrition found, match normalized ingredient text
 *    against Airtable banned/ingredient tables.
 *
 * Response includes:
 *  { found: boolean, message?, ocrText?, productName?, ingredientsText?, nutritionFacts?,
 *    matchedBanned?, matchedIngredients?, debug }
 */

import Airtable from "airtable";
import Tesseract from "tesseract.js"; // retained only if you ever re-add OCR; safe to keep

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

function extractIngredientsFromNutritionixFood(chosen = {}) {
  if (!chosen) return null;

  // Try common fields first (v2 and v1 variations)
  let ingredientsText =
    chosen.nf_ingredient_statement ||
    chosen.ingredient_statement ||
    chosen.ingredients_text ||
    chosen.ingredient_list ||
    chosen.ingredients ||
    "";

  // If ingredients is an array of objects [{text: "..."}], join them
  if (!ingredientsText && Array.isArray(chosen.ingredients)) {
    ingredientsText = chosen.ingredients.map((i) => i?.text).filter(Boolean).join(", ");
  }

  // Some responses may contain nested fields like chosen.food?.ingredients_text
  if (!ingredientsText && chosen?.food && chosen.food.ingredients_text) {
    ingredientsText = chosen.food.ingredients_text;
  }

  return ingredientsText && ingredientsText.trim() ? ingredientsText.trim() : null;
}

function extractIngredientsFromOpenFoodProduct(p = {}) {
  if (!p) return { productName: null, ingredientsText: null, nutrition: null };
  const productName = p.product_name || p.generic_name || p.product_name_en || null;

  let ingredientsText = p.ingredients_text || p.ingredients_text_en || "";
  if (!ingredientsText && Array.isArray(p.ingredients)) {
    ingredientsText = p.ingredients.map((i) => i?.text).filter(Boolean).join(", ");
  }
  if (!ingredientsText && p.ingredients_from_or_that_may_be_from_palm_oil) {
    ingredientsText = p.ingredients_from_or_that_may_be_from_palm_oil;
  }

  const nutrition = p.nutriments || null;

  return { productName, ingredientsText: (ingredientsText || "").trim() || null, nutrition };
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
    const { productName, ingredientsText, nutrition } = extractIngredientsFromOpenFoodProduct(p);
    return {
      ok: !!(ingredientsText || nutrition),
      provider: "openfoodfacts",
      productName,
      ingredientsText,
      nutrition,
      raw: p,
    };
  } catch (err) {
    return { ok: false, provider: "openfoodfacts", error: String(err) };
  }
}

/* --------------------
   Nutritionix (robust extraction + v2/v1 fallback)
   -------------------- */
async function tryNutritionix(upcCandidate) {
  const appId =
    process.env.NUTRITIONIX_APP_ID ||
    process.env.NUTRITIONIX_BASE_ID ||
    process.env.NUTRITIONIX_APPID ||
    process.env.NUTRITIONIX_APP_ID;
  const appKey =
    process.env.NUTRITIONIX_APP_KEY ||
    process.env.NUTRITIONIX_API_KEY ||
    process.env.NUTRITIONIX_APIKEY ||
    process.env.NUTRITIONIX_APP_KEY;

  if (!appId || !appKey) return { ok: false, provider: "nutritionix", reason: "no-api-key" };

  try {
    // Try v2 POST /v2/search/item
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
        const json = await resp.json();
        const foods = Array.isArray(json.foods) ? json.foods : [];
        if (foods.length === 0) {
          return { ok: false, provider: "nutritionix", raw: json, note: "no-foods" };
        }
        // Prefer first food with ingredient statement
        const chosen = foods.find((f) => extractIngredientsFromNutritionixFood(f)) || foods[0];
        const ingredientsText = extractIngredientsFromNutritionixFood(chosen);
        const productName =
          (chosen.food_name || chosen.brand_name || chosen.brand_name_item_name || "").trim() || null;
        const nutrition = extractNutritionFromNutritionixFood(chosen);

        return {
          ok: !!(ingredientsText || Object.keys(nutrition || {}).length),
          provider: "nutritionix",
          productName,
          ingredientsText,
          nutrition: Object.keys(nutrition || {}).length ? nutrition : null,
          raw: json,
        };
      }
    } catch (v2Err) {
      // continue to v1 fallback
    }

    // v1_1 fallback
    try {
      const url = `https://api.nutritionix.com/v1_1/item?upc=${encodeURIComponent(String(upcCandidate))}&appId=${encodeURIComponent(
        appId
      )}&appKey=${encodeURIComponent(appKey)}`;
      const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 9000);
      if (!resp.ok) return { ok: false, provider: "nutritionix", status: resp.status, note: "v1-failed" };
      const json = await resp.json();
      const ingredientsText = extractIngredientsFromNutritionixFood(json);
      const productName = [json.brand_name, json.item_name].filter(Boolean).join(" - ") || null;

      const nutrition = {};
      for (const k of Object.keys(json || {})) {
        if (k.startsWith("nf_")) nutrition[k.replace(/^nf_/, "")] = json[k];
      }

      return {
        ok: !!(ingredientsText || Object.keys(nutrition).length),
        provider: "nutritionix",
        productName,
        ingredientsText,
        nutrition: Object.keys(nutrition).length ? nutrition : null,
        raw: json,
      };
    } catch (v1Err) {
      return { ok: false, provider: "nutritionix", error: String(v1Err) };
    }
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
      ingredientsText: text || null,
      nutrition: null,
      rawProvider: null,
      providerName: null,
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

      // Order: OpenFoodFacts -> Nutritionix -> USDA -> FoodRepo
      for (const cand of candidates) {
        // 1) OpenFoodFacts
        try {
          console.log("[/api/check] Trying OpenFoodFacts candidate:", cand);
          const off = await tryOpenFoodFacts(cand);
          debug.externalAttempts.push({ candidate: cand, provider: "openfoodfacts", ok: !!off.ok, note: off.reason || off.status || off.error || null });
          if (off.ok && (off.ingredientsText || off.nutrition)) {
            structured.productName = off.productName || structured.productName;
            structured.ingredientsText = off.ingredientsText || structured.ingredientsText;
            structured.nutrition = off.nutrition || structured.nutrition;
            structured.rawProvider = off.raw || null;
            structured.providerName = "openfoodfacts";
            debug.fetchedFrom = "openfoodfacts";
            debug.fetchedCandidate = cand;
            debug.fetchedTextPreview = (off.ingredientsText || "").slice(0, 400);
            debug.fetchedProductName = off.productName || null;
            debug.fetchedNutritionPreview = off.nutrition ? Object.keys(off.nutrition).slice(0,10) : null;
            break;
          }
        } catch (e) {
          debug.externalAttempts.push({ candidate: cand, provider: "openfoodfacts", ok: false, note: String(e) });
        }

        // 2) Nutritionix
        try {
          console.log("[/api/check] Trying Nutritionix candidate:", cand);
          const nx = await tryNutritionix(cand);
          debug.externalAttempts.push({ candidate: cand, provider: "nutritionix", ok: !!nx.ok, note: nx.reason || nx.status || nx.note || nx.error || null });
          if (nx.ok && (nx.ingredientsText || nx.nutrition)) {
            structured.productName = nx.productName || structured.productName;
            structured.ingredientsText = nx.ingredientsText || structured.ingredientsText;
            structured.nutrition = nx.nutrition || structured.nutrition;
            structured.rawProvider = nx.raw || null;
            structured.providerName = "nutritionix";
            debug.fetchedFrom = "nutritionix";
            debug.fetchedCandidate = cand;
            debug.fetchedTextPreview = (nx.ingredientsText || "").slice(0, 400);
            debug.fetchedProductName = nx.productName || null;
            debug.fetchedNutritionPreview = nx.nutrition ? Object.keys(nx.nutrition).slice(0,10) : null;
            break;
          }
        } catch (e) {
          debug.externalAttempts.push({ candidate: cand, provider: "nutritionix", ok: false, note: String(e) });
        }

        // 3) USDA
        try {
          console.log("[/api/check] Trying USDA candidate:", cand);
          const usda = await tryUSDA(cand);
          debug.externalAttempts.push({ candidate: cand, provider: "usda", ok: !!usda.ok, note: usda.reason || usda.status || usda.error || null });
          if (usda.ok && (usda.ingredientsText || usda.nutrition)) {
            structured.productName = usda.productName || structured.productName;
            structured.ingredientsText = usda.ingredientsText || structured.ingredientsText;
            structured.nutrition = usda.nutrition || structured.nutrition;
            structured.rawProvider = usda.raw || null;
            structured.providerName = "usda";
            debug.fetchedFrom = "usda";
            debug.fetchedCandidate = cand;
            debug.fetchedTextPreview = (usda.ingredientsText || "").slice(0, 400);
            debug.fetchedProductName = usda.productName || null;
            debug.fetchedNutritionPreview = usda.nutrition ? Object.keys(usda.nutrition).slice(0,10) : null;
            break;
          }
        } catch (e) {
          debug.externalAttempts.push({ candidate: cand, provider: "usda", ok: false, note: String(e) });
        }

        // 4) FoodRepo
        try {
          console.log("[/api/check] Trying FoodRepo candidate:", cand);
          const fr = await tryFoodRepo(cand);
          debug.externalAttempts.push({ candidate: cand, provider: "foodrepo", ok: !!fr.ok, note: fr.reason || fr.status || fr.error || null });
          if (fr.ok && (fr.ingredientsText || fr.nutrition)) {
            structured.productName = fr.productName || structured.productName;
            structured.ingredientsText = fr.ingredientsText || structured.ingredientsText;
            structured.nutrition = fr.nutrition || structured.nutrition;
            structured.rawProvider = fr.raw || null;
            structured.providerName = "foodrepo";
            debug.fetchedFrom = "foodrepo";
            debug.fetchedCandidate = cand;
            debug.fetchedTextPreview = (fr.ingredientsText || "").slice(0, 400);
            debug.fetchedProductName = fr.productName || null;
            debug.fetchedNutritionPreview = fr.nutrition ? Object.keys(fr.nutrition).slice(0,10) : null;
            break;
          }
        } catch (e) {
          debug.externalAttempts.push({ candidate: cand, provider: "foodrepo", ok: false, note: String(e) });
        }
      } // end candidate loop
    } // end barcode flow

    // If we still have no provider-sourced ingredients/nutrition, do NOT run OCR here.
    if (!structured.ingredientsText || !structured.ingredientsText.trim()) {
      // Provide a user-friendly response that the UI can render a helpful message
      debug.note = debug.note || "no-ingredient-text-from-providers";
      // include provider attempt details in debug so frontend can show why (which providers were tried)
      return res.status(200).json({
        found: false,
        message:
          "We couldn't find product data for that barcode in our databases. Try a clearer photo, check the barcode, or enter the product/ingredients manually.",
        debug,
      });
    }

    // We have ingredient text — proceed to matching against Airtable
    const rawText = String(structured.ingredientsText).trim();
    console.log("[/api/check] Final ingredient text (preview):", rawText.slice(0, 300));

    // Match against Airtable banned + ingredient DBs
    let matchedBanned = [];
    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
      debug.totalBannedMatches = matchedBanned.length;
    } catch (err) {
      console.error("[/api/check] Error matching banned records:", err);
      debug.airtableBannedError = String(err?.message || err);
    }

    let matchedIngredients = [];
    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
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
      ocrText: rawText,
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
