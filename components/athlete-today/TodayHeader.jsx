// /components/athlete-today/TodayHeader.jsx
"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  RefreshCcw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Target,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Utensils,
} from "lucide-react";

import { Button, Pill, labelForDate, prettyDate } from "./ui";

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
  user, // kept for API compatibility
  selectedDate,
  dailyWorkout,
  loading,
  err,
  progress,
  onRefresh,
  onBack,

  nutritionDone = 0,
  nutritionTotal = 0,
}) {
  const [showDetails, setShowDetails] = useState(false);

  const titleLabel = labelForDate(selectedDate);
  const datePretty = prettyDate(selectedDate);

  const { completedCount = 0, totalCount = 0 } = progress || {};
  const hasWorkout = Boolean(dailyWorkout);

  // If coach sent it back, do NOT show "Complete"
  const reviewStatus = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const needsInfo = reviewStatus === "needs_info";

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

  const showOverall = overall.total > 0;
  const remaining = Math.max(0, overall.total - overall.done);

  // Keep ONE hero status pill to reduce noise.
  const topStatusPill = useMemo(() => {
    if (needsInfo) {
      return (
        <Pill tone="attention">
          <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
          Needs attention
        </Pill>
      );
    }

    if (!hasWorkout && !(nutritionTotal > 0)) {
      return (
        <Pill tone="warn">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
          Nothing assigned
        </Pill>
      );
    }

    if (showOverall && overall.pct >= 100) {
      return (
        <Pill tone="good">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          Complete
        </Pill>
      );
    }

    if (showOverall) {
      return (
        <Pill tone={toneForPct(overall.pct)}>
          <Target className="w-3.5 h-3.5 mr-1.5" />
          Overall {overall.done}/{overall.total} ({overall.pct}%)
        </Pill>
      );
    }

    return (
      <Pill tone="neutral">
        <Target className="w-3.5 h-3.5 mr-1.5" />
        Today
      </Pill>
    );
  }, [needsInfo, hasWorkout, nutritionTotal, showOverall, overall.done, overall.total, overall.pct]);

  const a11yProgress = useMemo(() => {
    if (!showOverall) return "No progress items for this day";
    return `Overall progress: ${overall.done} of ${overall.total} items complete`;
  }, [showOverall, overall.done, overall.total]);

  // Small helper: auto-collapse details when day changes (keeps it feeling “predictable”)
  const selectedKey = safeStr(selectedDate);
  useMemo(() => {
    // Reset details view when date changes (but avoid doing it on every render)
    // This memo is just for a stable key; effect-less reset happens by keying the details block below.
    return selectedKey;
  }, [selectedKey]);

  return (
    <header className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
      {/* subtle accent */}
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

      {/* tighter mobile padding; still premium on desktop */}
      <div className="p-4 sm:p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-[#46769B]" />
            </div>

            <div className="min-w-0">
              <motion.h1
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg sm:text-2xl font-extrabold truncate leading-tight text-gray-900"
              >
                {titleLabel}
              </motion.h1>

              {/* Pills: keep to 2 max in “default brain” mode */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill>{datePretty}</Pill>
                {topStatusPill}
              </div>
            </div>
          </div>

          {/* Actions: compact, predictable */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Details toggle: hidden if there’s nothing meaningful to show */}
            {showOverall ? (
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                disabled={loading}
                className={[
                  "hidden sm:inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white",
                  "px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60",
                  "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
                ].join(" ")}
                aria-expanded={showDetails}
                title={showDetails ? "Hide details" : "Show details"}
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Details
                  </>
                )}
              </button>
            ) : null}

            <Button
              variant="secondary"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh today data"
              className="px-3 py-2"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button variant="secondary" onClick={onBack} title="Back to dashboard" className="px-3 py-2">
              <span className="hidden sm:inline">Back</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ONE clean progress bar (only if meaningful) */}
        {showOverall ? (
          <div className="mt-3">
            {/* Keep labels quiet on mobile: show only “X left” */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
              <span className="truncate hidden sm:inline">
                {overall.pct >= 100 ? "Completed" : needsInfo ? "Needs attention" : "Progress"}
              </span>

              <span className="shrink-0">
                {overall.pct >= 100 ? "0 left" : `${remaining} left`}
              </span>
            </div>

            <div
              className="h-2 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden"
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

            {/* Mobile-only: simple “Details” button under bar */}
            <div className="mt-2 sm:hidden">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                disabled={loading}
                className={[
                  "w-full inline-flex items-center justify-center gap-2 rounded-xl",
                  "border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800",
                  "hover:bg-gray-50 disabled:opacity-60",
                  "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
                ].join(" ")}
                aria-expanded={showDetails}
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show details
                  </>
                )}
              </button>
            </div>

            {/* Optional compact details (progressive disclosure) */}
            <AnimatePresence initial={false}>
              {showDetails ? (
                <motion.div
                  key={`details-${selectedKey}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600">
                        Breakdown
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500">
                        {overall.pct >= 100 ? "All done" : `${remaining} left`}
                      </p>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-gray-500 font-semibold truncate">Workout</p>
                          <Dumbbell className="w-4 h-4 text-gray-500 shrink-0" />
                        </div>
                        <p className="text-sm font-extrabold text-gray-900 mt-1 truncate">
                          {overall.wt > 0 ? `${overall.wd}/${overall.wt}` : "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-gray-500 font-semibold truncate">Nutrition</p>
                          <Utensils className="w-4 h-4 text-gray-500 shrink-0" />
                        </div>
                        <p className="text-sm font-extrabold text-gray-900 mt-1 truncate">
                          {overall.nt > 0 ? `${overall.nd}/${overall.nt}` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Optional: a single, quiet guidance line (no fluff) */}
                    {needsInfo ? (
                      <p className="mt-2 text-[11px] text-amber-800">
                        Coach requested changes — update and re-submit.
                      </p>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        {/* Error / Loading (keep, compact) */}
        {err ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-sm font-semibold text-gray-800">Loading…</p>
            <p className="text-[11px] text-gray-600 mt-1 truncate">{selectedDate}</p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
