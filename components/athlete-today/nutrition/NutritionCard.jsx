// components/athlete-today/nutrition/NutritionCard.jsx
"use client";

import { useMemo } from "react";
import { AlertCircle } from "lucide-react";

import PlanHeader          from "./sections/PlanHeader";
import MealFlow            from "./sections/MealFlow";
import HydrationTracker    from "./sections/HydrationTracker";
import CoachGuidance       from "./sections/CoachGuidance";
import NutritionEmptyState from "./sections/NutritionEmptyState";

import {
  pickCoachNotes,
  pickSupplements,
  pickDailyHydrationOz,
  computeNutritionCounts,
} from "./helpers";

/* ── loading skeleton ── */
function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="rounded-2xl border border-gray-200 bg-white" style={{ height: 108 }} />
      <div className="rounded-2xl border border-gray-200 bg-white" style={{ height: 296 }} />
      <div className="rounded-2xl border border-gray-200 bg-white" style={{ height: 120 }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */

export default function NutritionCard({
  loading,
  err,
  hasPlan,
  daily,
  mealBlocks,
  planJson,
  selectedDate,
  effectiveDate,
  nextPlan,
  isFuture,
  message,
  onRefresh,
  onOpenNutrition,
  dailyHydrationOz,
  nutritionCompletion,
  onCompletionChange,
}) {
  /* ── plan name ── */
  const planName = useMemo(() => String(
    planJson?.name     ?? planJson?.planName  ?? planJson?.title    ??
    planJson?.PlanName ?? planJson?.Title     ?? daily?.planName    ?? ""
  ).trim(), [planJson, daily]);

  /* ── use helpers for robust field picking ── */
  const coachNotes = useMemo(() => pickCoachNotes({ planJson }), [planJson]);

  const { items: supplementItems, notes: supplementNotes } = useMemo(
    () => pickSupplements({ planJson }),
    [planJson]
  );

  /* ── resolves from prop, daily, and planJson ── */
  const resolvedHydrationOz = useMemo(
    () => pickDailyHydrationOz({ daily, planJson, dailyHydrationOzProp: dailyHydrationOz }),
    [daily, planJson, dailyHydrationOz]
  );

  /* ── mealBlocks - prefer prop, fall back to planJson directly ──────────────
     The hook derives mealBlocks from planJson, but if it returns null (e.g.
     stale render, old plan shape) we can still get the data from planJson. */
  const resolvedMealBlocks = useMemo(() => {
    if (mealBlocks && typeof mealBlocks === "object" && Object.keys(mealBlocks).length > 0) {
      return mealBlocks;
    }
    const mb = planJson?.mealBlocks;
    return mb && typeof mb === "object" && Object.keys(mb).length > 0 ? mb : null;
  }, [mealBlocks, planJson]);

  /* ── daily - prefer prop, fall back to planJson.daily ──────────────────────
     Ensures PlanHeader always gets macro targets even if the flat daily
     prop is missing hydrationOz or was built from older Airtable columns. */
  const resolvedDaily = useMemo(() => {
    const pjDaily = planJson?.daily && typeof planJson.daily === "object" ? planJson.daily : null;
    if (!daily && !pjDaily) return null;
    // Merge both - planJson.daily wins for any field it has
    return { ...(daily || {}), ...(pjDaily || {}) };
  }, [daily, planJson]);

  const completionCounts = useMemo(
    () => computeNutritionCounts(nutritionCompletion),
    [nutritionCompletion]
  );

  const hasGuidance = Boolean(coachNotes) || supplementItems.length > 0 || Boolean(supplementNotes);
  const hydrationStorageKey = `checkpeak:hydrationOz:${String(selectedDate || "today")}`;

  /* ── states ── */
  if (loading) return <Skeleton />;

  if (err) return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-red-700">{err}</p>
        <button type="button" onClick={onRefresh}
          className="mt-1.5 text-xs font-semibold text-red-600 underline">
          Try again
        </button>
      </div>
    </div>
  );

  if (!hasPlan) return (
    <NutritionEmptyState
      showUpcoming={isFuture}
      message={message}
      nextPlan={nextPlan}
      onOpenNutrition={onOpenNutrition}
      onRefresh={onRefresh}
    />
  );

  /* ── main view ── */
  return (
    <div className="space-y-3">
      <PlanHeader
        planName={planName}
        effectiveDate={effectiveDate}
        daily={resolvedDaily}
        dailyHydrationOz={resolvedHydrationOz}
        completionCounts={completionCounts}
        onRefresh={onRefresh}
      />

      <MealFlow
        mealBlocks={resolvedMealBlocks}
        nutritionCompletion={nutritionCompletion}
        onSetCompletion={onCompletionChange}
        dateISO={selectedDate}
      />

      <HydrationTracker
        goalOz={resolvedHydrationOz}
        storageKey={hydrationStorageKey}
        mealBlocks={resolvedMealBlocks}
      />

      {hasGuidance && (
        <CoachGuidance
          coachNotes={coachNotes}
          supplementItems={supplementItems}
          supplementNotes={supplementNotes}
        />
      )}
    </div>
  );
}