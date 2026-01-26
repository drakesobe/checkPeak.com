// /components/athlete-today/DateStrip.jsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classNames, labelForDate, prettyDate } from "./ui";

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
  const todayIso = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const normalizedStrip = useMemo(() => {
    const list = Array.isArray(dateStrip) ? dateStrip : [];
    return list
      .map((d) => {
        const iso = String(d?.iso || "").trim();
        if (!iso) return null;
        return {
          iso,
          label: d?.label || labelForDate(iso),
          pretty: d?.pretty || prettyDate(iso),
        };
      })
      .filter(Boolean);
  }, [dateStrip]);

  useEffect(() => {
    const iso = String(selectedDate || "").trim();
    if (!iso) return;
    const el = itemRefs.current?.[iso];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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

    const cur = String(selectedDate || "").trim();
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

  return (
    <section className="rounded-2xl border border-gray-200 bg-white/60 backdrop-blur p-3 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Browse days
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {selectedDate ? `Selected: ${selectedDate}` : "Select a day to view its workout."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showJumpToToday && (
            <button
              type="button"
              onClick={jumpToToday}
              disabled={loading}
              className="hidden sm:inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            >
              Today
            </button>
          )}

          <button
            type="button"
            onClick={onPrev}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Strip */}
      <div
        className="overflow-x-auto"
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
            if (normalizedStrip[normalizedStrip.length - 1]?.iso)
              onSelectDate?.(normalizedStrip[normalizedStrip.length - 1].iso);
          }
        }}
      >
        {/* Snap scrolling for mobile */}
        <div className="flex gap-2 min-w-max px-1 pb-1 snap-x snap-mandatory">
          {normalizedStrip.length === 0 ? (
            <div className="w-full rounded-2xl border border-dashed border-gray-300 bg-white p-4">
              <p className="text-xs text-gray-600">
                {loading ? "Loading days…" : "No days available."}
              </p>
            </div>
          ) : (
            normalizedStrip.map((d) => {
              const active = d.iso === selectedDate;
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
                    "snap-center relative text-left transition focus:outline-none focus:ring-2 focus:ring-[#46769B]/40",
                    // bigger tap target on mobile
                    "px-4 py-3 sm:px-3 sm:py-2 rounded-2xl border min-w-[120px] sm:min-w-[104px]",
                    active
                      ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
                      : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                  )}
                  title={d.iso}
                >
                  {isToday && !active ? (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                  ) : null}

                  {active ? (
                    <span className="absolute inset-0 rounded-2xl ring-2 ring-white/30 pointer-events-none" />
                  ) : null}

                  <div className={classNames("text-xs font-extrabold", active ? "text-white" : "text-gray-900")}>
                    {d.label}
                  </div>
                  <div className={classNames("text-[11px]", active ? "text-white/90" : "text-gray-500")}>
                    {d.pretty}
                  </div>

                  <div className="mt-1 flex items-center gap-1">
                    {active ? (
                      <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                        Selected
                      </span>
                    ) : isToday ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Today
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          Tip: tap a day to view its workout, then swipe right on an item to upload proof.
        </p>

        {showJumpToToday && (
          <button
            type="button"
            onClick={jumpToToday}
            disabled={loading}
            className="sm:hidden inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            Jump to Today
          </button>
        )}
      </div>
    </section>
  );
}
