// components/org/reviewQueue/ui.js
"use client";

import { useEffect } from "react";

/** ---------- classNames ---------- */
export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** ---------- Button ---------- */
export function Button({ variant = "primary", className = "", children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition border focus:outline-none focus:ring-2 focus:ring-[#46769B] disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[#46769B] text-white border-[#46769B] hover:opacity-95",
    secondary: "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
    dark: "bg-gray-900 text-white border-gray-900 hover:opacity-95",
  };

  return (
    <button className={classNames(base, variants[variant] || variants.primary, className)} {...props}>
      {children}
    </button>
  );
}

/** ---------- Pill ---------- */
export function Pill({ tone = "neutral", className = "", children }) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold";
  const tones = {
    neutral: "bg-white border-gray-200 text-gray-700",
    good: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    bad: "bg-red-50 border-red-200 text-red-800",
  };

  return <span className={classNames(base, tones[tone] || tones.neutral, className)}>{children}</span>;
}

/** ---------- Modal ---------- */
export function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />
      <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900 truncate">{title || "Modal"}</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-gray-50"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** ---------- tones ---------- */
export function dailyWorkoutTone(status = "") {
  const s = String(status || "").toLowerCase();
  if (s.includes("complete") || s.includes("done")) return "good";
  if (s.includes("miss") || s.includes("skipped") || s.includes("fail")) return "bad";
  if (s.includes("draft") || s.includes("pending")) return "warn";
  return "neutral";
}

export function reviewTone(status = "") {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "good";
  if (s === "needs_info") return "warn";
  if (s === "pending") return "warn";
  return "neutral";
}

/** ---------- attachments ---------- */
export function extractAttachmentUrl(att) {
  if (!att) return "";
  // Airtable attachment objects usually have url; sometimes thumbnails
  if (att.url) return att.url;
  const thumbs = att.thumbnails || {};
  return thumbs?.large?.url || thumbs?.full?.url || thumbs?.small?.url || "";
}
