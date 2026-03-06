// components/org/workoutsCalendar/MonthView.jsx
"use client";

import { DS } from "@/components/org/dashboard/DashboardUI";
import { isSameISO, isoToDate, dateToISO } from "@/lib/org/workoutsCalendar/date";

function sumCounts(list) {
  const ws = Array.isArray(list) ? list : [];
  let wc = ws.length, ac = 0, ic = 0;
  ws.forEach((w) => { ac += Number(w?.athleteCount || 0); ic += Number(w?.itemCount || 0); });
  return { workoutsCount: wc, athleteCount: ac, itemCount: ic };
}

export default function MonthView({
  monthDays, anchorISO, todayISO, loading,
  workoutsByDate, weekdayLabels, onOpenDay, onJumpToMonth,
}) {
  const a          = isoToDate(anchorISO);
  const monthIndex = a.getMonth();
  const year       = a.getFullYear();

  const handleDayClick = (iso) => {
    const d       = isoToDate(iso);
    const inMonth = d.getMonth() === monthIndex && d.getFullYear() === year;
    if (!inMonth && typeof onJumpToMonth === "function") {
      onJumpToMonth(dateToISO(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0)));
      return;
    }
    onOpenDay?.(iso);
  };

  return (
    <div className="w-full">
      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-px mb-px" style={{ backgroundColor: DS.border }}>
        {(weekdayLabels || []).map((lbl) => (
          <div
            key={lbl}
            className="px-2 py-2 text-center text-xs font-black uppercase tracking-wider"
            style={{ backgroundColor: DS.pageBg, color: DS.dimText }}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-px" style={{ backgroundColor: DS.border }}>
        {(Array.isArray(monthDays) ? monthDays : []).map((iso) => {
          const d       = isoToDate(iso);
          const inMonth = d.getMonth() === monthIndex && d.getFullYear() === year;
          const list    = workoutsByDate?.[iso] || [];
          const isToday = isSameISO(iso, todayISO);
          const counts  = sumCounts(list);
          const hasWork = counts.workoutsCount > 0;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(iso)}
              disabled={loading}
              className="text-left flex flex-col justify-between transition-colors"
              style={{
                backgroundColor: inMonth ? DS.cardBg : DS.pageBg,
                minHeight:       "88px",
                padding:         "8px 10px",
                outline:         "none",
                borderTop:       isToday ? `2px solid ${DS.safe}` : "none",
                opacity:         loading ? 0.7 : 1,
                cursor:          loading ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (loading) return;
                e.currentTarget.style.backgroundColor = inMonth ? DS.brandBg : DS.pageBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = inMonth ? DS.cardBg : DS.pageBg;
              }}
              title={inMonth ? "Open day" : "Jump to month"}
            >
              {/* Top: date number + workout count */}
              <div className="flex items-start justify-between gap-1">
                <div>
                  <p
                    className="text-xs font-black"
                    style={{ color: isToday ? DS.safe : inMonth ? DS.bodyText : DS.dimText }}
                  >
                    {d.getDate()}
                  </p>
                  {isToday && (
                    <p className="text-xs font-bold" style={{ color: DS.safe }}>Today</p>
                  )}
                </div>
                {hasWork && (
                  <span
                    className="text-xs font-bold tabular-nums px-1.5 py-0.5 shrink-0"
                    style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
                  >
                    {counts.workoutsCount}
                  </span>
                )}
              </div>

              {/* Bottom: workout preview */}
              <div className="mt-1 space-y-0.5">
                {loading ? (
                  <p className="text-xs" style={{ color: DS.dimText }}>…</p>
                ) : !inMonth ? (
                  <p className="text-xs" style={{ color: DS.dimText }}>Tap to jump</p>
                ) : list.length === 0 ? (
                  <p className="text-xs" style={{ color: DS.dimText }}>No workouts</p>
                ) : (
                  <>
                    <p className="text-xs" style={{ color: DS.dimText }}>
                      <span className="font-bold" style={{ color: DS.bodyText }}>{counts.athleteCount}</span> athletes
                    </p>
                    <p className="text-xs truncate" style={{ color: DS.dimText }}>
                      {list[0]?.Title || "Workout"}{list.length > 1 ? ` +${list.length - 1}` : ""}
                    </p>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}