// lib/affiliateProducts.js
// Supplement product catalog (Supabase `affiliate_products`).
//
// Records are returned in the shape the routes were written against: { id, fields } with the
// original field names ("Product Name", "Servings", ...), so /api/stacks, /api/smartstack and the
// Amazon jobs only swapped their data source. `id` stays the Airtable record id for products that
// came from Airtable, because saved stacks and compare lists reference those ids.
//
// Until supabase/affiliate_products_migration.sql has been run, reads and writes fall back to
// Airtable automatically, so deploying before or after the SQL both work.

import { supabaseAdmin as db } from "@/lib/supabase";

// Field name -> column
const COLUMN = {
  "Product Name":           "name",
  "ASIN":                   "asin",
  "Brand":                  "brand",
  "Category":               "category",
  "Price":                  "price",
  "Servings":               "servings",
  "Image URL":              "image_url",
  "Nutrition Label URL":    "nutrition_label_url",
  "Lo. Amazon/Stripe Link": "product_url",
  "Sh. Amazon/Stripe Link": "short_link",
  "Review Rating":          "review_rating",
  "Reviews":                "review_count",
  "Bought":                 "bought_last_month",
  "Coach Pick":             "coach_pick",
  "Supplements":            "supplements",
  "Variations":             "variations",
  "Variation Count":        "variation_count",
  "Last Synced":            "last_synced_at",
};

const AT = {
  key:   process.env.AFFILIATE_API_KEY,
  base:  process.env.AFFILIATE_BASE_ID,
  table: process.env.AFFILIATE_TABLE_NAME,
};
const atUrl = (suffix = "") => `https://api.airtable.com/v0/${AT.base}/${encodeURIComponent(AT.table)}${suffix}`;
const atHeaders = () => ({ Authorization: `Bearer ${AT.key}`, "Content-Type": "application/json" });

// Has the migration been run? Checked once per server instance; a failed check retries later.
let readyCheck = null;
export function supabaseCatalogReady() {
  readyCheck ??= db.from("affiliate_products").select("servings").limit(1)
    .then(({ error }) => {
      if (error) { readyCheck = null; return false; }
      return true;
    });
  return readyCheck;
}

function toRecord(row) {
  const fields = {};
  for (const [field, col] of Object.entries(COLUMN)) {
    let v = row[col];
    if (v === null || v === undefined || v === "") continue;
    if (col === "variations") v = JSON.stringify(v);                 // Airtable stored JSON text
    if (col === "supplements" && Array.isArray(v) && !v.length) continue;
    if (col === "coach_pick" && !v) continue;
    if (["price", "servings", "review_rating"].includes(col)) v = Number(v);
    fields[field] = v;
  }
  // Was an Airtable formula; computed from current price so it never goes stale
  if (fields.Servings && fields.Price) fields["Value Rating"] = fields.Servings / fields.Price;
  return { id: row.airtable_id || row.id, fields };
}

function toColumns(fields = {}) {
  const out = {};
  for (const [field, value] of Object.entries(fields)) {
    const col = COLUMN[field];
    if (!col) continue;
    if (col === "variations") {
      try { out[col] = value ? (typeof value === "string" ? JSON.parse(value) : value) : null; } catch { out[col] = null; }
    } else if (col === "supplements") {
      out[col] = Array.isArray(value) ? value : String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (col === "coach_pick") {
      out[col] = Boolean(value);
    } else if (col === "last_synced_at") {
      out[col] = value ? new Date(value).toISOString() : null;
    } else {
      out[col] = value === "" ? null : value;
    }
  }
  return out;
}

async function listFromAirtable() {
  if (!AT.key || !AT.base || !AT.table) throw new Error("Product catalog is not configured.");
  const records = [];
  let offset = null;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const res = await fetch(atUrl(`?${params}`), { headers: atHeaders() });
    if (!res.ok) throw new Error(`Airtable fetch failed ${res.status}`);
    const data = await res.json();
    records.push(...(data.records ?? []).map((r) => ({ id: r.id, fields: r.fields || {} })));
    offset = data.offset ?? null;
  } while (offset);
  return records;
}

// All active products as { id, fields }
export async function listProducts() {
  if (!(await supabaseCatalogReady())) return listFromAirtable();
  const { data, error } = await db
    .from("affiliate_products")
    .select("*")
    .neq("active", false)
    .order("name");
  if (error) throw new Error(`[products] ${error.message}`);
  return (data ?? []).map(toRecord);
}

// Update one product by its record id (Airtable id or Supabase uuid) using field names
export async function updateProduct(id, fields) {
  if (!(await supabaseCatalogReady())) {
    const res = await fetch(atUrl(`/${id}`), { method: "PATCH", headers: atHeaders(), body: JSON.stringify({ fields }) });
    if (!res.ok) throw new Error(`Update ${id} failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const column = /^rec[a-zA-Z0-9]{14,}$/.test(String(id)) ? "airtable_id" : "id";
  const { error } = await db
    .from("affiliate_products")
    .update({ ...toColumns(fields), updated_at: new Date().toISOString() })
    .eq(column, id);
  if (error) throw new Error(`Update ${id} failed: ${error.message}`);
}

export { COLUMN as PRODUCT_COLUMNS };
