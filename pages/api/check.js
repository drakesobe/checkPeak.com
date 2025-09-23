// pages/api/check.js
/**
 * pages/api/check.js
 *
 * Flow:
 *  - Accepts POST { text?, ocrText?, barcode?, labelImage? }
 *  - If barcode: attempt OpenFoodFacts -> USDA -> FoodRepo -> OCR(labelImage)
 *  - Normalize text and:
 *     1) Match against BANNED Airtable (Substance Name, Synonyms, etc.)
 *     2) THEN match against INGREDIENT Airtable (Name, Synonyms (Extended), etc.)
 *  - Return { ocrText, matchedBanned, matchedIngredients, debug }
 *
 * Env expected:
 *  - BANNED_API_KEY, BANNED_BASE_ID, BANNED_TABLE_NAME   (banned optional)
 *  - INGREDIENT_API_KEY, INGREDIENT_BASE_ID, INGREDIENT_TABLE_NAME (required)
 *  - USDA_API_KEY (optional)
 *  - FOODREPO_API_KEY (optional)
 */

import Airtable from "airtable";
import Tesseract from "tesseract.js";

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

// Safe regex escape
const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Airtable clients
const bannedBase =
  process.env.BANNED_API_KEY && process.env.BANNED_BASE_ID
    ? new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(process.env.BANNED_BASE_ID)
    : null;

const ingredientsBase =
  process.env.INGREDIENT_API_KEY && process.env.INGREDIENT_BASE_ID
    ? new Airtable({ apiKey: process.env.INGREDIENT_API_KEY }).base(process.env.INGREDIENT_BASE_ID)
    : null;

/* ---------------------------
   Fetch all Airtable records helper
   --------------------------- */
async function fetchAllAirtableRecordsUsingClient(baseInstance, tableName) {
  if (!baseInstance) throw new Error("Airtable base instance not configured");
  if (!tableName) throw new Error("Table name required");
  const pageSize = 100;
  const all = await baseInstance(tableName).select({ view: "Grid view", pageSize }).all();
  return all.map((r) => ({ id: r.id, fields: r.fields }));
}

/* ---------------------------
   External product lookups (barcode)
   --------------------------- */
async function fetchOFFIngredients(barcode) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 8000);
    if (!resp.ok) return { text: "", raw: null, source: "openfoodfacts", ok: false, status: resp.status };
    const json = await resp.json();
    if (!json || json.status !== 1 || !json.product) {
      return { text: "", raw: json || null, source: "openfoodfacts", ok: false, status: resp.status };
    }
    const p = json.product;
    const ingredText =
      p.ingredients_text_en ||
      p.ingredients_text ||
      (Array.isArray(p.ingredients) ? p.ingredients.map((i) => i?.text).filter(Boolean).join(", ") : "") ||
      "";
    return { text: ingredText || "", raw: p, source: "openfoodfacts", ok: true, status: resp.status };
  } catch (err) {
    return { text: "", raw: String(err?.message || err), source: "openfoodfacts", ok: false, error: String(err) };
  }
}

async function fetchUSDAIngredients(barcode) {
  try {
    const USDA_KEY = process.env.USDA_API_KEY;
    if (!USDA_KEY) return { text: "", source: "usda", ok: false, reason: "no-api-key" };
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
      String(barcode)
    )}&api_key=${USDA_KEY}&pageSize=5`;
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 9000);
    if (!resp.ok) return { text: "", raw: null, source: "usda", ok: false, status: resp.status };
    const json = await resp.json();
    if (!json || !Array.isArray(json.foods) || json.foods.length === 0) {
      return { text: "", raw: json || null, source: "usda", ok: false };
    }
    const foods = json.foods;
    const ingreds = foods.map((f) => f.ingredients || f.foodDescription || f.description || "").filter(Boolean).join(" ");
    return { text: ingreds || "", raw: foods, source: "usda", ok: true };
  } catch (err) {
    return { text: "", raw: String(err?.message || err), source: "usda", ok: false, error: String(err) };
  }
}

async function fetchFoodRepoIngredients(barcode) {
  try {
    if (!process.env.FOODREPO_API_KEY) return { text: "", source: "foodrepo", ok: false, reason: "no-api-key" };
    const url = `https://www.foodrepo.org/api/v3/products/${encodeURIComponent(barcode)}`;
    const resp = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Authorization: `Token token=${process.env.FOODREPO_API_KEY}` } },
      9000
    );
    if (!resp.ok) return { text: "", raw: null, source: "foodrepo", ok: false, status: resp.status };
    const json = await resp.json();
    const text = json?.data?.attributes?.ingredients_text || "";
    return { text: text || "", raw: json, source: "foodrepo", ok: true };
  } catch (err) {
    return { text: "", raw: String(err?.message || err), source: "foodrepo", ok: false, error: String(err) };
  }
}

/* ---------------------------
   OCR fallback using Tesseract
   --------------------------- */
async function runOCROnImage(imageUrlOrData) {
  try {
    const { data } = await Tesseract.recognize(String(imageUrlOrData || ""), "eng", {
      logger: () => {},
    });
    return { text: data?.text || "", ok: true };
  } catch (err) {
    return { text: "", ok: false, error: String(err?.message || err) };
  }
}

/* ---------------------------
   Normalize + split ingredient terms
   --------------------------- */
function splitNormalizedTextToTerms(text) {
  if (!text) return [];

  // lowercase
  const lower = text.toLowerCase();

  // remove common filler words/phrases
  const cleaned = lower.replace(/\b(ma|made|with|contains|ingredients|organic)\b/gi, " ");

  // split on commas and other punctuation
  const rawTerms = cleaned.split(/[.,;:\/\\\[\]\(\)\{\}"“”‘’<>|@#\$%\^&\*_+=~`·•]/);

  // trim and filter
  return rawTerms.map((t) => t.trim()).filter((t) => t.length > 1);
}

/* ---------------------------
   Helpers to record + match
   --------------------------- */
function recordTerms(fields = {}, primaryFields = ["Substance Name", "Name", "Ingredient Name"]) {
  const terms = new Set();

  for (const key of primaryFields) {
    const v = fields?.[key];
    if (!v) continue;
    splitNormalizedTextToTerms(String(v)).forEach((t) => terms.add(t));
  }

  // Synonyms
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

/* ---------------------------
   Matching functions
   --------------------------- */
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
          "Synonyms": fields["Synonyms"] || "",
          "Ban Type": fields["Ban Type"] || "",
          "Banned By": fields["Banned By"] || "",
          "Dosage Limit": fields["Dosage Limit"] || "",
          "Notes": fields["Notes"] || "",
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
          "Name": fields["Name"] || fields["Ingredient Name"] || "",
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

/* ---------------------------
   Main handler
   --------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const body = req.body || {};
    let { text, barcode, ocrText, labelImage } = body;

    text = text || ocrText || "";
    const isBarcode = Boolean(barcode);
    const barcodeValue = barcode ? String(barcode).trim() : null;

    const debug = {
      isBarcode,
      barcodeValue: barcodeValue || null,
      fetchedIngredientsSource: null,
      externalAttempts: [],
      airtable: {
        bannedConfigured: Boolean(bannedBase && process.env.BANNED_TABLE_NAME),
        ingredientsConfigured: Boolean(ingredientsBase && process.env.INGREDIENT_TABLE_NAME),
      },
    };

    // External lookups
    if (isBarcode && barcodeValue) {
      const off = await fetchOFFIngredients(barcodeValue);
      debug.externalAttempts.push({ provider: "openfoodfacts", ok: off.ok, source: off.source || null });
      if (off.ok && off.text?.trim()) {
        text = off.text;
        debug.fetchedIngredientsSource = "openfoodfacts";
        debug.off = { ok: true };
      } else {
        const usda = await fetchUSDAIngredients(barcodeValue);
        debug.externalAttempts.push({ provider: "usda", ok: usda.ok, source: usda.source || null, reason: usda.reason || null });
        if (usda.ok && usda.text?.trim()) {
          text = usda.text;
          debug.fetchedIngredientsSource = "usda";
          debug.usda = { ok: true };
        } else {
          const fr = await fetchFoodRepoIngredients(barcodeValue);
          debug.externalAttempts.push({ provider: "foodrepo", ok: fr.ok, source: fr.source || null, reason: fr.reason || null });
          if (fr.ok && fr.text?.trim()) {
            text = fr.text;
            debug.fetchedIngredientsSource = "foodrepo";
            debug.foodrepo = { ok: true };
          } else if (labelImage) {
            const ocrRes = await runOCROnImage(labelImage);
            debug.externalAttempts.push({ provider: "ocr-fallback", ok: ocrRes.ok, error: ocrRes.error || null });
            if (ocrRes.ok && ocrRes.text?.trim()) {
              text = ocrRes.text;
              debug.fetchedIngredientsSource = "ocr-fallback";
              debug.ocrFallback = { ok: true };
            }
          }
        }
      }
    }

    if (!text?.trim()) {
      return res.status(400).json({ error: "No ingredient text available for scanning. Provide 'text' or 'barcode' + (optional) 'labelImage'." });
    }

    const rawText = text.trim();

    let matchedBanned = [];
    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
      debug.totalBannedMatches = matchedBanned.length;
    } catch (err) {
      console.error("Error matching banned:", err);
      debug.airtableBannedError = String(err?.message || err);
    }

    let matchedIngredients = [];
    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
      debug.totalIngredientMatches = matchedIngredients.length;
    } catch (err) {
      console.error("Error matching ingredient DB:", err);
      debug.airtableIngredientError = String(err?.message || err);
      if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME) {
        return res.status(500).json({ error: "Ingredients Airtable not configured (set INGREDIENT_* env vars).", debug });
      }
    }

    // Enrichment: banned -> ingredient
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

    console.log("[/api/check] barcodeFlow:", isBarcode ? "yes" : "no", "rawLen:", rawText.length);
    console.log("[/api/check] matchedBanned:", matchedBanned.map((m) => m.fields?.["Substance Name"] || m.id));
    console.log("[/api/check] matchedIngredients:", matchedIngredients.map((m) => m.fields?.["Name"] || m.id));

    return res.status(200).json({
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
    console.error("Check API Error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
