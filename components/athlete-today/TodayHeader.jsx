// /components/athlete-today/TodayHeader.jsx
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  RefreshCcw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  Flame,
  Target,
  Clock,
  Sparkles,
  HelpCircle,
  Utensils,
  Droplet,
} from "lucide-react";

import { Button, Pill, statusTone, labelForDate, prettyDate } from "./ui";

/* ---------------- helpers ---------------- */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function fmtPct(pct) {
  const n = Number.isFinite(Number(pct)) ? Number(pct) : 0;
  return clamp(Math.round(n), 0, 100);
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Consolidate progress:
 * - Workouts: uses existing `progress` from useAthleteToday hook
 * - Nutrition: uses `nutritionDone/nutritionTotal` passed from today.jsx (lifted + persisted)
 *
 * Result: overallDone/overallTotal/overallPct
 */
function computeOverall({ workoutDone, workoutTotal, nutritionDone, nutritionTotal }) {
  const wd = Math.max(0, safeInt(workoutDone, 0));
  const wt = Math.max(0, safeInt(workoutTotal, 0));
  const nd = Math.max(0, safeInt(nutritionDone, 0));
  const nt = Math.max(0, safeInt(nutritionTotal, 0));

  const total = wt + nt;
  const done = Math.min(total, wd + nd);
  const pct = total > 0 ? fmtPct((done / total) * 100) : 0;

  return { done, total, pct, wd, wt, nd, nt };
}

export default function TodayHeader({
  user,
  selectedDate,
  dailyWorkout,
  loading,
  err,
  progress,
  onRefresh,
  onBack,

  // ✅ Optional nutrition progress (from pages/athlete/today.jsx)
  nutritionDone = 0,
  nutritionTotal = 0,
}) {
  const name = String(user?.Name || user?.name || "Athlete");
  const email = String(user?.Email || user?.email || "");

  // Workout progress from hook
  const { completedCount = 0, totalCount = 0, pct = 0 } = progress || {};
  const hasWorkout = !!dailyWorkout;

  const titleLabel = labelForDate(selectedDate);
  const datePretty = prettyDate(selectedDate);

  // Workout calculations
  const pctSafe = fmtPct(pct);
  const remaining = Math.max(0, (Number(totalCount) || 0) - (Number(completedCount) || 0));

  // ✅ IMPORTANT: if coach sent it back, do NOT show "Complete"
  const reviewStatus = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const needsInfo = reviewStatus === "needs_info";

  const isWorkoutComplete = hasWorkout && !needsInfo && totalCount > 0 && pctSafe >= 100;

  const workoutStatus = String(dailyWorkout?.Status || "assigned");
  const workoutTone = statusTone(workoutStatus);

  // Nutrition quick pct (computed from passed counts)
  const nutritionPct = useMemo(() => {
    const nt = Math.max(0, safeInt(nutritionTotal, 0));
    const nd = Math.max(0, safeInt(nutritionDone, 0));
    if (!nt) return 0;
    return fmtPct((nd / nt) * 100);
  }, [nutritionDone, nutritionTotal]);

  const hasNutritionItems = useMemo(() => {
    const nt = Math.max(0, safeInt(nutritionTotal, 0));
    return nt > 0;
  }, [nutritionTotal]);

  // Overall consolidated
  const overall = useMemo(
    () =>
      computeOverall({
        workoutDone: completedCount,
        workoutTotal: totalCount,
        nutritionDone,
        nutritionTotal,
      }),
    [completedCount, totalCount, nutritionDone, nutritionTotal]
  );

  const overallRemaining = Math.max(0, overall.total - overall.done);
  const overallLabel = overall.total > 0 ? `${overall.done}/${overall.total}` : "—";

  // Microcopy: focus on overall completion so header feels unified
  const microcopy = useMemo(() => {
    // If we are still loading workout/nutrition data, keep it simple.
    if (loading) return "Syncing your day…";

    // Hard states
    if (!hasWorkout && !hasNutritionItems) return "Nothing is assigned yet for this date.";
    if (needsInfo) return "Coach needs more info — upload again with the requested details.";

    // Completion states
    if (overall.total > 0 && overall.pct >= 100) return "All set — you’re done for the day.";
    if (overall.total > 0) {
      return `${overallRemaining} item${overallRemaining === 1 ? "" : "s"} left — keep it moving.`;
    }

    // Fallback
    if (hasWorkout) return "Workout loaded — check items below.";
    if (hasNutritionItems) return "Nutrition targets loaded — check off meals as you go.";
    return "Ready when you are.";
  }, [loading, hasWorkout, hasNutritionItems, needsInfo, overall.total, overall.pct, overallRemaining]);

  // Pills
  const workoutProgressLabel = hasWorkout && totalCount > 0 ? `${completedCount}/${totalCount}` : "—";

  // Status chips
  const showOverallPill = overall.total > 0;
  const showWorkoutPill = hasWorkout;
  const showNutritionPill = hasNutritionItems;

  // Layout: fix progress bar spacing issues
  // - enforce consistent vertical rhythm
  // - avoid large `mt-4` collisions with flex wrap pills
  // - keep progress bar section in its own block with predictable height
  return (
    <header className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        {/* Top row */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left side */}
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-[#46769B]" />
              </div>

              <div className="min-w-0">
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-extrabold truncate leading-tight"
                >
                  {titleLabel}
                </motion.h1>

                {/* Pills */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Pill>{datePretty}</Pill>

                  {showOverallPill ? (
                    <Pill tone={overall.pct >= 100 ? "good" : overall.pct >= 50 ? "warn" : "neutral"}>
                      <Target className="w-3.5 h-3.5 mr-1.5" />
                      Overall {overallLabel} ({overall.pct}%)
                    </Pill>
                  ) : null}

                  {showWorkoutPill ? (
                    <Pill tone={workoutTone}>
                      <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                      {workoutStatus}
                    </Pill>
                  ) : (
                    <Pill tone="warn">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                      No workout
                    </Pill>
                  )}

                  {showWorkoutPill && totalCount > 0 ? (
                    <Pill tone={needsInfo ? "warn" : isWorkoutComplete ? "good" : pctSafe >= 50 ? "warn" : "neutral"}>
                      <Flame className="w-3.5 h-3.5 mr-1.5" />
                      Workout {workoutProgressLabel} ({pctSafe}%)
                    </Pill>
                  ) : null}

                  {showNutritionPill ? (
                    <Pill tone={nutritionPct >= 100 ? "good" : nutritionPct >= 50 ? "warn" : "neutral"}>
                      <Utensils className="w-3.5 h-3.5 mr-1.5" />
                      Nutrition {nutritionDone}/{nutritionTotal} ({nutritionPct}%)
                    </Pill>
                  ) : null}

                  {/* Needs Info pill (wins over Complete) */}
                  {needsInfo ? (
                    <Pill tone="attention">
                      <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                      Needs attention
                    </Pill>
                  ) : null}

                  {/* Complete pill (overall) */}
                  {showOverallPill && overall.pct >= 100 ? (
                    <Pill tone="good">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Complete
                    </Pill>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Identity + microcopy */}
            <div className="mt-3">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {name}
                {email ? <span className="text-gray-500 font-normal"> • {email}</span> : null}
              </p>

              <p className="text-[12px] text-gray-600 mt-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-400" />
                {microcopy}
              </p>
            </div>

            {/* Progress bar: dedicate a clean block to avoid layout shifting */}
            {showOverallPill ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Flame className="w-4 h-4" />
                    Today’s pace
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {overallRemaining} remaining
                  </span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#46769B] transition-all"
                    style={{ width: `${overall.pct}%` }}
                  />
                </div>

                {/* Sub-line: helpful breakdown (prevents “where did my items go?” confusion) */}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                  {overall.wt > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5" />
                      Workout: {overall.wd}/{overall.wt}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5" />
                      Workout: —
                    </span>
                  )}

                  {overall.nt > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Utensils className="w-3.5 h-3.5" />
                      Nutrition: {overall.nd}/{overall.nt}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Utensils className="w-3.5 h-3.5" />
                      Nutrition: —
                    </span>
                  )}

                  {/* Optional hint: hydration is tracked within meals */}
                  <span className="inline-flex items-center gap-1">
                    <Droplet className="w-3.5 h-3.5" />
                    Hydration tracked per meal
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right side actions */}
          <div className="flex gap-2 lg:pt-1">
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button variant="secondary" onClick={onBack}>
              Back
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Error callout */}
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}

        {/* Loading callout */}
        {loading ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-gray-800">Loading your day…</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Pulling your plan for <span className="font-semibold">{selectedDate}</span>
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
