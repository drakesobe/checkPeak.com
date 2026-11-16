// lib/foodLogItems.js
// Helpers shared by the food-logging endpoints (recent foods, meal copy, saved meals).

export const LOG_COLS =
  "id, meal_id, food_name, food_id, quantity, unit, grams, calories, protein_g, carbs_g, fat_g, created_at, log_date";

/** Portable item (no ids/dates) — what saved meals store and what copy re-inserts. */
export function toItem(row) {
  return {
    food_name: String(row.food_name || "").slice(0, 200),
    food_id:   row.food_id ?? null,
    quantity:  Number(row.quantity) || 1,
    unit:      String(row.unit || "serving").slice(0, 80),
    grams:     Number(row.grams) || 0,
    calories:  Math.round(Number(row.calories)  || 0),
    protein_g: Math.round(Number(row.protein_g) || 0),
    carbs_g:   Math.round(Number(row.carbs_g)   || 0),
    fat_g:     Math.round(Number(row.fat_g)     || 0),
  };
}

export function sumItems(items) {
  return items.reduce((t, i) => ({
    calories: t.calories + (Number(i.calories)  || 0),
    protein:  t.protein  + (Number(i.protein_g) || 0),
  }), { calories: 0, protein: 0 });
}

/** Rows ready to insert into athlete_food_logs. */
export function toLogRows(items, { athleteToken, date, mealId }) {
  return items
    .map(toItem)
    .filter(i => i.food_name && i.grams > 0)
    .map(i => ({ ...i, athlete_token: athleteToken, log_date: date, meal_id: mealId }));
}

export const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
export const isMealId = m => /^[a-z_]{2,20}$/.test(String(m || ""));

export function getAthleteToken(auth) {
  return String(auth?.athlete?.AthleteToken || auth?.user?.AthleteToken || "").trim();
}
