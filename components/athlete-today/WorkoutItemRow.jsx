"use client";

import { AlertTriangle, CheckCircle2, PlayCircle, Upload, Clock, XCircle } from "lucide-react";
import { Button, Pill, SwipeRow } from "./ui";

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

export default function WorkoutItemRow({
  item,
  submitting = false,
  onUpload,
  onQuickComplete,
}) {
  const id = String(item?.id || item?.ID || "");

  const exercise = item?.ExerciseName || item?.Title || "Exercise";
  const evidenceRequired = !!item?.EvidenceRequired;

  const status = norm(item?.Status || "");
  const isDone = status === "completed" || status === "pending_review" || norm(item?.Completed) === "true";
  const isPending = status === "pending_review";
  const isRejected = status === "rejected";

  // ✅ Prefer Weight, fallback to Load for older rows
  const weightValue = item?.Weight ?? item?.Load ?? "";

  const metaBits = [
    item?.Sets ? `${item.Sets} sets` : "",
    item?.Reps ? `${item.Reps} reps` : "",
    weightValue ? `Weight: ${weightValue}` : "",
    item?.RPE ? `RPE: ${item.RPE}` : "",
    item?.Rest ? `Rest: ${item.Rest}` : "",
  ].filter(Boolean);

  const disabled = submitting || (isDone && !isRejected); // allow interaction if rejected (resubmit)

  // Swipe action:
  // - Evidence required => upload flow
  // - Not required => quick complete
  const swipeAction = () => {
    if (disabled) return;
    if (evidenceRequired) onUpload?.({ ...item, id });
    else onQuickComplete?.(id);
  };

  const swipeHint = isDone
    ? isPending
      ? "Pending review"
      : "Completed"
    : evidenceRequired
    ? "Swipe right to upload"
    : "Swipe right to mark done";

  return (
    <SwipeRow disabled={disabled} onCommit={swipeAction} hint={swipeHint}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-extrabold text-gray-900 truncate">{exercise}</p>

              {isRejected ? (
                <Pill tone="warn">
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  Rejected
                </Pill>
              ) : isPending ? (
                <Pill tone="warn">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Pending review
                </Pill>
              ) : isDone ? (
                <Pill tone="good">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Done
                </Pill>
              ) : evidenceRequired ? (
                <Pill tone="warn">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Photo required
                </Pill>
              ) : (
                <Pill>Optional photo</Pill>
              )}

              {submitting ? <Pill tone="warn">Submitting…</Pill> : null}
            </div>

            {metaBits.length ? (
              <p className="text-[12px] text-gray-600 mt-2">{metaBits.join(" • ")}</p>
            ) : null}

            {item?.Instructions ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{item.Instructions}</p>
              </div>
            ) : null}

            {item?.VideoURL ? (
              <a
                href={item.VideoURL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#46769B] hover:underline"
              >
                <PlayCircle className="w-4 h-4" />
                Watch demo video
              </a>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => onUpload?.({ ...item, id })}
              disabled={submitting || (!evidenceRequired && isDone && !isRejected)}
              title="Upload photo / video"
            >
              <Upload className="w-4 h-4" />
              Upload
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
