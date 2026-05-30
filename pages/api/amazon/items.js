// pages/api/amazon/items.js
// Fetch one or more products by ASIN from Amazon Creators API.
//
// GET /api/amazon/items?asin=B07XXXX                  (single)
// GET /api/amazon/items?asin=B07XXXX,B08YYYY,B09ZZZZ  (batch, max 10)

import { getItems } from "@/lib/amazon/creatorsApi";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { asin } = req.query;
  if (!asin?.trim()) return res.status(400).json({ error: "Missing asin parameter" });

  const asinList = asin.split(",").map(a => a.trim()).filter(Boolean).slice(0, 10);

  try {
    const items = await getItems(asinList);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({ items, count: items.length });
  } catch (err) {
    console.error("[amazon/items]", err.message);
    return res.status(500).json({ error: "Amazon GetItems failed.", detail: err.message });
  }
}