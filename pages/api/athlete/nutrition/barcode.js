// pages/api/athlete/nutrition/barcode.js
// GET ?code=<barcode digits> → { ok, valid, found, food? }
//   food is in the food sheet's FoodItem shape (per 100 g + serving measure).
// Cache table: supabase/food_barcodes_migration.sql (works without it, just slower).

import { requireAthlete }    from "@/lib/requireAthlete";
import { lookupFoodBarcode } from "@/lib/foodBarcode";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const code = String(req.query.code || "").replace(/\D/g, "").slice(0, 14);
  if (code.length < 8) return res.status(400).json({ error: "code required" });

  try {
    const r = await lookupFoodBarcode(code);
    return res.status(200).json({ ok: true, ...r });
  } catch (err) {
    console.error("[athlete/nutrition/barcode]", err);
    return res.status(500).json({ error: "Lookup failed" });
  }
}
