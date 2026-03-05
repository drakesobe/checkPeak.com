// components/ChoiceModal.jsx
"use client";

/**
 * ChoiceModal
 *
 * Presents two options: "Use Camera" and "Choose from Photos / Files".
 * Keeps file input logic in the parent — this component only renders
 * the UI and fires the appropriate callback.
 *
 * Props:
 *   isOpen        — boolean
 *   onClose       — () => void
 *   onUseCamera   — () => void   triggered when user taps "Use Camera"
 *   onUseLibrary  — () => void   triggered when user taps "Choose from Photos"
 */
export default function ChoiceModal({ isOpen, onClose, onUseCamera, onUseLibrary }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Add Label Photo
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600">
          A single, sharp photo of the ingredients panel works best. Avoid
          shadows, glare, and extreme angles.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onUseCamera();
            }}
            className="w-full py-3 rounded-xl bg-[#46769B] text-white font-medium hover:bg-[#365b7a] transition shadow-sm text-sm"
          >
            📷 Use Camera
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onUseLibrary();
            }}
            className="w-full py-3 rounded-xl border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 transition text-sm"
          >
            🖼 Choose from Photos / Files
          </button>
        </div>

        {/* iPhone tip */}
        <p className="text-[11px] text-gray-500 leading-snug">
          <span className="font-semibold">iPhone tip:</span> If photos fail to
          scan, take a screenshot of the label and upload the screenshot instead.
          Or go to{" "}
          <span className="font-medium">
            Settings → Camera → Formats → Most Compatible
          </span>{" "}
          to avoid HEIC issues.
        </p>
      </div>
    </div>
  );
}