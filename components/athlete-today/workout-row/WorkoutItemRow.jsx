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
  ShieldAlert,
  Footprints,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, Pill, SwipeRow } from "../ui";
import StatusBadge from "./StatusBadge";
import WorkoutTargets from "./WorkoutTargets";
import { asBool, cx, formatWeight, normStatus, safeText, hasText } from "./helpers";
import { getRowState, getTone } from "./tone";

const SWIPE_ANIM_ID = "checkpeak-swipe-hint-anim";
function ensureSwipeStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SWIPE_ANIM_ID)) return;
  const s = document.createElement("style");
  s.id = SWIPE_ANIM_ID;
  s.textContent = `
    @keyframes cp-swipe-nudge {
      0%   { transform: translateX(0) }
      20%  { transform: translateX(10px) }
      45%  { transform: translateX(6px) }
      70%  { transform: translateX(12px) }
      85%  { transform: translateX(4px) }
      100% { transform: translateX(0) }
    }
    .cp-swipe-nudge {
      animation: cp-swipe-nudge 700ms cubic-bezier(0.22, 1, 0.36, 1) 900ms 1 both;
    }
  `;
  document.head.appendChild(s);
}

let swipeHintFired = false;

function pickCoachNote(item) {
  const candidates = [
    item?.ReviewNote,
    item?.reviewNote,
    item?.ReviewedNotes,
    item?.reviewedNotes,
    item?.CoachNote,
    item?.coachNote,
    item?.NoteToAthlete,
    item?.noteToAthlete,
    item?.Note,
  ];

  for (const v of candidates) {
    const s = safeText(v);
    if (s) return s;
  }
  return "";
}

function normalizeEvidenceRequired(raw) {
  if (raw === true || raw === "true") return "photo";
  if (!raw || raw === false || raw === "false") return "none";
  return String(raw).trim().toLowerCase();
}

export default function WorkoutItemRow({
  item,
  submitting = false,
  onUpload,
  onQuickComplete,
  optimisticStatus = "",
  onAcknowledge,
  acknowledging = false,
}) {
  useEffect(() => { ensureSwipeStyles(); }, []);

  const rowRef     = useRef(null);
  const hintedRef  = useRef(false);
  const id = String(item?.id || item?.ID || item?.recordId || "").trim();
  const exercise = safeText(item?.ExerciseName || item?.Title || "Exercise");

  const evidenceValue   = normalizeEvidenceRequired(item?.EvidenceRequired);
  const isVARA          = evidenceValue === "voluntary_activity_vara";
  const evidenceRequired = !isVARA && evidenceValue !== "none";

  let status = normStatus(optimisticStatus || item?.Status || "");

  const isAcknowledged = status === "acknowledged";
  const completedFlagRaw = normStatus(item?.Completed) === "true";
  const completedFlag = completedFlagRaw || isAcknowledged;

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

  const weightValue  = formatWeight(item?.Weight ?? item?.Load ?? "");
  const videoUrl     = safeText(item?.VideoURL);
  const instructions = safeText(item?.Instructions);
  const coachNote    = pickCoachNote(item);
  const completionId = safeText(item?.CompletionId || item?.completionId || "");

  const disabled = submitting || acknowledging || (isCheckedOff && !isRejected);

  useEffect(() => {
    if (disabled) return;
    if (hintedRef.current) return;
    if (swipeHintFired) return;
    hintedRef.current  = true;
    swipeHintFired     = true;
    const el = rowRef.current;
    if (!el) return;
    el.classList.add("cp-swipe-nudge");
    const clean = () => el.classList.remove("cp-swipe-nudge");
    el.addEventListener("animationend", clean, { once: true });
    return () => { el.removeEventListener("animationend", clean); };
  }, [disabled]);

  const swipeAction = () => {
    if (disabled) return;

    if (isRejected) {
      onAcknowledge?.({ completionId, workoutItemId: id });
      return;
    }

    if (isVARA) {
      onQuickComplete?.(id);
      return;
    }

    if (evidenceRequired) return onUpload?.({ ...item, id });
    onQuickComplete?.(id);
  };

  const swipeHint = isRejected
    ? "Swipe to acknowledge"
    : isVARA
    ? "Swipe to log activity"
    : evidenceRequired
    ? "Swipe to upload"
    : "Swipe to complete";

  const actionLabel = isRejected ? "Seen" : isVARA ? "Logged" : evidenceRequired ? "Uploaded" : "Done";

  const iconNode =
    cardTone === "pending" ? (
      <Clock className="w-5 h-5 text-sky-800" />
    ) : cardTone === "completed" ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-800" />
    ) : isVARA ? (
      <Footprints className="w-5 h-5 text-violet-600" />
    ) : evidenceRequired ? (
      <Camera className="w-5 h-5 text-amber-700" />
    ) : (
      <CheckCircle2 className="w-5 h-5 text-[#4FABFF]" />
    );

  return (
    <SwipeRow
      disabled={disabled}
      onCommit={swipeAction}
      hint={swipeHint}
      actionLabel={actionLabel}
      actionIcon={
        isRejected ? (
          <CheckCircle2 className="w-5 h-5 text-[#4FABFF]" />
        ) : isVARA ? (
          <Footprints className="w-5 h-5 text-[#4FABFF]" />
        ) : evidenceRequired ? (
          <Camera className="w-5 h-5 text-[#4FABFF]" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-[#4FABFF]" />
        )
      }
      railTone={railTone}
    >
      <div
        ref={rowRef}
        className={cx(
          "relative rounded-2xl border p-4 transition shadow-sm overflow-hidden",
          toneCardCls,
          ringCls,
          disabled ? "opacity-[0.98]" : ""
        )}
      >
        {isCheckedOff ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/45 blur-2xl" />
          </div>
        ) : null}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 relative">
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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-gray-900 truncate">{exercise}</p>

                    {isVARA && !isCheckedOff ? (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5">
                        <Footprints className="w-3 h-3 text-violet-500" />
                        <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Voluntary Activity</span>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
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

                      {acknowledging ? (
                        <Pill tone="warn">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Saving…
                        </Pill>
                      ) : null}
                    </div>

                    {isCheckedOff ? (
                      <p className={cx("text-xs mt-2 leading-snug", hintToneText)}>
                        {isRejected
                          ? "Coach note available - acknowledge when seen."
                          : isPending
                          ? "Submitted - coach review pending."
                          : isAcknowledged
                          ? "Acknowledged."
                          : "Completed."}
                      </p>
                    ) : null}

                    {!hasText(item?.Sets) &&
                    !hasText(item?.Reps) &&
                    !weightValue &&
                    !hasText(item?.RPE) &&
                    !hasText(item?.Rest) &&
                    !isCheckedOff ? (
                      <p className="text-xs text-gray-500 mt-2 leading-snug">
                        {isRejected
                          ? "Coach left a note - swipe to acknowledge."
                          : isVARA
                          ? "Self-report only - swipe to log."
                          : evidenceRequired
                          ? "Proof required - swipe to upload."
                          : "Swipe to mark complete."}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 text-gray-300 pt-0.5">
                    <ChevronRight className="w-5 h-5" />
                  </span>
                </div>

                <WorkoutTargets
                  sets={safeText(item?.Sets)}
                  reps={safeText(item?.Reps)}
                  weight={weightValue}
                  rest={safeText(item?.Rest)}
                  rpe={safeText(item?.RPE)}
                  muted={isCheckedOff}
                  tone={cardTone === "pending" ? "pending" : cardTone === "completed" ? "completed" : "base"}
                />

                {isVARA && !isCheckedOff ? (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Footprints className="w-4 h-4 text-violet-500" />
                      <p className="text-[11px] text-violet-800 font-extrabold">Voluntary Activity</p>
                    </div>
                    <p className="text-[12px] text-violet-900 leading-snug">
                      This activity is optional and self-reported. No photo or video required - just tap Done when complete.
                    </p>
                  </div>
                ) : null}

                {isRejected && coachNote ? (
                  <div className={cx("mt-3", isCheckedOff ? "opacity-[0.92]" : "")}>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldAlert className="w-4 h-4 text-amber-700" />
                        <p className="text-[11px] text-amber-900 font-extrabold">Coach note</p>
                      </div>
                      <p className="text-[12px] text-amber-900 whitespace-pre-wrap break-words leading-snug">
                        {coachNote}
                      </p>
                      <p className="text-[11px] text-amber-800 mt-2">
                        No back-and-forth needed - just acknowledge once you've read it.
                      </p>
                    </div>
                  </div>
                ) : null}

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

                {videoUrl ? (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cx("mt-3 inline-flex items-center gap-2 text-sm font-semibold hover:underline", linkTone)}
                  >
                    <PlayCircle className="w-4 h-4" />
                    Watch demo video
                    <ChevronRight className="w-4 h-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2 lg:items-end">
            {isRejected ? (
              <Button
                variant="dark"
                className="px-4 py-2.5 text-xs"
                onClick={() => onAcknowledge?.({ completionId, workoutItemId: id })}
                disabled={disabled || !id || (!completionId && !id)}
                title="Confirm you saw the coach note"
              >
                <CheckCircle2 className="w-4 h-4" />
                Acknowledge
              </Button>
            ) : !isCheckedOff ? (
              <>
                {isVARA ? (
                  <Button
                    variant="dark"
                    className="px-4 py-2.5 text-xs"
                    onClick={() => onQuickComplete?.(id)}
                    disabled={submitting}
                    title="Log this voluntary activity as complete"
                  >
                    <Footprints className="w-4 h-4" />
                    Done
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      className="px-4 py-2.5 text-xs"
                      onClick={() => onUpload?.({ ...item, id })}
                      disabled={submitting}
                      title={evidenceRequired ? "Upload required proof" : "Upload photo / video"}
                    >
                      {evidenceRequired ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                      {evidenceRequired ? "Upload proof" : "Upload"}
                    </Button>

                    {!evidenceRequired ? (
                      <Button
                        variant="dark"
                        className="px-4 py-2.5 text-xs"
                        onClick={() => onQuickComplete?.(id)}
                        disabled={submitting}
                        title="Mark complete without uploading"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Done
                      </Button>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </SwipeRow>
  );
}