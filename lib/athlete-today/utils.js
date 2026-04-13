// lib/athlete-today/utils.js
//
// Single source of truth for the athlete today experience.
// Previously duplicated across today.jsx, TodayStrip.jsx,
// DayPlannerSheet.jsx, and day.jsx. Import from here — never redefine locally.
//
// TODO for DayPlannerSheet.jsx: replace its local copies of everything below
// with imports from this file. The function signatures are identical.

// ─── MEAL CONSTANTS ───────────────────────────────────────────────────────────
export const MEAL_DEFAULTS = {
  breakfast: { startMinutes: 7 * 60,       durationMinutes: 45 },
  lunch:     { startMinutes: 12 * 60,      durationMinutes: 45 },
  afternoon: { startMinutes: 15 * 60,      durationMinutes: 30 },
  dinner:    { startMinutes: 18 * 60 + 30, durationMinutes: 45 },
};

export const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch:     "Lunch",
  afternoon: "Snack",
  dinner:    "Dinner",
};

// ─── NUTRITION COMPLETION ─────────────────────────────────────────────────────
export function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch:     { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner:    { mealDone: false, hydrationDone: false },
  };
}

export function normalizeCompletion(raw) {
  const base = makeEmptyCompletion();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    const row = (raw[k] && typeof raw[k] === "object") ? raw[k] : {};
    out[k] = { mealDone: Boolean(row.mealDone), hydrationDone: Boolean(row.hydrationDone) };
  }
  return out;
}

/**
 * Returns { done, total } counting all meal + hydration checkboxes.
 * Only call this if the athlete has an active nutrition plan — otherwise
 * you inflate totalItems for athletes with no targets.
 */
export function computeNutritionCounts(comp) {
  let done = 0, total = 0;
  for (const k of Object.keys(makeEmptyCompletion())) {
    total += 2;
    if (comp?.[k]?.mealDone)      done++;
    if (comp?.[k]?.hydrationDone) done++;
  }
  return { done, total };
}

// ─── CLASS SCHEDULE ───────────────────────────────────────────────────────────

/**
 * Returns true if a recurring class schedule appears on a given date string
 * (YYYY-MM-DD). Checks day-of-week, startDate, and endDate.
 */
export function classMatchesDate(cls, dateStr) {
  const dow = new Date(`${dateStr}T12:00:00`).getDay();
  if (!Array.isArray(cls.days) || !cls.days.includes(dow)) return false;
  if (cls.startDate && dateStr < cls.startDate) return false;
  if (cls.endDate   && dateStr > cls.endDate)   return false;
  return true;
}

/**
 * Returns a short day pattern string like "M/W/F" from an array of
 * JS getDay() values (0 = Sun, 1 = Mon … 6 = Sat).
 */
export function dayPattern(days) {
  if (!Array.isArray(days) || !days.length) return null;
  const S = { 0: "Su", 1: "M", 2: "T", 3: "W", 4: "Th", 5: "F", 6: "Sa" };
  return [...days]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(d => S[d] || "?")
    .join("/");
}

// ─── FORMATTING ───────────────────────────────────────────────────────────────

/** Converts total minutes-from-midnight to "9:00 AM" format. */
export function formatTime(min) {
  const h  = Math.floor(min / 60) % 24;
  const mn = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(mn).padStart(2, "0")} ${ap}`;
}

// ─── NUTRITION EVENT BUILDER ──────────────────────────────────────────────────

/**
 * Builds synthetic event objects for the four default meal slots.
 * Uses mealBlocks names if the coach has set them.
 */
export function buildNutritionDefaults(mealBlocks) {
  return Object.entries(MEAL_DEFAULTS).map(([key, def]) => ({
    id:      `nutrition_${key}`,
    source:  "nutrition",
    mealKey: key,
    title:   mealBlocks?.[key]?.name || MEAL_LABELS[key] || key,
    type:    "meal",
    ...def,
  }));
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
// Thin wrappers — same guards used across the codebase.

export function lsGet(k) {
  try { return typeof window !== "undefined" ? localStorage.getItem(k) : null; }
  catch { return null; }
}

export function lsSet(k, v) {
  try { if (typeof window !== "undefined") localStorage.setItem(k, v); }
  catch {}
}