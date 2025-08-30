// pages/api/smartstack.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.AFFILIATE_API_KEY;
  const BASE_ID = process.env.AFFILIATE_BASE_ID;
  const TABLE_ID = process.env.AFFILIATE_TABLE_NAME;
  const VIEW_ID = "viwUcs1qpyxyLqkIM";

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing AIRTABLE_API_KEY env var" });
  }

  const URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}${
    VIEW_ID ? `?view=${VIEW_ID}` : ""
  }`;

  try {
    const response = await fetch(URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Airtable fetch error:", response.status, text);
      return res
        .status(500)
        .json({ error: "Failed to fetch Airtable: " + response.status });
    }

    const data = await response.json();

    const stacks = (data.records || []).map((record) => {
      const f = record.fields || {};
      let supplements = [];
      if (Array.isArray(f["Supplements"])) supplements = f["Supplements"];
      else if (typeof f["Supplements"] === "string")
        supplements = f["Supplements"]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

      const priceNumber = parseFloat(f["Price"] || 0);
      const servings = f["Servings"] || "";
      const nutritionLabel = f["Nutrition Label URL"] || "";
      const affiliateLink =
        f["Lo. Amazon/Stripe Link"] ||
        f["Sh. Amazon/Stripe Link"] ||
        f["AffiliateLink"] ||
        "";
      const imageUrl = f["Image URL"] || "";
      const rating = parseFloat(f["Rating"]) || null;

      let valueScore = parseFloat(f["Value Rating"]) || null;
      if (!valueScore && priceNumber && servings) {
        const servingsNumber = parseFloat(servings) || 1;
        valueScore = (servingsNumber / priceNumber) * 10;
      }

      return {
        id: record.id,
        name: f["Product Name"] || "No Name",
        category: f["Category"] || "Misc",
        supplements,
        notes: `Servings: ${servings || "N/A"} • Price: $${priceNumber.toFixed(2)}`,
        affiliateLink,
        imageUrl,
        nutritionLabel,
        rating,
        valueScore,
        rawFields: f,
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ records: stacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to fetch Airtable data" });
  }
}
