// components/athlete-today/workout/WorkoutItemRow.jsx
"use client";

import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  PlayCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button, Pill, SwipeRow } from "../ui";
import StatusBadge from "./StatusBadge";
import WorkoutTargets from "./WorkoutTargets";
import { asBool, cx, formatWeight, normStatus, safeText, hasText } from "./helpers";
import { getRowState, getTone } from "./tone";

export default function WorkoutItemRow({
  item,
  submitting = false,
  onUpload,
  onQuickComplete,
  optimisticStatus = "",
}) {
  const id = String(item?.id || item?.ID || item?.recordId || "").trim();
  const exercise = safeText(item?.ExerciseName || item?.Title || "Exercise");
  const evidenceRequired = asBool(item?.EvidenceRequired);

  // Prefer optimistic status for instant UI feedback after submit
  const status = normStatus(optimisticStatus || item?.Status || "");
  const completedFlag = normStatus(item?.Completed) === "true";

  const { isPending, isRejected, isCompleted, isCheckedOff } = getRowState({
    status,
    completedFlag,
  });

  const {
    cardTone,
    toneCardCls,
    toneIconWrap,
    linkTone,
    railTone,
    hintToneText,
    ringCls,
  } = getTone({
    isRejected,
    isPending,
    isCompleted,
    isCheckedOff,
    evidenceRequired,
  });

  // Athlete can move on when pending OR completed (unless rejected)
  const disabled = submitting || (isCheckedOff && !isRejected);

  const weightValue = formatWeight(item?.Weight ?? item?.Load ?? "");
  const videoUrl = safeText(item?.VideoURL);
  const instructions = safeText(item?.Instructions);

  const swipeAction = () => {
    if (disabled) return;
    if (evidenceRequired) return onUpload?.({ ...item, id });
    onQuickComplete?.(id);
  };

  // Keep hint minimal (this is shown in the swipe rail)
  const swipeHint = isRejected
    ? "Swipe to re-upload"
    : evidenceRequired
    ? "Swipe to upload"
    : "Swipe to complete";

  // Left icon is a quick “state” indicator (no extra emoji text in the row)
  const iconNode =
    cardTone === "pending" ? (
      <Clock className="w-5 h-5 text-sky-800" />
    ) : cardTone === "completed" ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-800" />
    ) : evidenceRequired ? (
      <Camera className="w-5 h-5 text-amber-700" />
    ) : (
      <CheckCircle2 className="w-5 h-5 text-[#46769B]" />
    );

  return (
    <SwipeRow
      disabled={disabled}
      onCommit={swipeAction}
      hint={swipeHint}
      actionLabel={evidenceRequired ? "Upload" : "Done"}
      // rail icon should be subtle + consistent (don’t show “camera emoji” in the row)
      actionIcon={
        evidenceRequired ? (
          <Camera className="w-5 h-5 text-[#46769B]" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-[#46769B]" />
        )
      }
      railTone={railTone} // expects "blue" | "emerald" | "gray" | "sky" (if you added sky to SwipeRow)
    >
      <div
        className={cx(
          "relative rounded-2xl border p-4 transition shadow-sm overflow-hidden",
          toneCardCls,
          ringCls,
          disabled ? "opacity-[0.98]" : ""
        )}
      >
        {/* subtle sheen only when checked off */}
        {isCheckedOff ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/45 blur-2xl" />
          </div>
        ) : null}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 relative">
          {/* Left */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  "h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0",
                  toneIconWrap
                )}
              >
                {iconNode}
              </span>

              <div className="min-w-0 flex-1">
                {/* Header layout: title row + chips row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-gray-900 truncate">{exercise}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {/* One status indicator */}
                      <StatusBadge
                        isRejected={isRejected}
                        isPending={isPending}
                        isCompleted={isCompleted}
                        evidenceRequired={evidenceRequired}
                      />

                      {submitting ? (
                        <Pill tone="warn">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Submitting…
                        </Pill>
                      ) : null}
                    </div>

                    {/* One secondary line ONLY when checked off */}
                    {isCheckedOff ? (
                      <p className={cx("text-[12px] mt-2 leading-snug", hintToneText)}>
                        {isRejected
                          ? "Rejected — upload again with corrections."
                          : isPending
                          ? "Submitted — coach review pending."
                          : "Completed."}
                      </p>
                    ) : null}

                    {/* Guidance only when targets missing and NOT checked off */}
                    {!hasText(item?.Sets) &&
                    !hasText(item?.Reps) &&
                    !weightValue &&
                    !hasText(item?.RPE) &&
                    !hasText(item?.Rest) &&
                    !isCheckedOff ? (
                      <p className="text-[12px] text-gray-500 mt-2 leading-snug">
                        {evidenceRequired ? "Proof required — swipe to upload." : "Swipe to mark complete."}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 text-gray-300 pt-0.5">
                    <ChevronRight className="w-5 h-5" />
                  </span>
                </div>

                {/* Targets */}
                <WorkoutTargets
                  sets={safeText(item?.Sets)}
                  reps={safeText(item?.Reps)}
                  weight={weightValue}
                  rest={safeText(item?.Rest)}
                  rpe={safeText(item?.RPE)}
                  muted={isCheckedOff}
                  tone={cardTone === "pending" ? "pending" : cardTone === "completed" ? "completed" : "base"}
                />

                {/* Instructions */}
                {instructions ? (
                  <div className={cx("mt-3", isCheckedOff ? "opacity-[0.86]" : "")}>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="w-4 h-4 text-gray-400" />
                        <p className="text-[11px] text-gray-500 font-semibold">Coach instructions</p>
                      </div>
                      <p className="text-[12px] text-gray-700 whitespace-pre-wrap break-words leading-snug">
                        {instructions}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Video */}
                {videoUrl ? (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cx(
                      "mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline",
                      linkTone
                    )}
                  >
                    <PlayCircle className="w-4 h-4" />
                    Watch demo video
                    <ChevronRight className="w-4 h-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2 lg:items-end">
            {/* Hide actions once checked off (unless rejected) */}
            {!isCheckedOff || isRejected ? (
              <>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => onUpload?.({ ...item, id })}
                  disabled={submitting}
                  title={evidenceRequired ? "Upload required proof" : "Upload photo / video"}
                >
                  {evidenceRequired ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  {isRejected ? "Re-upload" : evidenceRequired ? "Upload proof" : "Upload"}
                </Button>

                {!evidenceRequired ? (
                  <Button
                    variant="dark"
                    className="px-3 py-2 text-xs"
                    onClick={() => onQuickComplete?.(id)}
                    disabled={submitting}
                    title="Mark complete without uploading"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Done
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </SwipeRow>
  );
}
