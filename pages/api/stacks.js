// pages/api/stacks.js

import { listProducts } from "@/lib/affiliateProducts";

export default async function handler(req, res) {
  try {
    const allRecords = await listProducts();

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
    return res.status(500).json({ error: "Could not load products. Try again shortly." });
  }
}