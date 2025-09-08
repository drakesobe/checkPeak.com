// pages/api/barcode.js
// Server route: GET or POST /api/barcode?barcode=0123456789012
// Attempts:
//  1) OpenFoodFacts -> get ingredients
//  2) If not found -> USDA FoodData Central (requires USDA_API_KEY in env)
//  3) Match against Airtable banned-list
// Response: { success, source, productName, ingredients, matchedBanned: [...], debug: {...} }

const DEFAULT_TIMEOUT = 10000;

async function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function escapeRegex(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchAllAirtableRecords(baseId, tableId, apiKey) {
  const records = [];
  let offset = undefined;
  const pageSize = 100;

  while (true) {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", String(pageSize));
    if (offset) url.searchParams.set("offset", offset);

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => null);
      throw new Error(`Airtable fetch failed: ${resp.status} ${txt || ""}`);
    }

    const json = await resp.json();
    if (json.records && Array.isArray(json.records)) {
      records.push(...json.records);
    }

    if (json.offset) {
      offset = json.offset;
    } else {
      break;
    }
  }
  return records;
}

async function matchAgainstBanned(ingredientsText) {
  const apiKey = process.env.BANNED_API_KEY;
  const baseId = process.env.BANNED_BASE_ID;
  const tableId = process.env.BANNED_TABLE_NAME;

  if (!apiKey || !baseId || !tableId) {
    throw new Error("Airtable BANNED_* env vars are not set.");
  }

  const normalized = String(ingredientsText || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const airtableRecords = await fetchAllAirtableRecords(baseId, tableId, apiKey);
  const matched = [];

  for (const rec of airtableRecords) {
    const fields = rec.fields || {};
    const name = (fields["Substance Name"] || fields["Name"] || "").toString().trim();
    const synonymsRaw = (fields["Synonyms"] || "").toString();
    const synonyms = synonymsRaw
      .split?.(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];

    const candidates = [name, ...synonyms].map((s) => s.trim()).filter(Boolean);
    const matchedTerms = [];

    for (const term of candidates) {
      if (!term) continue;
      if (term.length < 2) continue;
      if (/^[0-9]+$/.test(term)) continue;

      try {
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
        if (regex.test(normalized)) matchedTerms.push(term);
      } catch (err) {
        if (normalized.includes(term.toLowerCase())) matchedTerms.push(term);
      }
    }

    if (matchedTerms.length > 0) {
      matched.push({
        id: rec.id,
        fields: {
          "Substance Name": name,
          "Synonyms": synonymsRaw,
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

  return matched;
}

export default async function handler(req, res) {
  // Force no-cache so 304 responses don't block fresh data
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const method = req.method || "GET";
    const barcode =
      (method === "GET" ? req.query.barcode : req.body?.barcode) ||
      req.query?.code ||
      req.body?.code;

    if (!barcode || String(barcode).trim().length === 0) {
      return res.status(400).json({ success: false, error: "Missing 'barcode' parameter." });
    }

    const code = String(barcode).trim();

    let productName = null;
    let ingredients = "";
    let nutriments = null;
    let image = null;
    let foundSource = null;
    let debug = { steps: [] };

    // 1️⃣ OpenFoodFacts
    try {
      const offUrl = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
      const offResp = await fetchWithTimeout(offUrl, { method: "GET", headers: { Accept: "application/json" } }, 8000);
      debug.steps.push({ provider: "openfoodfacts", status: offResp.status });

      if (offResp.ok) {
        const offData = await offResp.json().catch(() => null);
        if (offData && offData.status === 1 && offData.product) {
          const product = offData.product;
          productName = product.product_name || product.brands || null;
          ingredients =
            product.ingredients_text_en ||
            product.ingredients_text ||
            (product.ingredients || []).map((i) => i?.text).filter(Boolean).join(", ") ||
            "";
          nutriments = product.nutriments || null;
          image = product.image_ingredients_url || product.image_url || product.image_small_url || null;
          foundSource = "openfoodfacts";
          debug.off = { found: true };
        } else {
          debug.off = { found: false, status: offData?.status ?? null };
        }
      } else {
        debug.off = { found: false, status: offResp.status };
      }
    } catch (offErr) {
      debug.off = { found: false, error: String(offErr?.message || offErr) };
    }

    // 2️⃣ USDA fallback if ingredients empty
    if (!ingredients || String(ingredients).trim().length === 0) {
      try {
        const USDA_KEY = process.env.USDA_API_KEY;
        if (!USDA_KEY) debug.usda = { attempted: false, reason: "USDA API key missing" };
        else {
          const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(code)}&api_key=${USDA_KEY}&pageSize=5`;
          const usdaResp = await fetchWithTimeout(usdaUrl, { method: "GET", headers: { Accept: "application/json" } }, 9000);
          debug.steps.push({ provider: "usda", status: usdaResp.status });

          if (usdaResp.ok) {
            const usdaData = await usdaResp.json().catch(() => null);
            if (usdaData && Array.isArray(usdaData.foods) && usdaData.foods.length > 0) {
              const item = usdaData.foods[0];
              productName = productName || item.description || item.brandOwner || null;
              ingredients = item.ingredients || item.foodDescription || item.description || ingredients || "";
              nutriments = nutriments || item.foodNutrients || null;
              foundSource = foundSource || "usda";
              debug.usda = { found: true, returned: usdaData.foods.length };
            } else debug.usda = { found: false, returned: usdaData?.foods?.length || 0 };
          } else {
            const txt = await usdaResp.text().catch(() => null);
            debug.usda = { found: false, status: usdaResp.status, body: txt };
          }
        }
      } catch (usdaErr) {
        debug.usda = { found: false, error: String(usdaErr?.message || usdaErr) };
      }
    }

    ingredients = (ingredients || "").toString().trim();

    // 3️⃣ Match against Airtable banned list
    let matchedBanned = [];
    try {
      if (ingredients.length > 0) matchedBanned = await matchAgainstBanned(ingredients);
    } catch (airErr) {
      console.error("Airtable matching error:", airErr);
      debug.airtableError = String(airErr?.message || airErr);
    }

    return res.status(200).json({
      success: true,
      source: foundSource || "none",
      productName: productName || null,
      ingredients,
      nutriments,
      image,
      matchedBanned,
      debug,
    });
  } catch (err) {
    console.error("Barcode API overall error:", err);
    return res.status(500).json({ success: false, error: "Internal server error", debug: { message: String(err?.message || err) } });
  }
}
