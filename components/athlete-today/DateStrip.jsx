// components/athlete-today/DateStrip.jsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classNames, labelForDate, prettyDate } from "./ui";

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
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const apply = () => setIsMobile(Boolean(mq.matches));
    apply();
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
  compactOnMobile = true,
  // Pass darkBg=true when this strip sits inside a dark background (e.g. the hero header)
  darkBg = false,
}) {
  const itemRefs    = useRef({});
  const scrollerRef = useRef(null);
  const todayIso    = useMemo(() => getLocalTodayISO(), []);
  const isMobile    = useIsMobile(640);

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const tk = useMemo(() => darkBg ? {
    navBtn:             "border-white/15 bg-white/[0.07] text-white/60 hover:bg-white/[0.14] hover:text-white disabled:opacity-30",
    dateBtnBorder:      "border-white/15 bg-white/[0.07] hover:bg-white/[0.14] disabled:cursor-default",
    dateBtnText:        "text-white font-bold",
    todayBadge:         "bg-emerald-400/20 text-emerald-300",
    jumpLabel:          "text-white/35",
    chipInactive:       "border-white/10 bg-white/[0.06] hover:bg-white/[0.11] hover:border-white/20",
    chipLabelInactive:  "text-white/75",
    chipSubInactive:    "text-white/35",
    chipActive:         "bg-white border-white shadow-lg",
    chipLabelActive:    "text-[#0F1E2E]",
    chipSubActive:      "text-[#0F1E2E]/50",
    todayDot:           "bg-emerald-400",
    expandInactive:     "border-white/15 bg-white/[0.06] text-white/45 hover:bg-white/[0.10]",
    expandActive:       "border-white/40 bg-white/[0.14] text-white",
    emptyBorder:        "border-white/10",
    emptyText:          "text-white/30",
    fadeLeft:           "from-[#0F1E2E]",
    fadeRight:          "from-[#0F1E2E]",
    expandedWrap:       "border-white/10 bg-white/[0.04]",
  } : {
    navBtn:             "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40",
    dateBtnBorder:      "border-gray-200 bg-white hover:bg-gray-50 disabled:cursor-default",
    dateBtnText:        "text-gray-900 font-bold",
    todayBadge:         "bg-emerald-100 text-emerald-700",
    jumpLabel:          "text-[#46769B]",
    chipInactive:       "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
    chipLabelInactive:  "text-gray-900",
    chipSubInactive:    "text-gray-400",
    chipActive:         "bg-[#1E3A5F] border-[#1E3A5F] shadow-md",
    chipLabelActive:    "text-white",
    chipSubActive:      "text-white/70",
    todayDot:           "bg-emerald-500",
    expandInactive:     "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
    expandActive:       "border-[#46769B] bg-[#46769B]/10 text-[#46769B]",
    emptyBorder:        "border-gray-200",
    emptyText:          "text-gray-400",
    fadeLeft:           "from-white",
    fadeRight:          "from-white",
    expandedWrap:       "border-gray-200 bg-gray-50",
  }, [darkBg]);

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
    try { return prettyDate(iso); } catch { return iso; }
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
    const nextIdx = idx === -1
      ? dir > 0 ? 0 : list.length - 1
      : Math.min(list.length - 1, Math.max(0, idx + dir));
    const nextIso = list[nextIdx]?.iso;
    if (nextIso) onSelectDate?.(nextIso);
  };

  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const max  = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 2);
    setCanScrollRight(max - left > 2);
  }, []);

  useEffect(() => { updateScrollHints(); }, [normalizedStrip.length, updateScrollHints]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateScrollHints();
    el.addEventListener("scroll", onScroll, { passive: true });
    let ro;
    try { ro = new ResizeObserver(() => updateScrollHints()); ro.observe(el); } catch {}
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect();
    };
  }, [updateScrollHints]);

  useEffect(() => {
    if (isMobile && compactOnMobile) return;
    const iso = safeIso(selectedDate);
    if (!iso) return;
    const el = itemRefs.current?.[iso];
    if (!el) return;
    try { el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } catch {}
  }, [selectedDate, isMobile, compactOnMobile]);

  const compactWindow = useMemo(() => {
    const list = normalizedStrip;
    if (!list.length) return [];
    const cur = safeIso(selectedDate);
    let idx = list.findIndex((x) => x.iso === cur);
    if (idx === -1) idx = Math.max(0, list.findIndex((x) => x.iso === todayIso));
    if (idx === -1) idx = 0;
    const uniq = [];
    const seen = new Set();
    for (const d of [
      list[Math.max(0, idx - 1)],
      list[idx],
      list[Math.min(list.length - 1, idx + 1)],
    ].filter(Boolean)) {
      if (!seen.has(d.iso)) { seen.add(d.iso); uniq.push(d); }
    }
    return uniq;
  }, [normalizedStrip, selectedDate, todayIso]);

  const isCompactMobile = Boolean(isMobile && compactOnMobile);
  const [showAllMobile, setShowAllMobile] = useState(false);

  useEffect(() => {
    if (isCompactMobile) setShowAllMobile(false);
  }, [selectedDate, isCompactMobile]);

  const isToday = safeIso(selectedDate) === todayIso;

  // ── Reusable chip ──────────────────────────────────────────────────────────
  const renderChip = (d, { small = false, onClick } = {}) => {
    const active      = safeIso(d.iso) === safeIso(selectedDate);
    const isTodayChip = d.iso === todayIso;
    return (
      <button
        key={d.iso}
        type="button"
        onClick={onClick ?? (() => onSelectDate?.(d.iso))}
        disabled={loading}
        className={classNames(
          "relative flex flex-col items-center justify-center rounded-xl border transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
          small ? "py-2" : "py-2.5",
          active ? tk.chipActive : tk.chipInactive
        )}
      >
        {isTodayChip && !active ? (
          <span className={classNames("absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full", tk.todayDot)} />
        ) : null}
        <span className={classNames(
          "font-black uppercase tracking-wider leading-none",
          small ? "text-[10px]" : "text-[11px]",
          active ? tk.chipLabelActive : tk.chipLabelInactive
        )}>
          {d.label}
        </span>
        <span className={classNames(
          "mt-1 leading-none",
          small ? "text-[9px]" : "text-[10px]",
          active ? tk.chipSubActive : tk.chipSubInactive
        )}>
          {d.pretty}
        </span>
      </button>
    );
  };

  return (
    <div className="relative">

      {/* ── Nav row ── */}
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={loading}
          className={classNames(
            "flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border transition",
            tk.navBtn
          )}
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={jumpToToday}
          disabled={loading || isToday}
          className={classNames(
            "flex-1 min-w-0 flex items-center justify-center gap-2 h-9 rounded-xl border px-3 transition",
            tk.dateBtnBorder
          )}
          title={isToday ? "Today" : "Jump to today"}
        >
          <span className={classNames("text-[13px] truncate", tk.dateBtnText)}>
            {selectedDate ? selectedPretty : "Pick a day"}
          </span>
          {isToday ? (
            <span className={classNames(
              "flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              tk.todayBadge
            )}>
              Today
            </span>
          ) : (
            <span className={classNames("flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide", tk.jumpLabel)}>
              ↩ Today
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className={classNames(
            "flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border transition",
            tk.navBtn
          )}
          aria-label="Next day"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Mobile compact: 3-chip window ── */}
      {isCompactMobile ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {compactWindow.length === 0 ? (
              <div className={classNames(
                "col-span-3 flex items-center justify-center h-12 rounded-xl border border-dashed",
                tk.emptyBorder
              )}>
                <p className={classNames("text-xs", tk.emptyText)}>
                  {loading ? "Loading…" : "No days"}
                </p>
              </div>
            ) : (
              compactWindow.map((d) => renderChip(d))
            )}
          </div>

          {normalizedStrip.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllMobile((v) => !v)}
              disabled={loading}
              className={classNames(
                "w-full h-8 rounded-xl border text-[11px] font-bold uppercase tracking-wide transition",
                showAllMobile ? tk.expandActive : tk.expandInactive
              )}
            >
              {showAllMobile ? "Collapse" : `All ${normalizedStrip.length} days`}
            </button>
          ) : null}

          {showAllMobile ? (
            <div className={classNames("rounded-xl border p-2", tk.expandedWrap)}>
              <div className="grid grid-cols-4 gap-1.5">
                {normalizedStrip.map((d) =>
                  renderChip(d, {
                    small: true,
                    onClick: () => { onSelectDate?.(d.iso); setShowAllMobile(false); },
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>

      ) : (
        /* ── Desktop: horizontal scroll strip ── */
        <div className="relative">
          {canScrollLeft ? (
            <div className={classNames(
              "pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r to-transparent z-10",
              tk.fadeLeft
            )} />
          ) : null}
          {canScrollRight ? (
            <div className={classNames(
              "pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l to-transparent z-10",
              tk.fadeRight
            )} />
          ) : null}

          <div
            ref={scrollerRef}
            className="overflow-x-auto overscroll-x-contain"
            style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
            role="listbox"
            aria-label="Select a day"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft")  { e.preventDefault(); moveSelection(-1); }
              if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(1);  }
              if (e.key === "Home") { e.preventDefault(); if (normalizedStrip[0]?.iso) onSelectDate?.(normalizedStrip[0].iso); }
              if (e.key === "End")  { e.preventDefault(); const last = normalizedStrip[normalizedStrip.length - 1]?.iso; if (last) onSelectDate?.(last); }
            }}
          >
            <div className="flex gap-1.5 min-w-max pb-0.5 snap-x snap-mandatory">
              {normalizedStrip.length === 0 ? (
                <div className={classNames(
                  "w-64 flex items-center justify-center h-12 rounded-xl border border-dashed",
                  tk.emptyBorder
                )}>
                  <p className={classNames("text-xs", tk.emptyText)}>
                    {loading ? "Loading days…" : "No days available."}
                  </p>
                </div>
              ) : (
                normalizedStrip.map((d) => {
                  const active = safeIso(d.iso) === safeIso(selectedDate);
                  return (
                    <button
                      key={d.iso}
                      ref={(el) => { if (el) itemRefs.current[d.iso] = el; }}
                      type="button"
                      onClick={() => onSelectDate?.(d.iso)}
                      disabled={loading}
                      role="option"
                      aria-selected={active}
                      className={classNames(
                        "snap-center relative flex flex-col items-center justify-center transition",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                        "rounded-xl border px-4 py-2.5 min-w-[88px]",
                        active ? tk.chipActive : tk.chipInactive
                      )}
                    >
                      {d.iso === todayIso && !active ? (
                        <span className={classNames("absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full", tk.todayDot)} />
                      ) : null}
                      <span className={classNames(
                        "text-[11px] font-black uppercase tracking-wider leading-none",
                        active ? tk.chipLabelActive : tk.chipLabelInactive
                      )}>
                        {d.label}
                      </span>
                      <span className={classNames(
                        "text-[10px] mt-1 leading-none",
                        active ? tk.chipSubActive : tk.chipSubInactive
                      )}>
                        {d.pretty}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}