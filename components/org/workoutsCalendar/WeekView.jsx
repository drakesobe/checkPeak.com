"use client";

import { ArrowRight, CheckCircle2, ClipboardList, Dumbbell, Plus, Users } from "lucide-react";
import Button from "./Button";
import Pill from "./Pill";
import WorkoutCard from "./WorkoutCard";
import { isSameISO, isoToDate } from "@/lib/org/workoutsCalendar/date";

export default function WeekView({
  weekDays,
  todayISO,
  loading,
  workoutsByDate,
  onOpenDay,
  onOpenWorkout,
  onCreateForDay,
}) {
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

  // Mobile list
  const renderMobile = () => (
    <div className="lg:hidden space-y-3">
      {weekDays.map((iso) => {
        const list = workoutsByDate?.[iso] || [];
        const isToday = isSameISO(iso, todayISO);
        const counts = sumCountsForDay(list);

        return (
          <div key={iso} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-gray-900">
                    {isoToDate(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  {isToday ? (
                    <Pill tone="good">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Today
                    </Pill>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill>
                    <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                    {counts.workoutsCount} workouts
                  </Pill>
                  <Pill>
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    {counts.athleteCount} athletes
                  </Pill>
                  <Pill>
                    <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                    {counts.itemCount} items
                  </Pill>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => onOpenDay?.(iso)}>
                  Open <ArrowRight className="w-4 h-4" />
                </Button>
                <Button className="px-3 py-2 text-xs" onClick={() => onCreateForDay?.(iso)}>
                  <Plus className="w-4 h-4" />
                  Create
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {loading ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <p className="text-sm text-gray-800 font-semibold">Loading…</p>
                </div>
              ) : list.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[12px] text-gray-600">No workouts scheduled.</p>
                </div>
              ) : (
                list.slice(0, 4).map((w) => (
                  <WorkoutCard key={w.id} w={w} onOpen={onOpenWorkout} compact />
                ))
              )}

              {list.length > 4 ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold text-[#46769B] hover:underline"
                  onClick={() => onOpenDay?.(iso)}
                >
                  View all ({list.length}) →
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Desktop week grid
  const renderDesktop = () => (
    <div className="hidden lg:block">
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((iso) => {
          const list = workoutsByDate?.[iso] || [];
          const isToday = isSameISO(iso, todayISO);

          return (
            <div
              key={iso}
              className={[
                "rounded-2xl border bg-white overflow-hidden flex flex-col h-[300px]",
                isToday ? "border-emerald-200" : "border-gray-200",
              ].join(" ")}
            >
              <div className={["p-3 pb-4 border-b", isToday ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"].join(" ")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-extrabold text-gray-900 truncate">
                      {isoToDate(iso).toLocaleString(undefined, { weekday: "short" })}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {isoToDate(iso).toLocaleString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  {isToday ? <Pill tone="good">Today</Pill> : null}
                </div>

                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" className="px-3 py-2 text-xs w-full" onClick={() => onOpenDay?.(iso)}>
                    Open <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                {loading ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-sm text-gray-800 font-semibold">Loading…</p>
                  </div>
                ) : list.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[12px] text-gray-600">No workouts.</p>
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-semibold text-[#46769B] hover:underline"
                      onClick={() => onCreateForDay?.(iso)}
                    >
                      Create workout →
                    </button>
                  </div>
                ) : (
                  list.map((w) => <WorkoutCard key={w.id} w={w} onOpen={onOpenWorkout} compact />)
                )}
              </div>

              <div className="p-3 border-t border-gray-200 bg-white">
                <p className="text-[11px] text-gray-500">{list.length ? `${list.length} workout(s)` : " "}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {renderMobile()}
      {renderDesktop()}
    </>
  );
}
