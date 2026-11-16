// pages/api/athlete/nutrition/meal-copy.js
//   GET  ?date=YYYY-MM-DD&mealId=breakfast
//        → { sources: [{ date, mealId, itemCount, calories, protein, names: [..] }] }
//          up to 3 previous days (within 14) that have this meal logged, newest first.
//   POST { fromDate, fromMealId, toDate, toMealId }
//        → { ok, entries } — copies every item from the source meal into the target meal.

import { requireAthlete }  from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { LOG_COLS, toLogRows, sumItems, isDate, isMealId, getAthleteToken } from "@/lib/foodLogItems";

function isoDaysBefore(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  if (req.method === "GET") {
    const date = String(req.query.date || "");
    const mealId = String(req.query.mealId || "");
    if (!isDate(date) || !isMealId(mealId)) return res.status(400).json({ error: "date and mealId required" });

    const { data, error } = await db
      .from("athlete_food_logs")
      .select(LOG_COLS)
      .eq("athlete_token", athleteToken)
      .eq("meal_id", mealId)
      .gte("log_date", isoDaysBefore(date, 14))
      .lt("log_date", date)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const byDate = new Map();
    for (const r of data ?? []) {
      if (!byDate.has(r.log_date)) byDate.set(r.log_date, []);
      byDate.get(r.log_date).push(r);
    }
    const sources = [...byDate.entries()].slice(0, 3).map(([d, rows]) => {
      const t = sumItems(rows);
      return {
        date: d, mealId,
        itemCount: rows.length,
        calories:  t.calories,
        protein:   t.protein,
        names:     rows.slice(0, 4).map(r => r.food_name),
      };
    });
    return res.status(200).json({ ok: true, sources });
  }

  if (req.method === "POST") {
    const { fromDate, fromMealId, toDate, toMealId } = req.body || {};
    if (![fromDate, toDate].every(isDate) || ![fromMealId, toMealId].every(isMealId)) {
      return res.status(400).json({ error: "fromDate, fromMealId, toDate, toMealId required" });
    }

    const { data: src, error: sErr } = await db
      .from("athlete_food_logs")
      .select(LOG_COLS)
      .eq("athlete_token", athleteToken)
      .eq("log_date", fromDate)
      .eq("meal_id", fromMealId)
      .order("created_at", { ascending: true });
    if (sErr) return res.status(500).json({ error: sErr.message });

    const rows = toLogRows(src ?? [], { athleteToken, date: toDate, mealId: toMealId });
    if (!rows.length) return res.status(404).json({ error: "Nothing to copy" });

    const { data, error } = await db.from("athlete_food_logs").insert(rows).select(LOG_COLS);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ ok: true, entries: data ?? [] });
  }

  return res.status(405).end();
}
