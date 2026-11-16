// scripts/sync-products-from-airtable.mjs
// Copies the supplement product catalog from Airtable into Supabase `affiliate_products`.
// Run AFTER supabase/affiliate_products_migration.sql. This is a Node script: run it in a
// terminal from the project folder, not in the Supabase SQL editor.
//
//   node scripts/sync-products-from-airtable.mjs          dry run: prints what would change
//   node scripts/sync-products-from-airtable.mjs --write  applies it
//
// Airtable is the live catalog until the app switches over, so its values win. Rows are matched
// by Airtable record id; products only in Supabase are listed, never deleted. Safe to re-run.

import fs from "fs";
import Airtable from "airtable";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const WRITE = process.argv.includes("--write");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const base = new Airtable({ apiKey: process.env.AFFILIATE_API_KEY }).base(process.env.AFFILIATE_BASE_ID);

// Same map as lib/affiliateProducts.js
const COLUMN = {
  "Product Name": "name", "ASIN": "asin", "Brand": "brand", "Category": "category",
  "Price": "price", "Servings": "servings", "Image URL": "image_url",
  "Nutrition Label URL": "nutrition_label_url", "Lo. Amazon/Stripe Link": "product_url",
  "Sh. Amazon/Stripe Link": "short_link", "Review Rating": "review_rating", "Reviews": "review_count",
  "Bought": "bought_last_month", "Coach Pick": "coach_pick", "Supplements": "supplements",
  "Variations": "variations", "Variation Count": "variation_count", "Last Synced": "last_synced_at",
};

function columnsFrom(f) {
  const out = {};
  for (const [field, col] of Object.entries(COLUMN)) {
    let v = f[field];
    if (col === "coach_pick") { out[col] = Boolean(v); continue; }
    if (col === "supplements") {
      out[col] = Array.isArray(v) ? v : String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (col === "variations") {
      try { out[col] = v ? JSON.parse(v) : null; } catch { out[col] = null; }
      continue;
    }
    if (col === "last_synced_at") { out[col] = v ? new Date(v).toISOString() : null; continue; }
    if (["review_count", "bought_last_month", "variation_count"].includes(col) && v != null) v = Math.round(Number(v));
    out[col] = v === undefined || v === "" ? null : typeof v === "string" ? v.trim() : v;
  }
  return out;
}

const norm = (v) => (v === undefined ? null : JSON.stringify(v));
function same(a, b, col) {
  if (col === "price") return (a == null ? null : Number(a).toFixed(2)) === (b == null ? null : Number(b).toFixed(2)); // column stores cents
  if (["servings", "review_rating"].includes(col)) return (a == null ? null : Number(a)) === (b == null ? null : Number(b));
  if (col === "last_synced_at") return (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  return norm(a ?? null) === norm(b ?? null);
}

const probe = await db.from("affiliate_products").select("servings").limit(1);
if (probe.error) {
  console.error("Run supabase/affiliate_products_migration.sql in the Supabase SQL editor first.\n", probe.error.message);
  process.exit(1);
}

const [atRows, { data: sbRows, error }] = await Promise.all([
  base(process.env.AFFILIATE_TABLE_NAME).select().all(),
  db.from("affiliate_products").select("*"),
]);
if (error) throw new Error(error.message);

const sbByAirtable = new Map(sbRows.filter((r) => r.airtable_id).map((r) => [r.airtable_id, r]));
const seen = new Set();
let inserts = 0, updates = 0, unchanged = 0;

for (const rec of atRows) {
  const cols = columnsFrom(rec.fields);
  if (!cols.name) { console.log(`skip ${rec.id}: no Product Name`); continue; }
  const existing = sbByAirtable.get(rec.id);

  if (!existing) {
    inserts++;
    console.log(`INSERT ${cols.name}`);
    if (WRITE) {
      const { error: e } = await db.from("affiliate_products").insert({ ...cols, airtable_id: rec.id, active: true });
      if (e) console.error("  failed:", e.message);
    }
    continue;
  }
  seen.add(existing.id);

  const changed = Object.keys(cols).filter((c) => !same(existing[c], cols[c], c));
  if (!changed.length) { unchanged++; continue; }
  updates++;
  if (updates <= 15) console.log(`UPDATE ${cols.name}: ${changed.join(", ")}`);
  if (WRITE) {
    const patch = Object.fromEntries(changed.map((c) => [c, cols[c]]));
    const { error: e } = await db.from("affiliate_products").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (e) console.error("  failed:", e.message);
  }
}
if (updates > 15) console.log(`...and ${updates - 15} more updates`);

const onlySupabase = sbRows.filter((r) => !seen.has(r.id) && !atRows.some((a) => a.id === r.airtable_id));
for (const r of onlySupabase) console.log(`only in Supabase: ${r.name} (${r.airtable_id || "no airtable id"})`);

console.log(`\n${WRITE ? "Applied" : "Dry run"}: ${inserts} insert, ${updates} update, ${unchanged} unchanged, ${onlySupabase.length} Supabase-only`);
if (!WRITE) console.log("Re-run with --write to apply.");
