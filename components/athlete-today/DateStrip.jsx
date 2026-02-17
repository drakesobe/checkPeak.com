// /components/athlete-today/DateStrip.jsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { classNames, labelForDate, prettyDate } from "./ui";

/**
 * DateStrip (mobile-compact + desktop-full)
 * ✅ Mobile: shows only 3 days (prev / selected / next) to reduce noise
 * ✅ Desktop: full horizontal scroll strip with snap + fades
 * ✅ Keeps selected centered (desktop strip)
 * ✅ Keyboard nav on desktop
 * ✅ Today button (mobile + desktop)
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

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // SSR-safe
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const apply = () => setIsMobile(Boolean(mq.matches));
    apply();

    // Safari fallback
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [breakpointPx]);

  return isMobile;
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

  // new: mobile behavior
  compactOnMobile = true,
}) {
  const itemRefs = useRef({});
  const scrollerRef = useRef(null);

  const todayIso = useMemo(() => getLocalTodayISO(), []);
  const isMobile = useIsMobile(640);

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

  const selectedPretty = useMemo(() => {
    const iso = safeIso(selectedDate);
    if (!iso) return "";
    try {
      return prettyDate(iso);
    } catch {
      return iso;
    }
  }, [selectedDate]);

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

  /* ---------------- Desktop scroll hint fades ---------------- */

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

  /* ---------------- keep selected centered (desktop only) ---------------- */

  useEffect(() => {
    if (isMobile && compactOnMobile) return;

    const iso = safeIso(selectedDate);
    if (!iso) return;

    const el = itemRefs.current?.[iso];
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } catch {
      // no-op
    }
  }, [selectedDate, isMobile, compactOnMobile]);

  /* ---------------- Mobile: 3-day window (prev/selected/next) ---------------- */

  const compactWindow = useMemo(() => {
    const list = normalizedStrip;
    if (!list.length) return [];

    const cur = safeIso(selectedDate);
    let idx = list.findIndex((x) => x.iso === cur);
    if (idx === -1) idx = Math.max(0, list.findIndex((x) => x.iso === todayIso));
    if (idx === -1) idx = 0;

    const prev = list[Math.max(0, idx - 1)];
    const curr = list[idx];
    const next = list[Math.min(list.length - 1, idx + 1)];

    // ensure uniqueness if at edges
    const out = [prev, curr, next].filter(Boolean);
    const uniq = [];
    const seen = new Set();
    for (const d of out) {
      if (!seen.has(d.iso)) {
        seen.add(d.iso);
        uniq.push(d);
      }
    }
    return uniq;
  }, [normalizedStrip, selectedDate, todayIso]);

  const isCompactMobile = Boolean(isMobile && compactOnMobile);

  // Optional: mobile expand
  const [showAllMobile, setShowAllMobile] = useState(false);
  useEffect(() => {
    // when switching days, keep mobile clean (collapse)
    if (isCompactMobile) setShowAllMobile(false);
  }, [selectedDate, isCompactMobile]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-40" />

      <div className="p-3 sm:p-4">
        {/* Header row (tighter on mobile) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-[#46769B]" />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-extrabold text-gray-900 leading-none truncate">
                {selectedDate ? selectedPretty : "Pick a day"}
              </p>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1 leading-none truncate">
                {isCompactMobile ? "Prev / Today / Next" : "Swipe the strip to change days"}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {showJumpToToday ? (
              <button
                type="button"
                onClick={jumpToToday}
                disabled={loading}
                className={classNames(
                  "hidden sm:inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2",
                  "text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                )}
              >
                Today
              </button>
            ) : null}

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

        {/* MOBILE COMPACT: 3 chips */}
        {isCompactMobile ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {compactWindow.length === 0 ? (
                <div className="col-span-3 rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                  <p className="text-xs text-gray-600">{loading ? "Loading days…" : "No days available."}</p>
                </div>
              ) : (
                compactWindow.map((d) => {
                  const active = safeIso(d.iso) === safeIso(selectedDate);
                  const isToday = d.iso === todayIso;

                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => onSelectDate?.(d.iso)}
                      disabled={loading}
                      className={classNames(
                        "relative rounded-2xl border px-3 py-2 text-left transition",
                        "focus:outline-none focus:ring-2 focus:ring-[#46769B]/40",
                        active
                          ? "bg-[#46769B] text-white border-[#46769B]"
                          : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                      )}
                      title={d.iso}
                    >
                      {isToday && !active ? (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                      ) : null}

                      <div className={classNames("text-[11px] font-extrabold truncate", active ? "text-white" : "text-gray-900")}>
                        {d.label}
                      </div>
                      <div className={classNames("text-[10px] truncate mt-0.5", active ? "text-white/90" : "text-gray-500")}>
                        {d.pretty}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Optional: expand into full strip on mobile */}
            <div className="flex items-center gap-2">
              {showJumpToToday ? (
                <button
                  type="button"
                  onClick={jumpToToday}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                >
                  Today
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowAllMobile((v) => !v)}
                disabled={loading || normalizedStrip.length <= 3}
                className={classNames(
                  "flex-1 inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  "disabled:opacity-60",
                  showAllMobile
                    ? "border-[#46769B] bg-[#46769B] text-white"
                    : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                )}
                title="Show all days"
              >
                {showAllMobile ? "Hide" : "All days"}
              </button>
            </div>

            {showAllMobile ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {normalizedStrip.map((d) => {
                    const active = safeIso(d.iso) === safeIso(selectedDate);
                    const isToday = d.iso === todayIso;

                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => onSelectDate?.(d.iso)}
                        disabled={loading}
                        className={classNames(
                          "relative rounded-2xl border px-3 py-2 text-left transition",
                          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/40",
                          active
                            ? "bg-[#46769B] text-white border-[#46769B]"
                            : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                        )}
                        title={d.iso}
                      >
                        {isToday && !active ? (
                          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                        ) : null}
                        <div className={classNames("text-[11px] font-extrabold truncate", active ? "text-white" : "text-gray-900")}>
                          {d.label}
                        </div>
                        <div className={classNames("text-[10px] truncate mt-0.5", active ? "text-white/90" : "text-gray-500")}>
                          {d.pretty}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* DESKTOP / TABLET: full scroll strip */
          <div className="relative">
            {canScrollLeft ? (
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-r from-white to-white/0" />
            ) : null}
            {canScrollRight ? (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-8 bg-gradient-to-l from-white to-white/0" />
            ) : null}

            <div
              ref={scrollerRef}
              className={classNames("overflow-x-auto overscroll-x-contain rounded-2xl")}
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
              style={{ WebkitOverflowScrolling: "touch" }}
            >
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
                          "px-3 py-2",
                          "min-w-[108px] max-w-[140px]",
                          active
                            ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
                            : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                        )}
                        title={d.iso}
                      >
                        {isToday && !active ? (
                          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                        ) : null}

                        <div className={classNames("text-xs font-extrabold truncate", active ? "text-white" : "text-gray-900")}>
                          {d.label}
                        </div>
                        <div className={classNames("text-[11px] truncate mt-0.5", active ? "text-white/90" : "text-gray-500")}>
                          {d.pretty}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
