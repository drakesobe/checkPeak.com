"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  Dumbbell,
  ShieldAlert,
} from "lucide-react";
import { statusTone } from "./ui";
import WorkoutItemRow from "./WorkoutItemRow";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function safeText(v) {
  return String(v ?? "").trim();
}

function pickNote(dw) {
  const v = dw?.ReviewedNotes ?? dw?.reviewedNotes ?? "";
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

function isDoneItem(it) {
  const st = norm(it?.Status || "");
  const completed = norm(it?.Completed || it?.completed || "") === "true";
  // Athlete considers pending_review "checked off"
  return completed || st === "completed" || st === "pending_review";
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function progressTone(pct) {
  const p = clampPct(pct);
  if (p >= 100) return "ok";
  if (p >= 50) return "blue";
  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* Header UI                                                                  */
/* -------------------------------------------------------------------------- */

function Chip({ children, tone = "neutral", className = "" }) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}

function MiniBar({ pct }) {
  const p = clampPct(pct);
  return (
    <div
      className="h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label="Workout completion progress"
    >
      <div
        className="h-full rounded-full bg-[#46769B] transition-all"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small helper for chip tone priority                                         */
/* -------------------------------------------------------------------------- */

function isCompleteChipTone(isWorkoutCompleted, chipTone) {
  return isWorkoutCompleted ? "ok" : chipTone;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function WorkoutCard({
  loading = false,
  dailyWorkout,
  items = [],
  onUpload,
  onQuickComplete,
  submittingId = "",
}) {
  const list = Array.isArray(items) ? items : [];
  const hasWorkout = Boolean(dailyWorkout);
  const hasItems = list.length > 0;

  const workoutStatusRaw = safeText(dailyWorkout?.Status || "assigned");
  const workoutStatus = norm(workoutStatusRaw);

  const reviewStatus = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const reviewedNotes = pickNote(dailyWorkout);

  const needsInfo = reviewStatus === "needs_info";
  const isWorkoutCompleted = workoutStatus === "completed";

  const progress = useMemo(() => {
    const total = list.length;
    const done = list.filter((x) => isDoneItem(x)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [list]);

  // Empty state: no workout
  if (!loading && !hasWorkout) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="h-10 w-10 rounded-2xl border border-amber-200 bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900">
                No workout assigned for this day
              </p>
              <p className="text-[12px] text-gray-600 mt-1 leading-snug">
                Refresh and check again — or contact your coach.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chipTone = progress.total ? progressTone(progress.pct) : "neutral";

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <span className="shrink-0 h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-[#46769B]" />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-extrabold text-gray-900 leading-tight">
                    Workout
                  </p>

                  <Chip
                    tone={
                      statusTone(dailyWorkout?.Status) === "good"
                        ? "ok"
                        : statusTone(dailyWorkout?.Status) === "warn"
                        ? "warn"
                        : statusTone(dailyWorkout?.Status) === "blue"
                        ? "blue"
                        : "neutral"
                    }
                  >
                    {workoutStatusRaw || "assigned"}
                  </Chip>

                  <Chip tone={isCompleteChipTone(isWorkoutCompleted, chipTone)}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {progress.total
                      ? `${progress.done}/${progress.total} (${clampPct(progress.pct)}%)`
                      : "No items"}
                  </Chip>

                  {isWorkoutCompleted ? (
                    <Chip tone="ok">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Complete
                    </Chip>
                  ) : null}

                  {needsInfo ? (
                    <Chip tone="warn">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Needs info
                    </Chip>
                  ) : null}
                </div>

                {safeText(dailyWorkout?.Title) ? (
                  <p className="text-[12px] text-gray-600 mt-2 leading-snug truncate">
                    {safeText(dailyWorkout?.Title)}
                  </p>
                ) : null}

                {progress.total ? (
                  <div className="mt-3">
                    <MiniBar pct={progress.pct} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right side: no quick upload anymore */}
          <div className="flex items-center gap-2 lg:justify-end">
            <span className="text-[12px] text-gray-500">
              Swipe right on an item to submit.
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>

        {/* Needs-info message */}
        {needsInfo && reviewedNotes ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="h-10 w-10 rounded-2xl border border-amber-200 bg-white flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              </span>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">
                  Coach message
                </p>
                <p className="text-[12px] text-gray-700 mt-2 whitespace-pre-wrap break-words leading-snug">
                  {reviewedNotes}
                </p>
                <p className="text-[11px] text-gray-600 mt-2 leading-snug">
                  Re-submit with the requested details.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Items */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-gray-800 font-semibold">Loading items…</p>
              <p className="text-[11px] text-gray-600 mt-1">
                Pulling workout items for this date.
              </p>
            </div>
          ) : hasItems ? (
            list.map((it, idx) => {
              const id = String(it?.id || it?.ID || it?.recordId || "").trim();
              const submitting = Boolean(submittingId && id && submittingId === id);
              const key = id || `${idx}-${safeText(it?.Title || it?.Name || "item")}`;

              return (
                <WorkoutItemRow
                  key={key}
                  item={it}
                  submitting={submitting}
                  onUpload={onUpload}
                  onQuickComplete={onQuickComplete}
                />
              );
            })
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-extrabold text-gray-900">
                Workout assigned, but no items found
              </p>
              <p className="text-[12px] text-gray-700 mt-1 leading-snug">
                Your coach assigned a workout for this date, but the{" "}
                <span className="font-semibold">WorkoutItems</span> field on the DailyWorkouts record has no linked items.
              </p>
              <p className="text-[11px] text-gray-600 mt-2 leading-snug">
                If this looks wrong, refresh and ask your coach to link the items.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
