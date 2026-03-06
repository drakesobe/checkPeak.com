// components/org/workoutsCalendar/SportChips.jsx
"use client";

import { useMemo, useCallback } from "react";
import { Filter } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

function uniqByKey(items) {
  const seen = new Set(); const out = [];
  for (const it of Array.isArray(items) ? items : []) {
    const k = String(it?.k || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(it);
  }
  return out;
}

export default function SportChips({
  sportsAll, selectedSports, setSelectedSports, onOpenMore,
  compact = false, maxPrimary = 5, maxSelected = 6,
  darkMode = false, // true when rendered in the nav bar (dark bg)
}) {
  const selected = useMemo(() => {
    const arr = Array.isArray(selectedSports) ? selectedSports : [];
    const seen = new Set(); const out = [];
    for (const s of arr) {
      const k = normalizeSport(s);
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(k);
    }
    return out;
  }, [selectedSports]);

  const all = useMemo(() => {
    const src = Array.isArray(sportsAll) ? sportsAll : [];
    const items = src.map((s) => { const k = normalizeSport(s); return k ? { k, label: titleSport(s) } : null; }).filter(Boolean);
    items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return uniqByKey(items);
  }, [sportsAll]);

  const primary = useMemo(() => {
    const selectedSet = new Set(selected);
    const selectedFirst = selected
      .map((k) => all.find((x) => x.k === k) || { k, label: titleSport(k) })
      .filter(Boolean);
    const rest = all.filter((x) => !selectedSet.has(x.k));
    return uniqByKey([...selectedFirst, ...rest]).slice(0, maxPrimary);
  }, [all, selected, maxPrimary]);

  const isSelected = useCallback((k) => selected.includes(k), [selected]);

  const toggleSport = useCallback((sportKeyOrLabel) => {
    const k = normalizeSport(sportKeyOrLabel);
    if (!k) return;
    setSelectedSports((prev) => {
      const cur = Array.isArray(prev) ? prev.map(normalizeSport).filter(Boolean) : [];
      const set = new Set(cur);
      if (set.has(k)) return cur.filter((x) => x !== k);
      if (cur.length >= maxSelected) return cur;
      return [...cur, k];
    });
  }, [setSelectedSports, maxSelected]);

  const clearAll = useCallback(() => setSelectedSports([]), [setSelectedSports]);

  // Chip styles depend on dark/light context
  function chipStyle(active) {
    if (darkMode) {
      return {
        display:         "inline-flex",
        alignItems:      "center",
        gap:             "4px",
        padding:         compact ? "5px 10px" : "6px 12px",
        fontSize:        "11px",
        fontWeight:      700,
        textTransform:   "uppercase",
        letterSpacing:   "0.06em",
        border:          active ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(255,255,255,0.2)",
        backgroundColor: active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
        color:           "#fff",
        cursor:          "pointer",
        transition:      "all 0.12s",
        whiteSpace:      "nowrap",
      };
    }
    return {
      display:         "inline-flex",
      alignItems:      "center",
      gap:             "4px",
      padding:         compact ? "4px 10px" : "5px 12px",
      fontSize:        "11px",
      fontWeight:      700,
      textTransform:   "uppercase",
      letterSpacing:   "0.06em",
      border:          `1px solid ${active ? DS.brand : DS.border}`,
      backgroundColor: active ? DS.brand     : DS.cardBg,
      color:           active ? "#fff"        : DS.labelText,
      cursor:          "pointer",
      transition:      "all 0.12s",
      whiteSpace:      "nowrap",
    };
  }

  function chipEnter(el, active) {
    if (darkMode) { el.style.backgroundColor = "rgba(255,255,255,0.25)"; return; }
    if (!active) { el.style.backgroundColor = DS.brandBg; el.style.borderColor = DS.brandBorder; el.style.color = DS.brand; }
  }
  function chipLeave(el, active) {
    if (darkMode) { el.style.backgroundColor = active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"; return; }
    if (!active) { el.style.backgroundColor = DS.cardBg; el.style.borderColor = DS.border; el.style.color = DS.labelText; }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* All */}
      <button
        type="button"
        style={chipStyle(selected.length === 0)}
        onClick={clearAll}
        title="Show all sports"
        onMouseEnter={(e) => chipEnter(e.currentTarget, selected.length === 0)}
        onMouseLeave={(e) => chipLeave(e.currentTarget, selected.length === 0)}
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
            style={chipStyle(active)}
            onClick={() => toggleSport(it.k)}
            title={active ? "Remove filter" : "Add filter"}
            onMouseEnter={(e) => chipEnter(e.currentTarget, active)}
            onMouseLeave={(e) => chipLeave(e.currentTarget, active)}
          >
            {it.label}
          </button>
        );
      })}

      {/* More */}
      <button
        type="button"
        style={chipStyle(false)}
        onClick={onOpenMore}
        title="Open sports filter"
        onMouseEnter={(e) => chipEnter(e.currentTarget, false)}
        onMouseLeave={(e) => chipLeave(e.currentTarget, false)}
      >
        <Filter className="w-3 h-3" />
        More
        {selected.length > 0 && (
          <span
            className="ml-0.5 px-1.5 py-0.5 text-xs font-black"
            style={{
              backgroundColor: darkMode ? "rgba(255,255,255,0.2)" : DS.brandBg,
              color:           darkMode ? "#fff" : DS.brand,
            }}
          >
            {selected.length}
          </span>
        )}
      </button>
    </div>
  );
}