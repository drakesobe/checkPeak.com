"use client";

import { useMemo, useState, useCallback } from "react";
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

  dailyHydrationOz: dailyHydrationOzProp,

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

  const showUpcoming = Boolean(
    !loading && !err && !hasPlan && (isFuture || safeText(nextPlan?.effectiveDate))
  );

  const [suppOpen, setSuppOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const setCompletion = useCallback(
    (next) => {
      if (typeof onCompletionChange === "function") onCompletionChange(next);
    },
    [onCompletionChange]
  );

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 overflow-visible">
      <NutritionHeader
        subtitle={subtitle}
        metaStatus={metaStatus}
        metaEff={metaEff}
        counts={counts}
        onRefresh={onRefresh}
        onOpenNutrition={onOpenNutrition}
      />

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
        <NutritionEmptyState
          showUpcoming={showUpcoming}
          message={message}
          nextPlan={nextPlan}
          onOpenNutrition={onOpenNutrition}
          onRefresh={onRefresh}
        />
      ) : (
        <div className="mt-4 space-y-4 overflow-visible">
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
    </section>
  );
}
