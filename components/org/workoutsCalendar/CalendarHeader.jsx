// components/org/workoutsCalendar/CalendarHeader.jsx
"use client";

import { useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight,
  RefreshCcw, Plus, LayoutDashboard, Filter,
  AlertTriangle, ShieldCheck,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import SportChips from "./SportChips";

// ─── Responsive CSS ───────────────────────────────────────────────────────────
const HEADER_CSS = `
  .ch-shell { background-color: var(--ch-brand); }

  /* ── Top bar ── */
  .ch-top {
    padding: 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  @media (min-width: 700px) {
    .ch-top {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      gap: 12px;
    }
  }

  /* ── Left: title + date nav ── */
  .ch-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── Right: action buttons ── */
  .ch-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* ── Ghost button base ── */
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
  .ch-btn:hover { background-color: rgba(255,255,255,0.18); }
  .ch-btn:disabled { opacity: 0.5; cursor: default; }

  /* ── Primary create button ── */
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

  /* ── Date nav label ── */
  .ch-date-label {
    font-size: 13px;
    font-weight: 900;
    color: #fff;
    padding: 4px 10px;
    min-width: 130px;
    text-align: center;
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
    padding: 5px 12px;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #fff;
    border: none;
    cursor: pointer;
    transition: background-color 0.12s;
  }

  /* ── Sport chips panel ── */
  .ch-sports-panel {
    padding: 10px 16px;
    border-top: 1px solid rgba(255,255,255,0.12);
    background-color: rgba(0,0,0,0.12);
  }
  @media (min-width: 700px) {
    .ch-sports-panel { padding: 10px 20px; }
  }

  /* ── Error stripe ── */
  .ch-error {
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    background-color: rgba(200,16,46,0.25);
    border-top: 1px solid rgba(200,16,46,0.3);
    color: #FFC8C8;
  }
`;

export default function CalendarHeader({
  viewMode, setViewMode,
  weekLabel, monthLabel,
  selectedSports, setSelectedSports, SPORTS_ALL, onOpenMoreSports,
  err, loading,
  rangeSummary,
  onGoDashboard, onRefresh, onGoToday, onPrev, onNext, onCreateToday,
  onOpenCompliance, onOpenSeasonCalendar,
}) {
  const [sportsOpen, setSportsOpen] = useState(false);
  const primaryLabel = viewMode === "week" ? weekLabel : monthLabel;

  return (
    <>
      <style>{HEADER_CSS}</style>
      <div
        className="ch-shell"
        style={{ "--ch-brand": DS.brand }}
      >
        <div className="ch-top">

          {/* ── Left: identity + date nav ── */}
          <div className="ch-left">

            {/* Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <CalendarDays size={15} color="rgba(255,255,255,0.75)" />
              <span style={{
                fontSize: 13, fontWeight: 900, color: "#fff",
                letterSpacing: "0.08em", textTransform: "uppercase",
                fontFamily: "'Arial Narrow', Arial, sans-serif",
              }}>
                Workouts Calendar
              </span>
            </div>

            {/* Date nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button className="ch-btn" onClick={onPrev} title="Previous">
                <ChevronLeft size={13} />
              </button>
              <span className="ch-date-label">{primaryLabel}</span>
              <button className="ch-btn" onClick={onNext} title="Next">
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Today */}
            <button className="ch-btn" onClick={onGoToday}>Today</button>

            {/* Week / Month toggle */}
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

          {/* ── Right: actions ── */}
          <div className="ch-right">

            <button
              className="ch-btn"
              onClick={() => setSportsOpen((v) => !v)}
              style={{
                backgroundColor: sportsOpen || selectedSports.length > 0
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.08)",
              }}
            >
              <Filter size={12} />
              Sports
              {selectedSports.length > 0 && (
                <span style={{
                  backgroundColor: "rgba(255,255,255,0.25)",
                  padding: "1px 5px", fontSize: 10, fontWeight: 900,
                }}>
                  {selectedSports.length}
                </span>
              )}
            </button>

            <button className="ch-btn" onClick={onRefresh} disabled={loading}>
              <RefreshCcw size={12} style={{ animation: loading ? "ch-spin 1s linear infinite" : "none" }} />
              Refresh
            </button>

            <button className="ch-btn" onClick={onGoDashboard}>
              <LayoutDashboard size={12} />
              Dashboard
            </button>

            <button
              className="ch-btn"
              onClick={(e) => { e.stopPropagation(); onOpenSeasonCalendar?.(); }}
            >
              <CalendarDays size={12} />
              Season Dates
            </button>

            <button
              className="ch-btn"
              onClick={(e) => { e.stopPropagation(); onOpenCompliance?.(); }}
            >
              <ShieldCheck size={12} />
              Compliance
            </button>

            <button className="ch-btn-create" onClick={onCreateToday}>
              <Plus size={13} />
              Create
            </button>
          </div>
        </div>

        {/* ── Sport chips ── */}
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

        <style>{`@keyframes ch-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}