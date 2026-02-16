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
  BadgeCheck,
  BarChart3,
  ShieldAlert,
} from "lucide-react";

import { Button, Pill, statusTone, labelForDate, prettyDate } from "./ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

function toneForPct(p) {
  const n = fmtPct(p);
  if (n >= 100) return "good";
  if (n >= 50) return "warn";
  return "neutral";
}

function safeStr(v) {
  return String(v ?? "").trim();
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

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
  const name = safeStr(user?.Name || user?.name || "Athlete");
  const email = safeStr(user?.Email || user?.email || "");

  // Workout progress from hook
  const { completedCount = 0, totalCount = 0, pct = 0 } = progress || {};
  const hasWorkout = Boolean(dailyWorkout);

  const titleLabel = labelForDate(selectedDate);
  const datePretty = prettyDate(selectedDate);

  // Workout calculations
  const pctSafe = fmtPct(pct);
  const remaining = Math.max(0, (Number(totalCount) || 0) - (Number(completedCount) || 0));

  // ✅ IMPORTANT: if coach sent it back, do NOT show "Complete"
  const reviewStatus = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const needsInfo = reviewStatus === "needs_info";

  const isWorkoutComplete = hasWorkout && !needsInfo && totalCount > 0 && pctSafe >= 100;

  const workoutStatus = safeStr(dailyWorkout?.Status || "assigned");
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

  // Microcopy: unify “day status” into one line for a clean SaaS feel
  const microcopy = useMemo(() => {
    if (loading) return "Syncing your day…";

    // Hard states first
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

  // Status chips visibility
  const showOverallPill = overall.total > 0;
  const showWorkoutPill = hasWorkout;
  const showNutritionPill = hasNutritionItems;

  const workoutProgressLabel = hasWorkout && totalCount > 0 ? `${completedCount}/${totalCount}` : "—";

  // Subtle “plan” status for workouts (assigned/draft/completed)
  const workoutMeta = useMemo(() => {
    const s = norm(workoutStatus);
    if (!hasWorkout) return { label: "No workout", tone: "warn", icon: AlertTriangle };
    if (needsInfo) return { label: "Needs info", tone: "warn", icon: ShieldAlert };
    if (s === "completed") return { label: "Completed", tone: "good", icon: BadgeCheck };
    if (s === "assigned") return { label: "Assigned", tone: workoutTone, icon: Dumbbell };
    if (s === "draft") return { label: "Draft", tone: "neutral", icon: Dumbbell };
    return { label: workoutStatus || "Workout", tone: workoutTone, icon: Dumbbell };
  }, [hasWorkout, needsInfo, workoutStatus, workoutTone]);

  // Progress bar label helpers
  const progressLeftLabel = useMemo(() => {
    if (!showOverallPill) return "Today’s pace";
    if (overall.pct >= 100) return "Completed";
    if (overall.pct >= 50) return "In progress";
    return "Getting started";
  }, [showOverallPill, overall.pct]);

  const progressRightLabel = useMemo(() => {
    if (!showOverallPill) return "";
    if (overall.pct >= 100) return "0 remaining";
    return `${overallRemaining} remaining`;
  }, [showOverallPill, overall.pct, overallRemaining]);

  // Accessibility labels
  const a11yProgress = useMemo(() => {
    if (!showOverallPill) return "No progress items for this day";
    return `Overall progress: ${overall.done} of ${overall.total} items complete`;
  }, [showOverallPill, overall.done, overall.total]);

  return (
    <header className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
      {/* Soft top accent bar to match the SaaS vibe used elsewhere */}
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-60" />

      <div className="p-5 sm:p-6">
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
                    className="text-2xl font-extrabold truncate leading-tight text-gray-900"
                  >
                    {titleLabel}
                  </motion.h1>

                  {/* Pills */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Pill>{datePretty}</Pill>

                    {showOverallPill ? (
                      <Pill tone={toneForPct(overall.pct)}>
                        <Target className="w-3.5 h-3.5 mr-1.5" />
                        Overall {overallLabel} ({overall.pct}%)
                      </Pill>
                    ) : null}

                    {/* Workout status */}
                    {showWorkoutPill ? (
                      <Pill tone={workoutMeta.tone}>
                        <workoutMeta.icon className="w-3.5 h-3.5 mr-1.5" />
                        {workoutMeta.label}
                      </Pill>
                    ) : (
                      <Pill tone="warn">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                        No workout
                      </Pill>
                    )}

                    {/* Workout progress */}
                    {showWorkoutPill && totalCount > 0 ? (
                      <Pill tone={needsInfo ? "warn" : isWorkoutComplete ? "good" : toneForPct(pctSafe)}>
                        <Flame className="w-3.5 h-3.5 mr-1.5" />
                        Workout {workoutProgressLabel} ({pctSafe}%)
                      </Pill>
                    ) : null}

                    {/* Nutrition progress */}
                    {showNutritionPill ? (
                      <Pill tone={toneForPct(nutritionPct)}>
                        <Utensils className="w-3.5 h-3.5 mr-1.5" />
                        Nutrition {nutritionDone}/{nutritionTotal} ({nutritionPct}%)
                      </Pill>
                    ) : null}

                    {/* Needs info pill (wins over Complete) */}
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

                <p className="text-[12px] text-gray-600 mt-1 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-gray-400 mt-[1px] shrink-0" />
                  <span className="min-w-0">{microcopy}</span>
                </p>
              </div>

              {/* Progress bar + breakdown */}
              {showOverallPill ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      {progressLeftLabel}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {progressRightLabel}
                    </span>
                  </div>

                  <div
                    className="h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden"
                    role="progressbar"
                    aria-label={a11yProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={overall.pct}
                  >
                    <div
                      className="h-full rounded-full bg-[#46769B] transition-all"
                      style={{ width: `${overall.pct}%` }}
                    />
                  </div>

                  {/* Breakdown row: mobile safe wrap + clear icons */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5" />
                      Workout: {overall.wt > 0 ? `${overall.wd}/${overall.wt}` : "—"}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Utensils className="w-3.5 h-3.5" />
                      Nutrition: {overall.nt > 0 ? `${overall.nd}/${overall.nt}` : "—"}
                    </span>

                    <span className="inline-flex items-center gap-1">
                      <Droplet className="w-3.5 h-3.5" />
                      Hydration tracked per meal
                    </span>
                  </div>

                  {/* Extra microcopy for clarity (keeps support tickets down) */}
                  <p className="mt-2 text-[11px] text-gray-500">
                  </p>
                </div>
              ) : null}
            </div>

            {/* Right side actions */}
            <div className="flex flex-col sm:flex-row gap-2 lg:pt-1 shrink-0">
              <Button variant="secondary" onClick={onRefresh} disabled={loading} title="Refresh today data">
                <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>

              <Button variant="secondary" onClick={onBack} title="Back to dashboard">
                Back
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Error callout */}
          {err ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{err}</p>
              <p className="text-[11px] text-red-700/80 mt-1">
                If this persists, refresh and try again.
              </p>
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
      </div>
    </header>
  );
}
