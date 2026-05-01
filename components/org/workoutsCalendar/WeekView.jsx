// components/org/workoutsCalendar/WeekView.jsx
"use client";

import { useMemo } from "react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import WorkoutCard from "./WorkoutCard";
import { isSameISO, isoToDate } from "@/lib/org/workoutsCalendar/date";

const COND = {
  fontFamily: "'Arial Narrow', Arial, sans-serif",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const WL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WEEK_CSS = `
  /* Mobile: stacked list */
  .wv-mobile { display: flex; flex-direction: column; gap: 1px; background-color: var(--wv-border); }
  .wv-desktop { display: none; }

  @media (min-width: 700px) {
    .wv-mobile  { display: none; }
    .wv-desktop {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background-color: var(--wv-border);
    }
  }
`;

export default function WeekView({
  weekDays = [], todayISO = "", loading = false,
  workoutsByDate = {}, onOpenDay, onCreateForDay,
}) {
  const days = useMemo(() => {
    const byDate = workoutsByDate && typeof workoutsByDate === "object" ? workoutsByDate : {};
    return (Array.isArray(weekDays) ? weekDays : []).map((iso, idx) => ({
      iso, idx,
      d:       isoToDate(iso),
      list:    Array.isArray(byDate?.[iso]) ? byDate[iso] : [],
      isToday: isSameISO(iso, todayISO),
    }));
  }, [weekDays, workoutsByDate, todayISO]);

  // ── Mobile: stacked rows ──────────────────────────────────────────────────
  const renderMobile = () => (
    <div className="wv-mobile">
      {days.map(({ iso, idx, d, list, isToday }) => {
        const dateLabel = d.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric" });
        return (
          <div
            key={iso}
            style={{
              backgroundColor: DS.cardBg,
              borderLeft: `3px solid ${isToday ? DS.safe : DS.border}`,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {/* Row header */}
            <button
              type="button"
              onClick={() => onOpenDay?.(iso)}
              disabled={loading}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                backgroundColor: isToday ? "rgba(21,128,61,0.04)" : DS.pageBg,
                border: "none",
                borderBottom: `1px solid ${DS.border}`,
                cursor: loading ? "default" : "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{
                  fontSize: 20, fontWeight: 900, lineHeight: 1,
                  color: isToday ? DS.safe : DS.bodyText,
                }}>
                  {d.getDate()}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, ...COND,
                  color: isToday ? DS.safe : DS.dimText,
                }}>
                  {WL[idx]} · {d.toLocaleString(undefined, { month: "short" })}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {list.length > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 900, ...COND,
                    color: DS.brand, backgroundColor: DS.brandBg,
                    border: `1px solid ${DS.brandBorder}`, padding: "1px 6px",
                  }}>
                    {list.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); !loading && onCreateForDay?.(iso); }}
                  disabled={loading}
                  style={{
                    fontSize: 10, fontWeight: 900, ...COND, color: DS.brand,
                    background: "none", border: `1px solid ${DS.brandBorder}`,
                    padding: "3px 8px", cursor: loading ? "default" : "pointer",
                  }}
                >
                  + Create
                </button>
              </div>
            </button>

            {/* Workout list */}
            {list.length > 0 && (
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {list.slice(0, 5).map((w, i) => (
                  <WorkoutCard key={w?.id || `${iso}-${i}`} w={w} onOpen={() => onOpenDay?.(iso)} compact />
                ))}
                {list.length > 5 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay?.(iso)}
                    style={{
                      fontSize: 10, fontWeight: 900, ...COND, color: DS.brand,
                      background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", padding: "2px 0",
                    }}
                  >
                    +{list.length - 5} more
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Desktop: 7-column grid (prototype style) ──────────────────────────────
  const renderDesktop = () => (
    <div className="wv-desktop">
      {days.map(({ iso, idx, d, list, isToday }) => (
        <div
          key={iso}
          style={{
            backgroundColor: DS.cardBg,
            display: "flex",
            flexDirection: "column",
            minHeight: 320,
            borderTop: `3px solid ${isToday ? DS.safe : DS.border}`,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {/* Column header */}
          <button
            type="button"
            onClick={() => onOpenDay?.(iso)}
            disabled={loading}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 10px 8px",
              backgroundColor: isToday ? "rgba(21,128,61,0.04)" : DS.pageBg,
              border: "none",
              cursor: loading ? "default" : "pointer",
              borderBottom: `1px solid ${DS.border}`,
            }}
          >
            <p style={{ fontSize: 9, fontWeight: 900, ...COND, color: isToday ? DS.safe : DS.dimText, marginBottom: 2 }}>
              {WL[idx]}
            </p>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 4 }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: isToday ? DS.safe : DS.bodyText, lineHeight: 1 }}>
                {d.getDate()}
              </p>
              {list.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 900, ...COND,
                  color: DS.brand, backgroundColor: DS.brandBg,
                  border: `1px solid ${DS.brandBorder}`, padding: "1px 5px",
                }}>
                  {list.length}
                </span>
              )}
            </div>
          </button>

          {/* Workout cards */}
          <div style={{ flex: 1, padding: "8px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
            {loading ? (
              <p style={{ fontSize: 11, color: DS.dimText, padding: "4px 0" }}>Loading…</p>
            ) : list.length === 0 ? (
              <p style={{ fontSize: 11, color: DS.dimText, padding: "4px 0" }}>No workouts</p>
            ) : (
              <>
                {list.slice(0, 6).map((w, i) => (
                  <WorkoutCard key={w?.id || `${iso}-${i}`} w={w} onOpen={() => onOpenDay?.(iso)} compact />
                ))}
                {list.length > 6 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay?.(iso)}
                    style={{
                      fontSize: 10, fontWeight: 900, ...COND, color: DS.brand,
                      background: "none", border: "none", cursor: "pointer",
                      textAlign: "left", padding: "2px 0",
                    }}
                  >
                    +{list.length - 6} more
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "6px 10px", borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
            <button
              type="button"
              onClick={() => !loading && onCreateForDay?.(iso)}
              disabled={loading}
              style={{
                fontSize: 10, fontWeight: 900, ...COND, color: DS.brand,
                background: "none", border: "none", cursor: loading ? "default" : "pointer",
              }}
            >
              + Create
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <style>{WEEK_CSS}</style>
      <div style={{ "--wv-border": DS.border }}>
        {renderMobile()}
        {renderDesktop()}
      </div>
    </>
  );
}