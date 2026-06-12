// pages/api/amazon/sync-variations.js
// Weekly cron (Monday 7 AM UTC): fetches flavor/size variations for all products
// with an ASIN and stores them in Airtable as JSON in a "Variations" field.
//
// Variations field stores: JSON array of { asin, flavor, size, price, image, affiliateLink }
// SmartStack cards use this to show a flavor picker when browsing.
//
// Airtable field required: "Variations" (Long text / JSON)

import { getVariations } from "@/lib/amazon/creatorsApi";

const AT_KEY   = process.env.AFFILIATE_API_KEY;
const AT_BASE  = process.env.AFFILIATE_BASE_ID;
const AT_TABLE = process.env.AFFILIATE_TABLE_NAME;

const AT_HEADERS = {
  Authorization:  `Bearer ${AT_KEY}`,
  "Content-Type": "application/json",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchRecordsWithAsins() {
  const records = [];
  let offset = null;
  do {
    const params = new URLSearchParams({ filterByFormula: "NOT({ASIN} = '')" });
    if (offset) params.set("offset", offset);
    const res  = await fetch(
      `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}?${params}`,
      { headers: AT_HEADERS }
    );
    if (!res.ok) throw new Error(`Airtable fetch failed ${res.status}`);
    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset ?? null;
  } while (offset);
  return records;
}

async function patchRecord(recordId, fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}/${recordId}`,
    { method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }) }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Patch ${recordId} failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();

  const validCron   = req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`;
  const validManual = req.headers["x-sync-secret"] === process.env.SYNC_SECRET;
  if (!validCron && !validManual) return res.status(401).json({ error: "Unauthorized" });

  if (!AT_KEY || !AT_BASE || !AT_TABLE) {
    return res.status(503).json({ error: "Missing Airtable config." });
  }

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
      console.log(`[sync-variations] ✓ ${asin} — ${variations.length} variations`);
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
