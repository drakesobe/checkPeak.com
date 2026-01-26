"use client";

import { Filter } from "lucide-react";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function SportChips({
  sportsAll,
  selectedSports,
  setSelectedSports,
  onOpenMore,
  compact = false,
}) {
  const primary = (Array.isArray(sportsAll) ? sportsAll : []).slice(0, 5);
  const selected = Array.isArray(selectedSports) ? selectedSports : [];

  const isSelected = (s) => selected.includes(normalizeSport(s));

  const toggleSport = (s) => {
    const k = normalizeSport(s);
    if (!k) return;
    setSelectedSports((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      return [...cur, k];
    });
  };

  const clearAll = () => setSelectedSports([]);

  const chipBase = "px-3 py-2 rounded-2xl border text-sm font-semibold transition whitespace-nowrap";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={classNames(
          chipBase,
          selected.length === 0
            ? "bg-[#46769B] text-white border-[#46769B]"
            : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
          compact ? "text-xs px-2.5 py-2" : ""
        )}
        onClick={clearAll}
      >
        All
      </button>

      {primary.map((s) => {
        const active = isSelected(s);
        return (
          <button
            key={s}
            type="button"
            className={classNames(
              chipBase,
              active
                ? "bg-[#46769B] text-white border-[#46769B]"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
              compact ? "text-xs px-2.5 py-2" : ""
            )}
            onClick={() => toggleSport(s)}
          >
            {titleSport(s)}
          </button>
        );
      })}

      <button
        type="button"
        className={classNames(
          chipBase,
          "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
          compact ? "text-xs px-2.5 py-2" : ""
        )}
        onClick={onOpenMore}
      >
        <Filter className="w-4 h-4" />
        More
      </button>
    </div>
  );
}
