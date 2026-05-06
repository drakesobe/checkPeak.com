// components/org/workoutsCalendar/MonthView.jsx
"use client";

import { DS } from "@/components/org/dashboard/DashboardUI";
import { isSameISO, isoToDate, dateToISO } from "@/lib/org/workoutsCalendar/date";

const COND = {
  fontFamily: "'Arial Narrow', Arial, sans-serif",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const WL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({
  monthDays, anchorISO, todayISO, loading,
  workoutsByDate, onOpenDay, onJumpToMonth,
  // weekdayLabels prop accepted but we use the hardcoded WL to match the prototype exactly
}) {
  const anchor  = isoToDate(anchorISO);
  const mi      = anchor.getMonth();
  const yr      = anchor.getFullYear();

  const handleClick = (iso) => {
    if (loading) return;
    const d       = isoToDate(iso);
    const inMonth = d.getMonth() === mi && d.getFullYear() === yr;
    if (!inMonth && typeof onJumpToMonth === "function") {
      onJumpToMonth(dateToISO(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0)));
      return;
    }
    onOpenDay?.(iso);
  };

  return (
    <div>
      {/* Weekday header row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, backgroundColor: DS.border, marginBottom: 1 }}>
        {WL.map((l) => (
          <div
            key={l}
            style={{
              backgroundColor: DS.pageBg,
              padding: "6px",
              textAlign: "center",
              fontSize: 10,
              fontWeight: 900,
              ...COND,
              color: DS.dimText,
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, backgroundColor: DS.border, opacity: loading ? 0.6 : 1 }}>
        {(Array.isArray(monthDays) ? monthDays : []).map((iso) => {
          const d       = isoToDate(iso);
          const inMonth = d.getMonth() === mi && d.getFullYear() === yr;
          const list    = workoutsByDate?.[iso] || [];
          const isToday = isSameISO(iso, todayISO);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleClick(iso)}
              disabled={loading}
              style={{
                backgroundColor: inMonth ? DS.cardBg : "#F8FAFC",
                minHeight: 120,
                textAlign: "left",
                border: "none",
                cursor: loading ? "default" : "pointer",
                borderTop: `3px solid ${isToday ? DS.safe : DS.border}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",     // ← prevents title bleeding out of cell
                minWidth: 0,            // ← allows flex children to shrink
              }}
            >
              <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, overflow: "hidden" }}>
                {/* Date number + workout count */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 900, color: isToday ? DS.safe : inMonth ? DS.bodyText : DS.dimText, flexShrink: 0 }}>
                    {d.getDate()}
                  </p>
                  {list.length > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 900, ...COND,
                      color: DS.brand, backgroundColor: DS.brandBg,
                      border: `1px solid ${DS.brandBorder}`, padding: "1px 5px",
                      flexShrink: 0,
                    }}>
                      {list.length}
                    </span>
                  )}
                </div>

                {/* Workout preview - title hidden on very narrow cells, count badge above handles it */}
                {inMonth && list.length > 0 && (
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, color: DS.bodyText,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      maxWidth: "100%", display: "block",
                    }}>
                      {list[0]?.Title || list[0]?.title}
                    </p>
                    {list.length > 1 && (
                      <p style={{ fontSize: 10, color: DS.dimText }}>+{list.length - 1} more</p>
                    )}
                  </div>
                )}
                {inMonth && list.length === 0 && (
                  <p style={{ fontSize: 10, color: DS.dimText }}>No workouts</p>
                )}
                {!inMonth && (
                  <p style={{ fontSize: 10, color: DS.dimText }}>Tap to jump</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}