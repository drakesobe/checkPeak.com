// pages/api/amazon/search-asins.js
// Fallback for products where URL extraction couldn't find an ASIN.
// Searches Amazon by product name and returns the best match.
//
// POST /api/amazon/search-asins
// Body: { recordIds: ["recXXX", "recYYY"] }  ← patch specific records
//   OR: {}                                    ← process all records missing ASIN
//
// Returns matches for review - does NOT auto-patch unless ?confirm=true.
// When confident (exact name match), use ?confirm=true to auto-patch.

import { searchItems } from "@/lib/amazon/creatorsApi";

const AT_KEY   = process.env.AFFILIATE_API_KEY;
const AT_BASE  = process.env.AFFILIATE_BASE_ID;
const AT_TABLE = process.env.AFFILIATE_TABLE_NAME;

const AT_HEADERS = {
  Authorization:  `Bearer ${AT_KEY}`,
  "Content-Type": "application/json",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchRecordsMissingAsins(recordIds = null) {
  const records = [];
  let offset = null;

  const formula = recordIds?.length
    ? `OR(${recordIds.map(id => `RECORD_ID()="${id}"`).join(",")})`
    : "AND({ASIN} = '', NOT({Product Name} = ''))";

  do {
    const params = new URLSearchParams({ filterByFormula: formula });
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
  await fetch(
    `https://api.airtable.com/v0/${AT_BASE}/${encodeURIComponent(AT_TABLE)}/${recordId}`,
    { method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }) }
  );
}

// Score how well a product name matches the search query
// Simple heuristic: count matching words
function nameMatchScore(amazonTitle = "", searchName = "") {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const queryWords  = normalize(searchName);
  const titleWords  = new Set(normalize(amazonTitle));
  const matched     = queryWords.filter(w => titleWords.has(w)).length;
  return queryWords.length > 0 ? matched / queryWords.length : 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = req.headers["x-sync-secret"];
  if (process.env.SYNC_SECRET && secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { recordIds } = req.body ?? {};
  const autoConfirm   = req.query.confirm === "true";  // auto-patch high-confidence matches
  const confidenceMin = Number(req.query.confidence ?? 0.7); // 0–1, default 70%

  let records;
  try {
    records = await fetchRecordsMissingAsins(recordIds?.length ? recordIds : null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (!records.length) {
    return res.status(200).json({ message: "No records missing ASINs found.", results: [] });
  }

  const results = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const f      = record.fields ?? {};
    const name   = String(f["Product Name"] || "").trim();

    if (!name) {
      results.push({ recordId: record.id, name: "(blank)", status: "skipped", reason: "No product name" });
      continue;
    }

    // Rate limit: Amazon search is stricter than GetItems (~1 req/sec)
    if (i > 0) await sleep(1200);

    let matches = [];
    try {
      const items = await searchItems(name, {
        searchIndex: "HealthPersonalCare",
        itemCount:   5,
        sortBy:      "Relevance",
      });

      matches = items.map(item => ({
        asin:        item.asin,
        name:        item.name,
        brand:       item.brand,
        price:       item.price,
        rating:      item.rating,
        imageUrl:    item.imageUrl,
        affiliateLink: item.affiliateLink,
        score:       nameMatchScore(item.name, name),
      })).sort((a, b) => b.score - a.score);

    } catch (err) {
      results.push({ recordId: record.id, name, status: "error", reason: err.message });
      continue;
    }

    if (!matches.length) {
      results.push({ recordId: record.id, name, status: "no_results", matches: [] });
      continue;
    }

    const best = matches[0];

    // Auto-patch if confidence is high enough and ?confirm=true
    if (autoConfirm && best.score >= confidenceMin) {
      try {
        await patchRecord(record.id, {
          ASIN:                    best.asin,
          Brand:                   best.brand || "",
          "Lo. Amazon/Stripe Link": best.affiliateLink,
          ...(best.price  ? { Price:           best.price  } : {}),
          ...(best.rating ? { "Review Rating": best.rating } : {}),
          ...(best.imageUrl ? { "Image URL":   best.imageUrl } : {}),
          "Last Synced": new Date().toISOString().slice(0, 10),
        });
        results.push({ recordId: record.id, name, status: "patched", asin: best.asin, score: best.score, matched: best.name });
      } catch (e) {
        results.push({ recordId: record.id, name, status: "patch_failed", reason: e.message, best });
      }
    } else {
      // Return suggestions for manual review
      results.push({
        recordId: record.id,
        name,
        status:   best.score >= confidenceMin ? "confident" : "review",
        matches:  matches.slice(0, 3),
      });
    }
  }

  const patched    = results.filter(r => r.status === "patched").length;
  const needReview = results.filter(r => r.status === "review" || r.status === "confident").length;

  return res.status(200).json({
    total:      records.length,
    patched,
    needReview,
    results,
    tip: needReview > 0
      ? `${needReview} products need review. Check the 'matches' array and use /api/amazon/extract-asins or manually set ASINs in Airtable.`
      : undefined,
  });
}