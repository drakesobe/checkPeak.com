"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Pill, statusTone } from "./ui";
import WorkoutItemRow from "./WorkoutItemRow";

export default function WorkoutCard({
  loading = false,
  dailyWorkout,
  items = [],
  onUpload,
  onQuickComplete,
  submittingId = "",
}) {
  const list = Array.isArray(items) ? items : [];
  const hasWorkout = !!dailyWorkout;
  const hasItems = list.length > 0;

  const workoutStatus = String(dailyWorkout?.Status || "").toLowerCase();

  if (!loading && !hasWorkout) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <p className="text-sm font-semibold text-gray-900">No workout assigned for this day.</p>
        </div>
        <p className="text-[12px] text-gray-600 mt-2">
          If you think this is wrong, refresh or contact your coach.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Daily Workout</p>
          <p className="text-lg font-extrabold text-gray-900 mt-1 truncate">
            {dailyWorkout?.Title || "Daily Workout"}
          </p>

          <p className="text-[12px] text-gray-600 mt-2">
            Swipe right on an item to upload a photo — or tap Upload.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Pill tone={statusTone(dailyWorkout?.Status)}>
            {dailyWorkout?.Status || "assigned"}
          </Pill>

          {workoutStatus === "completed" ? (
            <Pill tone="good">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Workout complete
            </Pill>
          ) : null}
        </div>
      </div>

      {/* Items */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-gray-800 font-semibold">Loading items…</p>
          </div>
        ) : hasItems ? (
          list.map((it) => {
            const id = String(it?.id || it?.ID || "");
            const submitting = Boolean(submittingId && id && submittingId === id);

            return (
              <WorkoutItemRow
                key={id || Math.random().toString(36).slice(2)}
                item={it}
                submitting={submitting}
                onUpload={onUpload}
                onQuickComplete={onQuickComplete}
              />
            );
          })
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-gray-900">Workout assigned, but no items found.</p>
            <p className="text-[12px] text-gray-700 mt-1">
              Your coach assigned a workout for this date, but the <span className="font-semibold">WorkoutItems</span>{" "}
              field on the DailyWorkouts record has no linked items.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
