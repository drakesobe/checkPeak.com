"use client";

import Pill from "./Pill";
import { isSameISO, isoToDate, dateToISO } from "@/lib/org/workoutsCalendar/date";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function MonthView({
  monthDays,
  anchorISO,
  todayISO,
  loading,
  workoutsByDate,
  weekdayLabels,
  onOpenDay,
  onJumpToMonth, // ✅ NEW (optional)
}) {
  const a = isoToDate(anchorISO);
  const monthIndex = a.getMonth();
  const year = a.getFullYear();

  const sumCountsForDay = (list) => {
    const workouts = Array.isArray(list) ? list : [];
    let workoutsCount = workouts.length;
    let athleteCount = 0;
    let itemCount = 0;
    workouts.forEach((w) => {
      athleteCount += Number(w?.athleteCount || 0);
      itemCount += Number(w?.itemCount || 0);
    });
    return { workoutsCount, athleteCount, itemCount };
  };

  const handleDayClick = (iso) => {
    const d = isoToDate(iso);
    const inMonth = d.getMonth() === monthIndex && d.getFullYear() === year;

    // If user taps a gray (out-of-month) day, jump the calendar to that month
    if (!inMonth && typeof onJumpToMonth === "function") {
      const newAnchor = new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0);
      onJumpToMonth(dateToISO(newAnchor));
      return;
    }

    // Otherwise open the day sheet as usual
    onOpenDay?.(iso);
  };

  return (
    <div className="w-full">
      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 px-0.5 sm:px-0">
        {weekdayLabels.map((lbl) => (
          <div
            key={lbl}
            className={cx(
              "text-[10px] sm:text-xs font-semibold text-gray-500",
              "px-0.5 sm:px-1 py-1.5 sm:py-2",
              "text-center sm:text-left"
            )}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="mt-1.5 sm:mt-2">
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-2xl overflow-hidden border border-gray-200">
          {monthDays.map((iso) => {
            const d = isoToDate(iso);
            const inMonth = d.getMonth() === monthIndex && d.getFullYear() === year;
            const list = workoutsByDate?.[iso] || [];
            const isToday = isSameISO(iso, todayISO);

            const counts = sumCountsForDay(list);
            const hasWork = counts.workoutsCount > 0;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(iso)}
                className={cx(
                  "text-left relative flex flex-col justify-between",
                  "transition active:scale-[0.99]",
                  "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
                  "p-2 sm:p-3",
                  "min-h-[78px] sm:min-h-[110px] lg:min-h-[130px]",
                  inMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50/70 hover:bg-gray-100",
                  isToday ? "ring-2 ring-emerald-200" : "",
                  loading ? "opacity-80 pointer-events-none" : ""
                )}
                title={inMonth ? "Open day" : "Jump to month"}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={cx(
                        "font-extrabold",
                        "text-[11px] sm:text-xs",
                        inMonth ? "text-gray-900" : "text-gray-500"
                      )}
                    >
                      {d.getDate()}
                    </p>

                    {isToday ? (
                      <p className="text-[10px] font-semibold text-emerald-700 mt-0.5 sm:mt-1">
                        Today
                      </p>
                    ) : null}
                  </div>

                  {hasWork ? (
                    <Pill className="shrink-0 text-[10px] sm:text-xs px-2 py-0.5">
                      {counts.workoutsCount}
                    </Pill>
                  ) : null}
                </div>

                <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                  {loading ? (
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Loading…</p>
                  ) : list.length === 0 ? (
                    <p className="text-[10px] sm:text-[11px] text-gray-400">
                      {inMonth ? "No workouts" : "Tap to jump"}
                    </p>
                  ) : (
                    <>
                      <p className="text-[10px] sm:text-[11px] text-gray-600 leading-tight">
                        <span className="font-semibold">{counts.athleteCount}</span> athletes
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-gray-600 leading-tight">
                        <span className="font-semibold">{counts.itemCount}</span> items
                      </p>
                      <p className="text-[10px] text-gray-500 truncate leading-tight">
                        {list[0]?.Title || "Workout"}
                        {list.length > 1 ? ` +${list.length - 1}` : ""}
                      </p>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}