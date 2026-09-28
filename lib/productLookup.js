// lib/productLookup.js
// Barcode -> product name + ingredient text: CheckPeak's own learned table first, then public product databases.

import { supabaseAdmin as db } from "@/lib/supabase";
import { canonicalGtin } from "@/lib/gtin";

const FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// A UPC-A product is often stored under its 13-digit EAN form (leading 0), so try both.
function barcodeCandidates(canonical) {
  return canonical.length === 12 ? [canonical, "0" + canonical] : [canonical];
}

// ---------------------------------------------------------------------------
// CheckPeak's own barcode table: ingredient lists learned from users' label scans.
// Run supabase/barcode_products_migration.sql once to create it.
// ---------------------------------------------------------------------------

let communityTableMissing = false;

async function communityLookup(code) {
  if (communityTableMissing) return null;
  const { data, error } = await db
    .from("barcode_products")
    .select("product_name, ingredients_text, updated_at")
    .eq("barcode", code)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || /does not exist|schema cache/i.test(error.message || "")) {
      communityTableMissing = true;
      console.warn("[productLookup] barcode_products table missing; run supabase/barcode_products_migration.sql");
    } else {
      console.error("[productLookup] community lookup failed:", error);
    }
    return null;
  }
  if (!data?.ingredients_text) return null;
  return { productName: data.product_name || null, ingredientsText: data.ingredients_text, learnedAt: data.updated_at };
}

// Save an ingredient list read from a label so the next scan of this barcode is instant.
export async function saveCommunityBarcode({ barcode, productName, ingredientsText, email }) {
  const code = canonicalGtin(barcode);
  if (!code || !ingredientsText || !email || communityTableMissing) return false;
  const { error } = await db.from("barcode_products").upsert({
    barcode:          code,
    product_name:     productName || null,
    ingredients_text: ingredientsText,
    source:           "label_scan",
    contributed_by:   email,
    updated_at:       new Date().toISOString(),
  }, { onConflict: "barcode" });
  if (error) {
    console.error("[productLookup] saving barcode failed:", error);
    return false;
  }
  return true;
}

const sameBarcode = (a, b) =>
  String(a || "").replace(/\D/g, "").replace(/^0+/, "") === String(b || "").replace(/\D/g, "").replace(/^0+/, "");

// ---------------------------------------------------------------------------
// Providers: each returns { productName, ingredientsText } or null
// ---------------------------------------------------------------------------

async function openFoodFacts(code) {
  const resp = await fetchWithTimeout(
    `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`,
    { headers: { Accept: "application/json", "User-Agent": "CheckPeak/1.0 (support@checkpeak.com)" } },
  );
  if (!resp.ok) return null;
  const json = await resp.json();
  if (json?.status !== 1 || !json.product) return null;
  const p = json.product;
  let ingredientsText = p.ingredients_text_en || p.ingredients_text || "";
  if (!ingredientsText && Array.isArray(p.ingredients)) {
    ingredientsText = p.ingredients.map((i) => i?.text).filter(Boolean).join(", ");
  }
  return {
    productName: [p.brands, p.product_name || p.generic_name].filter(Boolean).join(" ") || null,
    ingredientsText: ingredientsText.trim() || null,
  };
}

async function nutritionix(code) {
  const appId = process.env.NUTRITIONIX_APP_ID, appKey = process.env.NUTRITIONIX_APP_KEY;
  if (!appId || !appKey) return null;
  const resp = await fetchWithTimeout("https://trackapi.nutritionix.com/v2/search/item", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-id": appId, "x-app-key": appKey },
    body: JSON.stringify({ upc: String(code) }),
  });
  if (!resp.ok) return null;
  const f = (await resp.json())?.foods?.[0];
  if (!f) return null;
  return {
    productName: [f.brand_name, f.food_name].filter(Boolean).join(" ") || null,
    ingredientsText: (f.nf_ingredient_statement || f.ingredient_statement || "").trim() || null,
  };
}

// USDA search is full-text, so only accept results whose GTIN is exactly this barcode.
async function usda(code) {
  const key = process.env.USDA_API_KEY;
  if (!key) return null;
  const resp = await fetchWithTimeout(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(code)}&dataType=Branded&pageSize=10&api_key=${encodeURIComponent(key)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!resp.ok) return null;
  const food = (await resp.json())?.foods?.find((f) => sameBarcode(f.gtinUpc, code));
  if (!food) return null;
  return {
    productName: [food.brandOwner || food.brandName, food.description].filter(Boolean).join(" ") || null,
    ingredientsText: (food.ingredients || "").trim() || null,
  };
}

async function foodRepo(code) {
  const key = process.env.FOODREPO_API_KEY;
  if (!key) return null;
  const resp = await fetchWithTimeout(
    `https://www.foodrepo.org/api/v3/products/${encodeURIComponent(code)}`,
    { headers: { Authorization: `Token token=${key}` } },
  );
  if (!resp.ok) return null;
  const a = (await resp.json())?.data?.attributes;
  if (!a) return null;
  return {
    productName: a.display_name || a.name || null,
    ingredientsText: String(a.ingredients_text || "").trim() || null,
  };
}

const PROVIDERS = [
  { name: "openfoodfacts", fn: openFoodFacts },
  { name: "nutritionix",   fn: nutritionix },
  { name: "usda",          fn: usda },
  { name: "foodrepo",      fn: foodRepo },
];

// Checks CheckPeak's own table, then tries each barcode variant against all public providers in
// parallel, stopping at the first variant that yields an ingredient list.
// Returns { valid: false } if the digits aren't a real barcode.
export async function lookupBarcode(raw) {
  const canonical = canonicalGtin(raw);
  if (!canonical) return { valid: false, found: false };

  const community = await communityLookup(canonical);
  if (community) {
    return { valid: true, found: true, barcode: canonical, provider: "checkpeak", ...community, attempts: [] };
  }

  const attempts = [];
  let nameOnly = null;

  for (const code of barcodeCandidates(canonical)) {
    const results = await Promise.all(PROVIDERS.map(async (p) => {
      try {
        const r = await p.fn(code);
        attempts.push({ code, provider: p.name, ok: !!r?.ingredientsText });
        return r ? { ...r, provider: p.name } : null;
      } catch (err) {
        attempts.push({ code, provider: p.name, ok: false, error: String(err?.message || err) });
        return null;
      }
    }));

    const withIngredients = results.filter((r) => r?.ingredientsText)
      .sort((a, b) => b.ingredientsText.length - a.ingredientsText.length);
    if (withIngredients.length) {
      const best = withIngredients[0];
      return {
        valid: true,
        found: true,
        barcode: canonical,
        provider: best.provider,
        productName: best.productName || results.find((r) => r?.productName)?.productName || null,
        ingredientsText: best.ingredientsText,
        attempts,
      };
    }
    nameOnly = nameOnly || results.find((r) => r?.productName)?.productName || null;
  }

  return { valid: true, found: false, barcode: canonical, productName: nameOnly, attempts };
}
