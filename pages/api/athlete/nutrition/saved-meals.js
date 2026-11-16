// pages/api/athlete/nutrition/saved-meals.js
// Requires supabase/athlete_saved_meals_migration.sql.
//   GET                                   → { meals: [{ id, name, itemCount, calories, protein, names, useCount }] }
//   POST { name, fromDate, fromMealId }   → save a logged meal under a name        → { ok, meal }
//   POST { action: "log", id, toDate, toMealId } → log a saved meal into a meal   → { ok, entries }
//   DELETE ?id=…                          → { ok }

import { requireAthlete }  from "@/lib/requireAthlete";
import { supabaseAdmin as db } from "@/lib/supabase";
import { LOG_COLS, toItem, toLogRows, sumItems, isDate, isMealId, getAthleteToken } from "@/lib/foodLogItems";

const MAX_SAVED = 30;

function shape(m) {
  const items = Array.isArray(m.items) ? m.items : [];
  const t = sumItems(items);
  return {
    id:        m.id,
    name:      m.name,
    itemCount: items.length,
    calories:  t.calories,
    protein:   t.protein,
    names:     items.slice(0, 4).map(i => i.food_name),
    useCount:  m.use_count || 0,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const athleteToken = getAthleteToken(auth);
  if (!athleteToken) return res.status(401).json({ error: "Missing AthleteToken" });

  if (req.method === "GET") {
    const { data, error } = await db
      .from("athlete_saved_meals")
      .select("id, name, items, use_count, last_used_at, created_at")
      .eq("athlete_token", athleteToken)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(MAX_SAVED);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, meals: (data ?? []).map(shape) });
  }

  if (req.method === "POST") {
    const b = req.body || {};

    // ── Log a saved meal ──────────────────────────────────────────────────
    if (b.action === "log") {
      if (!b.id || !isDate(b.toDate) || !isMealId(b.toMealId)) {
        return res.status(400).json({ error: "id, toDate, toMealId required" });
      }
      const { data: meal, error: mErr } = await db
        .from("athlete_saved_meals")
        .select("id, items, use_count")
        .eq("id", String(b.id))
        .eq("athlete_token", athleteToken)
        .maybeSingle();
      if (mErr) return res.status(500).json({ error: mErr.message });
      if (!meal) return res.status(404).json({ error: "Saved meal not found" });

      const rows = toLogRows(meal.items || [], { athleteToken, date: b.toDate, mealId: b.toMealId });
      if (!rows.length) return res.status(400).json({ error: "Saved meal is empty" });

      const { data, error } = await db.from("athlete_food_logs").insert(rows).select(LOG_COLS);
      if (error) return res.status(500).json({ error: error.message });

      await db.from("athlete_saved_meals")
        .update({ use_count: (meal.use_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", meal.id);

      return res.status(201).json({ ok: true, entries: data ?? [] });
    }

    // ── Save a logged meal under a name ───────────────────────────────────
    const name = String(b.name || "").trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: "name required" });
    if (!isDate(b.fromDate) || !isMealId(b.fromMealId)) {
      return res.status(400).json({ error: "fromDate and fromMealId required" });
    }

    const { count } = await db
      .from("athlete_saved_meals")
      .select("id", { count: "exact", head: true })
      .eq("athlete_token", athleteToken);
    if ((count || 0) >= MAX_SAVED) {
      return res.status(400).json({ error: `You can save up to ${MAX_SAVED} meals — delete one first.` });
    }

    const { data: src, error: sErr } = await db
      .from("athlete_food_logs")
      .select(LOG_COLS)
      .eq("athlete_token", athleteToken)
      .eq("log_date", b.fromDate)
      .eq("meal_id", b.fromMealId)
      .order("created_at", { ascending: true });
    if (sErr) return res.status(500).json({ error: sErr.message });

    const items = (src ?? []).map(toItem).filter(i => i.food_name && i.grams > 0);
    if (!items.length) return res.status(400).json({ error: "Log at least one food in this meal first" });

    const { data, error } = await db
      .from("athlete_saved_meals")
      .insert({ athlete_token: athleteToken, name, items })
      .select("id, name, items, use_count")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ ok: true, meal: shape(data) });
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const { error } = await db
      .from("athlete_saved_meals")
      .delete()
      .eq("id", id)
      .eq("athlete_token", athleteToken);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
