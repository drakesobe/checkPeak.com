// /components/athlete-today/ui.jsx
"use client";

import { useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/* Tiny helpers                                                               */
/* -------------------------------------------------------------------------- */

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toISODateLocal(d) {
  // local YYYY-MM-DD (no timezone shift)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function labelForDate(iso) {
  // iso: YYYY-MM-DD
  const d = new Date(`${iso}T12:00:00`);
  const today = new Date();
  const todayIso = toISODateLocal(today);

  if (iso === todayIso) return "Today";

  const yesterdayIso = toISODateLocal(addDays(today, -1));
  if (iso === yesterdayIso) return "Yesterday";

  const tomorrowIso = toISODateLocal(addDays(today, 1));
  if (iso === tomorrowIso) return "Tomorrow";

  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export function prettyDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "good";
  if (s === "assigned") return "warn";
  if (s === "draft") return "neutral";
  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* UI atoms                                                                   */
/* -------------------------------------------------------------------------- */

export function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  type = "button",
  title = "",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(base, styles, disabled ? "opacity-70 cursor-not-allowed" : "", className)}
    >
      {children}
    </button>
  );
}

export function Modal({ open, title, subtitle, children, onClose }) {
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
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              {subtitle ? <p className="text-[12px] text-gray-500 mt-1">{subtitle}</p> : null}
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

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Swipe row                                                                  */
/* -------------------------------------------------------------------------- */

export function SwipeRow({ children, onCommit, disabled = false, hint = "Swipe right to upload" }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const threshold = 90; // px to trigger

  const onDown = (e) => {
    if (disabled) return;
    setDragging(true);
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
  };

  const onMove = (e) => {
    if (!dragging || disabled) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const d = Math.max(0, x - startX.current);
    setDx(Math.min(d, 140));
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dx >= threshold) {
      setDx(0);
      onCommit?.();
      return;
    }
    setDx(0);
  };

  return (
    <div
      className="relative"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      role="group"
      aria-label={hint}
    >
      {/* background action */}
      <div className="absolute inset-0 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-end pr-4">
        <div className="text-[#46769B] font-semibold text-sm">{hint}</div>
      </div>

      {/* foreground */}
      <div
        className="relative rounded-2xl"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 220ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
