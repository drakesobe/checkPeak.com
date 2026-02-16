// components/athlete-today/NutritionCard.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  ArrowRight,
  CheckCircle2,
  Circle,
  Info,
  Pill as PillIcon,
} from "lucide-react";

/* ---------------- helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    // Avoid "[object Object]" in UI
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "";
    }
  }
  return String(v).trim();
}

function toNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmt(v) {
  const n = toNum(v);
  return n == null ? "—" : String(n);
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function fmtHumanDate(isoDate) {
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

function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(x)))}%`;
}

function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch: { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner: { mealDone: false, hydrationDone: false },
  };
}

function safeCompletionShape(v) {
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

function computeNutritionCounts(completion) {
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

function pickDailyHydrationOz({ daily, planJson, dailyHydrationOzProp }) {
  // prefer explicit prop
  const p = toNum(dailyHydrationOzProp);
  if (p != null) return p;

  // then daily shape
  const d1 = toNum(daily?.hydrationOz);
  const d2 = toNum(daily?.DailyHydration);
  if (d1 != null) return d1;
  if (d2 != null) return d2;

  // then planJson shapes
  const pj1 = toNum(planJson?.daily?.hydrationOz);
  const pj2 = toNum(planJson?.daily?.DailyHydration);
  const pj3 = toNum(planJson?.hydrationOz);
  const pj4 = toNum(planJson?.DailyHydration);
  return pj1 ?? pj2 ?? pj3 ?? pj4 ?? null;
}

function pickCoachNotes({ planJson }) {
  // Your Airtable column: "Prescription" (long text)
  // Support several shapes to avoid future breakage.
  const v =
    planJson?.Prescription ??
    planJson?.prescription ??
    planJson?.coachNotes ??
    planJson?.notes ??
    planJson?.freeformNotes ??
    "";
  const s = safeText(v);

  // If it looks like a JSON blob that used to be in coach notes,
  // format it nicer for humans.
  if (s && (s.startsWith("{") || s.startsWith("["))) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object") {
        // special case: { macros, supplements }
        const macros = safeText(obj?.macros);
        const supp = safeText(obj?.supplements);
        if (macros || supp) {
          return [
            macros ? `Macros: ${macros}` : "",
            supp ? `Supplements: ${supp}` : "",
          ]
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

function pickSupplements({ planJson }) {
  // These are suggestions, not medical advice.
  // Support both a nested object and “flat” structured keys.
  const src =
    (planJson?.supplements && typeof planJson.supplements === "object" ? planJson.supplements : null) ||
    (planJson?.recommendations && typeof planJson.recommendations === "object" ? planJson.recommendations : null) ||
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

/* ---------------- small UI atoms ---------------- */

function TinyPill({ children, tone = "base" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "base" && "bg-white border-gray-200 text-gray-700",
        tone === "soft" && "bg-gray-50 border-gray-200 text-gray-700",
        tone === "blue" && "bg-blue-50 border-blue-200 text-blue-700",
        tone === "ok" && "bg-emerald-50 border-emerald-200 text-emerald-700",
        tone === "warn" && "bg-amber-50 border-amber-200 text-amber-800"
      )}
    >
      {children}
    </span>
  );
}

function ProgressBar({ pctValue }) {
  const w = Math.max(0, Math.min(100, Number(pctValue) || 0));
  return (
    <div className="h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
      <div className="h-full rounded-full bg-[#46769B] transition-all" style={{ width: `${w}%` }} />
    </div>
  );
}

/**
 * Swipe-to-complete:
 * - Drag right to confirm
 * - Also has a check button for desktop
 */
function SwipeCompleteRow({
  title,
  subtitle,
  done,
  onToggle,
  icon,
  disabled = false,
}) {
  const [armed, setArmed] = useState(false);

  return (
    <div
      className={cx(
        "relative rounded-2xl border bg-white shadow-sm overflow-hidden",
        done ? "border-emerald-200" : "border-gray-200",
        disabled && "opacity-70"
      )}
    >
      {/* background affordance */}
      <div className={cx("absolute inset-0", done ? "bg-emerald-50" : "bg-white")} />

      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 120 }}
        dragElastic={0.08}
        onDrag={(e, info) => {
          if (disabled) return;
          setArmed(info.offset.x > 70);
        }}
        onDragEnd={(e, info) => {
          if (disabled) return;
          const shouldComplete = info.offset.x > 90;
          setArmed(false);
          if (shouldComplete) onToggle?.();
        }}
        className="relative p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cx(
                  "h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0",
                  done ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
                )}
              >
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>
                {subtitle ? (
                  <p className="text-[12px] text-gray-600 mt-0.5 break-words">{subtitle}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <TinyPill tone={done ? "ok" : "soft"}>
                {done ? (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Circle className="w-3.5 h-3.5" />
                    Not done yet
                  </span>
                )}
              </TinyPill>

              <span className="text-[11px] text-gray-500">
                {disabled ? "Unavailable" : armed ? "Release to complete" : "Swipe right to complete"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !disabled && onToggle?.()}
            className={cx(
              "shrink-0 rounded-xl px-3 py-2 text-[12px] font-semibold border transition",
              done
                ? "bg-emerald-600 text-white border-emerald-600 hover:brightness-110"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
              disabled && "cursor-not-allowed hover:bg-white"
            )}
            disabled={disabled}
            aria-pressed={done}
            title={done ? "Mark as not done" : "Mark as done"}
          >
            {done ? "Undo" : "Done"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MacroGrid({ t }) {
  const calories = fmt(t?.calories);
  const protein = fmt(t?.protein);
  const carbs = fmt(t?.carbs);
  const fat = fmt(t?.fat);
  const water = fmt(t?.hydrationOz);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 min-w-0">
        <p className="text-[11px] text-gray-500 truncate">Calories</p>
        <p className="text-sm font-extrabold text-gray-900 mt-1 tabular-nums">{calories}</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 min-w-0">
        <p className="text-[11px] text-gray-500 truncate">Protein</p>
        <p className="text-sm font-extrabold text-gray-900 mt-1 tabular-nums">{protein}g</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 min-w-0">
        <p className="text-[11px] text-gray-500 truncate">Carbs</p>
        <p className="text-sm font-extrabold text-gray-900 mt-1 tabular-nums">{carbs}g</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 min-w-0">
        <p className="text-[11px] text-gray-500 truncate">Fat</p>
        <p className="text-sm font-extrabold text-gray-900 mt-1 tabular-nums">{fat}g</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-blue-50 p-3 min-w-0">
        <p className="text-[11px] text-blue-700 truncate">Water</p>
        <p className="text-sm font-extrabold text-blue-900 mt-1 tabular-nums">{water}oz</p>
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */

export default function NutritionCard({
  loading,
  err,
  hasPlan,
  daily,
  mealBlocks,
  planJson,
  onRefresh,
  onOpenNutrition,

  selectedDate,
  effectiveDate,
  nextPlan,
  isFuture,
  message,

  // Optional prop from AthleteToday (still computed defensively)
  dailyHydrationOz: dailyHydrationOzProp,

  // ✅ Completion plumbing (lifted state)
  nutritionCompletion,
  onCompletionChange,
}) {
  const completion = useMemo(
    () => safeCompletionShape(nutritionCompletion),
    [nutritionCompletion]
  );

  const counts = useMemo(
    () => computeNutritionCounts(completion),
    [completion]
  );

  const coachNotes = useMemo(() => pickCoachNotes({ planJson }), [planJson]);

  const { items: supplementItems, notes: supplementNotes } = useMemo(
    () => pickSupplements({ planJson }),
    [planJson]
  );

  const dailyHydrationOz = useMemo(
    () => pickDailyHydrationOz({ daily, planJson, dailyHydrationOzProp }),
    [daily, planJson, dailyHydrationOzProp]
  );

  const metaStatus = useMemo(() => safeText(planJson?.meta?.status), [planJson]);

  const metaEff = useMemo(() => {
    const eff = safeText(planJson?.meta?.effectiveDate) || safeText(effectiveDate);
    if (/^\d{4}-\d{2}-\d{2}T/.test(eff)) return eff.slice(0, 10);
    return eff;
  }, [planJson, effectiveDate]);

  const subtitle = useMemo(() => {
    const d = safeText(selectedDate);
    if (isISODateOnly(d)) {
      return `Suggested targets for ${fmtHumanDate(d)} — built for real life (especially campus dining).`;
    }
    return "Suggested targets by meal + daily macros from your coach.";
  }, [selectedDate]);

  const showUpcoming = Boolean(!loading && !err && !hasPlan && (isFuture || safeText(nextPlan?.effectiveDate)));

  // Tabs / expandable meal UX (Skimmer-ish)
  const mealKeys = useMemo(() => ["breakfast", "lunch", "afternoon", "dinner"], []);
  const mealLabels = useMemo(
    () => ({
      breakfast: "Breakfast",
      lunch: "Lunch",
      afternoon: "Afternoon",
      dinner: "Dinner",
    }),
    []
  );

  const [activeMeal, setActiveMeal] = useState("breakfast");
  const [suppOpen, setSuppOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const setCompletion = useCallback(
    (next) => {
      if (typeof onCompletionChange === "function") onCompletionChange(next);
    },
    [onCompletionChange]
  );

  const toggleMealDone = useCallback(
    (mealKey) => {
      const cur = safeCompletionShape(nutritionCompletion);
      const next = {
        ...cur,
        [mealKey]: { ...cur[mealKey], mealDone: !cur[mealKey].mealDone },
      };
      setCompletion(next);
    },
    [nutritionCompletion, setCompletion]
  );

  const toggleHydrationDone = useCallback(
    (mealKey) => {
      const cur = safeCompletionShape(nutritionCompletion);
      const next = {
        ...cur,
        [mealKey]: { ...cur[mealKey], hydrationDone: !cur[mealKey].hydrationDone },
      };
      setCompletion(next);
    },
    [nutritionCompletion, setCompletion]
  );

  // targets for current meal
  const currentMealBlock = useMemo(() => {
    const mb = mealBlocks && typeof mealBlocks === "object" ? mealBlocks : null;
    if (!mb) return null;
    const b = mb?.[activeMeal];
    return b && typeof b === "object" ? b : null;
  }, [mealBlocks, activeMeal]);

  const currentTargets = useMemo(() => currentMealBlock?.targets || {}, [currentMealBlock]);
  const currentDining = useMemo(() => safeText(currentMealBlock?.diningHallRules), [currentMealBlock]);
  const currentHome = useMemo(() => safeText(currentMealBlock?.homeExamples), [currentMealBlock]);

  // daily values
  const dailyCalories = useMemo(() => fmt(daily?.calories), [daily]);
  const dailyProtein = useMemo(() => fmt(daily?.protein), [daily]);
  const dailyCarbs = useMemo(() => fmt(daily?.carbs), [daily]);
  const dailyFat = useMemo(() => fmt(daily?.fat), [daily]);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 overflow-visible">
      {/* Header row */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-gray-900">Nutrition</h2>

              <TinyPill tone="blue">Suggested</TinyPill>

              {metaStatus ? <TinyPill tone="soft">{metaStatus}</TinyPill> : null}

              {/* Completion lives INSIDE this card */}
              <TinyPill tone={counts.done === counts.total && counts.total > 0 ? "ok" : "soft"}>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {counts.done}/{counts.total} complete ({pct(counts.pct)})
                </span>
              </TinyPill>
            </div>

            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>

            {metaEff && isISODateOnly(metaEff) ? (
              <p className="text-[11px] text-gray-500 mt-1">
                Plan effective:{" "}
                <span className="font-semibold text-gray-700">{fmtHumanDate(metaEff)}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={onRefresh}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenNutrition}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
            >
              <span className="inline-flex items-center gap-2">
                Open <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>

        {/* progress bar */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Daily completion</p>
            <p className="text-[11px] text-gray-600">
              Meal + hydration per meal (swipe right to complete).
            </p>
          </div>
          <div className="mt-3">
            <ProgressBar pctValue={counts.pct} />
          </div>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Loading nutrition plan…</p>
        </div>
      ) : err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{err}</p>
          <p className="text-xs text-red-700/80 mt-1">
            If this persists, confirm /api/athlete/nutrition/today is deployed and the athlete session cookie is valid.
          </p>
        </div>
      ) : !hasPlan ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {showUpcoming ? "Plan starts soon" : "No plan yet"}
            </p>

            <p className="text-sm text-gray-600 mt-1">
              {showUpcoming ? (
                <>
                  {safeText(message) ? (
                    <span>{message}</span>
                  ) : (
                    <>
                      No plan is effective for this date.{" "}
                      {safeText(nextPlan?.effectiveDate) ? (
                        <>
                          Next plan starts{" "}
                          <span className="font-semibold text-gray-800">
                            {fmtHumanDate(String(nextPlan.effectiveDate))}
                          </span>
                          .
                        </>
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <>Your coach hasn’t assigned a nutrition plan. Check back soon.</>
              )}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenNutrition}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Open Nutrition →
              </button>

              <button
                type="button"
                onClick={onRefresh}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">How to use this</p>
            <p className="text-sm text-blue-900/80 mt-1">
              Targets are guidance — not “mandatory” like workouts. Focus on hitting the big rocks:
              protein, hydration, and reasonable portions.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4 overflow-visible">
          {/* Daily targets (include hydration) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm overflow-visible">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-gray-900">Daily Targets</p>
                <p className="text-xs text-gray-500 mt-1">
                  Aim to be close — consistency beats perfection.
                </p>
              </div>

              {dailyHydrationOz != null ? (
                <TinyPill tone="ok">
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    Hydration {dailyHydrationOz} oz
                  </span>
                </TinyPill>
              ) : (
                <TinyPill tone="soft">
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5" />
                    Hydration —
                  </span>
                </TinyPill>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] text-gray-500">Calories</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{dailyCalories}</p>
                <p className="text-[11px] text-gray-500 mt-1">kcal</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] text-gray-500">Protein</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{dailyProtein}</p>
                <p className="text-[11px] text-gray-500 mt-1">grams</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] text-gray-500">Carbs</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{dailyCarbs}</p>
                <p className="text-[11px] text-gray-500 mt-1">grams</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] text-gray-500">Fat</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{dailyFat}</p>
                <p className="text-[11px] text-gray-500 mt-1">grams</p>
              </div>
            </div>
          </div>

          {/* Targets by meal: clickable/swipeable tabs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm overflow-visible">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-gray-900">Targets by Meal</p>
                <p className="text-xs text-gray-500 mt-1">
                  Tap a meal tab. Complete the meal + hydration when you’re done.
                </p>
              </div>

              <TinyPill tone="soft">
                <span className="inline-flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Suggested, not medical advice
                </span>
              </TinyPill>
            </div>

            {/* Tabs */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {mealKeys.map((k) => {
                const isActive = activeMeal === k;
                const doneMeal = Boolean(completion?.[k]?.mealDone);
                const doneWater = Boolean(completion?.[k]?.hydrationDone);
                const doneBoth = doneMeal && doneWater;

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setActiveMeal(k)}
                    className={cx(
                      "shrink-0 rounded-2xl border px-3 py-2 text-left transition",
                      isActive
                        ? "bg-[#46769B] text-white border-[#46769B]"
                        : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold">{mealLabels[k]}</span>
                      {doneBoth ? (
                        <CheckCircle2 className={cx("w-4 h-4", isActive ? "text-white" : "text-emerald-600")} />
                      ) : (
                        <Circle className={cx("w-4 h-4", isActive ? "text-white/80" : "text-gray-400")} />
                      )}
                    </div>

                    <div className={cx("mt-1 text-[11px] font-semibold", isActive ? "text-white/90" : "text-gray-500")}>
                      Meal {doneMeal ? "✓" : "—"} · Water {doneWater ? "✓" : "—"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active meal content */}
            {mealBlocks ? (
              <div className="mt-4 space-y-3 overflow-visible">
                {/* Meal completion rows */}
                <div className="grid md:grid-cols-2 gap-3 overflow-visible">
                  <SwipeCompleteRow
                    title={`${mealLabels[activeMeal]} complete`}
                    subtitle="Mark when you finished this meal."
                    done={Boolean(completion?.[activeMeal]?.mealDone)}
                    onToggle={() => toggleMealDone(activeMeal)}
                    icon={<CheckCircle2 className={cx("w-4 h-4", Boolean(completion?.[activeMeal]?.mealDone) ? "text-emerald-700" : "text-gray-500")} />}
                  />

                  <SwipeCompleteRow
                    title="Hydration complete"
                    subtitle="Mark when you hit the water target for this meal."
                    done={Boolean(completion?.[activeMeal]?.hydrationDone)}
                    onToggle={() => toggleHydrationDone(activeMeal)}
                    icon={<Droplets className={cx("w-4 h-4", Boolean(completion?.[activeMeal]?.hydrationDone) ? "text-blue-700" : "text-gray-500")} />}
                  />
                </div>

                {/* Macro breakdown */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 overflow-visible">
                  <p className="text-sm font-bold text-gray-900">Macro breakdown</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Use this as a guide. You don’t need perfect labels for every bite.
                  </p>

                  <div className="mt-3">
                    <MacroGrid t={currentTargets} />
                  </div>
                </div>

                {/* Notes for this meal */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4 overflow-visible">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-extrabold text-gray-900">Dining hall</p>
                      <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">
                        {currentDining || "No dining hall rules added yet."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-extrabold text-gray-900">Home examples</p>
                      <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">
                        {currentHome || "No home examples added yet."}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 mt-3">
                    Tip: treat these targets as guardrails — protein + hydration first.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">Meal blocks aren’t enabled on this plan yet.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Your coach can turn them on to give you dining hall rules + simple home examples.
                </p>
              </div>
            )}
          </div>

          {/* Supplements dropdown (full-width, smaller, above coach notes) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm overflow-visible">
            <button
              type="button"
              onClick={() => setSuppOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#46769B]/25 rounded-2xl"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">Supplements</p>
                <p className="text-xs text-gray-500 mt-1">
                  Suggestions only — not medical advice.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <TinyPill tone="soft">
                  <span className="inline-flex items-center gap-1">
                    <PillIcon className="w-3.5 h-3.5" />
                    {supplementItems?.length || supplementNotes ? "View" : "None"}
                  </span>
                </TinyPill>
                {suppOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {suppOpen ? (
                <motion.div
                  key="supp"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3">
                    {supplementItems?.length ? (
                      <div className="grid md:grid-cols-2 gap-2">
                        {supplementItems.map((it) => (
                          <div
                            key={it.k}
                            className="rounded-2xl border border-gray-200 bg-gray-50 p-3 min-w-0"
                          >
                            <p className="text-[11px] text-gray-500">{it.label}</p>
                            <p className="text-sm font-extrabold text-gray-900 mt-1 break-words">
                              {it.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm text-gray-700">No supplement suggestions on this plan.</p>
                      </div>
                    )}

                    {supplementNotes ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                        <p className="text-[11px] text-gray-500">Supplement notes</p>
                        <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{supplementNotes}</p>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-[11px] font-semibold text-blue-900">
                        Reminder: supplements are optional
                      </p>
                      <p className="text-[11px] text-blue-900/80 mt-1">
                        If you use them, prioritize third-party tested options (e.g., NSF Certified for Sport) and follow your coach’s guidance.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Coach Notes (from Airtable "Prescription" long text) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm overflow-visible">
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#46769B]/25 rounded-2xl"
            >
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">Coach Notes</p>
                <p className="text-xs text-gray-500 mt-1">
                  The plan is guidance — focus on consistency and the big rocks.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <TinyPill tone="soft">{coachNotes ? "View" : "None"}</TinyPill>
                {notesOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {notesOpen ? (
                <motion.div
                  key="notes"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3">
                    {coachNotes ? (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                          {coachNotes}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm text-gray-700">No coach notes on this plan.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Bottom guidance (Skimmer-ish “simpleton approach”) */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 overflow-visible">
            <p className="text-sm font-semibold text-blue-900">Simple daily approach</p>
            <div className="mt-2 space-y-2 text-sm text-blue-900/85">
              <p>• Hit protein each meal (close is good enough).</p>
              <p>• Keep hydration steady — use the water target per meal as your anchor.</p>
              <p>• Use carbs strategically around lifts/practice, and don’t stress exact labels.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
