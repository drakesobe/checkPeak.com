"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function BottomSheet({
  open,
  title,
  children,
  onClose,
  subtitle,
  topOffsetPx, // optional override
}) {
  // lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // respects your NavBar height if you set --nav-h on the app shell
  const topOffset = typeof topOffsetPx === "number" ? `${topOffsetPx}px` : "var(--nav-h, 0px)";

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay region begins below navbar */}
      <div className="absolute inset-x-0 bottom-0" style={{ top: topOffset }}>
        {/* Backdrop (only below navbar) */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Close sheet"
        />

        {/* ✅ Centered on ALL breakpoints */}
        <div
          className={cx(
            "absolute inset-0",
            "flex items-center justify-center",
            // padding so it doesn't touch edges; safe-area helps iPhone
            "px-3 sm:px-6",
            "py-3 sm:py-6",
            "pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
          )}
        >
          <div
            className={cx(
              "w-full max-w-3xl",
              "bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden",
              // ✅ Use dvh so mobile browser chrome doesn't cause weird sizing
              "max-h-[calc(100dvh-var(--nav-h,0px)-24px)]",
              "sm:max-h-[calc(100vh-var(--nav-h,0px)-48px)]"
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title || "Bottom sheet"}
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-extrabold text-gray-900 truncate">{title}</p>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-snug">
                    {subtitle || "Tap a workout to manage it."}
                  </p>
                </div>

                <button
                  className="p-2.5 sm:p-3 rounded-2xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition"
                  onClick={onClose}
                  type="button"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content (scroll inside) */}
            <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto overscroll-contain">
              {children}
              <div className="h-1 sm:h-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}