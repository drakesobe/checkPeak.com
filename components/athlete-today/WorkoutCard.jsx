// components/athlete-today/WorkoutItemRow.jsx
"use client";

import { AlertTriangle, CheckCircle2, PlayCircle, Upload } from "lucide-react";
import { Button, Pill, SwipeRow } from "./ui";

export default function WorkoutItemRow({
  item,
  submitting = false,
  onUpload,
  onQuickComplete,
}) {
  const id = String(item?.id || item?.ID || "");
  const exercise = item?.ExerciseName || item?.Title || "Exercise";

  const evidenceRequired = String(item?.EvidenceRequired || "").toLowerCase() === "true";

  const isDone =
    String(item?.Completed || item?.completed || "").toLowerCase() === "true" ||
    String(item?.Status || "").toLowerCase() === "completed";

  const metaBits = [
    item?.Sets ? `${item.Sets} sets` : "",
    item?.Reps ? `${item.Reps} reps` : "",
    item?.Load ? `Load: ${item.Load}` : "",
    item?.RPE ? `RPE: ${item.RPE}` : "",
    item?.Rest ? `Rest: ${item.Rest}` : "",
  ].filter(Boolean);

  const disabled = isDone || submitting;

  return (
    <SwipeRow
      disabled={disabled}
      onCommit={() => onUpload?.({ ...item, id })}
      hint={isDone ? "Completed" : "Swipe right to upload"}
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-extrabold text-gray-900 truncate">{exercise}</p>

              {isDone ? (
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
              disabled={disabled}
              title="Upload photo / complete"
            >
              <Upload className="w-4 h-4" />
              Upload
            </Button>

            {!isDone && !evidenceRequired ? (
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
          </div>
        </div>
      </div>
    </SwipeRow>
  );
}
