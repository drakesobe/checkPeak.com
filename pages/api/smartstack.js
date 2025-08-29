// pages/api/smartstack.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing AIRTABLE_API_KEY env var" });
  }

  const BASE_ID = "appspE640Pggw1VP9"; // your base ID
  const TABLE_ID = "tblF4rxxbnn6z9lGr"; // your table ID
  const VIEW_ID = "viwUcs1qpyxyLqkIM"; // optional view

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

      // Supplements array
      let supplements = [];
      if (Array.isArray(f["Supplements"])) supplements = f["Supplements"];
      else if (typeof f["Supplements"] === "string")
        supplements = f["Supplements"]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

      // Price & servings
      const priceNumber = parseFloat(f["Price"] || 0);
      const servings = f["Servings"] || "";

      // Nutrition label
      const nutritionLabel = f["Nutrition Label URL"] || "";

      // Affiliate link
      const affiliateLink =
        f["Lo. Amazon/Stripe Link"] ||
        f["Sh. Amazon/Stripe Link"] ||
        f["AffiliateLink"] ||
        "";

      // Image URL
      const imageUrl = f["Image URL"] || "";

      // Rating
      const rating = parseFloat(f["Rating"]) || null;

      // Value Rating from Airtable
      let valueScore = parseFloat(f["Value Rating"]) || null;

      // Fallback: calculate valueScore from servings / price
      if (!valueScore && priceNumber && servings) {
        const servingsNumber = parseFloat(servings) || 1;
        valueScore = (servingsNumber / priceNumber) * 10; // scale factor for badge
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
        valueScore, // ✅ include computed valueScore
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
