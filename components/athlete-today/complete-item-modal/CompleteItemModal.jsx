// components/athlete-today/CompleteItemModal.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, CheckCircle2, Camera } from "lucide-react";

import ModalHeaderBanner from "./complete-item-modal/components/ModalHeaderBanner";
import PhotoSection      from "./complete-item-modal/components/PhotoSection";
import NotesDropdown     from "./complete-item-modal/components/NotesDropdown";
import ModalActions      from "./complete-item-modal/components/ModalActions";

/* ── helpers ── */
function cx(...xs) { return xs.filter(Boolean).join(" "); }

function normalizeEvidenceRequired(raw) {
  if (raw === true  || raw === "true")  return "photo";
  if (!raw || raw === false || raw === "false") return "none";
  return String(raw).trim().toLowerCase();
}

/* ── Entrance/exit animation — injected once into <head> ── */
const ANIM_ID = "checkpeak-modal-anim";
function ensureAnimStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(ANIM_ID)) return;
  const s = document.createElement("style");
  s.id = ANIM_ID;
  s.textContent = `
    @keyframes cp-backdrop-in   { from { opacity: 0 }                                        to { opacity: 1 } }
    @keyframes cp-backdrop-out  { from { opacity: 1 }                                        to { opacity: 0 } }
    @keyframes cp-sheet-up      { from { transform: translateY(100%) }                       to { transform: translateY(0) } }
    @keyframes cp-sheet-down    { from { transform: translateY(0) }                          to { transform: translateY(100%) } }
    @keyframes cp-sheet-in      { from { opacity: 0; transform: scale(0.96) translateY(8px)} to { opacity: 1; transform: scale(1) translateY(0) } }
    @keyframes cp-sheet-out     { from { opacity: 1; transform: scale(1) }                  to { opacity: 0; transform: scale(0.96) translateY(8px) } }
    @keyframes cp-shake         { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-6px) } 40% { transform: translateX(6px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(4px) } }

    .cp-backdrop-enter          { animation: cp-backdrop-in   180ms ease both }
    .cp-backdrop-exit           { animation: cp-backdrop-out  160ms ease both }
    .cp-sheet-enter-mobile      { animation: cp-sheet-up      260ms cubic-bezier(0.32,0.72,0,1) both }
    .cp-sheet-exit-mobile       { animation: cp-sheet-down    200ms cubic-bezier(0.4,0,1,1)     both }
    .cp-sheet-enter-desktop     { animation: cp-sheet-in      220ms cubic-bezier(0.32,0.72,0,1) both }
    .cp-sheet-exit-desktop      { animation: cp-sheet-out     180ms ease both }
    .cp-shake                   { animation: cp-shake         400ms cubic-bezier(0.36,0.07,0.19,0.97) both }
  `;
  document.head.appendChild(s);
}

/* ─────────────────────────────────────────────────────────────────── */

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
  evidenceRequiredOverride,  // explicit signal from today.jsx, bypasses item.EvidenceRequired
}) {
  useEffect(() => { ensureAnimStyles(); }, []);

  const [previewUrl,  setPreviewUrl]  = useState("");
  const [isExiting,   setIsExiting]   = useState(false);
  const [visible,     setVisible]     = useState(false);
  const [showError,   setShowError]   = useState(false);
  const closeTimerRef = useRef(null);
  const errorRef      = useRef(null);
  const shakeTimerRef = useRef(null);

  /* ── Derive evidence requirement ── */
  const evidenceValue = useMemo(
    () => normalizeEvidenceRequired(item?.EvidenceRequired),
    [item?.EvidenceRequired]
  );
  const evidenceRequired =
    evidenceRequiredOverride !== undefined
      ? Boolean(evidenceRequiredOverride)
      : evidenceValue !== "none" && evidenceValue !== "voluntary_activity_vara";
  const canSubmit        = Boolean(item?.id) && !submitting && (!evidenceRequired || !!selectedFile);

  /* ── Clear error when a file is selected ── */
  useEffect(() => {
    if (selectedFile) setShowError(false);
  }, [selectedFile]);

  /* ── Reset error on close ── */
  useEffect(() => {
    if (!open) setShowError(false);
  }, [open]);

  /* ── Intercept submit — show error + shake if missing photo ── */
  const handleAttemptSubmit = () => {
    if (evidenceRequired && !selectedFile) {
      setShowError(true);
      // Scroll error into view
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Shake animation: remove then re-add class to re-trigger
      const el = errorRef.current;
      if (el) {
        el.classList.remove("cp-shake");
        clearTimeout(shakeTimerRef.current);
        // Force reflow so the class removal takes effect before re-adding
        void el.offsetWidth;
        el.classList.add("cp-shake");
        shakeTimerRef.current = setTimeout(() => el.classList.remove("cp-shake"), 420);
      }
      return;
    }
    onSubmit?.();
  };

  /* ── Controlled mount/unmount with exit animation ── */
  useEffect(() => {
    if (open) {
      setIsExiting(false);
      setVisible(true);
    } else if (visible) {
      setIsExiting(true);
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
      }, 260);
    }
    return () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(shakeTimerRef.current);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Preview lifecycle ── */
  useEffect(() => {
    if (!open) return;
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl("");
  }, [open, selectedFile]);

  /* ── Reset on close ── */
  useEffect(() => {
    if (!open) setPreviewUrl("");
  }, [open, item?.id]);

  /* ── Lock body scroll ── */
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

  const handleClose = () => { if (!submitting) onClose?.(); };

  if (!visible || !item) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">

      {/* ── Backdrop ── */}
      <div
        className={cx(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          isExiting ? "cp-backdrop-exit" : "cp-backdrop-enter"
        )}
        onClick={handleClose}
      />

      {/* ── Sheet ── */}
      <div
        className={cx(
          "relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden",
          isExiting
            ? "cp-sheet-exit-mobile sm:cp-sheet-exit-desktop"
            : "cp-sheet-enter-mobile sm:cp-sheet-enter-desktop"
        )}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-4 space-y-4">

          {/* Banner: item name + evidence requirement + close button */}
          <ModalHeaderBanner
            itemTitle={String(item?.ExerciseName || item?.Title || "").trim()}
            evidenceRequired={evidenceRequired}
            onClose={handleClose}
          />

          {/* Error banner — shown when athlete tries to submit without a required photo */}
          {showError && evidenceRequired && !selectedFile ? (
            <div
              ref={errorRef}
              className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3"
            >
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <Camera className="w-4 h-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-red-700">Photo required</p>
                <p className="text-xs text-red-600 mt-0.5 leading-snug">
                  Your coach requires a photo or video for this item. Tap the button below to take or choose one.
                </p>
              </div>
            </div>
          ) : null}

          {/* Photo upload / preview */}
          <PhotoSection
            evidenceRequired={evidenceRequired}
            submitting={submitting}
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            onPickFile={onPickFile}
          />

          {/* Notes (collapsible) */}
          <NotesDropdown
            value={coachNote}
            onChange={onChangeNote}
            disabled={submitting}
          />
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pb-6 pt-3 border-t border-gray-100">
          <ModalActions
            evidenceRequired={evidenceRequired}
            submitting={submitting}
            canSubmit={canSubmit}
            onClose={handleClose}
            onSubmit={handleAttemptSubmit}
          />
        </div>
      </div>
    </div>
  );
}