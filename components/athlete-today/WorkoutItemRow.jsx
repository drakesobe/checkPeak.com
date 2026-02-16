// components/athlete-today/WorkoutItemRow.jsx
"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  Upload,
  Clock,
  XCircle,
  ChevronRight,
  Camera,
  Sparkles,
  Info,
} from "lucide-react";
import { Button, Pill, SwipeRow } from "./ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function asBool(v) {
  if (typeof v === "boolean") return v;
  return String(v ?? "").trim().toLowerCase() === "true";
}

function safeText(v) {
  return String(v ?? "").trim();
}

function formatWeight(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s;
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function hasText(v) {
  return Boolean(safeText(v));
}

/* -------------------------------------------------------------------------- */
/* Micro UI                                                                    */
/* -------------------------------------------------------------------------- */

function MetaPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
      {children}
    </span>
  );
}

function StatusBadge({ isRejected, isPending, isDone, evidenceRequired }) {
  if (isRejected) {
    return (
      <Pill tone="warn">
        <XCircle className="w-3.5 h-3.5 mr-1.5" />
        Rejected
      </Pill>
    );
  }
  if (isPending) {
    return (
      <Pill tone="warn">
        <Clock className="w-3.5 h-3.5 mr-1.5" />
        Pending review
      </Pill>
    );
  }
  if (isDone) {
    return (
      <Pill tone="good">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
        Done
      </Pill>
    );
  }
  if (evidenceRequired) {
    return (
      <Pill tone="warn">
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        Proof required
      </Pill>
    );
  }
  return <Pill>Optional photo</Pill>;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function WorkoutItemRow({
  item,
  submitting = false,
  onUpload,
  onQuickComplete,
}) {
  const id = String(item?.id || item?.ID || item?.recordId || "").trim();

  const exercise = safeText(item?.ExerciseName || item?.Title || "Exercise");

  // EvidenceRequired can arrive as boolean or string
  const evidenceRequired = asBool(item?.EvidenceRequired);

  const status = norm(item?.Status || "");
  const completedFlag = norm(item?.Completed) === "true";

  const isPending = status === "pending_review";
  const isRejected = status === "rejected";
  const isCompleted = status === "completed" || completedFlag;
  const isDone = isCompleted || isPending;

  // allow interaction if rejected (resubmit)
  const disabled = submitting || (isDone && !isRejected);

  // Prefer Weight, fallback to Load for older rows
  const weightValue = formatWeight(item?.Weight ?? item?.Load ?? "");

  const metaBits = useMemo(() => {
    const out = [];
    if (hasText(item?.Sets)) out.push({ k: "sets", v: `${item.Sets} sets` });
    if (hasText(item?.Reps)) out.push({ k: "reps", v: `${item.Reps} reps` });
    if (weightValue) out.push({ k: "weight", v: `Weight ${weightValue}` });
    if (hasText(item?.RPE)) out.push({ k: "rpe", v: `RPE ${item.RPE}` });
    if (hasText(item?.Rest)) out.push({ k: "rest", v: `Rest ${item.Rest}` });
    return out;
  }, [item, weightValue]);

  // Swipe action:
  // - Evidence required => upload flow (opens camera via modal input capture)
  // - Not required => quick complete
  const swipeAction = () => {
    if (disabled) return;

    if (evidenceRequired) {
      onUpload?.({ ...item, id });
      return;
    }

    onQuickComplete?.(id);
  };

  // Hint text
  const swipeHint = isRejected
    ? "Fix and swipe right to re-upload"
    : isPending
    ? "Pending coach review"
    : evidenceRequired
    ? "Swipe right to upload proof"
    : "Swipe right to mark done";

  const videoUrl = safeText(item?.VideoURL);
  const instructions = safeText(item?.Instructions);

  const badge = (
    <StatusBadge
      isRejected={isRejected}
      isPending={isPending}
      isDone={isDone}
      evidenceRequired={evidenceRequired}
    />
  );

  return (
    <SwipeRow
      disabled={disabled}
      onCommit={swipeAction}
      hint={swipeHint}
      actionLabel={evidenceRequired ? "Upload" : "Done"}
      actionIcon={
        evidenceRequired ? (
          <Camera className="w-5 h-5 text-[#46769B]" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-[#46769B]" />
        )
      }
    >
      <div
        className={cx(
          "rounded-2xl border bg-white p-4 transition shadow-sm",
          "overflow-hidden",
          disabled ? "border-gray-200 opacity-[0.92]" : "border-gray-200 hover:border-gray-300"
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {/* Icon well */}
              <span
                className={cx(
                  "h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0",
                  evidenceRequired ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50"
                )}
              >
                {evidenceRequired ? (
                  <Camera className="w-5 h-5 text-amber-700" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#46769B]" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-gray-900 truncate">{exercise}</p>

                  {badge}

                  {submitting ? (
                    <Pill tone="warn">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Submitting…
                    </Pill>
                  ) : null}
                </div>

                {/* Meta pills (mobile-friendly, wraps cleanly) */}
                {metaBits.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metaBits.map((m) => (
                      <MetaPill key={m.k}>{m.v}</MetaPill>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-gray-500 mt-2 leading-snug">
                    {isDone
                      ? isPending
                        ? "Your coach is reviewing your proof."
                        : "Nice work — this item is complete."
                      : evidenceRequired
                      ? "Proof required — swipe to upload fast."
                      : "Photo optional — swipe to finish instantly."}
                  </p>
                )}

                {/* Instructions (compact, consistent spacing) */}
                {instructions ? (
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="w-4 h-4 text-gray-400" />
                      <p className="text-[11px] text-gray-500 font-semibold">
                        Coach instructions
                      </p>
                    </div>
                    <p className="text-[12px] text-gray-700 whitespace-pre-wrap break-words leading-snug">
                      {instructions}
                    </p>
                  </div>
                ) : null}

                {/* Video link */}
                {videoUrl ? (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#46769B] hover:underline"
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
            <Button
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => onUpload?.({ ...item, id })}
              disabled={submitting || (!evidenceRequired && isDone && !isRejected)}
              title={evidenceRequired ? "Upload required proof" : "Upload photo / video"}
            >
              {evidenceRequired ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {evidenceRequired ? "Upload proof" : "Upload"}
            </Button>

            {!evidenceRequired ? (
              <Button
                variant="dark"
                className="px-3 py-2 text-xs"
                onClick={() => onQuickComplete?.(id)}
                disabled={submitting || (isDone && !isRejected)}
                title="Mark complete without uploading"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </SwipeRow>
  );
}
