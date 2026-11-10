// components/org/workoutsCalendar/WeekView.jsx
"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { APP } from "@/components/app/ui";
import WorkoutCard from "./WorkoutCard";
import { isSameISO, isoToDate } from "@/lib/org/workoutsCalendar/date";

const WL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 6;

const WEEK_CSS = `
  .wv { font-family: ${APP.font}; }
  .wv-mobile { display: flex; flex-direction: column; }
  .wv-desktop { display: none; }
  @media (min-width: 700px) {
    .wv-mobile { display: none; }
    .wv-desktop { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  }

  .wv-col { display: flex; flex-direction: column; min-height: 300px; min-width: 0; border-left: 1px solid ${APP.lineSoft}; }
  .wv-col:first-child { border-left: none; }
  .wv-col.is-today { background: rgba(30,58,95,0.025); }
  .wv-head { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; padding: 12px 12px 10px;
    border: none; border-bottom: 1px solid ${APP.lineSoft}; background: transparent; cursor: pointer; text-align: left; }
  .wv-head:hover .wv-num { background: ${APP.lineSoft}; }
  .wv-head:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: -2px; }
  .wv-dow { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: ${APP.muted}; }
  .wv-num { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 34px; padding: 0 6px;
    border-radius: 17px; font-size: 18px; font-weight: 650; color: ${APP.ink}; font-variant-numeric: tabular-nums; }
  .is-today .wv-dow { color: ${APP.brand}; }
  .is-today .wv-num, .is-today .wv-head:hover .wv-num { background: ${APP.brand}; color: #fff; }
  .wv-body { position: relative; flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 8px; }

  /* Empty-day add button: appears on hover with a mouse; always visible (subtle) on touch */
  .wv-add { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; margin-top: auto;
    border: 1px dashed transparent; border-radius: 8px; background: transparent; color: ${APP.faint};
    font: 600 13px/1 ${APP.font}; cursor: pointer; opacity: 0; transition: opacity 0.12s, background 0.12s, color 0.12s, border-color 0.12s; }
  .wv-col:hover .wv-add, .wv-add:focus-visible { opacity: 1; border-color: #CBD5E1; color: ${APP.brand}; }
  .wv-add:hover { background: ${APP.brandTint}; }
  .wv-add:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: 1px; }
  @media (hover: none) { .wv-add { opacity: 1; color: ${APP.muted}; border-color: ${APP.line}; } }
  .wv-more { align-self: flex-start; padding: 2px 4px; border: none; background: none; color: ${APP.brand};
    font: 600 12px/1.4 ${APP.font}; cursor: pointer; }
  .wv-more:hover { text-decoration: underline; }

  .wv-row { border-top: 1px solid ${APP.lineSoft}; }
  .wv-row:first-child { border-top: none; }
  .wv-row.is-today { background: rgba(30,58,95,0.025); }
  .wv-row-head { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 14px; }
  .wv-row-open { flex: 1; display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0; border: none; background: none;
    cursor: pointer; text-align: left; }
  .wv-row-add { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px;
    border: 1px solid ${APP.line}; background: #fff; color: ${APP.brand}; cursor: pointer; flex-shrink: 0; }
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

  const longDate = (d) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <style>{WEEK_CSS}</style>
      <div className="wv" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.15s" }} aria-busy={loading || undefined}>

        {/* Phones: one row per day */}
        <div className="wv-mobile">
          {days.map(({ iso, idx, d, list, isToday }) => (
            <div key={iso} className={`wv-row${isToday ? " is-today" : ""}`}>
              <div className="wv-row-head">
                <button type="button" className="wv-row-open" onClick={() => onOpenDay?.(iso)} disabled={loading} aria-label={`Open ${longDate(d)}`}>
                  <span className="wv-num" style={isToday ? { background: APP.brand, color: "#fff" } : undefined}>{d.getDate()}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 650, color: isToday ? APP.brand : APP.ink }}>
                      {isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "long" })}
                    </span>
                    <span style={{ fontSize: 13, color: APP.muted }}>
                      {list.length ? `${list.length} workout${list.length === 1 ? "" : "s"}` : "No workouts"}
                    </span>
                  </span>
                </button>
                <button type="button" className="wv-row-add" onClick={() => !loading && onCreateForDay?.(iso)} disabled={loading} aria-label={`Add workout on ${longDate(d)}`}>
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
              {list.length > 0 && (
                <div style={{ padding: "0 12px 12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.slice(0, MAX_VISIBLE).map((w, i) => (
                    <WorkoutCard key={w?.id || `${iso}-${i}`} w={w} onOpen={() => onOpenDay?.(iso)} />
                  ))}
                  {list.length > MAX_VISIBLE && (
                    <button type="button" className="wv-more" onClick={() => onOpenDay?.(iso)}>+{list.length - MAX_VISIBLE} more</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Tablets and up: 7-column week */}
        <div className="wv-desktop">
          {days.map(({ iso, idx, d, list, isToday }) => (
            <div key={iso} className={`wv-col${isToday ? " is-today" : ""}`}>
              <button type="button" className="wv-head" onClick={() => onOpenDay?.(iso)} disabled={loading} aria-label={`Open ${longDate(d)}`}>
                <span className="wv-dow">{WL[idx]}</span>
                <span className="wv-num">{d.getDate()}</span>
              </button>
              <div className="wv-body">
                {list.slice(0, MAX_VISIBLE).map((w, i) => (
                  <WorkoutCard key={w?.id || `${iso}-${i}`} w={w} onOpen={() => onOpenDay?.(iso)} compact />
                ))}
                {list.length > MAX_VISIBLE && (
                  <button type="button" className="wv-more" onClick={() => onOpenDay?.(iso)}>+{list.length - MAX_VISIBLE} more</button>
                )}
                <button type="button" className="wv-add" onClick={() => !loading && onCreateForDay?.(iso)} disabled={loading} aria-label={`Add workout on ${longDate(d)}`}>
                  <Plus size={15} aria-hidden="true" /> Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
