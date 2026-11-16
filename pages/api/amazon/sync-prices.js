// pages/api/sync-prices.js
// Syncs live Amazon data into the product catalog (Supabase affiliate_products).
// Run daily via Vercel Cron or manually via POST.
//
// What it updates (all writable fields):
//   Price                  → live Amazon listing price
//   Review Rating          → star rating (0–5)
//   Reviews                → total review count
//   Bought                 → bought last month count
//   Image URL              → primary product image
//   Lo. Amazon/Stripe Link → full affiliate link with partner tag
//
// What it does NOT touch (manual or formula):
//   Product Name, Category, Servings, Nutrition Label URL,
//   Sh. Amazon/Stripe Link, Value Rating (formula field)
//
// Products come from lib/affiliateProducts.js (Supabase affiliate_products).

import { getItems } from "@/lib/amazon/creatorsApi";

import { listProducts, updateProduct } from "@/lib/affiliateProducts";

const sleep = ms => new Promise(r => setTimeout(r, ms));
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function fetchRecordsWithAsins() {
  return (await listProducts()).filter((r) => String(r.fields?.ASIN || "").trim());
}

const patchRecord = updateProduct;

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();

  const validCron   = req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`;
  const validManual = req.headers["x-sync-secret"] === process.env.SYNC_SECRET;
  if (!validCron && !validManual) return res.status(401).json({ error: "Unauthorized" });

  let records;
  try {
    records = await fetchRecordsWithAsins();
  } catch (err) {
    return res.status(500).json({ error: "Failed to load products.", detail: err.message });
  }

  if (!records.length) {
    return res.status(200).json({
      synced: 0,
      message: "No records with ASIN found. Add an ASIN field (Single line text) to your table and fill in each product's Amazon ASIN (found in the product URL: /dp/B07XXXXXX/).",
    });
  }

  const pairs   = records
    .map(r => ({ recordId: r.id, asin: String(r.fields?.ASIN || "").trim() }))
    .filter(p => p.asin);

  const batches   = chunk(pairs, 10);
  let   synced    = 0;
  let   errors    = 0;
  const errorList = [];

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    try {
      const asins  = batch.map(p => p.asin);
      const items  = await getItems(asins);
      const byAsin = new Map(items.map(item => [item.asin, item]));

      await Promise.all(batch.map(async ({ recordId, asin }) => {
        const item = byAsin.get(asin);
        if (!item) { errors++; errorList.push(`ASIN not found on Amazon: ${asin}`); return; }

        // Field names are mapped to columns in lib/affiliateProducts.js
        const fields = {
          "Lo. Amazon/Stripe Link": item.affiliateLink,  // always refresh tag
        };
        if (item.price           != null) fields["Price"]         = item.price;
        if (item.rating          != null) fields["Review Rating"] = item.rating;
        if (item.reviewCount     != null) fields["Reviews"]       = item.reviewCount;
        if (item.imageUrl                ) fields["Image URL"]    = item.imageUrl;
        if (item.boughtLastMonth != null) fields["Bought"]        = item.boughtLastMonth;
        if (item.brand                   ) fields["Brand"]        = item.brand;
        fields["Last Synced"] = new Date().toISOString();

        try {
          await patchRecord(recordId, fields);
          synced++;
          console.log(`[sync] ✓ ${asin} - $${item.price} | ★${item.rating}`);
        } catch (e) {
          errors++;
          errorList.push(`Patch failed for ${asin}: ${e.message}`);
        }
      }));
    } catch (err) {
      errors += batch.length;
      errorList.push(`Batch ${bi + 1} error: ${err.message}`);
      // Account-level block - no point retrying remaining batches
      if (err.message.includes("AssociateNotEligible")) break;
    }

    if (bi < batches.length - 1) await sleep(1100);
  }

  return res.status(200).json({
    total: pairs.length,
    synced,
    errors,
    ...(errorList.length ? { errorList } : {}),
  });
}