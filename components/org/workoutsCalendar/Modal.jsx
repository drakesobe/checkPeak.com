"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Modal({
  open,
  title,
  children,
  onClose,
  subtitle,
  maxWidth = "max-w-3xl",
}) {
  const panelRef = useRef(null);

  // Prevent background scroll + add Escape key close
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    // Focus the modal for better UX
    setTimeout(() => panelRef.current?.focus?.(), 0);

    return () => {
      document.documentElement.style.overflow = prevOverflow || "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal"}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Centering + safe spacing */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        {/* Panel */}
        <div
          ref={panelRef}
          tabIndex={-1}
          className={classNames(
            "w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden outline-none",
            maxWidth,
            // ✅ fixes “stuck near bottom” + supports tall content
            "max-h-[92vh] flex flex-col"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header (sticky-ish because body scrolls, header stays) */}
          <div className="p-5 border-b flex items-start justify-between gap-4 bg-white">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">
                {title}
              </p>
              {subtitle ? (
                <p className="text-[12px] text-gray-500 mt-1">{subtitle}</p>
              ) : null}
            </div>

            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 shrink-0"
              onClick={onClose}
              type="button"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body scroll (prevents modal from pushing down/off-screen) */}
          <div className="p-5 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
