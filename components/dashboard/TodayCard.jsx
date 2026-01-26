// /components/dashboard/TodayCard.jsx
"use client";

import { CalendarDays, ChevronRight } from "lucide-react";

export default function TodayCard({ loading = false, summary, onOpen }) {
  const itemsCount = summary?.itemsCount ?? 0;
  const completedCount = summary?.completedCount ?? 0;

  // 🔑 Infer work existence from multiple signals (defensive)
  const todayHasWork =
    !!summary?.hasWorkout ||
    !!summary?.title ||
    itemsCount > 0;

  const pct = Math.round(
    (completedCount / Math.max(1, itemsCount)) * 100,
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-blue-700" />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Today
            </p>

            {todayHasWork ? (
              <span className="ml-1 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Assigned
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                None
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {todayHasWork ? "Your workout plan" : "No workout scheduled"}
          </h2>

          {/* Body */}
          {loading ? (
            <p className="mt-1 text-sm text-gray-600">
              Loading today’s plan…
            </p>
          ) : todayHasWork ? (
            <div className="mt-2 text-sm text-gray-700 space-y-1">
              <p className="truncate">
                <span className="font-semibold">
                  {summary?.title || "Daily Workout"}
                </span>
                {summary?.status && (
                  <span className="text-gray-500">
                    {" "}
                    • {summary.status}
                  </span>
                )}
              </p>

              <p>
                <span className="font-semibold">{itemsCount}</span>{" "}
                item{itemsCount !== 1 ? "s" : ""} •{" "}
                <span className="font-semibold">{completedCount}</span>{" "}
                completed
              </p>

              {itemsCount > 0 && (
                <div className="mt-2">
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {pct}% complete
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-600">
              No workout has been assigned yet. Check back later or open Today
              to refresh.
            </p>
          )}

          <p className="mt-3 text-[11px] text-gray-400">
            Coach schedules. You execute.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#46769B] text-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
        >
          Open
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
