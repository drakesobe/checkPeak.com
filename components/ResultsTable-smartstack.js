"use client";
import { useMemo, useState, useRef, useEffect } from "react";

const banTypeColors = [
  { label: "Prohibited", color: "#d62828" },
  { label: "Limited to Out of Competition", color: "#f77f00" },
  { label: "Particular Sports", color: "#3fb0ac" },
];

export default function ResultsTableSmartstack({ matchedRecords = [] }) {
  const [activeBanType, setActiveBanType] = useState(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [fadeHint, setFadeHint] = useState(false);
  const scrollRef = useRef(null);

  const filtered = useMemo(() => {
    if (!activeBanType) return matchedRecords;
    return matchedRecords.filter(
      (r) => (r.fields?.["Ban Type"] || "None") === activeBanType
    );
  }, [matchedRecords, activeBanType]);

  const getBadge = (banType) => {
    const c = banTypeColors.find((b) => b.label === banType)?.color || "#999";
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          color: "white",
          backgroundColor: c,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
        }}
      >
        {banType || "None"}
      </span>
    );
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftShadow(el.scrollLeft > 0);
    setShowRightShadow(el.scrollLeft + el.clientWidth < el.scrollWidth);
    if (showSwipeHint && el.scrollLeft > 5) setShowSwipeHint(false);
  };

  const checkScrollable = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth) {
      setShowSwipeHint(true);
      setFadeHint(true);
    } else {
      setShowSwipeHint(false);
      setFadeHint(false);
    }
    handleScroll();
  };

  useEffect(() => {
    checkScrollable();
  }, [filtered]);

  // Auto-hide swipe hint after 3 seconds
  useEffect(() => {
    if (!showSwipeHint) return;
    const timer = setTimeout(() => setFadeHint(false), 2500);
    const timerHide = setTimeout(() => setShowSwipeHint(false), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(timerHide);
    };
  }, [showSwipeHint]);

  return (
    <div className="w-full relative">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {banTypeColors.map((b) => (
          <button
            key={b.label}
            onClick={() =>
              setActiveBanType(activeBanType === b.label ? null : b.label)
            }
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${
              activeBanType === b.label
                ? "border-white/50 bg-white/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            <span className="text-sm font-medium text-white">{b.label}</span>
          </button>
        ))}
        {activeBanType && (
          <button
            onClick={() => setActiveBanType(null)}
            className="text-sm text-white/80 underline underline-offset-2"
            title="Clear filter"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="relative rounded-xl border border-white/10 bg-gray-900/60 overflow-x-auto overflow-y-auto max-h-72"
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        {/* Left shadow/gradient peek */}
        {showLeftShadow && (
          <div className="pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-gray-900/80 to-transparent z-10" />
        )}
        {/* Right shadow/gradient peek */}
        {showRightShadow && (
          <div className="pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-gray-900/80 to-transparent z-10" />
        )}
        {/* Mobile swipe hint */}
        {showSwipeHint && (
          <div
            className={`pointer-events-none absolute top-1/2 right-2 transform -translate-y-1/2 text-white/50 z-20 select-none text-sm transition-opacity duration-500 ${
              fadeHint ? "opacity-100" : "opacity-0"
            }`}
          >
            ← Swipe to scroll →
          </div>
        )}

        <table className="min-w-full text-sm">
          <thead className="bg-[#2a3d4d] text-white/95 sticky top-0 z-10">
            <tr>
              {[
                "Substance Name",
                "Synonyms",
                "Banned By",
                "Ban Type",
                "Dosage Limit",
                "Notes",
                "Source / Citation",
              ].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-white/70">
                  No banned substances detected for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((rec, i) => {
                const f = rec.fields || {};
                return (
                  <tr
                    key={rec.id || i}
                    className={i % 2 === 0 ? "bg-white/5" : "bg-white/0"}
                  >
                    <td className="px-4 py-2 text-white">{f["Substance Name"] || "-"}</td>
                    <td className="px-4 py-2 text-white/80">{f["Synonyms"] || "-"}</td>
                    <td className="px-4 py-2 text-white/80">{f["Banned By"] || "-"}</td>
                    <td className="px-4 py-2">{getBadge(f["Ban Type"])}</td>
                    <td className="px-4 py-2 text-white/80">{f["Dosage Limit"] || "-"}</td>
                    <td className="px-4 py-2 text-white/80">{f["Notes"] || "-"}</td>
                    <td className="px-4 py-2 text-white/80 break-words">{f["Source / Citation"] || "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
