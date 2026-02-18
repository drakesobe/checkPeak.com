// components/org/reviewQueue/ReviewQueueLightbox.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function ReviewQueueLightbox({ url, onClose }) {
  const closeBtnRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset load state when url changes
  useEffect(() => {
    if (!url) return;
    setLoaded(false);
    setFailed(false);
  }, [url]);

  // ESC to close + lock background scroll while open
  useEffect(() => {
    if (!url) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKeyDown);

    // Focus the close button for accessibility + keyboard flow
    const t = setTimeout(() => closeBtnRef.current?.focus?.(), 0);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[10000]"
      role="dialog"
      aria-modal="true"
      aria-label="Upload preview"
    >
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close preview"
      />

      {/* Centered container */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        {/* Panel */}
        <div
          className="w-full max-w-5xl"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {/* Top bar */}
          <div className="flex items-center justify-end mb-2">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className={cx(
                "inline-flex items-center justify-center",
                "w-10 h-10 rounded-2xl",
                "bg-white/95 border border-white/40",
                "hover:bg-white transition",
                "focus:outline-none focus:ring-2 focus:ring-white/60"
              )}
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-900" />
            </button>
          </div>

          {/* Image frame */}
          <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/20">
            {!loaded && !failed ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-xs font-semibold text-white/80 bg-black/40 border border-white/20 rounded-2xl px-3 py-2">
                  Loading image…
                </div>
              </div>
            ) : null}

            {failed ? (
              <div className="p-6 text-center">
                <div className="text-sm font-semibold text-white">Couldn’t load this image.</div>
                <div className="text-xs text-white/80 mt-1">Try closing and reopening.</div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="Upload"
                className={cx(
                  "w-full object-contain",
                  "max-h-[78vh] sm:max-h-[82vh]",
                  loaded ? "opacity-100" : "opacity-0",
                  "transition-opacity duration-200"
                )}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            )}
          </div>

          {/* Tiny hint row (optional, subtle) */}
          <div className="mt-2 text-[11px] text-white/70">
            Press <span className="font-semibold text-white/80">Esc</span> to close.
          </div>
        </div>
      </div>
    </div>
  );
}
