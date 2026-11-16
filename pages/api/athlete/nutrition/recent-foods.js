// pages/api/athlete/nutrition/recent-foods.js
// GET ?days=45 — the athlete's recently logged foods, derived from athlete_food_logs (no extra table).
// Each food comes back in the shape the app's food sheet uses, with the athlete's usual amount:
//   { foods: [{ food: { id, name, brand, cal, pro, carb, fat, measures }, mIdx, qty, count, lastAt }] }
//   cal/pro/carb/fat are per 100 g (derived from the latest logged portion).
//   mIdx === measures.length means "grams" mode in the app (qty = grams).

import { requireAthlete }  from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { getAthleteToken } from "@/lib/foodLogItems";

const MAX_FOODS = 25;

function per100(v, grams) {
  return Math.round(((Number(v) || 0) / grams) * 1000) / 10;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  const days  = Math.min(Math.max(parseInt(String(req.query.days || "45"), 10) || 45, 1), 180);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await db
    .from("athlete_food_logs")
    .select("food_name, food_id, quantity, unit, grams, calories, protein_g, carbs_g, fat_g, created_at")
    .eq("athlete_token", athleteToken)
    .gte("log_date", since)
    .order("created_at", { ascending: false })
    .limit(600);

  if (error) return res.status(500).json({ error: error.message });

  const groups = new Map();
  for (const r of data ?? []) {
    const grams = Number(r.grams) || 0;
    if (!r.food_name || grams <= 0) continue;
    const key = r.food_id || `name:${String(r.food_name).trim().toLowerCase()}`;
    const g = groups.get(key);
    if (g) { g.count++; continue; }            // rows are newest-first: first seen = latest portion
    groups.set(key, { latest: r, count: 1 });
  }

  const foods = [...groups.entries()].slice(0, MAX_FOODS).map(([key, { latest: r, count }]) => {
    const grams = Number(r.grams);
    const qty   = Number(r.quantity) || 1;
    const unit  = String(r.unit || "serving");
    const isGramsUnit = unit === "g";
    const measures = isGramsUnit ? [{ label: "100g", g: 100 }] : [{ label: unit, g: Math.round((grams / qty) * 10) / 10 }];
    return {
      food: {
        id:    r.food_id || `log-${key.replace(/^name:/, "").replace(/\s+/g, "-").slice(0, 60)}`,
        name:  r.food_name,
        brand: null,
        cal:   per100(r.calories,  grams),
        pro:   per100(r.protein_g, grams),
        carb:  per100(r.carbs_g,   grams),
        fat:   per100(r.fat_g,     grams),
        measures,
      },
      mIdx:   isGramsUnit ? 1 : 0,
      qty:    String(isGramsUnit ? Math.round(grams) : qty),
      count,
      lastAt: new Date(r.created_at).getTime(),
    };
  });

  return res.status(200).json({ ok: true, foods });
}
