"use client";

import { X } from "lucide-react";

export default function BottomSheet({ open, title, children, onClose, subtitle }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <div className="mx-auto w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-extrabold text-gray-900 truncate">{title}</p>
              {subtitle ? (
                <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
              ) : (
                <p className="text-[11px] text-gray-500 mt-0.5">Tap a workout to manage it.</p>
              )}
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
