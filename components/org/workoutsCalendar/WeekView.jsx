"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Plus,
  Users,
} from "lucide-react";

import Button from "./Button";
import Pill from "./Pill";
import WorkoutCard from "./WorkoutCard";
import { isSameISO, isoToDate } from "@/lib/org/workoutsCalendar/date";

function sumCountsForDay(list) {
  const workouts = Array.isArray(list) ? list : [];
  let workoutsCount = workouts.length;
  let athleteCount = 0;
  let itemCount = 0;

  for (const w of workouts) {
    athleteCount += Number(w?.athleteCount || 0);
    itemCount += Number(w?.itemCount || 0);
  }

  return { workoutsCount, athleteCount, itemCount };
}

function safeDateLabels(iso) {
  const d = isoToDate(iso);
  const ok = d instanceof Date && !Number.isNaN(d.getTime());
  const date = ok ? d : new Date();

  return {
    labelLong: date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    labelWeekday: date.toLocaleString(undefined, { weekday: "short" }),
    labelMonthDay: date.toLocaleString(undefined, { month: "short", day: "numeric" }),
  };
}

export default function WeekView({
  weekDays = [],
  todayISO = "",
  loading = false,
  workoutsByDate = {},
  onOpenDay,
  onOpenWorkout,
  onCreateForDay,
}) {
  const DESKTOP_MAX = 6;

  // Precompute per-day derived data once (date labels + list)
  const days = useMemo(() => {
    const byDate = workoutsByDate && typeof workoutsByDate === "object" ? workoutsByDate : {};
    const isos = Array.isArray(weekDays) ? weekDays : [];

    return isos.map((iso) => {
      const list = Array.isArray(byDate?.[iso]) ? byDate[iso] : [];
      const labels = safeDateLabels(iso);

      return {
        iso,
        list,
        isToday: isSameISO(iso, todayISO),
        ...labels,
      };
    });
  }, [weekDays, workoutsByDate, todayISO]);

  const handleCreate = (iso) => {
    if (loading) return;
    onCreateForDay?.(iso);
  };

  // Mobile list
  const renderMobile = () => (
    <div className="lg:hidden space-y-3">
      {days.map(({ iso, list, isToday, labelLong }) => {
        const counts = sumCountsForDay(list);

        return (
          <div key={iso} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-gray-900">{labelLong}</p>
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
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => onOpenDay?.(iso)}
                  disabled={loading}
                >
                  Open <ArrowRight className="w-4 h-4" />
                </Button>

                <Button
                  className="px-3 py-2 text-xs"
                  onClick={() => handleCreate(iso)}
                  disabled={loading}
                >
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
                list.slice(0, 4).map((w, idx) => (
                  <WorkoutCard
                    key={w?.id || `${iso}-${w?.Title || "workout"}-${idx}`}
                    w={w}
                    onOpen={onOpenWorkout}
                    compact
                  />
                ))
              )}

              {!loading && list.length > 4 ? (
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
        {days.map(({ iso, list, isToday, labelWeekday, labelMonthDay }) => {
          const desktopList = list.slice(0, DESKTOP_MAX);
          const hasMore = list.length > DESKTOP_MAX;

          return (
            <div
              key={iso}
              className={[
                "rounded-2xl border bg-white overflow-hidden flex flex-col h-[300px]",
                isToday ? "border-emerald-200" : "border-gray-200",
              ].join(" ")}
            >
              <div
                className={[
                  "p-3 pb-4 border-b",
                  isToday ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200",
                ].join(" ")}
              >
                {/* Header clickable */}
                <button
                  type="button"
                  onClick={() => onOpenDay?.(iso)}
                  disabled={loading}
                  className={["text-left w-full", loading ? "opacity-80 cursor-not-allowed" : ""].join(" ")}
                  title="Open day"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-extrabold text-gray-900 truncate">
                        {labelWeekday}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{labelMonthDay}</p>
                    </div>
                    {isToday ? <Pill tone="good">Today</Pill> : null}
                  </div>
                </button>

                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-2 text-xs w-full"
                    onClick={() => onOpenDay?.(iso)}
                    disabled={loading}
                  >
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
                  </div>
                ) : (
                  <>
                    {desktopList.map((w, idx) => (
                      <WorkoutCard
                        key={w?.id || `${iso}-${w?.Title || "workout"}-${idx}`}
                        w={w}
                        onOpen={onOpenWorkout}
                        compact
                      />
                    ))}

                    {hasMore ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-[#46769B] hover:underline"
                        onClick={() => onOpenDay?.(iso)}
                      >
                        View all ({list.length}) →
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              <div className="p-3 border-t border-gray-200 bg-white flex items-center justify-between">
                <p className="text-[11px] text-gray-500">
                  {list.length ? `${list.length} workout(s)` : " "}
                </p>

                <button
                  type="button"
                  className={[
                    "text-[11px] font-semibold hover:underline",
                    loading ? "text-gray-400 cursor-not-allowed" : "text-[#46769B]",
                  ].join(" ")}
                  onClick={() => handleCreate(iso)}
                  disabled={loading}
                  title={loading ? "Loading…" : "Create workout"}
                >
                  + Create
                </button>
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
