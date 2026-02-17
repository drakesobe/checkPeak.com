// components/athlete-today/ui/atoms/Modal.jsx
"use client";

import { useEffect } from "react";

export default function Modal({ open, title, subtitle, children, onClose }) {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close modal overlay"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200"
          role="dialog"
          aria-modal="true"
          aria-label={title || "Modal"}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 sm:p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-extrabold text-gray-900 truncate">
                {title}
              </p>
              {subtitle ? (
                <p className="text-[11px] sm:text-[12px] text-gray-500 mt-1">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          <div className="p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
