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

  // ✅ One handler for both buttons
  const handleCreate = () => {
    // Close the sheet first (prevents stacked overlays)
    onClose?.();
    // Then open the create modal for this day
    onCreateForDay?.(selectedDayISO);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={dayTitle}
      subtitle={
        loading
          ? "Loading workouts for this day…"
          : dayList.length
          ? "Tap a workout to manage it. Use filters to narrow down."
          : "No workouts scheduled yet — create one to get started."
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Stats + CTA */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

            <div className="sm:pl-2">
              <Button
                className="px-3 py-2 text-xs w-full sm:w-auto justify-center"
                onClick={handleCreate}
              >
                <Plus className="w-4 h-4" />
                Create workout
              </Button>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs text-gray-500 mt-3 leading-snug">
            This day pulls from the range endpoint for speed. After creating a workout, refresh will bring it into the
            calendar view.
          </p>
        </div>

        {/* Sports filter */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Sports (filter)</p>
            <p className="text-[11px] text-gray-400">
              {selectedSports?.length ? `${selectedSports.length} selected` : "All"}
            </p>
          </div>

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

        {/* Workout list */}
        <div className="space-y-2 sm:space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
              <p className="text-sm text-gray-800 font-semibold">Loading…</p>
              <p className="text-[11px] sm:text-xs text-gray-600 mt-1">
                Pulling workouts and counts for this date.
              </p>
            </div>
          ) : dayList.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <p className="text-sm font-semibold text-gray-900">No workouts scheduled.</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                Use “Create workout” above to add one for this day.
              </p>

              <div className="mt-3">
                <Button onClick={handleCreate} className="w-full justify-center">
                  <Plus className="w-4 h-4" />
                  Create workout
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Workouts</p>
                <p className="text-[11px] text-gray-400">
                  Showing {dayList.length} / {dayListRaw.length}
                </p>
              </div>

              <div className="space-y-2">
                {dayList.map((w) => (
                  <WorkoutCard key={w.id} w={w} onOpen={onOpenWorkout} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2">
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto justify-center">
              Close
            </Button>
          </div>
          <div className="h-1 sm:h-2" />
        </div>
      </div>
    </BottomSheet>
  );
}