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
    tone === "attention"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "warn"
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
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
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
/* Swipe row (enhanced “skim / lane” feel)                                    */
/* -------------------------------------------------------------------------- */

/**
 * SwipeRow
 * - Feels like a “skimmer lane”: as you drag, an action rail reveals underneath.
 * - Has elastic drag (resistance as you near max), and a crisp commit threshold.
 * - Prevents vertical scroll lock unless the gesture is clearly horizontal.
 * - Supports optional `actionLabel` and `actionIcon` slot (keeps default if omitted).
 *
 * Props:
 * - children: row content
 * - onCommit: called when swipe exceeds threshold on release (or if "snap" completes)
 * - disabled: disables interactions
 * - hint: small rail text (e.g. "Swipe right to upload")
 * - actionLabel: bigger rail label (e.g. "Upload")
 * - actionIcon: React node (e.g. <Upload className="..." />)
 * - maxDx: how far the foreground can travel (default 160)
 * - threshold: commit threshold (default 96)
 */
export function SwipeRow({
  children,
  onCommit,
  disabled = false,
  hint = "Swipe right to upload",
  actionLabel = "Upload",
  actionIcon = null,
  maxDx = 160,
  threshold = 96,
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  // We only “lock” into horizontal mode once the user clearly swipes sideways.
  const [locked, setLocked] = useState(false);

  const start = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  // Smooth performance: apply dx updates with rAF batching
  const setDxRaf = (next) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setDx(next));
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // “Elastic” resistance near max
  const applyResistance = (raw) => {
    const clamped = Math.max(0, raw);
    if (clamped <= maxDx) return clamped;

    // resistance: additional pixels beyond max get reduced heavily
    const extra = clamped - maxDx;
    return maxDx + extra * 0.18;
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

    // determine lock
    if (!locked) {
      const ax = Math.abs(rawDx);
      const ay = Math.abs(rawDy);

      // If user is scrolling vertically, do NOT hijack.
      if (ay > 10 && ay > ax * 1.2) {
        // let scroll happen; also stop dragging visuals
        setDragging(false);
        setLocked(false);
        setDxRaf(0);
        return;
      }

      // lock into horizontal when clear intent
      if (ax > 10 && ax > ay) setLocked(true);
    }

    if (!locked) return;

    // When locked, prevent page scroll (touch) so swipe feels crisp
    if (e.cancelable && e.touches) e.preventDefault();

    // Only allow swipe to the right
    const next = applyResistance(rawDx);
    setDxRaf(Math.min(next, maxDx + 60));
  };

  const reset = () => setDx(0);

  const commit = () => {
    setDx(0);
    onCommit?.();
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);

    // If not locked, treat as a tap/no-op
    if (!locked) {
      reset();
      return;
    }

    // Commit if threshold met
    if (dx >= threshold) {
      commit();
      return;
    }

    reset();
  };

  // Progress values for UI rail
  const pct = Math.max(0, Math.min(1, dx / threshold));
  const glow = pct > 0.65;
  const railOpacity = Math.min(1, 0.22 + pct * 0.55);
  const railScale = 0.98 + pct * 0.02;

  return (
    <div
      className={classNames(
        "relative select-none",
        disabled ? "opacity-[0.92]" : ""
      )}
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
        // Helps iOS not delay touch; gives a snappy feel
        touchAction: disabled ? "auto" : "pan-y",
      }}
    >
      {/* Background action rail */}
      <div
        className={classNames(
          "absolute inset-0 rounded-2xl border flex items-center justify-end pr-4 overflow-hidden",
          glow ? "border-blue-200" : "border-blue-100"
        )}
        style={{
          background: `linear-gradient(90deg, rgba(70,118,155,0.08), rgba(70,118,155,${railOpacity}))`,
        }}
      >
        {/* Rail content */}
        <div
          className="flex items-center gap-3"
          style={{
            transform: `scale(${railScale})`,
            transition: dragging ? "none" : "transform 160ms ease",
          }}
        >
          <div className="text-right">
            <div className="text-[#46769B] font-extrabold text-sm leading-tight">
              {actionLabel}
            </div>
            <div className="text-[11px] text-[#46769B]/80 font-semibold">
              {hint}
            </div>
          </div>

          {/* Icon bubble */}
          <div
            className={classNames(
              "h-10 w-10 rounded-2xl border flex items-center justify-center",
              glow ? "bg-white border-blue-200" : "bg-white/80 border-blue-100"
            )}
            style={{
              transform: `translateX(${Math.max(0, (1 - pct) * 10)}px)`,
              transition: dragging ? "none" : "transform 160ms ease",
            }}
          >
            {actionIcon ? (
              actionIcon
            ) : (
              <span className="text-[#46769B] text-sm font-extrabold">→</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5">
          <div
            className="h-full bg-[#46769B]"
            style={{
              width: "100%",
              transform: `scaleY(${Math.max(0.12, pct)})`,
              transformOrigin: "bottom",
              opacity: 0.55 + pct * 0.35,
              transition: dragging ? "none" : "transform 160ms ease, opacity 160ms ease",
            }}
          />
        </div>
      </div>

      {/* Foreground (actual row content) */}
      <div
        className="relative rounded-2xl"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 200ms cubic-bezier(0.2, 0.9, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
