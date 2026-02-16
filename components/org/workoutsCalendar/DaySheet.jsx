"use client";

import { ClipboardList, Dumbbell, Plus, Users } from "lucide-react";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import Pill from "./Pill";
import SportChips from "./SportChips";
import WorkoutCard from "./WorkoutCard";
import { isoToDate, isSameISO } from "@/lib/org/workoutsCalendar/date";
import { normalizeSport } from "@/lib/org/workoutsCalendar/sports";

export default function DaySheet({
  open,
  onClose,
  titleISO,
  todayISO,
  loading,
  workoutsByDate,
  selectedSports,
  setSelectedSports,
  SPORTS_ALL,
  onOpenMoreSports,
  onCreateForDay,
  onOpenWorkout,
}) {
  const selectedDayISO = String(titleISO || "").slice(0, 10);

  const dayTitle = (() => {
    const d = isoToDate(selectedDayISO);
    return d.toLocaleString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  })();

  const dayListRaw = workoutsByDate?.[selectedDayISO] || [];
  const dayList = (() => {
    const s = Array.isArray(selectedSports) ? selectedSports : [];
    if (!s.length) return dayListRaw;
    return dayListRaw.filter((w) => s.includes(normalizeSport(w?.Sport || "")));
  })();

  const dayCounts = (() => {
    const workouts = Array.isArray(dayList) ? dayList : [];
    let workoutsCount = workouts.length;
    let athleteCount = 0;
    let itemCount = 0;
    workouts.forEach((w) => {
      athleteCount += Number(w?.athleteCount || 0);
      itemCount += Number(w?.itemCount || 0);
    });
    return { workoutsCount, athleteCount, itemCount };
  })();

  return (
    <BottomSheet open={open} onClose={onClose} title={dayTitle}>
      {/* ✅ Constrain height + internal scroll so sheet doesn't "sit low" */}
      <div className="max-h-[78vh] sm:max-h-[82vh] overflow-y-auto px-0 pb-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            {/* ✅ Better wrapping + right-aligned CTA that doesn't shove layout */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-2 items-center">
                <Pill>
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "…" : dayCounts.workoutsCount} workouts
                </Pill>
                <Pill>
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "…" : dayCounts.athleteCount} athletes
                </Pill>
                <Pill>
                  <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                  {loading ? "…" : dayCounts.itemCount} items
                </Pill>
                {isSameISO(selectedDayISO, todayISO) ? <Pill tone="good">Today</Pill> : null}
              </div>

              <div className="sm:ml-auto">
                <Button
                  className="px-3 py-2 text-xs w-full sm:w-auto"
                  onClick={() => onCreateForDay?.(selectedDayISO)}
                >
                  <Plus className="w-4 h-4" />
                  Create workout
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-2 leading-snug">
              This list comes from the range endpoint (fast). Create a workout here, then refresh pulls it into the calendar.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Sports (filter)</p>
            <div className="mt-3">
              <SportChips
                sportsAll={SPORTS_ALL}
                selectedSports={selectedSports}
                setSelectedSports={setSelectedSports}
                onOpenMore={onOpenMoreSports}
                compact
              />
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm text-gray-800 font-semibold">Loading…</p>
              </div>
            ) : dayList.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">No workouts scheduled.</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Use “Create workout” above to add one for this day.
                </p>
              </div>
            ) : (
              dayList.map((w) => <WorkoutCard key={w.id} w={w} onOpen={onOpenWorkout} />)
            )}
          </div>

          {/* ✅ Footer stays reachable; not pushed offscreen */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 pb-4">
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
