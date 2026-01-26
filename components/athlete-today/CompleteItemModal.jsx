// components/athlete-today/CompleteItemModal.jsx
"use client";

import { Camera, Info } from "lucide-react";
import { Button, Modal } from "./ui";

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
  if (!open) return null;

  const evidenceRequired = String(item?.EvidenceRequired || "").toLowerCase() === "true";

  return (
    <Modal
      open={open}
      title={item ? `Complete: ${item?.ExerciseName || item?.Title || "Workout item"}` : "Complete item"}
      onClose={onClose}
      subtitle="Upload proof or mark complete."
    >
      {item ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-gray-400" />
              Tip
            </p>
            <p className="text-[12px] text-gray-700 mt-2">
              Quick proof works best: machine display, bar on rack, treadmill screen, or a selfie in the gym.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-extrabold text-gray-900">Upload proof</p>
            <p className="text-[12px] text-gray-600 mt-1">On mobile, this can open your camera if supported.</p>

            <div className="mt-3 grid gap-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPickFile?.(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />

              {selectedFile ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[12px] text-emerald-900 font-semibold">Selected: {selectedFile.name}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[12px] text-gray-600">
                    No file selected {evidenceRequired ? "(required for this item)." : "(optional for this item)."}
                  </p>
                </div>
              )}

              <textarea
                className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                placeholder="Optional note (e.g. felt easy today / changed weight / short on time)"
                value={coachNote || ""}
                onChange={(e) => onChangeNote?.(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>

            <Button onClick={onSubmit} disabled={!item?.id || submitting}>
              <Camera className="w-4 h-4" />
              {submitting ? "Submitting…" : "Complete"}
            </Button>
          </div>

          <p className="text-[11px] text-gray-500">
            If you haven’t built /api/upload/image yet, leave file empty and paste a URL when prompted.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
