// pages/api/amazon/search.js
// Proxy search through Amazon Creators API.
// Used by the SmartStack admin dashboard to find and add new products.
//
// GET /api/amazon/search?q=creatine+monohydrate&category=HealthPersonalCare&count=10

import { searchItems } from "@/lib/amazon/creatorsApi";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { q, category = "HealthPersonalCare", count = "10", sort = "Relevance" } = req.query;

  if (!q?.trim()) {
    return res.status(400).json({ error: "Missing query parameter: q" });
  }

  try {
    const items = await searchItems(q.trim(), {
      searchIndex: category,
      itemCount:   Math.min(10, Math.max(1, Number(count) || 10)),
      sortBy:      sort,
    });

    // Cache for 30 min - prices change but not that fast
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({ items, count: items.length });
  } catch (err) {
    console.error("[amazon/search]", err.message);

    if (err.message.includes("credentials not configured")) {
      return res.status(503).json({ error: "Amazon credentials not configured.", detail: err.message });
    }
    if (err.message.includes("AssociateNotEligible")) {
      return res.status(503).json({
        error: "Amazon API not yet active.",
        detail: "Your Associates account needs 10 qualifying sales within the past 30 days before Creator API access activates. No code changes needed — check back once you hit the threshold.",
      });
    }

    return res.status(500).json({ error: "Amazon search failed.", detail: err.message });
  }
}