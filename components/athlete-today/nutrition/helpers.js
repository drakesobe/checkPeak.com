// components/athlete-today/nutrition/helpers.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    try { return JSON.stringify(v, null, 2); } catch { return ""; }
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
      month: "short", day: "numeric", year: "numeric",
    }).format(d);
  } catch { return s; }
}

export function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(x)))}%`;
}

/* -------- completion helpers -------- */

export function makeEmptyCompletion() {
  return {
    breakfast:  { mealDone: false, hydrationDone: false },
    lunch:      { mealDone: false, hydrationDone: false },
    afternoon:  { mealDone: false, hydrationDone: false },
    dinner:     { mealDone: false, hydrationDone: false },
  };
}

export function safeCompletionShape(v) {
  const base = makeEmptyCompletion();
  if (!v || typeof v !== "object") return base;
  for (const k of ["breakfast", "lunch", "afternoon", "dinner"]) {
    base[k] = {
      mealDone:      Boolean(v?.[k]?.mealDone),
      hydrationDone: Boolean(v?.[k]?.hydrationDone),
    };
  }
  return base;
}

export function computeNutritionCounts(completion) {
  const c    = safeCompletionShape(completion);
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  let done = 0, total = 0;
  for (const k of keys) {
    total += 2;
    if (c[k].mealDone)      done += 1;
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
  // ── 1) freeformNotes — the actual coach free-text field, check FIRST ──────
  // planJson.notes is a structured object { macros, supplements }, NOT a string.
  // The ?? operator would stop there and never reach freeformNotes, so we check
  // freeformNotes explicitly before anything else.
  const freeform = safeText(planJson?.freeformNotes);
  if (freeform) return freeform;

  // ── 2) Legacy text fields (older plans / other entry points) ─────────────
  const legacy = safeText(
    planJson?.Prescription ??
    planJson?.prescription ??
    planJson?.coachNotes   ??
    ""
  );
  if (legacy) return legacy;

  // ── 3) planJson.notes — structured object { macros, supplements } ─────────
  // Only used as a fallback for plans that stored notes here instead of
  // freeformNotes. Both fields are usually empty strings in practice.
  const notesRaw = planJson?.notes;
  const notesStr = safeText(notesRaw);

  if (notesStr && (notesStr.startsWith("{") || notesStr.startsWith("["))) {
    try {
      const obj    = JSON.parse(notesStr);
      const macros = safeText(obj?.macros);
      const supp   = safeText(obj?.supplements);
      if (macros || supp) {
        return [
          macros ? `Macros: ${macros}`       : "",
          supp   ? `Supplements: ${supp}`    : "",
        ].filter(Boolean).join("\n");
      }
    } catch { /* keep raw */ }
  }

  return notesStr;
}

/**
 * pickSupplements
 *
 * Reads planJson.supplements and returns:
 *   items  — array of { k, label, value, affiliateLink?, imageUrl?, pricePerServing? }
 *   notes  — string dosing notes
 *
 * Priority: product object (new) → legacy string (old) → skip
 *
 * The 5 active categories mirror SUPP_CATEGORIES in PlanBuilderForm:
 *   Pre-Workout, Protein Powder, Creatine, Protein Bars, BCAAs
 * Legacy electrolytes kept for backward compat with old plans.
 */
export function pickSupplements({ planJson }) {
  const src =
    (planJson?.supplements && typeof planJson.supplements === "object"
      ? planJson.supplements
      : null) ||
    (planJson?.recommendations && typeof planJson.recommendations === "object"
      ? planJson.recommendations
      : null) ||
    planJson;

  // Helper — try the product object first, fall back to the string recommendation
  function resolveItem({ k, label, productKey, stringKey }) {
    const product = src?.[productKey];

    // Valid product object from the new picker
    if (product && typeof product === "object" && safeText(product.name)) {
      return {
        k,
        label,
        value:          safeText(product.name),
        affiliateLink:  safeText(product.affiliateLink || ""),
        imageUrl:       safeText(product.imageUrl      || ""),
        pricePerServing: product.pricePerServing != null
          ? Number(product.pricePerServing) || null
          : null,
      };
    }

    // Legacy string recommendation
    const str = safeText(src?.[stringKey]);
    if (str) {
      return { k, label, value: str };
    }

    return null;
  }

  const items = [
    resolveItem({ k: "preWorkout",   label: "Pre-Workout",    productKey: "preWorkoutProduct",  stringKey: "preWorkoutRecommendation"   }),
    resolveItem({ k: "protein",      label: "Protein",        productKey: "proteinProduct",     stringKey: "proteinRecommendation"      }),
    resolveItem({ k: "creatine",     label: "Creatine",       productKey: "creatineProduct",    stringKey: "creatineRecommendation"     }),
    resolveItem({ k: "proteinBar",   label: "Protein Bars",   productKey: "proteinBarProduct",  stringKey: "proteinBarRecommendation"   }),
    resolveItem({ k: "bcaa",         label: "BCAA / EAA",     productKey: "bcaaProduct",        stringKey: "bcaaRecommendation"         }),
    // Legacy — kept so old plans still render
    resolveItem({ k: "electrolytes", label: "Electrolytes",   productKey: "electrolytesProduct", stringKey: "electrolytesRecommendation" }),
  ].filter(Boolean);

  const notes = safeText(src?.notesSupplements || planJson?.notes?.supplements || "");

  return { items, notes };
}