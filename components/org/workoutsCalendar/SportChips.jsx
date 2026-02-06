// /components/org/workouts-calendar/SportChips.jsx
"use client";

import { useMemo, useCallback } from "react";
import { Filter } from "lucide-react";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function uniqByKey(items) {
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const k = String(it?.k || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export default function SportChips({
  sportsAll,
  selectedSports,
  setSelectedSports,
  onOpenMore,
  compact = false,
  maxPrimary = 5,
  maxSelected = 6, // ✅ cap (matches your modal default)
}) {
  const selected = useMemo(() => {
    const arr = Array.isArray(selectedSports) ? selectedSports : [];
    // normalize + dedupe
    const seen = new Set();
    const out = [];
    for (const s of arr) {
      const k = normalizeSport(s);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }, [selectedSports]);

  const all = useMemo(() => {
    const src = Array.isArray(sportsAll) ? sportsAll : [];
    const items = src
      .map((s) => {
        const k = normalizeSport(s);
        if (!k) return null;
        return { k, label: titleSport(s) };
      })
      .filter(Boolean);

    // deterministic order by label
    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return uniqByKey(items);
  }, [sportsAll]);

  // ✅ Keep selected sports visible in the primary row (so "More" selections show up)
  const primary = useMemo(() => {
    const selectedSet = new Set(selected);

    const selectedFirst = selected
      .map((k) => {
        const found = all.find((x) => x.k === k);
        return found || { k, label: titleSport(k) };
      })
      .filter(Boolean);

    const rest = all.filter((x) => !selectedSet.has(x.k));

    return uniqByKey([...selectedFirst, ...rest]).slice(0, maxPrimary);
  }, [all, selected, maxPrimary]);

  const isSelected = useCallback((k) => selected.includes(k), [selected]);

  const toggleSport = useCallback(
    (sportKeyOrLabel) => {
      const k = normalizeSport(sportKeyOrLabel);
      if (!k) return;

      setSelectedSports((prev) => {
        const cur = Array.isArray(prev) ? prev.map(normalizeSport).filter(Boolean) : [];
        const curSet = new Set(cur);

        if (curSet.has(k)) {
          return cur.filter((x) => x !== k);
        }

        // ✅ enforce cap
        if (cur.length >= maxSelected) return cur;

        return [...cur, k];
      });
    },
    [setSelectedSports, maxSelected]
  );

  const clearAll = useCallback(() => setSelectedSports([]), [setSelectedSports]);

  const chipBase =
    "px-3 py-2 rounded-2xl border text-sm font-semibold transition whitespace-nowrap inline-flex items-center gap-2";

  const sizeClass = compact ? "text-xs px-2.5 py-2" : "";

  const moreCount = selected.length;

  return (
    <div className="flex flex-wrap gap-2">
      {/* All */}
      <button
        type="button"
        aria-pressed={selected.length === 0}
        className={classNames(
          chipBase,
          selected.length === 0
            ? "bg-[#46769B] text-white border-[#46769B]"
            : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
          sizeClass
        )}
        onClick={clearAll}
        title="Show all sports"
      >
        All
      </button>

      {/* Primary chips */}
      {primary.map((it) => {
        const active = isSelected(it.k);
        return (
          <button
            key={it.k}
            type="button"
            aria-pressed={active}
            className={classNames(
              chipBase,
              active
                ? "bg-[#46769B] text-white border-[#46769B]"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
              sizeClass
            )}
            onClick={() => toggleSport(it.k)}
            title={active ? "Remove filter" : "Add filter"}
          >
            {it.label}
          </button>
        );
      })}

      {/* More */}
      <button
        type="button"
        className={classNames(
          chipBase,
          "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
          sizeClass
        )}
        onClick={onOpenMore}
        title="Open multi-select sports filter"
      >
        <Filter className="w-4 h-4" />
        More
        {moreCount > 0 ? (
          <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold bg-gray-100 border border-gray-200">
            {moreCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
