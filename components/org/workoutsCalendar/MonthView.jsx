// components/org/workoutsCalendar/MonthView.jsx
"use client";

import { APP } from "@/components/app/ui";
import { isSameISO, isoToDate, dateToISO } from "@/lib/org/workoutsCalendar/date";

const WL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_CSS = `
  .mv { font-family: ${APP.font}; }
  .mv-dow, .mv-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .mv-dow div { padding: 10px 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
    color: ${APP.muted}; text-align: center; border-bottom: 1px solid ${APP.line}; }
  .mv-cell { display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 104px; padding: 8px;
    border: none; border-right: 1px solid ${APP.lineSoft}; border-bottom: 1px solid ${APP.lineSoft};
    background: #fff; text-align: left; cursor: pointer; transition: background 0.12s; }
  .mv-cell:nth-child(7n) { border-right: none; }
  .mv-cell:hover { background: #FAFBFC; }
  .mv-cell:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: -2px; }
  .mv-cell.is-out { background: #FBFCFD; }
  .mv-num { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 5px;
    border-radius: 13px; font-size: 13px; font-weight: 650; color: ${APP.ink}; font-variant-numeric: tabular-nums; }
  .is-out .mv-num { color: ${APP.faint}; font-weight: 500; }
  .is-today .mv-num { background: ${APP.brand}; color: #fff; }
  .mv-chip { display: block; max-width: 100%; padding: 3px 6px; border-radius: 5px; background: ${APP.brandTint}; color: ${APP.brand};
    font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 699px) {
    .mv-cell { min-height: 64px; padding: 6px 4px; align-items: center; }
    .mv-chip, .mv-more { display: none; }
    .mv-dot { display: block !important; }
  }
`;

export default function MonthView({
  monthDays, anchorISO, todayISO, loading,
  workoutsByDate, onOpenDay, onJumpToMonth,
}) {
  const anchor = isoToDate(anchorISO);
  const mi = anchor.getMonth();
  const yr = anchor.getFullYear();

  const handleClick = (iso) => {
    if (loading) return;
    const d = isoToDate(iso);
    const inMonth = d.getMonth() === mi && d.getFullYear() === yr;
    if (!inMonth && typeof onJumpToMonth === "function") {
      onJumpToMonth(dateToISO(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0)));
      return;
    }
    onOpenDay?.(iso);
  };

  return (
    <div className="mv" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.15s" }} aria-busy={loading || undefined}>
      <style>{MONTH_CSS}</style>
      <div className="mv-dow" aria-hidden="true">
        {WL.map((l) => <div key={l}>{l}</div>)}
      </div>
      <div className="mv-grid">
        {(Array.isArray(monthDays) ? monthDays : []).map((iso) => {
          const d = isoToDate(iso);
          const inMonth = d.getMonth() === mi && d.getFullYear() === yr;
          const list = workoutsByDate?.[iso] || [];
          const isToday = isSameISO(iso, todayISO);
          const label = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
          return (
            <button
              key={iso}
              type="button"
              className={`mv-cell${inMonth ? "" : " is-out"}${isToday ? " is-today" : ""}`}
              onClick={() => handleClick(iso)}
              disabled={loading}
              aria-label={`${label}${list.length ? `, ${list.length} workout${list.length === 1 ? "" : "s"}` : ""}${inMonth ? "" : ", go to that month"}`}
            >
              <span className="mv-num">{d.getDate()}</span>
              {inMonth && list.length > 0 && (
                <>
                  <span className="mv-chip">{list[0]?.Title || list[0]?.title || "Workout"}</span>
                  {list.length > 1 && <span className="mv-more" style={{ fontSize: 12, color: APP.muted, paddingLeft: 2 }}>+{list.length - 1} more</span>}
                  <span className="mv-dot" aria-hidden="true" style={{ display: "none", width: 6, height: 6, borderRadius: "50%", background: APP.brand }} />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
