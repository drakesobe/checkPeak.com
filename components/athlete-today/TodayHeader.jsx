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
} from "lucide-react";

import { Button, Pill, statusTone, labelForDate, prettyDate } from "./ui";

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

export default function TodayHeader({
  user,
  selectedDate,
  dailyWorkout,
  loading,
  err,
  progress,
  onRefresh,
  onBack,
}) {
  const name = String(user?.Name || user?.name || "Athlete");
  const email = String(user?.Email || user?.email || "");

  const { completedCount = 0, totalCount = 0, pct = 0 } = progress || {};
  const hasWorkout = !!dailyWorkout;

  const titleLabel = labelForDate(selectedDate);
  const datePretty = prettyDate(selectedDate);

  const pctSafe = fmtPct(pct);
  const remaining = Math.max(0, (Number(totalCount) || 0) - (Number(completedCount) || 0));

  // ✅ IMPORTANT: if coach sent it back, do NOT show "Complete"
  const reviewStatus = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const needsInfo = reviewStatus === "needs_info";

  const isComplete = hasWorkout && !needsInfo && totalCount > 0 && pctSafe >= 100;

  const workoutStatus = String(dailyWorkout?.Status || "assigned");
  const workoutTone = statusTone(workoutStatus);

  const microcopy = useMemo(() => {
    if (!hasWorkout) return "No workout is assigned for this date.";
    if (loading) return "Syncing your workout and items…";
    if (needsInfo) return "Coach needs more info — upload again with the requested details.";
    if (isComplete) return "All set — you’re done for the day.";
    if (totalCount > 0) return `${remaining} item${remaining === 1 ? "" : "s"} left — keep it moving.`;
    return "Workout loaded — waiting on items.";
  }, [hasWorkout, loading, needsInfo, isComplete, totalCount, remaining]);

  const progressLabel = hasWorkout && totalCount > 0 ? `${completedCount}/${totalCount}` : "—";

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-[#46769B]" />
              </div>

              <div className="min-w-0">
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-extrabold truncate"
                >
                  {titleLabel}
                </motion.h1>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill>{datePretty}</Pill>

                  {hasWorkout ? (
                    <Pill tone={workoutTone}>
                      <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                      {workoutStatus}
                    </Pill>
                  ) : (
                    <Pill tone="warn">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                      No workout assigned
                    </Pill>
                  )}

                  {hasWorkout ? (
                    <Pill tone={needsInfo ? "warn" : isComplete ? "good" : pctSafe >= 50 ? "warn" : "neutral"}>
                      <Target className="w-3.5 h-3.5 mr-1.5" />
                      {progressLabel} ({pctSafe}%)
                    </Pill>
                  ) : null}

                  {/* ✅ Needs Info pill (wins over Complete) */}
                  {needsInfo ? (
                    <Pill tone="attention">
                      <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                      Needs attention
                    </Pill>
                  ) : null}

                  {isComplete ? (
                    <Pill tone="good">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Complete
                    </Pill>
                  ) : null}
                </div>
              </div>
            </div>

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

            {hasWorkout && totalCount > 0 ? (
              <div className="mt-4 max-w-xl">
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                  <span className="flex items-center gap-1">
                    <Flame className="w-4 h-4" />
                    Today’s pace
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {remaining} remaining
                  </span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#46769B] transition-all"
                    style={{ width: `${pctSafe}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
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

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-gray-800">Loading workout…</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Pulling your plan for <span className="font-semibold">{selectedDate}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
