// pages/api/barcode.js
/**
 * Barcode endpoint (GET or POST)
 *
 * - GET  /api/barcode?barcode=012345...
 * - POST /api/barcode  { barcode, labelImage? }
 *
 * Returns:
 * {
 *   ocrText: "<ingredients text>",
 *   matchedBanned: [...],
 *   matchedIngredients: [...],
 *   debug: { ... }
 * }
 *
 * Requires environment variables:
 * - INGREDIENT_API_KEY, INGREDIENT_BASE_ID, INGREDIENT_TABLE_NAME
 * - (optional) BANNED_API_KEY, BANNED_BASE_ID, BANNED_TABLE_NAME
 * - (optional) USDA_API_KEY, FOODREPO_API_KEY
 *
 * Notes:
 * - This implementation pages through Airtable on each request (suitable for modest table sizes).
 * - If you rename Airtable fields later, update the returned fields mapping below.
 */

import Airtable from "airtable";
import Tesseract from "tesseract.js";

const DEFAULT_FETCH_TIMEOUT = 10000;
const fetchWithTimeout = async (url, opts = {}, timeout = DEFAULT_FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
};

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Airtable clients (ingredientsBase required)
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
  // pageSize 100 should be fine for moderate tables
  const records = await baseInstance(tableName).select({ view: "Grid view", pageSize: 100 }).all();
  return records.map((r) => ({ id: r.id, fields: r.fields }));
}

/* -------------------------
   External lookups
   ------------------------- */
async function fetchOFFIngredients(barcode) {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 8000);
    if (!resp.ok) return { text: "", ok: false, status: resp.status };
    const json = await resp.json();
    if (!json || json.status !== 1 || !json.product) return { text: "", ok: false, raw: json || null };
    const p = json.product;
    const ingredText =
      p.ingredients_text_en ||
      p.ingredients_text ||
      (Array.isArray(p.ingredients) ? p.ingredients.map((i) => i?.text).filter(Boolean).join(", ") : "") ||
      "";
    return { text: ingredText || "", ok: true, raw: p, source: "openfoodfacts" };
  } catch (err) {
    return { text: "", ok: false, error: String(err) };
  }
}

async function fetchUSDAIngredients(barcode) {
  try {
    if (!process.env.USDA_API_KEY) return { text: "", ok: false, reason: "no-api-key" };
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
      String(barcode)
    )}&api_key=${process.env.USDA_API_KEY}&pageSize=5`;
    const resp = await fetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 9000);
    if (!resp.ok) return { text: "", ok: false, status: resp.status };
    const json = await resp.json();
    if (!json || !Array.isArray(json.foods) || json.foods.length === 0) return { text: "", ok: false, raw: json };
    const ingreds = json.foods.map((f) => f.ingredients || f.foodDescription || f.description || "").filter(Boolean).join(" ");
    return { text: ingreds || "", ok: true, raw: json, source: "usda" };
  } catch (err) {
    return { text: "", ok: false, error: String(err) };
  }
}

async function fetchFoodRepoIngredients(barcode) {
  try {
    if (!process.env.FOODREPO_API_KEY) return { text: "", ok: false, reason: "no-api-key" };
    const url = `https://www.foodrepo.org/api/v3/products/${encodeURIComponent(barcode)}`;
    const resp = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Authorization: `Token token=${process.env.FOODREPO_API_KEY}` } },
      9000
    );
    if (!resp.ok) return { text: "", ok: false, status: resp.status };
    const json = await resp.json();
    const text = json?.data?.attributes?.ingredients_text || "";
    return { text: text || "", ok: true, raw: json, source: "foodrepo" };
  } catch (err) {
    return { text: "", ok: false, error: String(err) };
  }
}

// OCR fallback
async function runOCROnImage(imageUrlOrData) {
  try {
    const { data } = await Tesseract.recognize(String(imageUrlOrData || ""), "eng", { logger: () => {} });
    return { text: data?.text || "", ok: true };
  } catch (err) {
    return { text: "", ok: false, error: String(err) };
  }
}

/* -------------------------
   Matching helpers (aligned to your Airtable schema)
   ------------------------- */
function recordTerms(fields = {}, primaryFields = ["Name"]) {
  // Build a set of candidate terms: Name + split pieces + synonyms (Synonyms (Extended) and Synonyms)
  const terms = new Set();

  for (const key of primaryFields) {
    const v = fields?.[key];
    if (!v) continue;
    const str = String(v).trim();
    if (str) terms.add(str);
    // also split on common separators to capture pieces
    str
      .split(/[;,\/\|\(\)\[\]\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => terms.add(p));
  }

  // Synonym columns (match your sheet)
  const synonymCols = ["Synonyms (Extended)", "Synonyms"];
  for (const col of synonymCols) {
    const v = fields?.[col];
    if (!v) continue;
    String(v)
      .split(/[;,\/\|\(\)\[\]\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => terms.add(p));
  }

  // Return normalized (lowercased) terms
  return Array.from(terms).map((t) => String(t).toLowerCase());
}

function termInText(term = "", normalizedText = "") {
  if (!term) return false;
  if (term.length < 2) return false;
  if (/^[0-9]+$/.test(term)) return false; // skip purely numeric tokens
  try {
    const rx = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
    return rx.test(normalizedText);
  } catch {
    return normalizedText.includes(term.toLowerCase());
  }
}

/* -------------------------
   Airtable matching functions
   ------------------------- */
async function matchAgainstBannedRecords(ingredientsText) {
  if (!bannedBase || !process.env.BANNED_TABLE_NAME) return [];
  const normalized = String(ingredientsText || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").toLowerCase();
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
  if (!ingredientsBase) throw new Error("Ingredients Airtable base not configured (INGREDIENT_API_KEY/INGREDIENT_BASE_ID)");
  if (!process.env.INGREDIENT_TABLE_NAME) throw new Error("INGREDIENT_TABLE_NAME env var missing");

  const normalized = String(ingredientsText || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  const raw = await fetchAllAirtableRecordsUsingClient(ingredientsBase, process.env.INGREDIENT_TABLE_NAME);

  const matches = [];
  for (const rec of raw) {
    const fields = rec.fields || {};
    // Use "Name" as the primary field (matches your sheet)
    const candidates = recordTerms(fields, ["Name"]);
    const matchedTerms = [];
    for (const t of candidates) {
      if (termInText(t, normalized)) matchedTerms.push(t);
    }

    if (matchedTerms.length > 0) {
      matches.push({
        id: rec.id,
        fields: {
          Name: fields["Name"] || "",
          PubChemCID: fields["PubChemCID"] || "", // matches your column name
          "Synonyms (Extended)": fields["Synonyms (Extended)"] || fields["Synonyms"] || "",
          "Pharmacology Notes": fields["Pharmacology Notes"] || "",
          Benefits: fields["Benefits"] || "",
          Weaknesses: fields["Weaknesses"] || "",
          "Nutrient Antagonism": fields["Nutrient Antagonism"] || fields["Nutrient Antagonisms"] || "",
          "Sources / References": fields["Sources / References"] || fields["Source"] || "",
        },
        matchedTerms,
      });
    }
  }

  return matches;
}

/* -------------------------
   Handler
   ------------------------- */
export default async function handler(req, res) {
  try {
    const method = (req.method || "GET").toUpperCase();
    let barcode = null;
    let labelImage = null;

    if (method === "GET") {
      barcode = req.query?.barcode ? String(req.query.barcode).trim() : null;
    } else if (method === "POST") {
      const body = req.body || {};
      barcode = body.barcode ? String(body.barcode).trim() : null;
      labelImage = body.labelImage || null;
    } else {
      return res.status(405).json({ error: "Method not allowed. Use GET or POST." });
    }

    if (!barcode) {
      return res.status(400).json({ error: "Missing 'barcode' parameter. Use ?barcode= or POST { barcode }." });
    }

    const debug = {
      barcode,
      attempts: [],
      airtable: {
        bannedConfigured: Boolean(bannedBase && process.env.BANNED_TABLE_NAME),
        ingredientsConfigured: Boolean(ingredientsBase && process.env.INGREDIENT_TABLE_NAME),
      },
    };

    // 1) external lookups: OFF -> USDA -> FoodRepo
    let ingredientText = "";

    const off = await fetchOFFIngredients(barcode);
    debug.attempts.push({ provider: "openfoodfacts", ok: !!off.ok, source: off.source || null, status: off.status || null });
    if (off.ok && off.text && off.text.trim().length > 0) {
      ingredientText = off.text;
      debug.fetchedFrom = "openfoodfacts";
    } else {
      const usda = await fetchUSDAIngredients(barcode);
      debug.attempts.push({ provider: "usda", ok: !!usda.ok, reason: usda.reason || null });
      if (usda.ok && usda.text && usda.text.trim().length > 0) {
        ingredientText = usda.text;
        debug.fetchedFrom = "usda";
      } else {
        const fr = await fetchFoodRepoIngredients(barcode);
        debug.attempts.push({ provider: "foodrepo", ok: !!fr.ok, reason: fr.reason || null });
        if (fr.ok && fr.text && fr.text.trim().length > 0) {
          ingredientText = fr.text;
          debug.fetchedFrom = "foodrepo";
        } else if (labelImage) {
          const ocrRes = await runOCROnImage(labelImage);
          debug.attempts.push({ provider: "ocr-fallback", ok: !!ocrRes.ok, error: ocrRes.error || null });
          if (ocrRes.ok && ocrRes.text && ocrRes.text.trim().length > 0) {
            ingredientText = ocrRes.text;
            debug.fetchedFrom = "ocr-fallback";
          }
        }
      }
    }

    if (!ingredientText || !String(ingredientText).trim()) {
      // nothing found externally
      return res.status(404).json({ error: "No ingredient text found for barcode via external providers or OCR.", debug });
    }

    // Normalize raw text for logging & matching
    const rawText = String(ingredientText).trim();
    const normalizedText = rawText.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").toLowerCase();

    console.log("[/api/barcode] raw ingredient text (first 300 chars):", rawText.slice(0, 300));

    // Perform Airtable matching
    let matchedBanned = [];
    let matchedIngredients = [];

    try {
      matchedBanned = await matchAgainstBannedRecords(rawText);
      debug.bannedMatches = matchedBanned.length;
    } catch (err) {
      debug.bannedError = String(err?.message || err);
      console.warn("[/api/barcode] banned match error:", err);
    }

    try {
      matchedIngredients = await matchAgainstIngredientRecords(rawText);
      debug.ingredientMatches = matchedIngredients.length;
    } catch (err) {
      debug.ingredientError = String(err?.message || err);
      console.error("[/api/barcode] ingredient match error:", err);
      // If ingredients base missing, give actionable error
      if (!ingredientsBase || !process.env.INGREDIENT_TABLE_NAME) {
        return res.status(500).json({ error: "Ingredients Airtable not configured (set INGREDIENT_* env vars).", debug });
      }
    }

    // Return normalized shape
    return res.status(200).json({
      ocrText: rawText,
      matchedBanned,
      matchedIngredients,
      debug,
    });
  } catch (err) {
    console.error("[/api/barcode] unexpected error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
