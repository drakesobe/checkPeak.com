// pages/api/athlete/nutrition/food-log.js

import { requireAthlete } from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";

function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const date = String(req.query.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date required (YYYY-MM-DD)" });
    }

    const { data, error } = await db
      .from("athlete_food_logs")
      .select("id,meal_id,food_name,quantity,unit,grams,calories,protein_g,carbs_g,fat_g,created_at")
      .eq("athlete_token", athleteToken)
      .eq("log_date", date)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, entries: data ?? [] });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { date, meal_id, food_name, food_id, quantity, unit, grams, calories, protein_g, carbs_g, fat_g } = req.body || {};

    if (!date || !meal_id || !food_name || grams == null) {
      return res.status(400).json({ error: "date, meal_id, food_name, grams required" });
    }

    const { data, error } = await db
      .from("athlete_food_logs")
      .insert({
        athlete_token: athleteToken,
        log_date:  String(date),
        meal_id:   String(meal_id),
        food_name: String(food_name),
        food_id:   food_id ?? null,
        quantity:  Number(quantity) || 1,
        unit:      String(unit || "serving"),
        grams:     Number(grams),
        calories:  Math.round(Number(calories) || 0),
        protein_g: Math.round(Number(protein_g) || 0),
        carbs_g:   Math.round(Number(carbs_g) || 0),
        fat_g:     Math.round(Number(fat_g) || 0),
      })
      .select("id,meal_id,food_name,quantity,unit,grams,calories,protein_g,carbs_g,fat_g,created_at")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ ok: true, entry: data });
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await db
      .from("athlete_food_logs")
      .delete()
      .eq("id", id)
      .eq("athlete_token", athleteToken);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
