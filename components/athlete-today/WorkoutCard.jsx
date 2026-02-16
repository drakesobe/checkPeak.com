// components/athlete-today/WorkoutCard.jsx
"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Upload,
  ChevronRight,
  Dumbbell,
  Flame,
  ShieldAlert,
  Camera,
} from "lucide-react";
import { Pill, statusTone, Button } from "./ui";
import WorkoutItemRow from "./WorkoutItemRow";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s;
}

function pickNote(dw) {
  const v = dw?.ReviewedNotes ?? dw?.reviewedNotes ?? "";
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

function isDoneItem(it) {
  const st = norm(it?.Status || "");
  const completed = norm(it?.Completed || it?.completed || "") === "true";
  return completed || st === "completed" || st === "pending_review";
}

function evidenceRequired(it) {
  return norm(it?.EvidenceRequired || "") === "true" || it?.EvidenceRequired === true;
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function progressTone(pct) {
  const p = clampPct(pct);
  if (p >= 100) return "good";
  if (p >= 50) return "warn";
  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* Micro UI bits                                                              */
/* -------------------------------------------------------------------------- */

function SectionHeader({ title, subtitle, icon }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
            {icon}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {title}
            </p>
            {subtitle ? (
              <p className="text-lg font-extrabold text-gray-900 mt-0.5 truncate">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniProgress({ pct, done, total }) {
  const p = clampPct(pct);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
        <span className="inline-flex items-center gap-1">
          <Flame className="w-3.5 h-3.5" />
          Progress
        </span>

        {total ? (
          <span className="tabular-nums">
            {done}/{total} ({p}%)
          </span>
        ) : (
          <span>—</span>
        )}
      </div>

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
    </div>
  );
}

function ActionRail({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{title}</p>
          {subtitle ? (
            <p className="text-[12px] text-gray-600 mt-1 leading-snug">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex items-center gap-2">{children}</div>
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white/70 px-3 py-2">
        <p className="text-[11px] text-gray-600 leading-snug">
          <span className="font-semibold">Pro tip:</span> On mobile, swipe right on any row below to open upload.
        </p>
      </div>
    </div>
  );
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

  const nextUploadCandidate = useMemo(() => {
    // Prefer evidence-required items that are NOT done
    const preferred = list.find((x) => evidenceRequired(x) && !isDoneItem(x));
    if (preferred) return preferred;

    // Else any not-done item
    const anyNotDone = list.find((x) => !isDoneItem(x));
    return anyNotDone || null;
  }, [list]);

  const onQuickUpload = () => {
    if (!nextUploadCandidate) return;
    const id = String(nextUploadCandidate?.id || nextUploadCandidate?.ID || "").trim();
    if (!id) return;

    // This opens your CompleteItemModal, which has capture="environment" (camera on mobile)
    onUpload?.({ ...nextUploadCandidate, id });
  };

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
                If you think this is wrong, refresh and check again — or contact your coach.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tone = progressTone(progress.pct);

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      {/* Subtle top accent to align with the SaaS look used elsewhere */}
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <SectionHeader
              title="Daily workout"
              subtitle={safeText(dailyWorkout?.Title) || "Daily Workout"}
              icon={<Dumbbell className="w-5 h-5 text-[#46769B]" />}
            />

            <p className="text-[12px] text-gray-600 mt-2 leading-snug">
              Upload proof when needed, and keep moving down the list. Quick Upload opens the next best item.
            </p>

            {/* Chips row: status, progress, needs-info */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone={statusTone(dailyWorkout?.Status)}>
                {workoutStatusRaw || "assigned"}
              </Pill>

              {progress.total ? (
                <Pill tone={tone}>
                  <Flame className="w-3.5 h-3.5 mr-1.5" />
                  {progress.done}/{progress.total} ({clampPct(progress.pct)}%)
                </Pill>
              ) : (
                <Pill tone="neutral">
                  <Flame className="w-3.5 h-3.5 mr-1.5" />
                  No items
                </Pill>
              )}

              {isWorkoutCompleted ? (
                <Pill tone="good">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Workout complete
                </Pill>
              ) : null}

              {needsInfo ? (
                <Pill tone="warn">
                  <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                  Needs info
                </Pill>
              ) : null}
            </div>

            {/* Mini progress bar */}
            {progress.total ? (
              <MiniProgress pct={progress.pct} done={progress.done} total={progress.total} />
            ) : null}
          </div>

          {/* Right actions (kept tight + mobile safe) */}
          <div className="flex flex-row lg:flex-col gap-2 lg:items-end">
            <Button
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={onQuickUpload}
              disabled={loading || !nextUploadCandidate}
              title={!nextUploadCandidate ? "No pending items" : "Open camera/upload for next item"}
            >
              <Camera className="w-4 h-4" />
              Quick Upload
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => {
                // quick complete for the next item that doesn't require evidence
                const candidate = list.find((x) => !evidenceRequired(x) && !isDoneItem(x));
                if (!candidate) return;
                const id = String(candidate?.id || candidate?.ID || "").trim();
                if (!id) return;
                onQuickComplete?.({ ...candidate, id });
              }}
              disabled={loading || !list.some((x) => !evidenceRequired(x) && !isDoneItem(x))}
              title="Quick complete the next non-evidence item"
            >
              <CheckCircle2 className="w-4 h-4" />
              Quick Complete
            </Button>
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
                  Upload again with the requested details so your coach can approve it.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick action rail (explains what the button does) */}
        <div className="mt-5">
          <ActionRail
            title="Quick Upload"
            subtitle={
              nextUploadCandidate
                ? `Next up: ${safeText(nextUploadCandidate?.Title || nextUploadCandidate?.Name || "Workout item")} ${
                    evidenceRequired(nextUploadCandidate) ? "(proof required)" : "(proof optional)"
                  }`
                : "No pending items right now."
            }
          >
            <Button
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={onQuickUpload}
              disabled={loading || !nextUploadCandidate}
              title={!nextUploadCandidate ? "No pending items" : "Open camera/upload for next item"}
            >
              <Upload className="w-4 h-4" />
              {evidenceRequired(nextUploadCandidate) ? "Upload proof" : "Upload (optional)"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </ActionRail>
        </div>

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

              // Stable key fallback: id preferred; else deterministic-ish
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
                If this looks wrong, refresh and ask your coach to link the items to the workout.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
