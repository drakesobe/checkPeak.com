// pages/api/stacks.js

export default async function handler(req, res) {
  const AIRTABLE_API_KEY = process.env.AFFILIATE_API_KEY;
  const BASE_ID          = process.env.AFFILIATE_BASE_ID;
  const TABLE_ID         = process.env.AFFILIATE_TABLE_NAME;
  const VIEW_ID          = "viwUcs1qpyxyLqkIM";

  if (!AIRTABLE_API_KEY) return res.status(500).json({ error: "Missing AFFILIATE_API_KEY env var" });
  if (!BASE_ID)          return res.status(500).json({ error: "Missing AFFILIATE_BASE_ID env var" });
  if (!TABLE_ID)         return res.status(500).json({ error: "Missing AFFILIATE_TABLE_NAME env var" });

  const buildUrl = (offset) => {
    const params = new URLSearchParams();
    if (VIEW_ID) params.set("view", VIEW_ID);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_ID)}?${params.toString()}`;
  };

  try {
    let allRecords = [];
    let offset     = null;

    while (true) {
      const response = await fetch(buildUrl(offset), {
        headers: {
          Authorization:  `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Airtable fetch error:", response.status, text);
        return res.status(500).json({ error: "Failed to fetch Airtable: " + response.status });
      }

      const data = await response.json();
      allRecords  = allRecords.concat(data.records || []);
      offset      = data.offset;
      if (!offset) break;
    }

    const stacks = allRecords.map((record) => {
      const f = record.fields || {};

      let supplements = [];
      if (Array.isArray(f["Supplements"])) {
        supplements = f["Supplements"];
      } else if (typeof f["Supplements"] === "string") {
        supplements = f["Supplements"].split(",").map((s) => s.trim()).filter(Boolean);
      }

      const priceNumber    = Number(f["Price"]);
      const servingsNumber = Number(f["Servings"]);
      const price          = Number.isFinite(priceNumber)    ? priceNumber    : null;
      const servings       = Number.isFinite(servingsNumber) ? servingsNumber : null;

      const nutritionLabel = f["Nutrition Label URL"] || "";
      const affiliateLink  =
        f["Lo. Amazon/Stripe Link"] ||
        f["Sh. Amazon/Stripe Link"] ||
        f["AffiliateLink"]          ||
        "";
      const imageUrl = f["Image URL"] || "";
      const rating       = Number.isFinite(Number(f["Review Rating"])) ? Number(f["Review Rating"]) : null;
      const reviewCount  = Number.isFinite(Number(f["Reviews"]))       ? Number(f["Reviews"])       : null;
      const boughtLastMonth = Number.isFinite(Number(f["Bought"]))     ? Number(f["Bought"])        : null;

      let valueScore = Number.isFinite(Number(f["Value Rating"])) ? Number(f["Value Rating"]) : null;
      if (valueScore == null && price && servings) valueScore = (servings / price) * 10;

      return {
        id:    record.id,
        name:  f["Product Name"] || "No Name",
        category:     f["Category"] || "Misc",
        supplements,
        notes: `Servings: ${servings ?? "N/A"} • Price: $${price != null ? price.toFixed(2) : "0.00"}`,
        affiliateLink,
        imageUrl,
        nutritionLabel,
        rating,
        reviewCount,
        boughtLastMonth,
        Price:    price,
        Servings: servings,
        pricePerServing: price != null && servings != null && servings > 0 ? price / servings : null,
        valueScore,
        rawFields: f,
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ records: stacks });
  } catch (error) {
    console.error("[stacks] API error:", error);
    return res.status(500).json({ error: "Failed to fetch Airtable data" });
  }
}