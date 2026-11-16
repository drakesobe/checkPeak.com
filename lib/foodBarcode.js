// lib/foodBarcode.js
// Barcode → nutrition for the athlete food logger.
// Order of trust: CheckPeak cache (food_barcodes) → USDA Branded (label data) → Nutritionix → Open Food Facts.
// Returns the food in the app's FoodItem shape: macros per 100 g + a "1 serving" measure when known.

import { supabaseAdmin as db } from "@/lib/supabase";
import { canonicalGtin } from "@/lib/gtin";

const FETCH_TIMEOUT = 7000;

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

const r1 = n => Math.round((Number(n) || 0) * 10) / 10;

function digits(s) { return String(s || "").replace(/\D/g, ""); }
function sameBarcode(a, b) {
  const x = digits(a).replace(/^0+/, ""), y = digits(b).replace(/^0+/, "");
  return !!x && x === y;
}

/** Sanity-check per-100 g values; reject obviously broken records.
 *  All-zero is allowed (water, diet soda) — providers only return a record when it
 *  actually carries nutrition data, so zeros here are real zeros. */
function valid(f) {
  if (!f || !f.name) return false;
  const { cal, pro, carb, fat } = f;
  if (![cal, pro, carb, fat].every(v => Number.isFinite(v) && v >= 0)) return false;
  return !(cal > 950 || pro > 100 || carb > 100 || fat > 100);
}

function build({ name, brand, cal, pro, carb, fat, servingLabel, servingG }) {
  const measures = [];
  if (servingG && servingG > 0 && servingG < 2000) {
    // "1 bar (68 g)" → "1 bar" — the app appends the gram weight itself ("1 bar · 68g").
    const label = String(servingLabel || "").replace(/\s*\([^)]*\)\s*$/, "").trim().slice(0, 60) || "1 serving";
    measures.push({ label, g: r1(servingG) });
  }
  measures.push({ label: "100g", g: 100 });
  return {
    name:  String(name || "").trim().slice(0, 200),
    brand: brand ? String(brand).trim().slice(0, 120) : null,
    cal: r1(cal), pro: r1(pro), carb: r1(carb), fat: r1(fat),
    measures,
  };
}

// ── Providers ────────────────────────────────────────────────────────────────

async function usda(code) {
  const key = process.env.USDA_API_KEY || process.env.FDC_API_KEY;
  if (!key) return null;
  const j = await fetchJson(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(code)}&dataType=Branded&pageSize=10&api_key=${encodeURIComponent(key)}`,
  );
  const f = j?.foods?.find(x => sameBarcode(x.gtinUpc, code));
  if (!f) return null;
  const has = id => f.foodNutrients?.some(x => x.nutrientId === id && x.value != null);
  if (!has(1008)) return null;                                                                 // no calorie data
  const n = id => Number(f.foodNutrients?.find(x => x.nutrientId === id)?.value ?? 0) || 0;   // Branded: per 100 g
  const unit = String(f.servingSizeUnit || "").toLowerCase();
  const servingG = unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt" ? Number(f.servingSize) : null;
  return build({
    name: f.description, brand: f.brandName || f.brandOwner,
    cal: n(1008), pro: n(1003), carb: n(1005), fat: n(1004),
    servingLabel: f.householdServingFullText || null, servingG,
  });
}

async function nutritionix(code) {
  const appId = process.env.NUTRITIONIX_APP_ID, appKey = process.env.NUTRITIONIX_APP_KEY;
  if (!appId || !appKey) return null;
  const j = await fetchJson(`https://trackapi.nutritionix.com/v2/search/item?upc=${encodeURIComponent(code)}`, {
    headers: { "x-app-id": appId, "x-app-key": appKey },
  });
  const f = j?.foods?.[0];
  const g = Number(f?.serving_weight_grams);
  if (!f || !g || f.nf_calories == null) return null;
  const per = v => (Number(v) || 0) / g * 100;   // Nutritionix values are per serving
  return build({
    name: f.food_name, brand: f.brand_name,
    cal: per(f.nf_calories), pro: per(f.nf_protein), carb: per(f.nf_total_carbohydrate), fat: per(f.nf_total_fat),
    servingLabel: f.serving_qty && f.serving_unit ? `${f.serving_qty} ${f.serving_unit}` : null, servingG: g,
  });
}

async function openFoodFacts(code) {
  const j = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, {
    headers: { Accept: "application/json", "User-Agent": "CheckPeak/1.0 (support@checkpeak.com)" },
  });
  const p = j?.product;
  if (!p || j.status !== 1) return null;
  const m = p.nutriments || {};
  const kcal = m["energy-kcal_100g"] ?? (m.energy_100g != null ? Number(m.energy_100g) / 4.184 : null);
  if (kcal == null) return null;
  return build({
    name: p.product_name || p.generic_name, brand: String(p.brands || "").split(",")[0] || null,
    cal: kcal, pro: m.proteins_100g, carb: m.carbohydrates_100g, fat: m.fat_100g,
    servingLabel: p.serving_size || null, servingG: Number(p.serving_quantity) || null,
  });
}

const PROVIDERS = [
  { name: "usda",          fn: usda },
  { name: "nutritionix",   fn: nutritionix },
  { name: "openfoodfacts", fn: openFoodFacts },
];

// ── Cache ────────────────────────────────────────────────────────────────────

let cacheMissing = false;

async function cacheGet(code) {
  if (cacheMissing) return null;
  const { data, error } = await db.from("food_barcodes").select("food, source").eq("barcode", code).maybeSingle();
  if (error) { if (/does not exist|permission/i.test(error.message)) cacheMissing = true; return null; }
  return data || null;
}

async function cachePut(code, food, source) {
  if (cacheMissing) return;
  await db.from("food_barcodes")
    .upsert({ barcode: code, food, source, updated_at: new Date().toISOString() }, { onConflict: "barcode" })
    .then(({ error }) => { if (error && /does not exist|permission/i.test(error.message)) cacheMissing = true; });
}

// ── Public ───────────────────────────────────────────────────────────────────

/**
 * @returns {{ valid: boolean, found: boolean, barcode?: string, source?: string, food?: object }}
 *   food = { id: "upc-<gtin>", name, brand, cal, pro, carb, fat, measures } (per 100 g)
 */
export async function lookupFoodBarcode(raw) {
  const canonical = canonicalGtin(raw);
  if (!canonical) return { valid: false, found: false };

  const withId = food => ({ id: `upc-${canonical}`, ...food });

  const cached = await cacheGet(canonical);
  if (cached?.food) return { valid: true, found: true, barcode: canonical, source: `cache:${cached.source}`, food: withId(cached.food) };

  // A UPC-A product is often stored under its 13-digit EAN form (leading 0) — try both.
  const codes = canonical.length === 12 ? [canonical, "0" + canonical] : [canonical];
  for (const code of codes) {
    const results = await Promise.all(PROVIDERS.map(p => p.fn(code).catch(() => null)));
    const i = results.findIndex(valid);           // PROVIDERS is in trust order
    if (i >= 0) {
      await cachePut(canonical, results[i], PROVIDERS[i].name);
      return { valid: true, found: true, barcode: canonical, source: PROVIDERS[i].name, food: withId(results[i]) };
    }
  }
  return { valid: true, found: false, barcode: canonical };
}

// Exported for tests.
export const _internal = { build, valid };
