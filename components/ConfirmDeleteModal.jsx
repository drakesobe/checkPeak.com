// components/ConfirmDeleteModal.jsx
"use client";

import { X, Trash2 } from "lucide-react";
import { useEffect } from "react";

export default function ConfirmDeleteModal({
  open,
  title = "Delete template?",
  message = "This can’t be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") onConfirm?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[92vw] max-w-md rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-start justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{message}</p>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex gap-3 justify-end">
          <button
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            {cancelLabel}
          </button>

          <button
            className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>

        <div className="px-4 pb-4 text-xs text-gray-500">
          Tip: Press <span className="font-medium">Esc</span> to cancel.
        </div>
      </div>
    </div>
  );
}
