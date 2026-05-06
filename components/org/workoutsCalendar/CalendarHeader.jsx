// components/org/workoutsCalendar/CalendarHeader.jsx
"use client";

import { useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight,
  Plus, Filter, AlertTriangle, ShieldCheck,
  MoreHorizontal, X,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import SportChips from "./SportChips";

const HEADER_CSS = `
  .ch-shell { background-color: var(--ch-brand); }

  /* ── Row 1: title + create ── */
  .ch-row1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px 0;
    gap: 8px;
  }
  @media (min-width: 700px) {
    .ch-row1 { padding: 10px 20px 0; }
  }

  /* ── Row 2: date nav + toggle + desktop actions ── */
  .ch-row2 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px 10px;
    gap: 8px;
    flex-wrap: wrap;
  }
  @media (min-width: 700px) {
    .ch-row2 { padding: 8px 20px 10px; }
  }

  .ch-row2-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* Desktop-only action buttons - hidden on mobile */
  .ch-desktop-actions {
    display: none;
  }
  @media (min-width: 700px) {
    .ch-desktop-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
  }

  /* Mobile-only more button - hidden on desktop */
  .ch-more-btn {
    display: inline-flex;
  }
  @media (min-width: 700px) {
    .ch-more-btn { display: none; }
  }

  /* ── Ghost button ── */
  .ch-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    border: 1px solid rgba(255,255,255,0.2);
    background-color: rgba(255,255,255,0.08);
    color: #fff;
    cursor: pointer;
    transition: background-color 0.15s;
    white-space: nowrap;
    line-height: 1;
  }
  .ch-btn:hover   { background-color: rgba(255,255,255,0.18); }
  .ch-btn:disabled { opacity: 0.5; cursor: default; }

  /* ── Create button ── */
  .ch-btn-create {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    background-color: rgba(255,255,255,0.95);
    color: var(--ch-brand);
    border: none;
    cursor: pointer;
    white-space: nowrap;
    line-height: 1;
    transition: background-color 0.15s;
  }
  .ch-btn-create:hover { background-color: #fff; }

  /* ── Date label ── */
  .ch-date-label {
    font-size: 13px;
    font-weight: 900;
    color: #fff;
    padding: 4px 8px;
    min-width: 110px;
    text-align: center;
    white-space: nowrap;
  }
  @media (min-width: 700px) {
    .ch-date-label { min-width: 160px; }
  }

  /* ── Week/Month toggle ── */
  .ch-toggle {
    display: flex;
    border: 1px solid rgba(255,255,255,0.2);
  }
  .ch-toggle-btn {
    padding: 5px 10px;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #fff;
    border: none;
    cursor: pointer;
    transition: background-color 0.12s;
  }

  /* ── Mobile dropdown menu ── */
  .ch-mobile-menu {
    border-top: 1px solid rgba(255,255,255,0.12);
    background-color: rgba(0,0,0,0.18);
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  @media (min-width: 700px) {
    .ch-mobile-menu { display: none; }
  }
  .ch-mobile-menu-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* ── Sport chips panel ── */
  .ch-sports-panel {
    padding: 10px 14px;
    border-top: 1px solid rgba(255,255,255,0.12);
    background-color: rgba(0,0,0,0.12);
  }
  @media (min-width: 700px) {
    .ch-sports-panel { padding: 10px 20px; }
  }

  /* ── Error stripe ── */
  .ch-error {
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    background-color: rgba(200,16,46,0.25);
    border-top: 1px solid rgba(200,16,46,0.3);
    color: #FFC8C8;
  }

  @keyframes ch-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

export default function CalendarHeader({
  viewMode, setViewMode,
  weekLabel, monthLabel,
  selectedSports, setSelectedSports, SPORTS_ALL, onOpenMoreSports,
  err, loading,
  onGoDashboard, onRefresh, onGoToday, onPrev, onNext, onCreateToday,
  onOpenCompliance, onOpenSeasonCalendar,
}) {
  const [moreOpen,   setMoreOpen]   = useState(false);
  const [sportsOpen, setSportsOpen] = useState(false);
  const primaryLabel = viewMode === "week" ? weekLabel : monthLabel;

  const handleSportsToggle = () => {
    setSportsOpen((v) => !v);
    setMoreOpen(false);
  };

  return (
    <>
      <style>{HEADER_CSS}</style>
      <div className="ch-shell" style={{ "--ch-brand": DS.brand }}>

        {/* ── Row 1: Title + Create ── */}
        <div className="ch-row1">
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <CalendarDays size={14} color="rgba(255,255,255,0.75)" />
            <span style={{
              fontSize: 12, fontWeight: 900, color: "#fff",
              letterSpacing: "0.09em", textTransform: "uppercase",
              fontFamily: "'Arial Narrow', Arial, sans-serif",
            }}>
              Workouts Calendar
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Desktop: show all actions inline */}
            <div className="ch-desktop-actions">
              <button
                className="ch-btn"
                onClick={handleSportsToggle}
                style={{
                  backgroundColor: sportsOpen || selectedSports.length > 0
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                <Filter size={12} />
                Sports
                {selectedSports.length > 0 && (
                  <span style={{ backgroundColor: "rgba(255,255,255,0.25)", padding: "1px 5px", fontSize: 10, fontWeight: 900 }}>
                    {selectedSports.length}
                  </span>
                )}
              </button>
              <button className="ch-btn" onClick={(e) => { e.stopPropagation(); onOpenSeasonCalendar?.(); }}>
                <CalendarDays size={12} />
                Season Dates
              </button>
              <button className="ch-btn" onClick={(e) => { e.stopPropagation(); onOpenCompliance?.(); }}>
                <ShieldCheck size={12} />
                Compliance
              </button>
            </div>

            {/* Mobile: ••• menu toggle */}
            <button
              className="ch-btn ch-more-btn"
              onClick={() => setMoreOpen((v) => !v)}
              style={{
                backgroundColor: moreOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
              }}
            >
              {moreOpen ? <X size={14} /> : <MoreHorizontal size={14} />}
            </button>

            {/* Create - always visible */}
            <button className="ch-btn-create" onClick={onCreateToday}>
              <Plus size={13} />
              Create
            </button>
          </div>
        </div>

        {/* ── Row 2: Date nav + Today + Week/Month toggle ── */}
        <div className="ch-row2">
          <div className="ch-row2-left">
            {/* Prev / Label / Next */}
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button className="ch-btn" onClick={onPrev} title="Previous" style={{ padding: "5px 8px" }}>
                <ChevronLeft size={13} />
              </button>
              <span className="ch-date-label">{primaryLabel}</span>
              <button className="ch-btn" onClick={onNext} title="Next" style={{ padding: "5px 8px" }}>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Today */}
            <button className="ch-btn" onClick={onGoToday}>Today</button>

            {/* Week / Month */}
            <div className="ch-toggle">
              {["week", "month"].map((v) => (
                <button
                  key={v}
                  className="ch-toggle-btn"
                  onClick={() => setViewMode(v)}
                  style={{
                    backgroundColor: viewMode === v ? "rgba(255,255,255,0.2)" : "transparent",
                    borderRight: v === "week" ? "1px solid rgba(255,255,255,0.2)" : "none",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Mobile dropdown menu ── */}
        {moreOpen && (
          <div className="ch-mobile-menu">
            <div className="ch-mobile-menu-row">
              <button
                className="ch-btn"
                onClick={handleSportsToggle}
                style={{
                  backgroundColor: sportsOpen || selectedSports.length > 0
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                <Filter size={12} />
                Sports
                {selectedSports.length > 0 && (
                  <span style={{ backgroundColor: "rgba(255,255,255,0.25)", padding: "1px 5px", fontSize: 10, fontWeight: 900 }}>
                    {selectedSports.length}
                  </span>
                )}
              </button>
              <button className="ch-btn" onClick={() => { onOpenSeasonCalendar?.(); setMoreOpen(false); }}>
                <CalendarDays size={12} />
                Season Dates
              </button>
              <button className="ch-btn" onClick={() => { onOpenCompliance?.(); setMoreOpen(false); }}>
                <ShieldCheck size={12} />
                Compliance
              </button>
            </div>
          </div>
        )}

        {/* ── Sport chips panel ── */}
        {sportsOpen && (
          <div className="ch-sports-panel">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <SportChips
                sportsAll={SPORTS_ALL}
                selectedSports={selectedSports}
                setSelectedSports={setSelectedSports}
                onOpenMore={onOpenMoreSports}
                darkMode
              />
              {selectedSports.length > 0 && (
                <button className="ch-btn" onClick={() => setSelectedSports([])}>
                  Clear filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Error stripe ── */}
        {err && (
          <div className="ch-error">
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            {err}
          </div>
        )}
      </div>
    </>
  );
}