// /components/athlete-today/DateStrip.jsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { classNames, labelForDate, prettyDate } from "./ui";

/**
 * DateStrip UX goals:
 * ✅ No cropping / cutoff on smaller screens
 * ✅ Smooth horizontal scrolling with snap
 * ✅ Optional "Today" jump (desktop + mobile)
 * ✅ Keeps selected day centered
 * ✅ Arrow keys navigation (desktop)
 * ✅ Small-screen friendly chip sizing + truncation
 *
 * Notes:
 * - Avoids relying on timezone helpers here; uses local browser date for "Today" tag.
 * - Degrades gracefully if ResizeObserver isn't available.
 */

function safeIso(v) {
  return String(v ?? "").trim();
}

function getLocalTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DateStrip({
  loading = false,
  selectedDate,
  dateStrip = [],
  onPrev,
  onNext,
  onSelectDate,
  showJumpToToday = true,
  onJumpToToday,
}) {
  const itemRefs = useRef({});
  const scrollerRef = useRef(null);

  const todayIso = useMemo(() => getLocalTodayISO(), []);

  const normalizedStrip = useMemo(() => {
    const list = Array.isArray(dateStrip) ? dateStrip : [];
    return list
      .map((d) => {
        const iso = safeIso(d?.iso);
        if (!iso) return null;
        return {
          iso,
          label: d?.label || labelForDate(iso),
          pretty: d?.pretty || prettyDate(iso),
        };
      })
      .filter(Boolean);
  }, [dateStrip]);

  /* ---------------- scroll hint fades ---------------- */

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 2);
    setCanScrollRight(max - left > 2);
  }, []);

  useEffect(() => {
    updateScrollHints();
  }, [normalizedStrip.length, updateScrollHints]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => updateScrollHints();
    el.addEventListener("scroll", onScroll, { passive: true });

    let ro;
    try {
      ro = new ResizeObserver(() => updateScrollHints());
      ro.observe(el);
    } catch {
      // ignore
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect();
    };
  }, [updateScrollHints]);

  /* ---------------- keep selected centered ---------------- */

  useEffect(() => {
    const iso = safeIso(selectedDate);
    if (!iso) return;

    const el = itemRefs.current?.[iso];
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } catch {
      // no-op
    }
  }, [selectedDate]);

  /* ---------------- actions ---------------- */

  const jumpToToday = () => {
    if (loading) return;
    if (typeof onJumpToToday === "function") return onJumpToToday();
    onSelectDate?.(todayIso);
  };

  const moveSelection = (dir) => {
    if (loading) return;
    const list = normalizedStrip;
    if (!list.length) return;

    const cur = safeIso(selectedDate);
    const idx = list.findIndex((x) => x.iso === cur);

    const nextIdx =
      idx === -1
        ? dir > 0
          ? 0
          : list.length - 1
        : Math.min(list.length - 1, Math.max(0, idx + dir));

    const nextIso = list[nextIdx]?.iso;
    if (nextIso) onSelectDate?.(nextIso);
  };

  const selectedPretty = useMemo(() => {
    const iso = safeIso(selectedDate);
    if (!iso) return "";
    try {
      return prettyDate(iso);
    } catch {
      return iso;
    }
  }, [selectedDate]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-3 sm:p-4 shadow-sm">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4.5 h-4.5 text-[#46769B]" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Browse days
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {selectedDate ? (
                  <>
                    Selected:{" "}
                    <span className="font-semibold text-gray-700">{selectedPretty}</span>
                  </>
                ) : (
                  "Select a day to view its plan."
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          {showJumpToToday ? (
            <button
              type="button"
              onClick={jumpToToday}
              disabled={loading}
              className="hidden sm:inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            >
              Today
            </button>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
              aria-label="Previous day"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
              aria-label="Next day"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scroll strip wrapper */}
      <div className="relative">
        {/* Left fade */}
        {canScrollLeft ? (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-white/90 to-white/0 rounded-l-2xl" />
        ) : null}

        {/* Right fade */}
        {canScrollRight ? (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-l from-white/90 to-white/0 rounded-r-2xl" />
        ) : null}

        {/* Scroller */}
        <div
          ref={scrollerRef}
          className={classNames(
            "overflow-x-auto overscroll-x-contain",
            "rounded-2xl"
          )}
          role="listbox"
          aria-label="Select a day"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              moveSelection(-1);
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              moveSelection(1);
            }
            if (e.key === "Home") {
              e.preventDefault();
              if (normalizedStrip[0]?.iso) onSelectDate?.(normalizedStrip[0].iso);
            }
            if (e.key === "End") {
              e.preventDefault();
              const last = normalizedStrip[normalizedStrip.length - 1]?.iso;
              if (last) onSelectDate?.(last);
            }
          }}
          style={{
            // keeps iOS scrolling smooth without strange bounce locking
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* Snap scrolling for mobile */}
          <div className="flex gap-2 min-w-max px-1 pb-1 snap-x snap-mandatory">
            {normalizedStrip.length === 0 ? (
              <div className="w-full rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                <p className="text-xs text-gray-600">{loading ? "Loading days…" : "No days available."}</p>
              </div>
            ) : (
              normalizedStrip.map((d) => {
                const active = safeIso(d.iso) === safeIso(selectedDate);
                const isToday = d.iso === todayIso;

                return (
                  <button
                    key={d.iso}
                    ref={(el) => {
                      if (el) itemRefs.current[d.iso] = el;
                    }}
                    type="button"
                    onClick={() => onSelectDate?.(d.iso)}
                    disabled={loading}
                    role="option"
                    aria-selected={active}
                    className={classNames(
                      "snap-center relative text-left transition",
                      "focus:outline-none focus:ring-2 focus:ring-[#46769B]/40",
                      "rounded-2xl border",
                      // ✅ Thumb-friendly on mobile, tighter on desktop
                      "px-4 py-3 sm:px-3 sm:py-2",
                      // ✅ No cutoff: enforce sensible min/max widths
                      "min-w-[132px] sm:min-w-[108px]",
                      "max-w-[170px] sm:max-w-[140px]",
                      active
                        ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
                        : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                    )}
                    title={d.iso}
                  >
                    {/* Today dot */}
                    {isToday && !active ? (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                    ) : null}

                    {/* Selected glow */}
                    {active ? (
                      <span className="absolute inset-0 rounded-2xl ring-2 ring-white/30 pointer-events-none" />
                    ) : null}

                    {/* label */}
                    <div className={classNames("text-xs font-extrabold truncate", active ? "text-white" : "text-gray-900")}>
                      {d.label}
                    </div>

                    {/* pretty */}
                    <div className={classNames("text-[11px] truncate mt-0.5", active ? "text-white/90" : "text-gray-500")}>
                      {d.pretty}
                    </div>

                    {/* footer chip */}
                    <div className="mt-2 flex items-center gap-1">
                      {active ? (
                        <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                          Selected
                        </span>
                      ) : isToday ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Today
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          View
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer / microcopy */}
      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          Tip: swipe the strip left/right. Use ← / → keys on desktop to move days.
        </p>

        {showJumpToToday ? (
          <button
            type="button"
            onClick={jumpToToday}
            disabled={loading}
            className="sm:hidden inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Jump to Today
          </button>
        ) : null}
      </div>
    </section>
  );
}
