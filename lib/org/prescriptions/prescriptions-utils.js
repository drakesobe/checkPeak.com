// lib/org/prescriptions/prescriptions-utils.js

function safeFirst(v) {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function dateToISO(dateStr) {
  const s = String(dateStr || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function getAthleteToken(a) {
  // Supports Airtable field casing + lookup arrays
  return String(
    safeFirst(
      a?.athleteToken ||
        a?.AthleteToken ||
        a?.["AthleteToken"] ||
        a?.fields?.AthleteToken ||
        a?.fields?.athleteToken
    ) || ""
  ).trim();
}

/* ---------------- meal blocks helpers ---------------- */

/**
 * ✅ IMPORTANT FIX:
 * - Number("") is 0 in JS, which was causing blank fields to become 0 in PlanJson.
 * - We treat empty/whitespace as null.
 * - We preserve explicit 0 if the user actually enters "0" / 0.
 */
function numOrNull(v) {
  if (v === 0) return 0; // preserve explicit 0
  const s = String(v ?? "").trim();
  if (!s) return null; // ✅ blank -> null (NOT 0)
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function roundInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x);
}

function clampRatio(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export const MEAL_KEYS = ["breakfast", "lunch", "afternoon", "dinner"];

export function defaultMealBlocks() {
  return {
    breakfast: {
      name: "Breakfast",
      targets: { calories: "", protein: "", carbs: "", fat: "" },
      diningHallRules: "",
      homeExamples: "",
      smartStackItems: [], // later: IDs
    },
    lunch: {
      name: "Lunch",
      targets: { calories: "", protein: "", carbs: "", fat: "" },
      diningHallRules: "",
      homeExamples: "",
      smartStackItems: [],
    },
    afternoon: {
      name: "Afternoon",
      targets: { calories: "", protein: "", carbs: "", fat: "" },
      diningHallRules: "",
      homeExamples: "",
      smartStackItems: [],
    },
    dinner: {
      name: "Dinner",
      targets: { calories: "", protein: "", carbs: "", fat: "" },
      diningHallRules: "",
      homeExamples: "",
      smartStackItems: [],
    },
  };
}

export function normalizeMealSplit(split) {
  const s = split && typeof split === "object" ? split : {};
  const raw = {
    breakfast: clampRatio(s.breakfast ?? 0.25),
    lunch: clampRatio(s.lunch ?? 0.30),
    afternoon: clampRatio(s.afternoon ?? 0.15),
    dinner: clampRatio(s.dinner ?? 0.30),
  };
  const sum = raw.breakfast + raw.lunch + raw.afternoon + raw.dinner;

  // If sum is 0, fall back to default
  if (!sum) {
    return { breakfast: 0.25, lunch: 0.30, afternoon: 0.15, dinner: 0.30 };
  }

  // Normalize to sum=1
  return {
    breakfast: raw.breakfast / sum,
    lunch: raw.lunch / sum,
    afternoon: raw.afternoon / sum,
    dinner: raw.dinner / sum,
  };
}

/**
 * Auto-split daily totals into meal targets using mealSplit ratios.
 * - Rounds each meal to integers
 * - Reconciles totals by adjusting dinner (last meal) so sums match daily totals
 */
export function autoSplitMeals(structured) {
  const split = normalizeMealSplit(structured?.mealSplit);

  const daily = {
    calories: numOrNull(structured?.calories),
    protein: numOrNull(structured?.proteinGrams),
    carbs: numOrNull(structured?.carbsGrams),
    fat: numOrNull(structured?.fatsGrams),
  };

  const baseBlocks =
    structured?.mealBlocks && typeof structured.mealBlocks === "object"
      ? structured.mealBlocks
      : defaultMealBlocks();

  // ✅ FIX: only skip if ALL are null (blank)
  const noDailyTotals =
    daily.calories == null &&
    daily.protein == null &&
    daily.carbs == null &&
    daily.fat == null;

  if (noDailyTotals) return baseBlocks;

  const next = { ...baseBlocks };

  const alloc = (total, ratio) => {
    if (!Number.isFinite(total)) return null;
    return roundInt(total * ratio);
  };

  // First pass (rounded)
  for (const key of MEAL_KEYS) {
    const r = split[key];
    const prev = next[key] || {};
    const prevTargets = prev.targets || {};

    next[key] = {
      ...prev,
      name: prev.name || key,
      targets: {
        ...prevTargets,
        calories:
          daily.calories == null ? prevTargets.calories : String(alloc(daily.calories, r) ?? ""),
        protein:
          daily.protein == null ? prevTargets.protein : String(alloc(daily.protein, r) ?? ""),
        carbs:
          daily.carbs == null ? prevTargets.carbs : String(alloc(daily.carbs, r) ?? ""),
        fat:
          daily.fat == null ? prevTargets.fat : String(alloc(daily.fat, r) ?? ""),
      },
    };
  }

  // Reconcile sums by adjusting dinner
  const reconcile = (field) => {
    const total = daily[field];
    if (!Number.isFinite(total)) return;

    const sum =
      (numOrNull(next.breakfast?.targets?.[field]) ?? 0) +
      (numOrNull(next.lunch?.targets?.[field]) ?? 0) +
      (numOrNull(next.afternoon?.targets?.[field]) ?? 0) +
      (numOrNull(next.dinner?.targets?.[field]) ?? 0);

    const diff = roundInt(total - sum);
    if (!diff) return;

    const dinnerVal = numOrNull(next.dinner?.targets?.[field]) ?? 0;
    const fixed = dinnerVal + diff;

    next.dinner = {
      ...next.dinner,
      targets: { ...(next.dinner?.targets || {}), [field]: String(fixed) },
    };
  };

  reconcile("calories");
  reconcile("protein");
  reconcile("carbs");
  reconcile("fat");

  return next;
}

/* ---------------- summary text ---------------- */

function fmtBlockLine(label, t) {
  const cals = t?.calories || "-";
  const p = t?.protein || "-";
  const c = t?.carbs || "-";
  const f = t?.fat || "-";
  return `- ${label}: ${cals} cals • ${p}P • ${c}C • ${f}F`;
}

export function buildPlanSummaryText(plan) {
  const lines = [];

  lines.push("SUPPLEMENTS");
  lines.push(`- Protein: ${plan.proteinRecommendation || "-"}`);
  lines.push(`- Creatine: ${plan.creatineRecommendation || "-"}`);
  lines.push(`- BCAA/EAA: ${plan.bcaaRecommendation || "-"}`);
  lines.push(`- Electrolytes: ${plan.electrolytesRecommendation || "-"}`);
  lines.push(`- Notes (Supplements): ${plan.notesSupplements || "-"}`);

  lines.push("");
  lines.push("MACROS");
  lines.push(`- Phase: ${plan.phase || "-"}`);
  lines.push(`- Calories: ${plan.calories || "-"}`);
  lines.push(`- Protein (g): ${plan.proteinGrams || "-"}`);
  lines.push(`- Carbs (g): ${plan.carbsGrams || "-"}`);
  lines.push(`- Fat (g): ${plan.fatsGrams || "-"}`);
  lines.push(`- Hydration (oz): ${plan.hydrationOz || "-"}`);
  lines.push(`- Notes (Macros): ${plan.notesMacros || "-"}`);

  // Meal blocks (Targets + Options)
  const mb = plan?.mealBlocks && typeof plan.mealBlocks === "object" ? plan.mealBlocks : null;
  if (mb) {
    lines.push("");
    lines.push("MEAL BLOCK TARGETS");
    lines.push(fmtBlockLine("Breakfast", mb.breakfast?.targets));
    lines.push(fmtBlockLine("Lunch", mb.lunch?.targets));
    lines.push(fmtBlockLine("Afternoon", mb.afternoon?.targets));
    lines.push(fmtBlockLine("Dinner", mb.dinner?.targets));

    // Optional suggestions
    const addSuggestion = (label, block) => {
      const dh = String(block?.diningHallRules || "").trim();
      const home = String(block?.homeExamples || "").trim();
      if (!dh && !home) return;
      lines.push("");
      lines.push(`${label.toUpperCase()} OPTIONS`);
      if (dh) lines.push(`- Dining hall: ${dh}`);
      if (home) lines.push(`- Home: ${home}`);
    };

    addSuggestion("Breakfast", mb.breakfast);
    addSuggestion("Lunch", mb.lunch);
    addSuggestion("Afternoon", mb.afternoon);
    addSuggestion("Dinner", mb.dinner);
  }

  if (plan.freeformNotes?.trim()) {
    lines.push("");
    lines.push("COACH NOTES");
    lines.push(plan.freeformNotes.trim());
  }

  return lines.join("\n");
}

/* ---------------- PlanJson builder ---------------- */

export function buildNutritionPlanJson(structured, { createdBy = "" } = {}) {
  const mealSplit = normalizeMealSplit(structured?.mealSplit);

  const mealBlocks =
    structured?.mealBlocks && typeof structured.mealBlocks === "object"
      ? structured.mealBlocks
      : defaultMealBlocks();

  // v1: store meal blocks as an object, plus a derived array for easy rendering later
  const mealsArray = MEAL_KEYS.map((k) => {
    const b = mealBlocks?.[k] || {};
    const t = b?.targets || {};
    return {
      key: k,
      name: b?.name || k,
      targets: {
        calories: numOrNull(t.calories),
        protein: numOrNull(t.protein),
        carbs: numOrNull(t.carbs),
        fat: numOrNull(t.fat),
      },
      diningHallRules: String(b?.diningHallRules || "").trim(),
      homeExamples: String(b?.homeExamples || "").trim(),
      smartStackItems: Array.isArray(b?.smartStackItems) ? b.smartStackItems : [],
    };
  });

  return {
    version: 1,
    phase: String(structured.phase || "Maintain"),
    daily: {
      // ✅ blank inputs now become null, NOT 0
      calories: numOrNull(structured.calories),
      protein: numOrNull(structured.proteinGrams),
      carbs: numOrNull(structured.carbsGrams),
      fat: numOrNull(structured.fatsGrams),
    },
    mealSplit,
    mealBlocks, // object form (editable)
    meals: mealsArray, // array form (render-friendly)
    supplements: {
      protein: structured.proteinRecommendation || "",
      creatine: structured.creatineRecommendation || "",
      bcaaEaa: structured.bcaaRecommendation || "",
      electrolytes: structured.electrolytesRecommendation || "",
      notes: structured.notesSupplements || "",
    },
    notesMacros: structured.notesMacros || "",
    hydrationOz: numOrNull(structured.hydrationOz),
    notes: String(structured.freeformNotes || "").trim(),
    meta: {
      status: String(structured.metaStatus || "Active"),
      effectiveDate: dateToISO(structured.metaEffectiveDate) || "",
    },
    updatedAt: new Date().toISOString(),
    updatedBy: createdBy || "",
  };
}

export const DEFAULT_STRUCTURED = {
  phase: "Maintain",

  calories: "",
  proteinGrams: "",
  carbsGrams: "",
  fatsGrams: "",
  hydrationOz: "",
  notesMacros: "",

  // Meal blocks
  mealSplit: {
    breakfast: 0.25,
    lunch: 0.3,
    afternoon: 0.15,
    dinner: 0.3,
  },
  mealBlocks: defaultMealBlocks(),

  proteinRecommendation: "",
  creatineRecommendation: "",
  bcaaRecommendation: "",
  electrolytesRecommendation: "",
  notesSupplements: "",

  metaStatus: "Active",
  metaEffectiveDate: "",

  freeformNotes: "",
};

export function getEmailFromAthlete(a) {
  return normalizeEmail(a?.email || a?.fields?.Email || a?.Email);
}
