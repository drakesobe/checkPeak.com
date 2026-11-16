// pages/api/amazon/sync-variations.js
// Weekly cron (Monday 7 AM UTC): fetches flavor/size variations for all products
// with an ASIN and stores them in the product catalog (affiliate_products.variations).
//
// Variations field stores: JSON array of { asin, flavor, size, price, image, affiliateLink }
// SmartStack cards use this to show a flavor picker when browsing.
//
// Stored via lib/affiliateProducts.js.

import { getVariations } from "@/lib/amazon/creatorsApi";

import { listProducts, updateProduct } from "@/lib/affiliateProducts";

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    return res.status(500).json({ error: "Failed to fetch records.", detail: err.message });
  }

  if (!records.length) {
    return res.status(200).json({ synced: 0, message: "No records with ASIN found." });
  }

  let synced = 0, skipped = 0, errors = 0;
  const errorList = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const asin   = String(record.fields?.ASIN || "").trim();
    if (!asin) { skipped++; continue; }

    if (i > 0) await sleep(1200);

    try {
      const { count, variations } = await getVariations(asin);

      await patchRecord(record.id, {
        Variations: variations.length > 0 ? JSON.stringify(variations) : "",
        "Variation Count": count,
      });

      synced++;
      console.log(`[sync-variations] ✓ ${asin} - ${variations.length} variations`);
    } catch (err) {
      errors++;
      errorList.push(`${asin}: ${err.message}`);
      if (err.message.includes("AssociateNotEligible")) break;
    }
  }

  return res.status(200).json({
    total: records.length,
    synced,
    skipped,
    errors,
    ...(errorList.length ? { errorList } : {}),
  });
}
