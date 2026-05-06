// components/org/prescriptions/planBuilder/mealBlocks/mealBlockUtils.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function asNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

export function normalizeSplit(split) {
  const s = split && typeof split === "object" ? split : {};
  const b = clamp(s.breakfast ?? 0.25, 0, 1);
  const l = clamp(s.lunch ?? 0.3, 0, 1);
  const a = clamp(s.afternoon ?? 0.15, 0, 1);
  const d = clamp(s.dinner ?? 0.3, 0, 1);
  const sum = b + l + a + d;
  if (!sum) return { breakfast: 0.25, lunch: 0.3, afternoon: 0.15, dinner: 0.3 };
  return { breakfast: b / sum, lunch: l / sum, afternoon: a / sum, dinner: d / sum };
}

export function pctStr(r) {
  const x = Number(r);
  if (!Number.isFinite(x)) return "-";
  return `${Math.round(x * 100)}%`;
}

export function mealCardTitle(key) {
  if (key === "breakfast") return "Breakfast";
  if (key === "lunch") return "Lunch";
  if (key === "afternoon") return "Afternoon";
  if (key === "dinner") return "Dinner";
  return key;
}

/**
 * Default structure for a meal block.
 * ✅ Added hydrationOz into targets so we can split daily hydration per meal.
 */
export function getDefaultMealBlock(label) {
  return {
    name: label,
    targets: { calories: "", protein: "", carbs: "", fat: "", hydrationOz: "" }, // ✅ NEW
    diningHallRules: "",
    homeExamples: "",
    smartStackItems: [],
  };
}

/**
 * Robust getter:
 * supports builder shape (proteinGrams/carbsGrams/fatsGrams/hydrationOz)
 * AND PlanJson daily shape (protein/carbs/fat/hydration)
 */
export function pickStructuredMacro(structured, keys) {
  const s = structured && typeof structured === "object" ? structured : {};
  for (const k of keys) {
    const v = s?.[k];
    const n = asNum(v);
    if (n != null) return n;
  }
  return null;
}
