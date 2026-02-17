// /components/athlete-today/ui.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function labelForDate(iso) {
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

/**
 * statusTone
 * - broadened for your real statuses
 */
export function statusTone(status) {
  const s = String(status || "").toLowerCase();

  if (s === "completed") return "good";
  if (s === "pending_review" || s === "needs_info" || s === "assigned") return "warn";
  if (s === "rejected") return "bad";
  if (s === "draft") return "neutral";

  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* UI atoms                                                                   */
/* -------------------------------------------------------------------------- */

export function Pill({ children, tone = "neutral", className = "" }) {
  const toneCls =
    tone === "attention" || tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border",
        "px-2 py-0.5 sm:px-2.5 sm:py-1",
        "text-[10px] sm:text-[11px] font-semibold leading-none whitespace-nowrap",
        "tabular-nums",
        toneCls,
        className
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
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition whitespace-nowrap";
  const size = "px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm";
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
      className={classNames(
        base,
        size,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Modal
 * Improvements:
 * - Escape closes
 * - Locks background scroll while open (mobile too)
 * - Clicking inside panel does NOT close
 */
export function Modal({ open, title, subtitle, children, onClose }) {
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

/* -------------------------------------------------------------------------- */
/* Swipe row                                                                  */
/* -------------------------------------------------------------------------- */

export function SwipeRow({
  children,
  onCommit,
  disabled = false,
  hint = "Swipe right",
  actionLabel = "Done",
  actionIcon = null,
  maxDx = 140,
  threshold = 92,
  railTone = "blue",
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [locked, setLocked] = useState(false);

  const start = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  const setDxRaf = (next) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setDx(next));
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // If disabled flips on, reset immediately
  useEffect(() => {
    if (disabled) {
      setDragging(false);
      setLocked(false);
      setDx(0);
    }
  }, [disabled]);

  const colors = useMemo(() => {
    if (railTone === "emerald") {
      return {
        railBg: "from-emerald-50 to-emerald-100/40",
        railText: "text-emerald-800",
        railSub: "text-emerald-700/80",
        railBorder: "border-emerald-200",
        railBar: "bg-emerald-600",
        iconBorder: "border-emerald-200",
      };
    }
    if (railTone === "gray") {
      return {
        railBg: "from-gray-50 to-gray-100/40",
        railText: "text-gray-800",
        railSub: "text-gray-700/80",
        railBorder: "border-gray-200",
        railBar: "bg-gray-800",
        iconBorder: "border-gray-200",
      };
    }
    return {
      railBg: "from-blue-50 to-blue-100/40",
      railText: "text-[#2F5E7A]",
      railSub: "text-[#2F5E7A]/80",
      railBorder: "border-blue-200",
      railBar: "bg-[#46769B]",
      iconBorder: "border-blue-200",
    };
  }, [railTone]);

  const applyResistance = (raw) => {
    const clamped = Math.max(0, raw);
    if (clamped <= maxDx) return clamped;
    const extra = clamped - maxDx;
    return maxDx + extra * 0.18;
  };

  const reset = () => {
    setDx(0);
    setLocked(false);
  };

  const commit = () => {
    setDx(0);
    setLocked(false);
    onCommit?.();
  };

  const onDown = (e) => {
    if (disabled) return;
    const pt = e.touches ? e.touches[0] : e;
    setDragging(true);
    setLocked(false);
    start.current = { x: pt.clientX, y: pt.clientY };
  };

  const onMove = (e) => {
    if (!dragging || disabled) return;

    const pt = e.touches ? e.touches[0] : e;
    const rawDx = pt.clientX - start.current.x;
    const rawDy = pt.clientY - start.current.y;

    if (!locked) {
      const ax = Math.abs(rawDx);
      const ay = Math.abs(rawDy);

      if (ay > 10 && ay > ax * 1.2) {
        setDragging(false);
        reset();
        return;
      }
      if (ax > 10 && ax > ay) setLocked(true);
    }

    if (!locked) return;

    if (e.cancelable && e.touches) e.preventDefault();

    const next = applyResistance(rawDx);
    setDxRaf(Math.min(next, maxDx + 60));
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);

    if (!locked) {
      reset();
      return;
    }

    if (dx >= threshold) {
      commit();
      return;
    }

    reset();
  };

  const pct = Math.max(0, Math.min(1, dx / threshold));
  const railOpacity = Math.min(1, 0.15 + pct * 0.5);

  return (
    <div
      className={classNames("relative", disabled ? "opacity-[0.92]" : "")}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      role="group"
      aria-label={hint}
      style={{
        touchAction: disabled ? "auto" : "pan-y",
      }}
    >
      <div
        className={classNames(
          "absolute inset-0 rounded-2xl border overflow-hidden",
          colors.railBorder
        )}
      >
        <div
          className={classNames("absolute inset-0 bg-gradient-to-r", colors.railBg)}
          style={{ opacity: railOpacity }}
        />

        <div className="absolute inset-0 flex items-center justify-end pr-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={classNames("text-sm font-extrabold leading-tight", colors.railText)}>
                {actionLabel}
              </div>
              <div className={classNames("text-[11px] font-semibold leading-tight", colors.railSub)}>
                {hint}
              </div>
            </div>

            <div
              className={classNames(
                "h-10 w-10 rounded-2xl border bg-white flex items-center justify-center",
                colors.iconBorder
              )}
              style={{
                transform: `translateX(${Math.max(0, (1 - pct) * 10)}px)`,
                transition: dragging ? "none" : "transform 160ms ease",
              }}
            >
              {actionIcon ? actionIcon : <span className={colors.railText}>→</span>}
            </div>
          </div>
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-1.5">
          <div
            className={classNames("h-full", colors.railBar)}
            style={{
              width: "100%",
              transform: `scaleY(${Math.max(0.12, pct)})`,
              transformOrigin: "bottom",
              opacity: 0.45 + pct * 0.45,
              transition: dragging ? "none" : "transform 160ms ease, opacity 160ms ease",
            }}
          />
        </div>
      </div>

      <div
        className="relative rounded-2xl"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging
            ? "none"
            : "transform 200ms cubic-bezier(0.2, 0.9, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
