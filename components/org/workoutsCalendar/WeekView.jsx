// components/org/workoutsCalendar/WeekView.jsx
"use client";

import { useMemo } from "react";
import { ArrowRight, Plus, CheckCircle2 } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import WorkoutCard from "./WorkoutCard";
import { isSameISO, isoToDate } from "@/lib/org/workoutsCalendar/date";

function sumCounts(list) {
  const ws = Array.isArray(list) ? list : [];
  let wc = ws.length, ac = 0, ic = 0;
  ws.forEach((w) => { ac += Number(w?.athleteCount || 0); ic += Number(w?.itemCount || 0); });
  return { workoutsCount: wc, athleteCount: ac, itemCount: ic };
}

function safeLabels(iso) {
  const d  = isoToDate(iso);
  const ok = d instanceof Date && !Number.isNaN(d.getTime());
  const dt = ok ? d : new Date();
  return {
    labelLong:    dt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    labelWeekday: dt.toLocaleString(undefined, { weekday: "short" }),
    labelDate:    dt.toLocaleString(undefined, { month: "short", day: "numeric" }),
  };
}

function SmBtn({ children, onClick, disabled, variant = "secondary", style = {} }) {
  const base = {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           "4px",
    padding:       "5px 10px",
    fontSize:      "11px",
    fontWeight:    900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    cursor:        disabled ? "not-allowed" : "pointer",
    opacity:       disabled ? 0.4 : 1,
    transition:    "background-color 0.12s",
    border:        `1px solid ${variant === "primary" ? DS.brand : DS.border}`,
    backgroundColor: variant === "primary" ? DS.brand : DS.cardBg,
    color:         variant === "primary" ? "#fff" : DS.labelText,
    ...style,
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={base}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === "primary") { e.currentTarget.style.backgroundColor = DS.brandLight; }
        else { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = variant === "primary" ? DS.brand : DS.cardBg;
        e.currentTarget.style.borderColor      = variant === "primary" ? DS.brand : DS.border;
        e.currentTarget.style.color            = variant === "primary" ? "#fff" : DS.labelText;
      }}
    >
      {children}
    </button>
  );
}

export default function WeekView({ weekDays = [], todayISO = "", loading = false, workoutsByDate = {}, onOpenDay, onCreateForDay }) {
  const DESKTOP_MAX = 5;

  const days = useMemo(() => {
    const byDate = workoutsByDate && typeof workoutsByDate === "object" ? workoutsByDate : {};
    return (Array.isArray(weekDays) ? weekDays : []).map((iso) => ({
      iso,
      list:    Array.isArray(byDate?.[iso]) ? byDate[iso] : [],
      isToday: isSameISO(iso, todayISO),
      ...safeLabels(iso),
    }));
  }, [weekDays, workoutsByDate, todayISO]);

  /* ── Mobile ── */
  const renderMobile = () => (
    <div className="lg:hidden space-y-3">
      {days.map(({ iso, list, isToday, labelLong }) => {
        const counts = sumCounts(list);
        return (
          <div
            key={iso}
            style={{
              backgroundColor: DS.cardBg,
              border:          `1px solid ${isToday ? DS.safe : DS.border}`,
              borderLeft:      `3px solid ${isToday ? DS.safe : DS.border}`,
            }}
          >
            {/* Day header */}
            <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-black truncate" style={{ color: DS.bodyText }}>{labelLong}</p>
                {isToday && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold" style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}>
                    <CheckCircle2 className="w-3 h-3" /> Today
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-bold tabular-nums px-1.5 py-0.5" style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
                  {counts.workoutsCount}
                </span>
                <SmBtn onClick={() => onOpenDay?.(iso)} disabled={loading}>
                  Open <ArrowRight className="w-3 h-3" />
                </SmBtn>
                <SmBtn onClick={() => !loading && onCreateForDay?.(iso)} disabled={loading} variant="primary">
                  <Plus className="w-3 h-3" />
                </SmBtn>
              </div>
            </div>

            {/* Workout list */}
            <div className="p-3 space-y-2">
              {loading ? (
                <p className="text-xs py-2" style={{ color: DS.dimText }}>Loading…</p>
              ) : list.length === 0 ? (
                <div className="flex items-center justify-between py-2 px-1">
                  <p className="text-xs" style={{ color: DS.dimText }}>No workouts scheduled.</p>
                  <button
                    type="button"
                    className="text-xs font-black uppercase tracking-wide hover:underline"
                    style={{ color: DS.brand }}
                    onClick={() => onCreateForDay?.(iso)}
                  >
                    + Create
                  </button>
                </div>
              ) : (
                <>
                  {list.slice(0, 4).map((w, idx) => (
                    <WorkoutCard key={w?.id || `${iso}-${idx}`} w={w} onOpen={() => onOpenDay?.(iso)} compact />
                  ))}
                  {list.length > 4 && (
                    <button type="button" className="text-xs font-bold hover:underline" style={{ color: DS.brand }} onClick={() => onOpenDay?.(iso)}>
                      View all ({list.length}) →
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ── Desktop ── */
  const renderDesktop = () => (
    <div className="hidden lg:block">
      <div className="grid grid-cols-7 gap-px" style={{ backgroundColor: DS.border }}>
        {days.map(({ iso, list, isToday, labelWeekday, labelDate }) => {
          const counts     = sumCounts(list);
          const desktopList = list.slice(0, DESKTOP_MAX);
          const hasMore    = list.length > DESKTOP_MAX;

          return (
            <div
              key={iso}
              className="flex flex-col"
              style={{
                backgroundColor: DS.cardBg,
                minHeight:       "300px",
                borderTop:       isToday ? `2px solid ${DS.safe}` : "none",
              }}
            >
              {/* Column header */}
              <button
                type="button"
                onClick={() => onOpenDay?.(iso)}
                disabled={loading}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors"
                style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: isToday ? DS.safeBg : DS.pageBg }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = isToday ? DS.safeBg : DS.brandBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isToday ? DS.safeBg : DS.pageBg; }}
              >
                <div>
                  <p className="text-xs font-black uppercase tracking-wide" style={{ color: isToday ? DS.safe : DS.bodyText }}>
                    {labelWeekday}
                  </p>
                  <p className="text-xs" style={{ color: DS.dimText }}>{labelDate}</p>
                </div>
                <div className="flex items-center gap-1">
                  {isToday && <CheckCircle2 className="w-3 h-3" style={{ color: DS.safe }} />}
                  {counts.workoutsCount > 0 && (
                    <span className="text-xs font-bold tabular-nums px-1.5" style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
                      {counts.workoutsCount}
                    </span>
                  )}
                </div>
              </button>

              {/* Workout cards */}
              <div className="p-2.5 space-y-2 flex-1 overflow-y-auto">
                {loading ? (
                  <p className="text-xs py-2 px-1" style={{ color: DS.dimText }}>Loading…</p>
                ) : list.length === 0 ? (
                  <p className="text-xs py-2 px-1" style={{ color: DS.dimText }}>No workouts.</p>
                ) : (
                  <>
                    {desktopList.map((w, idx) => (
                      <WorkoutCard key={w?.id || `${iso}-${idx}`} w={w} onOpen={() => onOpenDay?.(iso)} compact />
                    ))}
                    {hasMore && (
                      <button type="button" className="text-xs font-bold hover:underline px-1" style={{ color: DS.brand }} onClick={() => onOpenDay?.(iso)}>
                        +{list.length - DESKTOP_MAX} more
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Column footer — only Create; the entire header is already the Open target */}
              <div
                className="px-3 py-2 flex justify-end"
                style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
              >
                <button
                  type="button"
                  className="text-xs font-black uppercase tracking-wide hover:underline"
                  style={{ color: loading ? DS.dimText : DS.brand }}
                  onClick={() => !loading && onCreateForDay?.(iso)}
                  disabled={loading}
                  title="Create workout for this day"
                >
                  + Create
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {renderMobile()}
      {renderDesktop()}
    </>
  );
}