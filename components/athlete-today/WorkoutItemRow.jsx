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
} from "lucide-react";
import { Button, Pill, SwipeRow } from "./ui";

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

export default function WorkoutItemRow({ item, submitting = false, onUpload, onQuickComplete }) {
  const id = String(item?.id || item?.ID || "").trim();

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
    if (safeText(item?.Sets)) out.push(`${item.Sets} sets`);
    if (safeText(item?.Reps)) out.push(`${item.Reps} reps`);
    if (weightValue) out.push(`Weight: ${weightValue}`);
    if (safeText(item?.RPE)) out.push(`RPE: ${item.RPE}`);
    if (safeText(item?.Rest)) out.push(`Rest: ${item.Rest}`);
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
  ? "Swipe right to upload"
  : "Swipe right to mark done";

  // Badge
  const badge = (() => {
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
          Photo required
        </Pill>
      );
    }
    return <Pill>Optional photo</Pill>;
  })();

  const videoUrl = safeText(item?.VideoURL);

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
        className={[
          "rounded-2xl border bg-white p-4 transition",
          disabled ? "border-gray-200 opacity-[0.92]" : "border-gray-200 hover:border-gray-300",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left */}
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

            {metaBits.length ? (
              <p className="text-[12px] text-gray-600 mt-2">{metaBits.join(" • ")}</p>
            ) : (
              <p className="text-[12px] text-gray-500 mt-2">
                {isDone
                  ? isPending
                    ? "Your coach is reviewing your proof."
                    : "Nice work — this item is complete."
                  : evidenceRequired
                  ? "Photo required — swipe to upload fast."
                  : "Photo optional — swipe to finish instantly."}
              </p>
            )}

            {safeText(item?.Instructions) ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] text-gray-500 font-semibold mb-1">Coach instructions</p>
                <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{item.Instructions}</p>
              </div>
            ) : null}

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

          {/* Right actions */}
          <div className="flex flex-col gap-2 shrink-0">
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
