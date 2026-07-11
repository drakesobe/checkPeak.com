// pages/api/athlete/nutrition/food-search.js
// Proxy to USDA FoodData Central API (~600k foods).
// Requires USDA_API_KEY in environment variables.
// Free key: https://api.nal.usda.gov/signup

import { requireAthlete } from "@/lib/requireAthlete";

function nutrientVal(list, id) {
  return Number(list?.find(n => n.nutrientId === id)?.value ?? 0) || 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.status(200).json({ ok: true, foods: [] });

  const apiKey = process.env.USDA_API_KEY || process.env.FDC_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: true, foods: [] });

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(q)}&dataType=Foundation,SR%20Legacy,Branded&pageSize=25`;

    const r = await Promise.race([
      fetch(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
    ]);

    if (!r.ok) return res.status(200).json({ ok: true, foods: [] });

    const data = await r.json();
    const foods = (data.foods || []).slice(0, 20).map(f => {
      const nutrients = f.foodNutrients || [];
      const cal  = nutrientVal(nutrients, 1008);
      const pro  = nutrientVal(nutrients, 1003);
      const carb = nutrientVal(nutrients, 1005);
      const fat  = nutrientVal(nutrients, 1004);

      const measures = [];
      if (f.servingSize && f.servingSizeUnit) {
        measures.push({
          label: f.householdServingFullText || `${f.servingSize}${f.servingSizeUnit}`,
          g: Number(f.servingSize),
        });
      }
      (f.foodMeasures || []).slice(0, 5).forEach(m => {
        if (m.gramWeight && m.disseminationText) {
          measures.push({ label: m.disseminationText, g: Number(m.gramWeight) });
        }
      });
      if (!measures.length) measures.push({ label: "100g", g: 100 });

      return {
        id:       `fdc-${f.fdcId}`,
        name:     f.description,
        brand:    f.brandName || null,
        cal, pro, carb, fat,
        measures: measures.slice(0, 6),
      };
    });

    return res.status(200).json({ ok: true, foods });
  } catch {
    return res.status(200).json({ ok: true, foods: [] });
  }
}
