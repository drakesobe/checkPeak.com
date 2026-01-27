// components/org/reviewQueue/ReviewQueueModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Image as ImageIcon, ThumbsUp } from "lucide-react";
import {
  Button,
  Modal,
  Pill,
  dailyWorkoutTone,
  extractAttachmentUrl,
  reviewTone,
} from "@/components/org/reviewQueue/ui";

function safeLookupFirst(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

export default function ReviewQueueModal({
  open,
  active,
  saving,
  saveErr,
  fmtDate,
  onClose,
  onNeedsInfo, // (note: string) => void
  onApprove, // () => void
  onOpenLightbox, // (url: string) => void
}) {
  const [note, setNote] = useState("");

  // Preload existing ReviewedNotes when opening (trainer can edit)
  useEffect(() => {
    if (!open) {
      setNote("");
      return;
    }
    const existing =
      String(active?.reviewedNotes || "").trim() ||
      String(active?.ReviewedNotes || "").trim() ||
      "";
    setNote(existing);
  }, [open, active?.id]);

  const attachments = useMemo(
    () => (Array.isArray(active?.attachments) ? active.attachments : []),
    [active]
  );

  const athleteName = useMemo(() => {
    const v = String(active?.athleteName || "").trim() || safeLookupFirst(active?.AthleteName);
    return v || "Athlete";
  }, [active]);

  const athleteEmail = useMemo(() => {
    const v = String(active?.athleteEmail || "").trim() || safeLookupFirst(active?.AthleteEmail);
    return v || "";
  }, [active]);

  const canNeedsInfo = useMemo(() => String(note || "").trim().length >= 3, [note]);

  if (!active) {
    return (
      <Modal open={open} title="Review" onClose={onClose}>
        <div className="text-sm text-gray-600">No item selected.</div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={active ? `Review: ${active?.title || "Daily Workout"}` : "Review"}
      onClose={onClose}
    >
      {saveErr ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-700 font-semibold">{saveErr}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Daily Workout</p>
          <p className="text-sm font-extrabold text-gray-900 mt-1">{active?.title || "Daily Workout"}</p>

          <p className="text-[12px] text-gray-700 mt-1">
            Athlete: <span className="font-semibold">{athleteName}</span>
            {athleteEmail ? <span className="text-gray-500"> • {athleteEmail}</span> : null}
          </p>

          <p className="text-[12px] text-gray-700 mt-1">
            Date: <span className="font-semibold">{active?.date || "—"}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone={dailyWorkoutTone(active?.status)}>{active?.status || "—"}</Pill>
            <Pill tone={reviewTone(active?.reviewStatus)}>
              Review: {String(active?.reviewStatus || "pending").replaceAll("_", " ")}
            </Pill>
            {active?.createdAt ? <Pill>Created: {fmtDate(active.createdAt)}</Pill> : null}
          </div>

          {active?.attachmentSummary ? (
            <p className="text-[12px] text-gray-600 mt-2">{active.attachmentSummary}</p>
          ) : null}
        </div>

        {/* Message saved back to athlete's assigned workout */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-extrabold text-gray-900">Message to athlete</p>
          <p className="text-[12px] text-gray-600 mt-1">
            This will appear on the athlete’s assigned workout for the day. Required for{" "}
            <span className="font-semibold">Needs Info</span>.
          </p>

          <textarea
            className="mt-3 w-full min-h-[120px] rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
            placeholder='Example: "Upload a clearer screenshot and include weight x reps for set 3."'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="mt-2 text-[11px] text-gray-500">
            Saved to Airtable field: <span className="font-mono">ReviewedNotes</span>
          </div>
        </div>

        {/* Attachments */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <Image as={ImageIcon} />
              <ImageIcon className="w-4 h-4 text-gray-500" />
              Uploads
            </p>
            <Pill>{attachments.length}</Pill>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {attachments.map((att, i) => {
              const url = extractAttachmentUrl(att);
              const name = att?.filename || `Upload ${i + 1}`;

              if (!url) {
                return (
                  <div key={`${i}-${name}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500">
                    {name}
                  </div>
                );
              }

              return (
                <button
                  key={`${i}-${name}`}
                  type="button"
                  className="group rounded-2xl overflow-hidden border border-gray-200 bg-white text-left"
                  onClick={() => onOpenLightbox?.(url)}
                  title="Open"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={name} className="w-full h-32 object-cover group-hover:opacity-95" loading="lazy" />
                  <div className="p-2 text-[11px] text-gray-600 truncate">{name}</div>
                </button>
              );
            })}
          </div>

          {attachments.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
              No attachments found on this record.
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => onNeedsInfo?.(note)}
            disabled={saving || !active?.id || !canNeedsInfo}
            className="px-3 py-2 text-xs"
            title={!canNeedsInfo ? "Add a short message first" : ""}
          >
            <HelpCircle className="w-4 h-4" /> Needs Info
          </Button>

          <Button onClick={() => onApprove?.()} disabled={saving || !active?.id} className="px-3 py-2 text-xs">
            <ThumbsUp className="w-4 h-4" /> Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
}
