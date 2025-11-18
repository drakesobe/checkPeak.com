// pages/api/check.js
/**
 * /pages/api/check.js
 *
 * Accepts POST { text?, ocrText?, barcode?, labelImage?, isBarcodeFlow?, userEmail?, scanId? }
 *
 * Behavior:
 *  - Normalize barcode into UPC-A candidate(s).
 *  - For each candidate, query providers in this order:
 *      1) OpenFoodFacts
 *      2) Nutritionix (v2 POST + v1 GET; combine both results)
 *      3) USDA (if configured)
 *      4) FoodRepo (if configured)
 *    For each candidate we attempt all providers and merge their outputs.
 *  - After trying all candidates, we pick the "best" candidate by a score:
 *      score = ingredientsText.length + 50 * nutritionFieldCount
 *    and use that candidate's merged ingredients/nutrition.
 *  - If still no text found for any candidate, DO NOT run OCR automatically.
 *    Return helpful debug.
 *  - If ingredients/nutrition found, match normalized ingredient text
 *    against Airtable banned/ingredient tables (if configured).
 *
 * Also:
 *  - If userEmail is provided and SCANS_* env vars are configured,
 *    we save a row into the Scans Airtable with:
 *      UserEmail, ScanName, ScanDate, StackDetails, ResultsSummary, ID, BannedDetails
 *
 * Response includes:
 *  {
 *    found: boolean,
 *    message?,
 *    ocrText?,
 *    productName?,
 *    ingredientsText?,
 *    nutritionFacts?,
 *    matchedBanned?,
 *    matchedIngredients?,
 *    bannedDetails?: {
 *      ProhibitedCount: number,
 *      LimitedCount: number,
 *      OtherBannedCount: number,
 *      OtherFlagsCount?: number
 *    },
 *    debug
 *  }
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

// Scans DB (for My Scans)
const scansBase =
  process.env.SCANS_API_KEY && process.env.SCANS_BASE_ID
    ? new Airtable({ apiKey: process.env.SCANS_API_KEY }).base(
        process.env.SCANS_BASE_ID
      )
    : null;

async function fetchAllAirtableRecordsUsingClient(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");
  const pageSize = 100;
  const all = await baseInstance(tableName)
    .select({ view: "Grid view", pageSize })
    .all();
  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

/* --------------------
   Helpers: text normalization + matching
   -------------------- */
const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function splitNormalizedTextToTerms(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const cleaned = lower.replace(
    /\b(ma|made|with|contains|ingredients|ingredient|organic)\b/gi,
    " "
  );
  const rawTerms = cleaned.split(
    /[.,;:\/\\\[\]\(\)\{\}"“”‘’<>|@#\$%\^&\*_+=~`·•]/
  );
  return rawTerms
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
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
  const rawRecords = await fetchAllAirtableRecordsUsingClient(
    bannedBase,
    process.env.BANNED_TABLE_NAME
  );
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
          "Substance Name":
            fields["Substance Name"] || fields["Name"] || "",
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
  if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME)
    throw new Error("Ingredients Airtable not configured");
  const normalized = splitNormalizedTextToTerms(ingredientsText).join(" ");
  const raw = await fetchAllAirtableRecordsUsingClient(
    ingredientsBase,
    process.env.INGREDIENT_TABLE_NAME
  );
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
          "Synonyms (Extended)":
            fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          "Pharmacology Notes": fields["Pharmacology Notes"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism":
            fields["Nutrient Antagonism"] || "",
          "Sources / References":
            fields["Sources / References"] || "",
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
  if (!upcaWithoutChecksum || !/^\d{11}$/.test(upcaWithoutChecksum))
    return null;
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
  if (digitsOnly.length === 13 && digitsOnly.startsWith("0"))
    set.add(digitsOnly.substring(1));
  if (
    digitsOnly.length === 6 ||
    digitsOnly.length === 7 ||
    digitsOnly.length === 8
  ) {
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
  possible.push(chosen.ingredient_statement || null);
  possible.push(chosen.nf_ingredient_statement || null);
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
        .map(
          (c) =>
            c.ingredient_statement ||
            c.nf_ingredient_statement ||
            c.ingredients_text ||
            ""
        )
        .filter(Boolean)
        .join(", ")
    );
  }

  // If ingredients is an array of {text}
  if (!possible.some(Boolean) && Array.isArray(chosen.ingredients)) {
    possible.push(
      chosen.ingredients
        .map((i) => (i && i.text) || "")
        .filter(Boolean)
        .join(", ")
    );
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
*/
function flattenNutritionixRawToText(itemOrJson) {
  if (!itemOrJson) return "";
  const parts = [];

  // v2 search style
  if (itemOrJson && Array.isArray(itemOrJson.foods)) {
    for (const f of itemOrJson.foods) {
      const names = [
        f.food_name,
        f.brand_name,
        f.brand_name_item_name,
        f.item_name,
      ].filter(Boolean);
      if (names.length) parts.push(`NAME: ${names.join(" / ")}`);

      const ing = extractIngredientsFromNutritionixFood(f);
      if (ing) parts.push(`INGREDIENTS: ${ing}`);

      const nut = extractNutritionFromNutritionixFood(f);
      if (nut && Object.keys(nut).length) {
        const nutParts = Object.keys(nut).map((k) => `${k}: ${nut[k]}`);
        parts.push(`NUTRITION: ${nutParts.join(" | ")}`);
      }

      const fallbackFields = [
        "serving_size",
        "serving_qty",
        "serving_unit",
        "serving_weight_grams",
      ];
      for (const ff of fallbackFields) {
        if (f[ff]) parts.push(`${ff}: ${String(f[ff])}`);
      }
    }
    return parts.join("\n\n");
  }

  const obj = itemOrJson || {};
  const topNames = [
    obj.brand_name,
    obj.item_name,
    obj.food_name,
    obj.display_name,
  ].filter(Boolean);
  if (topNames.length) parts.push(`NAME: ${topNames.join(" / ")}`);

  const ing = extractIngredientsFromNutritionixFood(obj);
  if (ing) parts.push(`INGREDIENTS: ${ing}`);

  const nut = extractNutritionFromNutritionixFood(obj);
  if (nut && Object.keys(nut).length) {
    const nutParts = Object.keys(nut).map((k) => `${k}: ${nut[k]}`);
    parts.push(`NUTRITION: ${nutParts.join(" | ")}`);
  }

  if (obj.ingredient_statement)
    parts.push(`INGREDIENT_STATEMENT: ${obj.ingredient_statement}`);
  if (obj.ingredients_text)
    parts.push(`INGREDIENTS_TEXT: ${obj.ingredients_text}`);

  return parts.join("\n\n");
}

/* --------------------
   External providers (structured)
   -------------------- */

/* --------------------
   OpenFoodFacts
   -------------------- */
async function tryOpenFoodFacts(upcCandidate) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(
      upcCandidate
    )}.json`;
    const resp = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      8000
    );
    if (!resp.ok)
      return { ok: false, provider: "openfoodfacts", status: resp.status };
    const json = await resp.json();
    if (!json || json.status !== 1 || !json.product)
      return { ok: false, provider: "openfoodfacts", raw: json };
    const p = json.product;
    const productName =
      p.product_name || p.generic_name || p.product_name_en || null;

    let ingredientsText = p.ingredients_text || p.ingredients_text_en || "";
    if (!ingredientsText && Array.isArray(p.ingredients)) {
      ingredientsText = p.ingredients
        .map((i) => i?.text)
        .filter(Boolean)
        .join(", ");
    }
    if (
      !ingredientsText &&
      p.ingredients_from_or_that_may_be_from_palm_oil
    ) {
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
   -------------------- */
async function tryNutritionix(upcCandidate) {
  const appId =
    process.env.NUTRITIONIX_APP_ID || process.env.NUTRITIONIX_APPID || null;
  const appKey =
    process.env.NUTRITIONIX_APP_KEY || process.env.NUTRITIONIX_APP_KEY || null;

  if (!appId || !appKey)
    return { ok: false, provider: "nutritionix", reason: "no-api-key" };

  try {
    let v2Json = null;
    let v1Json = null;
    let rawTextV2 = "";
    let rawTextV1 = "";
    let productName = null;
    let mergedNutrition = {};
    let explicitIngredients = null;

    // v2
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
          productName =
            productName ||
            f.food_name ||
            f.brand_name ||
            f.item_name ||
            null;
          mergedNutrition = {
            ...mergedNutrition,
            ...extractNutritionFromNutritionixFood(f),
          };
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

    // v1
    try {
      const urlV1 = `https://api.nutritionix.com/v1_1/item?upc=${encodeURIComponent(
        String(upcCandidate)
      )}&appId=${encodeURIComponent(appId)}&appKey=${encodeURIComponent(
        appKey
      )}`;
      const respV1 = await fetchWithTimeout(
        urlV1,
        { method: "GET", headers: { Accept: "application/json" } },
        9000
      );
      if (respV1.ok) {
        v1Json = await respV1.json();
        rawTextV1 = flattenNutritionixRawToText(v1Json) || "";
        productName =
          productName ||
          (v1Json.brand_name
            ? `${v1Json.brand_name} - ${v1Json.item_name || ""}`.trim()
            : v1Json.item_name || null);

        for (const k of Object.keys(v1Json || {})) {
          if (k.startsWith("nf_"))
            mergedNutrition[k.replace(/^nf_/, "")] = v1Json[k];
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

    const combinedText = [rawTextV1, rawTextV2]
      .filter(Boolean)
      .join("\n\n--- Nutritionix Combined ---\n\n");

    const combinedData = {
      ok: !!(v1Json || v2Json),
      provider: "nutritionix",
      productName: productName || null,
      ingredientsText: explicitIngredients || (combinedText || null),
      nutrition:
        mergedNutrition && Object.keys(mergedNutrition).length
          ? mergedNutrition
          : null,
      raw: { v1: v1Json || null, v2: v2Json || null },
      note:
        !v1Json && !v2Json
          ? "no-response-from-nutritionix"
          : "nutritionix-v1-v2-combined",
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
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
      String(upcCandidate)
    )}&api_key=${encodeURIComponent(key)}&pageSize=5`;
    const resp = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      9000
    );
    if (!resp.ok)
      return { ok: false, provider: "usda", status: resp.status };
    const json = await resp.json();
    if (!json || !Array.isArray(json.foods) || json.foods.length === 0)
      return { ok: false, provider: "usda", raw: json };
    const foods = json.foods;
    const ingredientTexts = foods
      .map((f) => f.ingredients || f.foodDescription || f.description || "")
      .filter(Boolean);
    const ingredientsText = ingredientTexts.join(" ").trim() || null;

    const nutrition = {};
    for (const f of foods) {
      if (Array.isArray(f.foodNutrients)) {
        for (const n of f.foodNutrients) {
          const name =
            (n.nutrientName || n.name || n.nutrient || "").toString();
          if (!name) continue;
          const value = n.value ?? n.amount ?? null;
          const unit = n.unitName || n.unit || n.unit_name || "";
          if (value !== null && value !== undefined) {
            if (!nutrition[name]) nutrition[name] = { value, unit };
          }
        }
      }
    }

    const productName =
      foods
        .map((f) => f.description || f.foodName || "")
        .filter(Boolean)[0] || null;

    return {
      ok: !!(ingredientsText || Object.keys(nutrition).length),
      provider: "usda",
      productName,
      ingredientsText,
      nutrition:
        Object.keys(nutrition).length ? nutrition : null,
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
    if (!key)
      return { ok: false, provider: "foodrepo", reason: "no-api-key" };
    const url = `https://www.foodrepo.org/api/v3/products/${encodeURIComponent(
      String(upcCandidate)
    )}`;
    const resp = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Authorization: `Token token=${key}` } },
      9000
    );
    if (!resp.ok)
      return { ok: false, provider: "foodrepo", status: resp.status };
    const json = await resp.json();
    const attrs = json?.data?.attributes || {};
    const ingredientsText = attrs.ingredients_text || attrs.ingredients || null;
    const nutrition =
      attrs.nutritional_values || attrs.nutriments || null;
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
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ error: "Method not allowed. Use POST." });

  // no-cache headers
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const body = req.body || {};
    let { text, barcode, ocrText } = body;

    // prefer explicit 'text' or 'ocrText' if provided
    text = (text || ocrText || "").trim();

    // determine barcode flow
    const isBarcodeFlowFlag = Boolean(body.isBarcodeFlow === true);
    const isBarcodeFlow =
      isBarcodeFlowFlag || (barcode !== undefined && barcode !== null);
    const barcodeRaw =
      barcode !== undefined && barcode !== null ? String(barcode) : null;

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
      candidateResults: [],
      airtable: {
        bannedConfigured: Boolean(
          bannedBase && process.env.BANNED_TABLE_NAME
        ),
        ingredientsConfigured: Boolean(
          ingredientsBase && process.env.INGREDIENT_TABLE_NAME
        ),
        scansConfigured: Boolean(
          scansBase && process.env.SCANS_TABLE_NAME
        ),
      },
    };

    // structured result holder
    let structured = {
      productName: null,
      ingredientsText: text || null,
      nutrition: null,
      rawProvider: null,
      providerName: null,
      rawNutritionix: null,
      rawText: text || "",
    };

    // ---------------- BARCODE FLOW: evaluate all candidates, then choose best ----------------
    if (isBarcodeFlow && barcodeRaw) {
      console.log("[/api/check] Raw barcode:", barcodeRaw);

      const digitsOnly = String(barcodeRaw).replace(/\D/g, "");
      if (!digitsOnly) {
        debug.error =
          "barcode contains no digits after stripping non-digits";
        console.warn(
          "[/api/check] barcode contains no digits, aborting:",
          barcodeRaw
        );
        return res
          .status(400)
          .json({ error: "Barcode contains no digits", debug });
      }

      const candidates = generateBarcodeCandidates(barcodeRaw);
      debug.candidates = candidates.slice();
      console.log("[/api/check] Candidates:", debug.candidates);

      let bestCandidate = null;
      let bestScore = -1;

      for (const cand of candidates) {
        console.log("[/api/check] Starting candidate:", cand);

        const perCandidate = {
          candidate: cand,
          productName: null,
          ingredientsText: null,
          nutrition: null,
          rawProviders: {},
          providersOk: {},
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
              note:
                result?.reason ||
                result?.status ||
                result?.note ||
                result?.error ||
                null,
            });

            perCandidate.rawProviders[p.name] = result?.raw ?? null;
            perCandidate.providersOk[p.name] = !!(result && result.ok);

            if (!result) {
              console.log(
                `[/api/check] ${p.name} returned no object for candidate:`,
                cand
              );
              continue;
            }

            if (p.name === "nutritionix") {
              // keep full raw Nutritionix for optional flattening later
              structured.rawNutritionix =
                structured.rawNutritionix || result.raw || null;

              if (result.productName && !perCandidate.productName)
                perCandidate.productName = result.productName;
              if (result.ingredientsText && !perCandidate.ingredientsText)
                perCandidate.ingredientsText = result.ingredientsText;

              if (result.nutrition) {
                perCandidate.nutrition = perCandidate.nutrition || {};
                for (const k of Object.keys(result.nutrition || {})) {
                  if (!perCandidate.nutrition[k])
                    perCandidate.nutrition[k] = result.nutrition[k];
                }
              }

              console.log(
                `[/api/check] nutritionix produced data for candidate ${cand}: productName=${!!perCandidate.productName}, ingredients=${!!perCandidate.ingredientsText}, nutrition=${!!perCandidate.nutrition}`
              );
              // continue to next provider for this candidate (we still want all providers)
              continue;
            }

            // Non-Nutritionix providers: merge in productName / ingredients / nutrition
            if (result.productName && !perCandidate.productName)
              perCandidate.productName = result.productName;
            if (result.ingredientsText && !perCandidate.ingredientsText)
              perCandidate.ingredientsText = result.ingredientsText;
            if (result.nutrition) {
              perCandidate.nutrition = perCandidate.nutrition || {};
              for (const k of Object.keys(result.nutrition || {})) {
                if (!perCandidate.nutrition[k])
                  perCandidate.nutrition[k] = result.nutrition[k];
              }
            }

            if (
              result.ok &&
              (result.ingredientsText ||
                (result.nutrition &&
                  Object.keys(result.nutrition).length))
            ) {
              console.log(
                `[/api/check] ${p.name} returned usable data for candidate:`,
                cand
              );
            } else {
              console.log(
                `[/api/check] ${p.name} returned no useful structured ingredients/nutrition for candidate:`,
                cand
              );
            }
          } catch (err) {
            console.error(
              `[/api/check] Error calling provider ${p.name} for candidate ${cand}:`,
              err
            );
            debug.externalAttempts.push({
              candidate: cand,
              provider: p.name,
              ok: false,
              note: String(err),
            });
          }
        } // end providers loop

        const candidateText = (perCandidate.ingredientsText || "").trim();
        const nutritionFieldCount = perCandidate.nutrition
          ? Object.keys(perCandidate.nutrition).length
          : 0;

        // Heuristic: longer ingredients text + richer nutrition = better
        const score =
          candidateText.length + nutritionFieldCount * 50;

        debug.candidateResults.push({
          candidate: cand,
          hasIngredients: !!candidateText,
          ingredientsLength: candidateText.length,
          nutritionFieldCount,
          score,
          productNamePreview: perCandidate.productName || null,
        });

        if ((candidateText || nutritionFieldCount > 0) && score > bestScore) {
          bestScore = score;
          bestCandidate = perCandidate;
        }
      } // end candidates loop

      if (!bestCandidate) {
        debug.note =
          debug.note || "no-ingredient-text-or-nutrition-from-any-candidate";
        return res.status(200).json({
          found: false,
          message:
            "We couldn't find product data for that barcode in our databases. Try a clearer photo, check the barcode, or enter the product/ingredients manually.",
          debug,
        });
      }

      // Apply the best candidate to our structured output
      debug.fetchedCandidate = bestCandidate.candidate;
      debug.fetchedFrom = "best-candidate";
      debug.fetchedTextPreview = (
        bestCandidate.ingredientsText || ""
      ).slice(0, 400);
      debug.fetchedProductName = bestCandidate.productName || null;

      structured.productName =
        structured.productName || bestCandidate.productName || null;
      structured.ingredientsText =
        structured.ingredientsText ||
        bestCandidate.ingredientsText ||
        null;
      structured.nutrition =
        structured.nutrition || bestCandidate.nutrition || null;
    }
    // ---------------- END BARCODE FLOW ----------------

    // If after barcode logic we still don't have useful data, bail out
    if (
      !(
        structured.ingredientsText &&
        structured.ingredientsText.trim()
      ) &&
      !(
        structured.nutrition &&
        Object.keys(structured.nutrition).length
      )
    ) {
      debug.note =
        debug.note || "no-ingredient-text-or-nutrition-from-providers";
      return res.status(200).json({
        found: false,
        message:
          "We couldn't find product data for that barcode in our databases. Try a clearer photo, check the barcode, or enter the product/ingredients manually.",
        debug,
      });
    }

    const rawText = String(
      structured.ingredientsText || structured.rawText || ""
    ).trim();
    console.log(
      "[/api/check] Final ingredient/raw text (preview):",
      rawText.slice(0, 300)
    );

    // ---------------- Airtable matching ----------------
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
        return res.status(500).json({
          error:
            "Ingredients Airtable not configured (set INGREDIENT_* env vars).",
          debug,
        });
      }
    }

    // Enrich banned matches using ingredient DB when possible
    if (matchedBanned.length && matchedIngredients.length) {
      const ingByName = new Map();
      for (const ing of matchedIngredients) {
        const name = (ing.fields?.["Name"] || "")
          .toString()
          .trim()
          .toLowerCase();
        if (name) ingByName.set(name, ing);
        const syns = (
          ing.fields?.["Synonyms (Extended)"] ||
          ing.fields?.["Synonyms"] ||
          ""
        ).toString();
        syns
          .split(/[;,\/\|\(\)\[\]\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((s) => ingByName.set(s.toLowerCase(), ing));
      }

      matchedBanned = matchedBanned.map((b) => {
        const bName = (b.fields?.["Substance Name"] || "")
          .toString()
          .trim()
          .toLowerCase();
        const maybe = ingByName.get(bName);
        if (maybe) {
          const enriched = { ...b };
          enriched.fields["Benefits"] =
            enriched.fields["Benefits"] || maybe.fields?.Benefits || "";
          enriched.fields["Weaknesses"] =
            enriched.fields["Weaknesses"] ||
            maybe.fields?.Weaknesses ||
            "";
          enriched.fields["Nutrient Antagonism"] =
            enriched.fields["Nutrient Antagonism"] ||
            maybe.fields?.["Nutrient Antagonism"] ||
            "";
          return enriched;
        }
        return b;
      });
    }

    // ---- Compute banned counts for BannedDetails ----
    let prohibitedCount = 0;
    let limitedCount = 0;
    let otherBannedCount = 0;

    for (const b of matchedBanned) {
      const banTypeRaw = (b.fields?.["Ban Type"] || "")
        .toString()
        .toLowerCase();

      if (!banTypeRaw) {
        otherBannedCount += 1;
        continue;
      }

      if (
        banTypeRaw.includes("prohibited") ||
        banTypeRaw.includes("in-competition") ||
        banTypeRaw.includes("banned")
      ) {
        prohibitedCount += 1;
      } else if (
        banTypeRaw.includes("limited") ||
        banTypeRaw.includes("out of competition") ||
        banTypeRaw.includes("threshold")
      ) {
        limitedCount += 1;
      } else {
        otherBannedCount += 1;
      }
    }

    const bannedDetails = {
      ProhibitedCount: prohibitedCount,
      LimitedCount: limitedCount,
      OtherBannedCount: otherBannedCount,
    };

    // ------------- Save to Scans Airtable if userEmail is provided -------------
    if (body.userEmail && scansBase && process.env.SCANS_TABLE_NAME) {
      try {
        const now = new Date();
        const scanId = body.scanId || `scan-${now.getTime()}`;

        const scanName = structured.productName
          ? `${structured.productName} (${now.toLocaleString("en-US", {
              hour12: false,
            })})`
          : `Scan - ${now.toLocaleString("en-US", { hour12: false })}`;

        const recordPayload = {
          UserEmail: body.userEmail,
          ScanName: scanName,
          ScanDate: now.toISOString(),
          StackDetails:
            structured.ingredientsText ||
            rawText ||
            "No ingredient or label text captured",
          ResultsSummary: `Prohibited: ${bannedDetails.ProhibitedCount}, Limited: ${bannedDetails.LimitedCount}, Other: ${bannedDetails.OtherBannedCount}`,
          ID: scanId,
          BannedDetails: JSON.stringify(bannedDetails),
        };

        console.log(
          "[/api/check] Saving scan record to Scans Airtable:",
          JSON.stringify(recordPayload, null, 2)
        );

        await scansBase(process.env.SCANS_TABLE_NAME).create([
          { fields: recordPayload },
        ]);

        debug.scansSaveSuccess = true;
      } catch (err) {
        console.error(
          "[/api/check] Failed to save scan to Scans Airtable:",
          err
        );
        debug.scansSaveError = String(err?.message || err);
      }
    } else {
      if (!body.userEmail) {
        debug.scansSaveSkipped = "No userEmail provided in request body";
      } else if (!scansBase || !process.env.SCANS_TABLE_NAME) {
        debug.scansSaveSkipped = "Scans Airtable not configured";
      }
    }
    // ---------------------------------------------------------------------------

    // Return success + structured data
    return res.status(200).json({
      found: true,
      ocrText:
        structured.ingredientsText ||
        (structured.rawNutritionix
          ? flattenNutritionixRawToText(
              structured.rawNutritionix?.v2 ||
                structured.rawNutritionix?.v1 ||
                {}
            )
          : null),
      productName: structured.productName || null,
      ingredientsText: structured.ingredientsText || null,
      nutritionFacts: structured.nutrition || null,
      matchedBanned,
      matchedIngredients,
      bannedDetails, // summarized counts for saving/display
      debug: {
        ...debug,
        totalBannedMatches: matchedBanned.length,
        totalIngredientMatches: matchedIngredients.length,
      },
    });
  } catch (err) {
    console.error("[/api/check] Unexpected error:", err);
    return res
      .status(500)
      .json({
        error: "Internal server error",
        details: String(err?.message || err),
      });
  }
}
