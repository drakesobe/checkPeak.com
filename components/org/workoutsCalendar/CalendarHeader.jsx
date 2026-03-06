// components/org/workoutsCalendar/CalendarHeader.jsx
"use client";

import { useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight,
  RefreshCcw, Plus, LayoutDashboard, Filter,
  AlertTriangle,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import SportChips from "./SportChips";

function ghostBtn(danger = false) {
  return {
    display:         "inline-flex",
    alignItems:      "center",
    gap:             "5px",
    padding:         "6px 10px",
    fontSize:        "11px",
    fontWeight:      900,
    textTransform:   "uppercase",
    letterSpacing:   "0.07em",
    border:          danger
      ? "1px solid rgba(200,16,46,0.4)"
      : "1px solid rgba(255,255,255,0.2)",
    backgroundColor: danger
      ? "rgba(200,16,46,0.25)"
      : "rgba(255,255,255,0.08)",
    color:           "#fff",
    cursor:          "pointer",
    transition:      "background-color 0.15s",
    whiteSpace:      "nowrap",
  };
}
function ghostEnter(el, danger = false) {
  el.style.backgroundColor = danger ? "rgba(200,16,46,0.45)" : "rgba(255,255,255,0.18)";
}
function ghostLeave(el, danger = false) {
  el.style.backgroundColor = danger ? "rgba(200,16,46,0.25)" : "rgba(255,255,255,0.08)";
}

export default function CalendarHeader({
  viewMode, setViewMode,
  weekLabel, monthLabel,
  selectedSports, setSelectedSports, SPORTS_ALL, onOpenMoreSports,
  err, loading,
  rangeSummary,
  onGoDashboard, onRefresh, onGoToday, onPrev, onNext, onCreateToday,
}) {
  const [sportsOpen, setSportsOpen] = useState(false);
  const primaryLabel = viewMode === "week" ? weekLabel : monthLabel;

  return (
    <div style={{ backgroundColor: DS.brand }}>

      {/* ── Main nav bar ── */}
      <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

        {/* Left: identity + nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <CalendarDays className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.7)" }} />
            <h1 className="text-sm font-black uppercase tracking-wide" style={{ color: "#fff" }}>
              Workouts Calendar
            </h1>
          </div>

          {/* Date nav — inline */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              style={ghostBtn()}
              onClick={onPrev}
              title="Previous"
              onMouseEnter={(e) => ghostEnter(e.currentTarget)}
              onMouseLeave={(e) => ghostLeave(e.currentTarget)}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            <span
              className="text-sm font-black tabular-nums px-2 py-1"
              style={{ color: "#fff", minWidth: "160px", textAlign: "center" }}
            >
              {primaryLabel}
            </span>

            <button
              type="button"
              style={ghostBtn()}
              onClick={onNext}
              title="Next"
              onMouseEnter={(e) => ghostEnter(e.currentTarget)}
              onMouseLeave={(e) => ghostLeave(e.currentTarget)}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Today + view toggle */}
          <button
            type="button"
            style={ghostBtn()}
            onClick={onGoToday}
            onMouseEnter={(e) => ghostEnter(e.currentTarget)}
            onMouseLeave={(e) => ghostLeave(e.currentTarget)}
          >
            Today
          </button>

          {/* Week / Month toggle */}
          <div className="flex" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
            {["week", "month"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className="px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-all"
                style={{
                  backgroundColor: viewMode === v ? "rgba(255,255,255,0.18)" : "transparent",
                  color:           "#fff",
                  borderRight:     v === "week" ? "1px solid rgba(255,255,255,0.2)" : "none",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Sport filter toggle — shows count badge if active */}
          <button
            type="button"
            style={{
              ...ghostBtn(),
              backgroundColor: sportsOpen
                ? "rgba(255,255,255,0.18)"
                : selectedSports.length > 0
                ? "rgba(255,255,255,0.14)"
                : "rgba(255,255,255,0.08)",
            }}
            onClick={() => setSportsOpen((v) => !v)}
            onMouseEnter={(e) => ghostEnter(e.currentTarget)}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                sportsOpen || selectedSports.length > 0
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(255,255,255,0.08)";
            }}
          >
            <Filter className="w-3 h-3" />
            Sports
            {selectedSports.length > 0 && (
              <span
                className="px-1.5 py-0.5 text-xs font-black"
                style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
              >
                {selectedSports.length}
              </span>
            )}
          </button>

          <button
            type="button"
            style={ghostBtn()}
            onClick={onRefresh}
            disabled={loading}
            onMouseEnter={(e) => ghostEnter(e.currentTarget)}
            onMouseLeave={(e) => ghostLeave(e.currentTarget)}
          >
            <RefreshCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            style={ghostBtn()}
            onClick={onGoDashboard}
            onMouseEnter={(e) => ghostEnter(e.currentTarget)}
            onMouseLeave={(e) => ghostLeave(e.currentTarget)}
          >
            <LayoutDashboard className="w-3 h-3" />
            Dashboard
          </button>

          {/* Primary create — stands out */}
          <button
            type="button"
            onClick={onCreateToday}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-all"
            style={{
              backgroundColor: DS.cardBg,
              color:           DS.brand,
              border:          `1px solid ${DS.cardBg}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
          >
            <Plus className="w-3 h-3" />
            Create
          </button>
        </div>
      </div>

      {/* ── Sport chips panel — collapsible ── */}
      {sportsOpen && (
        <div
          className="px-5 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(0,0,0,0.12)" }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <SportChips
              sportsAll={SPORTS_ALL}
              selectedSports={selectedSports}
              setSelectedSports={setSelectedSports}
              onOpenMore={onOpenMoreSports}
              darkMode
            />
            {selectedSports.length > 0 && (
              <button
                type="button"
                style={ghostBtn()}
                onClick={() => setSelectedSports([])}
                onMouseEnter={(e) => ghostEnter(e.currentTarget)}
                onMouseLeave={(e) => ghostLeave(e.currentTarget)}
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Error stripe ── */}
      {err && (
        <div
          className="px-5 py-2 flex items-center gap-2 text-xs font-bold"
          style={{
            backgroundColor: "rgba(200,16,46,0.25)",
            borderTop:       "1px solid rgba(200,16,46,0.3)",
            color:           "#FFC8C8",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {err} — confirm your API accepts the sports/sport query params and that the Airtable field is named Sport.
        </div>
      )}
    </div>
  );
}