// components/athlete-today/NutritionCard.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { RefreshCw, ExternalLink, Salad } from "lucide-react";
import {
  safeText,
  safeCompletionShape,
  computeNutritionCounts,
  pickCoachNotes,
  pickSupplements,
  pickDailyHydrationOz,
  isISODateOnly,
  fmtHumanDate,
} from "./nutrition/helpers";

import NutritionHeader from "./nutrition/sections/NutritionHeader";
import NutritionEmptyState from "./nutrition/sections/NutritionEmptyState";
import DailyTargets from "./nutrition/sections/DailyTargets";
import MealTargets from "./nutrition/sections/MealTargets";
import SupplementsPanel from "./nutrition/sections/SupplementsPanel";
import CoachNotesPanel from "./nutrition/sections/CoachNotesPanel";
import GuidancePanel from "./nutrition/sections/GuidancePanel";

function cx(...xs) { return xs.filter(Boolean).join(" "); }

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

  dailyHydrationOzProp,
  nutritionCompletion,
  onCompletionChange,
}) {
  const completion = useMemo(
    () => safeCompletionShape(nutritionCompletion),
    [nutritionCompletion]
  );

  const counts = useMemo(() => computeNutritionCounts(completion), [completion]);

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
    if (isISODateOnly(d)) return `Suggested targets for ${fmtHumanDate(d)}.`;
    return "Suggested targets by meal + daily macros.";
  }, [selectedDate]);

  const showUpcoming = Boolean(
    !loading && !err && !hasPlan && (isFuture || safeText(nextPlan?.effectiveDate))
  );

  const [suppOpen, setSuppOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const setCompletion = useCallback(
    (next) => { if (typeof onCompletionChange === "function") onCompletionChange(next); },
    [onCompletionChange]
  );

  const allDone = counts.total > 0 && counts.done >= counts.total;

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm">

      {/* Card top accent — green when complete, brand blue otherwise */}
      <div className={cx(
        "h-1 w-full transition-colors duration-500",
        allDone ? "bg-emerald-400" : "bg-[#46769B]"
      )} />

      <div className="p-5">

        {/* ── Card header ── */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cx(
              "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
              allDone ? "bg-emerald-50 border border-emerald-100" : "bg-[#EEF4FA] border border-[#D0E4F0]"
            )}>
              <Salad className={cx("w-4 h-4", allDone ? "text-emerald-600" : "text-[#46769B]")} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 leading-none mb-0.5">
                Nutrition
              </p>
              <p className="text-sm font-bold text-gray-900 leading-snug truncate">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Done counter */}
            {counts.total > 0 ? (
              <span className={cx(
                "text-[11px] font-black rounded-full px-2 py-0.5 tabular-nums",
                allDone
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
              )}>
                {counts.done}/{counts.total}
              </span>
            ) : null}

            {/* Open full nutrition page */}
            {onOpenNutrition ? (
              <button
                type="button"
                onClick={onOpenNutrition}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
                title="Open nutrition plan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : null}

            {/* Refresh */}
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                title="Refresh nutrition"
              >
                <RefreshCw className={cx("w-3.5 h-3.5", loading ? "animate-spin" : "")} />
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Body ── */}
        {loading ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-500 font-semibold">Loading nutrition…</p>
          </div>
        ) : err ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
            <p className="text-xs text-red-600/80 mt-1">
              If this persists, confirm the nutrition API is deployed and your session is valid.
            </p>
          </div>
        ) : !hasPlan ? (
          <NutritionEmptyState
            showUpcoming={showUpcoming}
            message={message}
            nextPlan={nextPlan}
            onOpenNutrition={onOpenNutrition}
            onRefresh={onRefresh}
          />
        ) : (
          <div className="space-y-4 overflow-visible">
            <DailyTargets daily={daily} dailyHydrationOz={dailyHydrationOz} />

            <MealTargets
              mealBlocks={mealBlocks}
              completion={completion}
              nutritionCompletion={nutritionCompletion}
              onSetCompletion={setCompletion}
            />

            <SupplementsPanel
              open={suppOpen}
              onToggle={() => setSuppOpen((v) => !v)}
              supplementItems={supplementItems}
              supplementNotes={supplementNotes}
            />

            <CoachNotesPanel
              open={notesOpen}
              onToggle={() => setNotesOpen((v) => !v)}
              coachNotes={coachNotes}
            />

            <GuidancePanel />
          </div>
        )}
      </div>
    </div>
  );
}