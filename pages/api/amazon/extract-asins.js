// pages/api/amazon/extract-asins.js
// One-time (or periodic) endpoint that reads your Affiliate Products DB,
// extracts ASINs from existing Amazon URLs in the link fields,
// then patches the ASIN (and Brand via a live Amazon lookup) back into Airtable.
//
// Run once: POST /api/amazon/extract-asins
// Returns a summary of what was patched and what still needs manual attention.
//
// Extraction works on these URL patterns:
//   amazon.com/dp/B07XXXXXX
//   amazon.com/product-name/dp/B07XXXXXX/ref=...
//   amazon.com/gp/product/B07XXXXXX
//   amzn.to/XXXXX  ← short links, requires redirect follow (see below)

import { getItems } from "@/lib/amazon/creatorsApi";

const AT_KEY   = process.env.AFFILIATE_API_KEY;
const AT_BASE  = process.env.AFFILIATE_BASE_ID;
const AT_TABLE = process.env.AFFILIATE_TABLE_NAME;

const AT_HEADERS = {
  Authorization:  `Bearer ${AT_KEY}`,
  "Content-Type": "application/json",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Extract ASIN from a URL string ──────────────────────────────────────────
// Handles /dp/ASIN, /gp/product/ASIN, and bare 10-char alphanumeric ASINs in URLs
function extractAsin(url = "") {
  if (!url) return null;

  // Standard Amazon product URL patterns
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]ASIN=([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

// ─── Fetch all Airtable records ───────────────────────────────────────────────
async function fetchAllRecords() {
  const records = [];
  let offset = null;

  do {
    const params = new URLSearchParams();
    if (offset) params.set("offset", offset);

    const res  = await fetch(
      `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}?${params}`,
      { headers: AT_HEADERS }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable fetch failed ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset ?? null;
  } while (offset);

  return records;
}

// ─── Patch Airtable record ────────────────────────────────────────────────────
async function patchRecord(recordId, fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}/${recordId}`,
    { method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Patch failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-sync-secret"];
  if (process.env.SYNC_SECRET && secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ?dry=true → show what would happen without writing anything
  const dryRun = req.query.dry === "true";

  let records;
  try {
    records = await fetchAllRecords();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const results = {
    total:          records.length,
    alreadyHasAsin: 0,
    extracted:      0,
    needsLookup:    [],  // products where URL didn't contain an ASIN
    failed:         [],
  };

  // ── Step 1: Extract ASINs from existing URL fields ────────────────────────
  const toEnrich = []; // records with ASIN extracted, needs Brand lookup

  for (const record of records) {
    const f = record.fields ?? {};

    // Skip if ASIN already set
    if (String(f.ASIN || "").trim()) {
      results.alreadyHasAsin++;
      continue;
    }

    // Try both link fields
    const asin =
      extractAsin(f["Lo. Amazon/Stripe Link"]) ||
      extractAsin(f["Sh. Amazon/Stripe Link"]);

    if (asin) {
      toEnrich.push({ recordId: record.id, asin, name: f["Product Name"] || "" });
    } else {
      // Couldn't extract - needs manual attention or search fallback
      results.needsLookup.push({
        recordId: record.id,
        name:     f["Product Name"] || "Unknown",
        loLink:   f["Lo. Amazon/Stripe Link"] || "",
        shLink:   f["Sh. Amazon/Stripe Link"] || "",
      });
    }
  }

  if (dryRun) {
    return res.status(200).json({
      dryRun: true,
      ...results,
      wouldExtract: toEnrich.length,
      wouldNeedLookup: results.needsLookup.length,
      sample: toEnrich.slice(0, 5),
    });
  }

  // ── Step 2: Batch-fetch Amazon data to get Brand + confirm ASIN valid ─────
  const batches = chunk(toEnrich, 10);

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const asins = batch.map(p => p.asin);

    let amazonItems = [];
    try {
      amazonItems = await getItems(asins);
    } catch (err) {
      // If Amazon lookup fails, still patch ASIN alone (skip Brand)
      console.warn(`[extract-asins] Amazon batch ${bi + 1} failed: ${err.message}. Patching ASIN only.`);
    }

    const byAsin = new Map(amazonItems.map(item => [item.asin, item]));

    await Promise.all(batch.map(async ({ recordId, asin, name }) => {
      const amazonItem = byAsin.get(asin);

      const fields = { ASIN: asin };

      // If Amazon confirmed the product, grab Brand and update Last Synced
      if (amazonItem) {
        if (amazonItem.brand)    fields["Brand"]       = amazonItem.brand;
        if (amazonItem.price)    fields["Price"]       = amazonItem.price;
        if (amazonItem.rating)   fields["Review Rating"] = amazonItem.rating;
        if (amazonItem.reviewCount) fields["Reviews"]  = amazonItem.reviewCount;
        if (amazonItem.imageUrl) fields["Image URL"]   = amazonItem.imageUrl;
        if (amazonItem.affiliateLink) fields["Lo. Amazon/Stripe Link"] = amazonItem.affiliateLink;
        if (amazonItem.boughtLastMonth) fields["Bought"] = amazonItem.boughtLastMonth;
        fields["Last Synced"] = new Date().toISOString().slice(0, 10);
      }

      try {
        await patchRecord(recordId, fields);
        results.extracted++;
        console.log(`[extract-asins] ✓ ${asin} - ${name}`);
      } catch (e) {
        results.failed.push({ asin, name, error: e.message });
      }
    }));

    if (bi < batches.length - 1) await sleep(1100);
  }

  // ── Step 3: Return summary ────────────────────────────────────────────────
  return res.status(200).json({
    ...results,
    extracted: results.extracted,
    message: results.needsLookup.length > 0
      ? `${results.needsLookup.length} product(s) couldn't be auto-detected - see needsLookup. Use POST /api/amazon/search-asins to find them by name.`
      : "All products processed.",
    ...(results.failed.length ? { failed: results.failed } : {}),
  });
}