// components/org/reviewQueue/ReviewQueueModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, HelpCircle, Image as ImageIcon, ThumbsUp } from "lucide-react";
import {
  Button,
  Modal,
  Pill,
  dailyWorkoutTone,
  extractAttachmentUrl,
  reviewTone,
  classNames,
} from "@/components/org/reviewQueue/ui";

function safeLookupFirst(v) {
  if (Array.isArray(v)) return String(v?.[0] ?? "").trim();
  return String(v ?? "").trim();
}

function getAttName(att, i) {
  return String(att?.filename || att?.name || `Upload ${i + 1}`).trim();
}

function isLikelyImageUrl(url = "") {
  const u = String(url || "").toLowerCase();
  return u.includes(".png") || u.includes(".jpg") || u.includes(".jpeg") || u.includes(".webp") || u.includes("image");
}

function isLikelyPdfUrl(url = "") {
  const u = String(url || "").toLowerCase();
  return u.includes(".pdf") || u.includes("application/pdf");
}

/**
 * ReviewQueueModal (simple coach flow)
 * ✅ view uploads (thumbs + viewer)
 * ✅ open fullscreen / new tab
 * ✅ write ReviewNote (required for Needs Info)
 * ✅ approve / needs info
 */
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
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Load existing ReviewNote when opening (coach can edit)
  useEffect(() => {
    if (!open) {
      setNote("");
      setSelectedIdx(0);
      return;
    }

    const existing =
      String(active?.reviewNote || "").trim() ||
      String(active?.ReviewNote || "").trim() ||
      "";
    setNote(existing);
    setSelectedIdx(0);
  }, [open, active?.id]);

  const attachments = useMemo(() => (Array.isArray(active?.attachments) ? active.attachments : []), [active]);

  const athleteName = useMemo(() => {
    const v = String(active?.athleteName || "").trim() || safeLookupFirst(active?.AthleteName);
    return v || "Athlete";
  }, [active]);

  const athleteEmail = useMemo(() => {
    const v = String(active?.athleteEmail || "").trim() || safeLookupFirst(active?.AthleteEmail);
    return v || "";
  }, [active]);

  const canNeedsInfo = useMemo(() => String(note || "").trim().length >= 3, [note]);

  const selected = useMemo(() => {
    if (!attachments.length) return { url: "", name: "", idx: 0, total: 0 };
    const idx = Math.min(Math.max(0, selectedIdx), attachments.length - 1);
    const att = attachments[idx];
    return {
      url: extractAttachmentUrl(att),
      name: getAttName(att, idx),
      idx,
      total: attachments.length,
    };
  }, [attachments, selectedIdx]);

  const hasAttachments = attachments.length > 0;
  const selectedUrl = selected?.url || "";
  const selectedIsPdf = isLikelyPdfUrl(selectedUrl);
  const selectedIsImage = isLikelyImageUrl(selectedUrl);

  const goPrev = () => {
    if (!attachments.length) return;
    setSelectedIdx((i) => (i <= 0 ? attachments.length - 1 : i - 1));
  };

  const goNext = () => {
    if (!attachments.length) return;
    setSelectedIdx((i) => (i >= attachments.length - 1 ? 0 : i + 1));
  };

  if (!active) {
    return (
      <Modal open={open} title="Review" onClose={onClose}>
        <div className="text-sm text-gray-600">No item selected.</div>
      </Modal>
    );
  }

  return (
    <Modal open={open} title={`Review`} onClose={onClose}>
      {saveErr ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-700 font-semibold">{saveErr}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {/* Summary */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Workout completion</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1 truncate">
                {active?.title || "Workout completion"}
              </p>

              <p className="text-[12px] text-gray-700 mt-1">
                Athlete: <span className="font-semibold">{athleteName}</span>
                {athleteEmail ? <span className="text-gray-500"> • {athleteEmail}</span> : null}
              </p>

              <p className="text-[12px] text-gray-700 mt-1">
                Submitted: <span className="font-semibold">{active?.date ? fmtDate?.(active.date) : "—"}</span>
              </p>
            </div>

            <div className="shrink-0 flex flex-wrap gap-2 justify-end">
              <Pill tone={dailyWorkoutTone(active?.status)}>{active?.status || "—"}</Pill>
              <Pill tone={reviewTone(active?.reviewStatus)}>
                {String(active?.reviewStatus || "pending").replaceAll("_", " ")}
              </Pill>
              {hasAttachments ? <Pill>{attachments.length} uploads</Pill> : null}
            </div>
          </div>

          {active?.attachmentSummary ? (
            <p className="text-[12px] text-gray-600 mt-2">{active.attachmentSummary}</p>
          ) : null}
        </div>

        {/* Uploads (simple) */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              Uploads
            </p>
            <Pill>{attachments.length}</Pill>
          </div>

          {!hasAttachments ? (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
              No attachments found on this record.
            </div>
          ) : (
            <div className="mt-3 grid lg:grid-cols-12 gap-3">
              {/* Thumbs */}
              <div className="lg:col-span-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                  {attachments.map((att, i) => {
                    const url = extractAttachmentUrl(att);
                    const name = getAttName(att, i);
                    const isSel = i === selected.idx;

                    return (
                      <button
                        key={`${i}-${name}`}
                        type="button"
                        className={classNames(
                          "group rounded-2xl overflow-hidden border bg-white text-left transition",
                          isSel ? "border-[#46769B] ring-2 ring-[#46769B]/15" : "border-gray-200 hover:border-gray-300"
                        )}
                        onClick={() => setSelectedIdx(i)}
                        title="Select"
                      >
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={name}
                            className="w-full h-24 object-cover group-hover:opacity-95"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center bg-gray-50 text-[11px] text-gray-500 px-2">
                            Preview unavailable
                          </div>
                        )}
                        <div className="p-2 text-[11px] text-gray-600 truncate">{name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Viewer */}
              <div className="lg:col-span-8 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-gray-200">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{selected.name || "Upload"}</div>
                    <div className="text-[11px] text-gray-500">
                      {attachments.length ? `${selected.idx + 1} of ${selected.total}` : "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                      title="Previous"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
                      title="Next"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>

                    {selectedUrl ? (
                      <>
                        <a
                          href={selectedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-600" />
                          Open
                        </a>

                        <button
                          type="button"
                          onClick={() => onOpenLightbox?.(selectedUrl)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#46769B] px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
                          title="Full screen"
                        >
                          Full screen
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="p-3">
                  {selectedUrl ? (
                    selectedIsPdf ? (
                      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                        <iframe src={selectedUrl} title={selected.name} className="w-full h-[360px]" />
                      </div>
                    ) : selectedIsImage ? (
                      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedUrl}
                          alt={selected.name}
                          className="w-full max-h-[360px] object-contain bg-white"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
                        Preview not supported. Use <span className="font-semibold">Open</span>.
                      </div>
                    )
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
                      No preview available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Review note */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-extrabold text-gray-900">Message to athlete (only if needed)</p>
          <p className="text-[12px] text-gray-600 mt-1">
            Required for <span className="font-semibold">Needs Info</span>. Saved to Airtable field{" "}
            <span className="font-mono">ReviewNote</span>.
          </p>

          <textarea
            className="mt-3 w-full min-h-[110px] rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
            placeholder='Example: "Please upload a clearer screenshot and include weight x reps for set 3."'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
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
