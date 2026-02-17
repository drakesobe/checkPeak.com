"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classNames } from "./utils";

/**
 * SwipeRow
 * - reveal action rail behind the card
 * - doesn't hijack vertical scroll unless horizontal intent is clear
 *
 * NEW:
 * - railVariant="corner" shows a small top-right badge instead of a big rail UI
 */
export default function SwipeRow({
  children,
  onCommit,
  disabled = false,
  hint = "Swipe right",
  actionLabel = "Done",
  actionIcon = null,
  maxDx = 140,
  threshold = 92,
  railTone = "blue",
  railVariant = "full", // "full" | "corner"
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
        badgeBg: "bg-emerald-50",
        badgeBorder: "border-emerald-200",
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
        badgeBg: "bg-gray-50",
        badgeBorder: "border-gray-200",
      };
    }
    return {
      railBg: "from-blue-50 to-blue-100/40",
      railText: "text-[#2F5E7A]",
      railSub: "text-[#2F5E7A]/80",
      railBorder: "border-blue-200",
      railBar: "bg-[#46769B]",
      iconBorder: "border-blue-200",
      badgeBg: "bg-blue-50",
      badgeBorder: "border-blue-200",
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

      // If user intends vertical scroll, release
      if (ay > 10 && ay > ax * 1.2) {
        setDragging(false);
        reset();
        return;
      }
      // lock in when clearly horizontal
      if (ax > 10 && ax > ay) setLocked(true);
    }

    if (!locked) return;

    // prevent touch scroll only after lock
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
  const railOpacity = Math.min(1, 0.12 + pct * 0.55);

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
      aria-label={hint || "Swipe row"}
      style={{
        // keep vertical scroll unless locked
        touchAction: disabled ? "auto" : "pan-y",
      }}
    >
      {/* Action rail (background) */}
      <div
        className={classNames(
          "absolute inset-0 rounded-2xl border overflow-hidden",
          colors.railBorder
        )}
      >
        {/* subtle gradient wash */}
        <div
          className={classNames("absolute inset-0 bg-gradient-to-r", colors.railBg)}
          style={{ opacity: railOpacity }}
        />

        {/* ✅ Variant: corner badge (small, top-right) */}
        {railVariant === "corner" ? (
          <div className="pointer-events-none absolute top-2 right-2">
            <div
              className={classNames(
                "inline-flex items-center gap-2 rounded-xl border px-2 py-1",
                "text-[11px] font-extrabold leading-none",
                "shadow-sm",
                colors.badgeBg,
                colors.badgeBorder,
                colors.railText
              )}
              style={{
                opacity: Math.min(1, 0.35 + pct * 0.65),
                transform: `translateX(${Math.max(0, (1 - pct) * 8)}px)`,
                transition: dragging ? "none" : "transform 160ms ease, opacity 160ms ease",
              }}
            >
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-lg bg-white/70 border border-white/60">
                {actionIcon ? actionIcon : <span>→</span>}
              </span>
              {/* keep label short; if blank, just show icon */}
              {actionLabel ? <span>{actionLabel}</span> : null}
            </div>
          </div>
        ) : (
          /* Default: full rail content (unchanged) */
          <div className="absolute inset-0 flex items-center justify-end pr-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={classNames("text-sm font-extrabold leading-tight", colors.railText)}>
                  {actionLabel}
                </div>
                {hint ? (
                  <div className={classNames("text-[11px] font-semibold leading-tight", colors.railSub)}>
                    {hint}
                  </div>
                ) : null}
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
        )}

        {/* progress bar (left) */}
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

      {/* Foreground content */}
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
