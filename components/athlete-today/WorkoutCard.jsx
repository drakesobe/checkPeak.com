// components/athlete-today/WorkoutCard.jsx
"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Upload,
  ChevronRight,
} from "lucide-react";
import { Pill, statusTone, Button } from "./ui";
import WorkoutItemRow from "./WorkoutItemRow";

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
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

  const workoutStatus = norm(dailyWorkout?.Status || "");
  const reviewStatus = norm(dailyWorkout?.ReviewStatus || dailyWorkout?.reviewStatus || "");
  const reviewedNotes = pickNote(dailyWorkout);
  const needsInfo = reviewStatus === "needs_info";

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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Daily Workout</p>
          <p className="text-lg font-extrabold text-gray-900 mt-1 truncate">
            {dailyWorkout?.Title || "Daily Workout"}
          </p>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <p className="text-[12px] text-gray-600">
              Swipe right on an item to upload — or use Quick Upload.
            </p>

            {progress.total ? (
              <p className="text-[11px] text-gray-500">
                {progress.done}/{progress.total} done
              </p>
            ) : null}
          </div>

          {/* Mini progress bar */}
          {progress.total ? (
            <div className="mt-3 h-2 w-full max-w-md rounded-full bg-gray-100 overflow-hidden border border-gray-200">
              <div
                className="h-full rounded-full bg-[#46769B]"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Pill tone={statusTone(dailyWorkout?.Status)}>{dailyWorkout?.Status || "assigned"}</Pill>

          {workoutStatus === "completed" ? (
            <Pill tone="good">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Workout complete
            </Pill>
          ) : null}

          {needsInfo ? (
            <Pill tone="warn">
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
              Needs info from you
            </Pill>
          ) : null}
        </div>
      </div>

      {/* Needs-info message */}
      {needsInfo && reviewedNotes ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-700" />
            Coach message
          </p>
          <p className="text-[12px] text-gray-700 mt-2 whitespace-pre-wrap">{reviewedNotes}</p>
          <p className="text-[11px] text-gray-600 mt-2">
            Upload again with the requested details so your coach can approve it.
          </p>
        </div>
      ) : null}

      {/* “Skimmer lane” quick action rail */}
      <div className="mt-5">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-gray-700" />
                Quick Upload
              </p>
              <p className="text-[12px] text-gray-600 mt-1">
                Fastest path: tap to open the camera flow.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
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
            </div>
          </div>

          {/* Swipe hint strip */}
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white/70 px-3 py-2">
            <p className="text-[11px] text-gray-600">
              <span className="font-semibold">Pro tip:</span> On mobile, swipe right on any row below to open upload.
            </p>
          </div>
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
              Your coach assigned a workout for this date, but the{" "}
              <span className="font-semibold">WorkoutItems</span> field on the DailyWorkouts record has no linked items.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
