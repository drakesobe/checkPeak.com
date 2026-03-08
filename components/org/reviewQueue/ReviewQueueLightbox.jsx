// components/org/reviewQueue/ReviewQueueLightbox.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function ReviewQueueLightbox({ url, onClose }) {
  const closeBtnRef = useRef(null);
  const [loaded,  setLoaded]  = useState(false);
  const [failed,  setFailed]  = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoaded(false);
    setFailed(false);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => closeBtnRef.current?.focus?.(), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[10000]"
      role="dialog" aria-modal="true" aria-label="Upload preview"
    >
      {/* Overlay */}
      <button
        type="button" onClick={onClose} aria-label="Close"
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
          {/* Close button */}
          <div className="flex justify-end mb-3">
            <button
              ref={closeBtnRef}
              type="button" onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition focus:outline-none focus:ring-2"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}
              aria-label="Close" title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Image frame */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.3)" }}
          >
            {!loaded && !failed && (
              <div className="flex items-center justify-center py-20">
                <span
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                >
                  Loading…
                </span>
              </div>
            )}
            {failed ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-white">Couldn't load this image.</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Try closing and reopening.</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url} alt="Upload"
                className="w-full object-contain transition-opacity duration-200"
                style={{ maxHeight: "80vh", opacity: loaded ? 1 : 0 }}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            )}
          </div>

          <p className="mt-2 text-[11px] text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
            Press <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Esc</span> to close
          </p>
        </div>
      </div>
    </div>
  );
}