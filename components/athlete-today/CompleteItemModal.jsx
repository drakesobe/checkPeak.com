// components/athlete-today/CompleteItemModal.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Info, Upload, AlertTriangle, X, Image as ImageIcon } from "lucide-react";
import { Button, Modal, Pill } from "./ui";

function normBool(v) {
  return String(v ?? "").trim().toLowerCase() === "true";
}

function safeText(v) {
  return String(v ?? "").trim();
}

function fileLabel(file) {
  if (!file) return "";
  const name = safeText(file?.name);
  const size = Number(file?.size || 0);
  if (!name) return "Selected file";
  if (!size) return name;
  const kb = Math.round(size / 1024);
  if (kb < 1024) return `${name} (${kb} KB)`;
  const mb = (kb / 1024).toFixed(1);
  return `${name} (${mb} MB)`;
}

export default function CompleteItemModal({
  open,
  item,
  selectedFile,
  coachNote,
  submitting = false,
  onClose,
  onPickFile,
  onChangeNote,
  onSubmit,
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  const evidenceRequired = useMemo(() => normBool(item?.EvidenceRequired), [item]);
  const title = safeText(item?.ExerciseName || item?.Title || "") || "Workout item";

  // Build / clean up preview URL
  useEffect(() => {
    if (!open) return;

    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    setPreviewUrl("");
  }, [open, selectedFile]);

  // When closing or switching items, clear preview
  useEffect(() => {
    if (!open) setPreviewUrl("");
  }, [open, item?.id]);

  if (!open) return null;

  const noteText = String(coachNote || "");
  const noteLen = noteText.length;

  const canSubmit = Boolean(item?.id) && !submitting && (!evidenceRequired || !!selectedFile);
  const submitLabel = evidenceRequired ? "Submit proof" : "Mark complete";

  return (
    <Modal
      open={open}
      title={item ? `Complete: ${title}` : "Complete item"}
      onClose={onClose}
      subtitle={evidenceRequired ? "Proof required for this item." : "Proof optional — you can still complete it."}
    >
      {item ? (
        <div className="space-y-4">
          {/* Requirement banner */}
          <div
            className={[
              "rounded-2xl border p-4",
              evidenceRequired ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  Tip
                </p>

                <p className="text-[12px] text-gray-700 mt-2 leading-snug">
                  Quick proof works best: machine display, bar on rack, treadmill screen, or a selfie in the gym.
                </p>

                <div className="mt-3">
                  {evidenceRequired ? (
                    <Pill tone="warn">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                      Evidence required
                    </Pill>
                  ) : (
                    <Pill>Evidence optional</Pill>
                  )}
                </div>
              </div>

              {/* Close button for fast mobile UX */}
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Upload */}
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">Upload proof</p>
                <p className="text-[12px] text-gray-600 mt-1 leading-snug">
                  On mobile, this may open your camera. Photos work best.
                </p>
              </div>

              {/* requirement chip (mobile-friendly) */}
              <div className="shrink-0">
                {evidenceRequired ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                    Required
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                    Optional
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              {/* Clickable upload area */}
              <label className="group cursor-pointer">
                <div
                  className={[
                    "rounded-2xl border border-dashed p-4 transition",
                    evidenceRequired
                      ? "border-amber-300 bg-amber-50/40 hover:bg-amber-50"
                      : "border-gray-300 bg-gray-50 hover:bg-gray-100",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-2 shrink-0">
                      <Upload className="w-5 h-5 text-gray-700" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedFile ? "Change file" : "Tap to choose a photo"}
                      </p>
                      <p className="text-[12px] text-gray-600 truncate">
                        {selectedFile ? fileLabel(selectedFile) : evidenceRequired ? "Required for this item" : "Optional for this item"}
                      </p>
                    </div>
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => onPickFile?.(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {/* Preview */}
              {previewUrl ? (
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="w-full h-56 object-cover" />
                  <div className="px-3 py-2 text-[11px] text-gray-600">
                    Looks good? Hit <span className="font-semibold">{submitLabel}</span>.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start gap-2">
                    <span className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
                      <ImageIcon className="w-4 h-4 text-gray-600" />
                    </span>
                    <p className="text-[12px] text-gray-600 leading-snug">
                      {evidenceRequired
                        ? "You must select a photo to submit this item."
                        : "You can submit without a photo, but uploading helps your coach approve faster."}
                    </p>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold text-gray-900">Note to coach (optional)</p>
                  <p className="text-[11px] text-gray-500 shrink-0">{noteLen}/500</p>
                </div>

                <textarea
                  className="mt-2 w-full min-h-[96px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/40"
                  placeholder="Example: changed weight, felt easy, modified exercise, short on time…"
                  value={noteText}
                  maxLength={500}
                  onChange={(e) => onChangeNote?.(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions (mobile-safe stacking) */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>

            <Button onClick={onSubmit} disabled={!canSubmit}>
              <Camera className="w-4 h-4" />
              {submitting ? "Submitting…" : submitLabel}
            </Button>
          </div>

          {/* Inline validation */}
          {evidenceRequired && !selectedFile ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] text-amber-900 font-semibold">
                A photo is required for this item before you can submit.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
