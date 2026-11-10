// components/org/workoutsCalendar/CalendarHeader.jsx
"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Filter, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader, APP } from "@/components/app/ui";
import SportChips from "./SportChips";

function summaryLine(summary, viewMode) {
  const n = summary?.workoutsCount || 0;
  const days = summary?.uniqueDaysCount || 0;
  const span = viewMode === "week" ? "this week" : "this month";
  if (!n) return `No workouts scheduled ${span}`;
  return `${n} workout${n === 1 ? "" : "s"} across ${days} day${days === 1 ? "" : "s"} ${span}`;
}

export default function CalendarHeader({
  viewMode, setViewMode,
  weekLabel, monthLabel,
  selectedSports, setSelectedSports, SPORTS_ALL, onOpenMoreSports,
  err, loading, rangeSummary,
  onGoToday, onPrev, onNext, onCreateToday,
  onOpenCompliance, onOpenSeasonCalendar,
}) {
  const [sportsOpen, setSportsOpen] = useState(false);
  const rangeLabel = viewMode === "week" ? weekLabel : monthLabel;

  const toolbar = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <button type="button" className="app-icon-btn" onClick={onPrev} aria-label={viewMode === "week" ? "Previous week" : "Previous month"}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button type="button" className="app-icon-btn" onClick={onNext} aria-label={viewMode === "week" ? "Next week" : "Next month"}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <span aria-live="polite" style={{ fontSize: 16, fontWeight: 650, color: APP.ink, padding: "0 6px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          {rangeLabel}
        </span>
        <button type="button" className="app-btn app-btn--secondary" onClick={onGoToday} style={{ height: 32, padding: "0 12px", fontSize: 13 }}>
          Today
        </button>
      </div>
      <div className="app-seg" role="group" aria-label="Calendar view">
        {["week", "month"].map((v) => (
          <button key={v} type="button" aria-pressed={viewMode === v} onClick={() => setViewMode(v)}>
            {v === "week" ? "Week" : "Month"}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <PageHeader
      title="Schedule"
      subtitle={loading ? "Loading schedule…" : summaryLine(rangeSummary, viewMode)}
      primaryAction={{ label: "Create workout", icon: Plus, onClick: onCreateToday }}
      secondaryActions={[
        { label: "Sports", icon: Filter, onClick: () => setSportsOpen((v) => !v), active: sportsOpen || selectedSports.length > 0, count: selectedSports.length },
        { label: "Season dates", icon: CalendarDays, onClick: () => onOpenSeasonCalendar?.() },
        { label: "Compliance", icon: ShieldCheck, onClick: () => onOpenCompliance?.() },
      ]}
      toolbar={toolbar}
    >
      {sportsOpen && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: APP.canvas, border: `1px solid ${APP.line}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <SportChips
            sportsAll={SPORTS_ALL}
            selectedSports={selectedSports}
            setSelectedSports={setSelectedSports}
            onOpenMore={onOpenMoreSports}
          />
          {selectedSports.length > 0 && (
            <button type="button" className="app-btn app-btn--ghost" onClick={() => setSelectedSports([])} style={{ height: 32, fontSize: 13 }}>
              Clear filter
            </button>
          )}
        </div>
      )}

      {err && (
        <div role="alert" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: APP.dangerTint, color: APP.danger, fontSize: 13, fontWeight: 600 }}>
          <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
          {err}
        </div>
      )}
    </PageHeader>
  );
}
