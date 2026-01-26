// /components/athlete-today/TodayHeader.jsx
"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  RefreshCcw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
} from "lucide-react";

// IMPORTANT: match your actual export style in ./ui
// If your ui file is ui.jsx, you can also do: from "./ui.jsx"
import { Button, Pill, statusTone, labelForDate, prettyDate } from "./ui";

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
  const name = user?.Name || user?.name || "Athlete";
  const email = user?.Email || user?.email || "";

  const { completedCount = 0, totalCount = 0, pct = 0 } = progress || {};
  const hasWorkout = !!dailyWorkout;

  const titleLabel = labelForDate(selectedDate); // Today / Yesterday / etc.
  const datePretty = prettyDate(selectedDate); // Jan 26, etc.

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col gap-4">
        {/* Top row: title + actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            {/* Title line (avoid “Today” twice by not also rendering a second “Today” label elsewhere) */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-[#46769B]" />
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-extrabold truncate"
              >
                {titleLabel}
              </motion.h1>
              <Pill>{datePretty}</Pill>
            </div>

            {/* Subline */}
            <p className="text-sm text-gray-600 mt-1 truncate">
              {name}
              {email ? (
                <>
                  {" "}
                  • <span className="font-semibold">{email}</span>
                </>
              ) : null}
            </p>

            {/* Status row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasWorkout ? (
                <>
                  <Pill tone={statusTone(dailyWorkout?.Status)}>
                    <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                    {dailyWorkout?.Status || "assigned"}
                  </Pill>

                  <Pill tone={pct === 100 && totalCount > 0 ? "good" : "warn"}>
                    Progress: {completedCount}/{totalCount} ({pct}%)
                  </Pill>

                  {dailyWorkout?.Date ? <Pill>{dailyWorkout.Date}</Pill> : null}

                  {pct === 100 && totalCount > 0 ? (
                    <Pill tone="good">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Complete
                    </Pill>
                  ) : null}
                </>
              ) : (
                <Pill tone="warn">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  No workout assigned
                </Pill>
              )}
            </div>

            {/* Inline progress bar (subtle, looks premium) */}
            {hasWorkout && totalCount > 0 ? (
              <div className="mt-3 max-w-md">
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  {pct}% complete • {totalCount - completedCount} remaining
                </p>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Back
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Error */}
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-gray-800 font-semibold">Loading workout…</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Pulling your plan and items for <span className="font-semibold">{selectedDate}</span>.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
