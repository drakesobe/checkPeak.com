// components/athlete-today/CompleteItemModal.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Info,
  Upload,
  AlertTriangle,
  X,
  Image as ImageIcon,
  CheckCircle2,
  ClipboardEdit,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button, Modal, Pill, classNames } from "./ui";

/**
 * CompleteItemModal (athlete-simple)
 * Goals:
 * ✅ Clean spacing on mobile (no “running into header”)
 * ✅ Photo capture first (live camera on mobile via input capture)
 * ✅ Proof-required gating stays strict
 * ✅ Notes are optional + collapsible (keeps UI simple for “the lads”)
 * ✅ Preview image when selected
 * ✅ Small, clear copy (less SaaS-y, more athlete)
 */

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

function Card({ children, className = "" }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-gray-200 bg-white p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle = "", right = null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">{title}</p>
            {subtitle ? (
              <p className="text-[12px] text-gray-600 mt-0.5 leading-snug">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/**
 * NotesDropdown
 * - Button row + animated open/close area
 * - Keeps the main modal short and simple
 */
function NotesDropdown({ value, onChange, disabled, maxLength = 500 }) {
  const [open, setOpen] = useState(false);
  const text = String(value || "");
  const len = text.length;

  // Close dropdown if user clears everything (optional nice touch)
  useEffect(() => {
    if (!text.trim()) return;
    // keep open if they’re actively typing; no-op
  }, [text]);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          "w-full text-left rounded-2xl",
          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={open}
        disabled={disabled}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                <ClipboardEdit className="w-4 h-4 text-gray-700" />
              </span>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">
                  Notes (optional)
                </p>
                <p className="text-[12px] text-gray-600 mt-0.5 leading-snug truncate">
                  {text.trim()
                    ? "Note added"
                    : "Add a quick note if you changed anything."}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[11px] text-gray-500 tabular-nums">
              {len}/{maxLength}
            </span>
            <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-white flex items-center justify-center">
              {open ? (
                <ChevronUp className="w-5 h-5 text-gray-700" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-700" />
              )}
            </span>
          </div>
        </div>
      </button>

      {open ? (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <textarea
            className="w-full min-h-[92px] sm:min-h-[104px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/40"
            placeholder="Example: used 10 lbs less, swapped machine, short on time, felt easy/tough…"
            value={text}
            maxLength={maxLength}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
          />
        </div>
      ) : null}
    </Card>
  );
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
  const inputRef = useRef(null);

  const evidenceRequired = useMemo(
    () => normBool(item?.EvidenceRequired),
    [item]
  );

  const title =
    safeText(item?.ExerciseName || item?.Title || "") || "Workout item";

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
  const canSubmit =
    Boolean(item?.id) &&
    !submitting &&
    (!evidenceRequired || !!selectedFile);

  const submitLabel = evidenceRequired ? "Submit proof" : "Mark complete";

  // Button copy simplified
  const captureBtnLabel = selectedFile ? "Change photo" : "Take photo";

  // “Live picture taking”
  // On most mobile browsers, <input type="file" accept="image/*" capture="environment" />
  // opens camera directly (or lets user choose camera).
  // Desktop will open file picker (expected).
  const openCamera = () => {
    if (submitting) return;
    if (inputRef.current) inputRef.current.click();
  };

  return (
    <Modal
      open={open}
      title={item ? `Complete: ${title}` : "Complete item"}
      onClose={onClose}
      subtitle={
        evidenceRequired
          ? "Take a photo to submit."
          : "Photo is optional."
      }
    >
      {!item ? null : (
        <div className="space-y-3 sm:space-y-4">
          {/* Top banner: tighter spacing so it doesn’t feel bulky on mobile */}
          <div
            className={classNames(
              "rounded-2xl border p-3 sm:p-4",
              evidenceRequired
                ? "border-amber-200 bg-amber-50"
                : "border-gray-200 bg-gray-50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-700 font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  Keep it quick
                </p>

                <p className="text-[12px] text-gray-700 mt-2 leading-snug">
                  Snap the machine display, bar on rack, treadmill screen, or a quick selfie in the gym.
                </p>

                <div className="mt-2">
                  {evidenceRequired ? (
                    <Pill tone="warn">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                      Photo required
                    </Pill>
                  ) : (
                    <Pill>Photo optional</Pill>
                  )}
                </div>
              </div>

              {/* Close for fast mobile */}
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

          {/* Upload / Camera card */}
          <Card>
            <SectionTitle
              icon={<Camera className="w-4 h-4 text-[#46769B]" />}
              title="Photo"
              subtitle={
                evidenceRequired
                  ? "Required - take a quick pic and submit."
                  : "Optional - take a pic if you want."
              }
              right={
                evidenceRequired ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                    Required
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                    Optional
                  </span>
                )
              }
            />

            <div className="mt-3 grid gap-3">
              {/* Primary “Take photo” action (simple for athletes) */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={openCamera}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                  title="Open camera / choose photo"
                >
                  <Camera className="w-4 h-4" />
                  {captureBtnLabel}
                </Button>

                {/* Secondary “Upload” action for clarity (same input) */}
                <Button
                  variant="secondary"
                  onClick={openCamera}
                  disabled={submitting}
                  className="w-full sm:w-auto"
                  title="Choose from library"
                >
                  <Upload className="w-4 h-4" />
                  Choose file
                </Button>
              </div>

              {/* Hidden input (camera capture on mobile) */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPickFile?.(e.target.files?.[0] || null)}
                className="hidden"
              />

              {/* File label / quick status */}
              <div
                className={classNames(
                  "rounded-2xl border p-3",
                  selectedFile ? "border-blue-200 bg-blue-50/40" : "border-gray-200 bg-gray-50"
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-gray-600" />
                  </span>

                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900">
                      {selectedFile ? "Photo selected" : "No photo selected"}
                    </p>
                    <p className="text-[12px] text-gray-600 truncate">
                      {selectedFile
                        ? fileLabel(selectedFile)
                        : evidenceRequired
                        ? "You need a photo to submit."
                        : "You can submit without a photo."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {previewUrl ? (
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-52 sm:h-56 object-cover"
                  />
                  <div className="px-3 py-2 text-[11px] text-gray-600">
                    {evidenceRequired
                      ? "Looks good - submit when ready."
                      : "Optional photo attached - submit when ready."}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          {/* Notes dropdown (optional, keeps it simple) */}
          <NotesDropdown
            value={noteText}
            onChange={onChangeNote}
            disabled={submitting}
          />

          {/* Actions (mobile-safe stacking) */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>

            <Button onClick={onSubmit} disabled={!canSubmit}>
              {evidenceRequired ? (
                <Camera className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {submitting ? "Submitting…" : submitLabel}
            </Button>
          </div>

          {/* Inline validation */}
          {evidenceRequired && !selectedFile ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] text-amber-900 font-semibold">
                Photo required - take one before submitting.
              </p>
            </div>
          ) : null}

          {/* Tiny help text (super minimal, but reduces confusion) */}
          <p className="text-[11px] text-gray-500 leading-snug">
            On mobile, <span className="font-semibold">Take photo</span> should open your camera.
            If it doesn’t, your browser may ask whether to use the camera or photo library.
          </p>
        </div>
      )}
    </Modal>
  );
}
