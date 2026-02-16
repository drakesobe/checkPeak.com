// components/athlete-today/nutrition/helpers.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "";
    }
  }
  return String(v).trim();
}

export function toNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fmt(v) {
  const n = toNum(v);
  return n == null ? "—" : String(n);
}

export function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

export function fmtHumanDate(isoDate) {
  const s = String(isoDate || "").trim();
  if (!isISODateOnly(s)) return s || "—";
  const d = new Date(`${s}T12:00:00`);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return s;
  }
}

export function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(x)))}%`;
}

/* -------- completion helpers -------- */

export function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch: { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner: { mealDone: false, hydrationDone: false },
  };
}

export function safeCompletionShape(v) {
  const base = makeEmptyCompletion();
  if (!v || typeof v !== "object") return base;

  for (const k of ["breakfast", "lunch", "afternoon", "dinner"]) {
    base[k] = {
      mealDone: Boolean(v?.[k]?.mealDone),
      hydrationDone: Boolean(v?.[k]?.hydrationDone),
    };
  }
  return base;
}

export function computeNutritionCounts(completion) {
  const c = safeCompletionShape(completion);
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  let done = 0;
  let total = 0;

  for (const k of keys) {
    total += 2; // meal + hydration
    if (c[k].mealDone) done += 1;
    if (c[k].hydrationDone) done += 1;
  }

  return { done, total, pct: total ? (done / total) * 100 : 0 };
}

/* -------- plan pickers -------- */

export function pickDailyHydrationOz({ daily, planJson, dailyHydrationOzProp }) {
  const p = toNum(dailyHydrationOzProp);
  if (p != null) return p;

  const d1 = toNum(daily?.hydrationOz);
  const d2 = toNum(daily?.DailyHydration);
  if (d1 != null) return d1;
  if (d2 != null) return d2;

  const pj1 = toNum(planJson?.daily?.hydrationOz);
  const pj2 = toNum(planJson?.daily?.DailyHydration);
  const pj3 = toNum(planJson?.hydrationOz);
  const pj4 = toNum(planJson?.DailyHydration);
  return pj1 ?? pj2 ?? pj3 ?? pj4 ?? null;
}

export function pickCoachNotes({ planJson }) {
  const v =
    planJson?.Prescription ??
    planJson?.prescription ??
    planJson?.coachNotes ??
    planJson?.notes ??
    planJson?.freeformNotes ??
    "";

  const s = safeText(v);

  if (s && (s.startsWith("{") || s.startsWith("["))) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object") {
        const macros = safeText(obj?.macros);
        const supp = safeText(obj?.supplements);
        if (macros || supp) {
          return [macros ? `Macros: ${macros}` : "", supp ? `Supplements: ${supp}` : ""]
            .filter(Boolean)
            .join("\n");
        }
        return JSON.stringify(obj, null, 2);
      }
    } catch {
      // keep raw
    }
  }

  return s;
}

export function pickSupplements({ planJson }) {
  const src =
    (planJson?.supplements && typeof planJson.supplements === "object" ? planJson.supplements : null) ||
    (planJson?.recommendations && typeof planJson.recommendations === "object"
      ? planJson.recommendations
      : null) ||
    planJson;

  const protein = safeText(src?.proteinRecommendation);
  const creatine = safeText(src?.creatineRecommendation);
  const bcaa = safeText(src?.bcaaRecommendation);
  const electrolytes = safeText(src?.electrolytesRecommendation);
  const notes = safeText(src?.notesSupplements);

  const items = [
    protein ? { k: "protein", label: "Protein", value: protein } : null,
    creatine ? { k: "creatine", label: "Creatine", value: creatine } : null,
    bcaa ? { k: "bcaa", label: "BCAA/EAA", value: bcaa } : null,
    electrolytes ? { k: "electrolytes", label: "Electrolytes", value: electrolytes } : null,
  ].filter(Boolean);

  return { items, notes };
}
