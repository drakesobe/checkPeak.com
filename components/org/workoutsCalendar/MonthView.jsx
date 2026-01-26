"use client";

import Pill from "./Pill";
import { isSameISO, isoToDate } from "@/lib/org/workoutsCalendar/date";

export default function MonthView({
  monthDays,
  anchorISO,
  todayISO,
  loading,
  workoutsByDate,
  weekdayLabels,
  onOpenDay,
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

  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {weekdayLabels.map((lbl) => (
          <div key={lbl} className="text-xs font-semibold text-gray-500 px-1 py-2">
            {lbl}
          </div>
        ))}

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
              onClick={() => onOpenDay?.(iso)}
              className={[
                "rounded-2xl border text-left p-3 transition relative flex flex-col justify-between",
                "min-h-[96px] sm:min-h-[120px] lg:min-h-[140px]",
                inMonth ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-gray-50 border-gray-200 hover:bg-gray-100",
                isToday ? "ring-2 ring-emerald-200" : "",
              ].join(" ")}
              title="Open day"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={["text-xs font-extrabold", inMonth ? "text-gray-900" : "text-gray-500"].join(" ")}>
                    {d.getDate()}
                  </p>
                  {isToday ? <p className="text-[10px] font-semibold text-emerald-700 mt-1">Today</p> : null}
                </div>

                {hasWork ? <Pill className="shrink-0">{counts.workoutsCount}</Pill> : null}
              </div>

              <div className="mt-2 space-y-1">
                {loading ? (
                  <p className="text-[11px] text-gray-500">Loading…</p>
                ) : list.length === 0 ? (
                  <p className="text-[11px] text-gray-400">No workouts</p>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-600">
                      <span className="font-semibold">{counts.athleteCount}</span> athletes
                    </p>
                    <p className="text-[11px] text-gray-600">
                      <span className="font-semibold">{counts.itemCount}</span> items
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
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
  );
}
