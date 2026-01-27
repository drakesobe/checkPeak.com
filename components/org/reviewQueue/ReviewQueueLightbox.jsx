// components/org/reviewQueue/ReviewQueueLightbox.jsx
"use client";

export default function ReviewQueueLightbox({ url, onClose }) {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} role="button" tabIndex={0} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="flex justify-end mb-2">
            <button
              className="p-2 rounded-xl bg-white/90 border border-white/40 hover:bg-white"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Upload"
            className="w-full max-h-[80vh] object-contain rounded-2xl border border-white/20"
          />
        </div>
      </div>
    </div>
  );
}
