// pages/api/smartstack.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing AIRTABLE_API_KEY env var" });
  }

  const BASE_ID = "appspE640Pggw1VP9"; // your base ID
  const TABLE_ID = "tblF4rxxbnn6z9lGr"; // your table id (as provided)
  const VIEW_ID = "viwUcs1qpyxyLqkIM"; // optional view id

  // Build Airtable URL
  const URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}${VIEW_ID ? `?view=${VIEW_ID}` : ""}`;

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
      return res.status(500).json({ error: "Failed to fetch Airtable: " + response.status });
    }

    const data = await response.json();

    // Map Airtable records into the shape the front-end expects
    const stacks = (data.records || []).map((record) => {
      const f = record.fields || {};

      // Prefer existing supplements array; if string, split by comma, else empty
      let supplements = [];
      if (Array.isArray(f["Supplements"])) supplements = f["Supplements"];
      else if (typeof f["Supplements"] === "string") supplements = f["Supplements"].split(",").map(s => s.trim()).filter(Boolean);
      // If there isn't a dedicated supplements column, try pulling from Product Name / Category heuristics (optional)
      if (!supplements.length && f["Supplement List"]) {
        supplements = Array.isArray(f["Supplement List"]) ? f["Supplement List"] : (typeof f["Supplement List"] === "string" ? f["Supplement List"].split(",").map(s => s.trim()) : []);
      }

      // Rating to internal valueRating mapping
      let valueRating = "moderate";
      if (f["Rating"]) {
        // handle numeric or string rating: 4.5+ -> bestValue, 3-4.5 -> moderate, <3 -> highPrice (you can change)
        const r = typeof f["Rating"] === "number" ? f["Rating"] : parseFloat(String(f["Rating"]).replace(/[^\d.]/g, "")) || 0;
        if (r >= 4.5) valueRating = "bestValue";
        else if (r >= 3.0) valueRating = "moderate";
        else valueRating = "highPrice";
      }

      // Ban type: prefer explicit column, otherwise infer from Safe column (Yes/No)
      let banType = "None";
      if (f["Ban Type"]) banType = f["Ban Type"];
      else if (typeof f["Safe"] === "string") banType = String(f["Safe"]).toLowerCase() === "yes" ? "None" : "Prohibited";
      else if (f["Safe"] === true) banType = "None";
      else if (f["Safe"] === false) banType = "Prohibited";

      // Price & servings
      const priceNumber = (typeof f["Price"] === "number") ? f["Price"] : parseFloat(String(f["Price"] || "").replace(/[^0-9.]/g, "")) || 0;
      const servings = f["Servings"] || "";

      // Nutrition label field (map common typos)
      const nutritionLabel = f["Nutrition Label URL"] || f["Nutrtion Label URL"] || f["Nutrition Label"] || f["Nutrtion Label"] || "";

      // Affiliate link preference: long first, fallback to short
      const affiliateLink = f["Lo. Amazon/Stripe Link"] || f["Sh. Amazon/Stripe Link"] || f["AffiliateLink"] || "";

      return {
        id: record.id,
        name: f["Product Name"] || "No Name",
        category: f["Category"] || "Misc",
        supplements,
        valueRating,
        banType,
        notes: `Servings: ${servings || "N/A"} • Price: $${priceNumber.toFixed(2)}`,
        affiliateLink,
        imageUrl: f["Image url"] || f["Image"] || "",
        nutritionLabel,
        rawFields: f, // keep original fields if you want more detail in the front-end
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300"); // short cache for Vercel
    return res.status(200).json({ records: stacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to fetch Airtable data" });
  }
}
