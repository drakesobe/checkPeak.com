// components/athlete-today/TodayStrip.jsx
//
// Today's schedule strip - dark, actionable, contextual.
//
// Changes from previous version:
//  • Dark visual system matching DayPlannerSheet (no more white card mismatch)
//  • Meal blocks only render when hasPlan=true - no fake default meals
//  • Meal rows show live completion state (checkmark when done)
//  • Timeline bar has a "now" indicator line for today's date
//  • Current event gets a highlighted "RIGHT NOW" badge in the list
//  • Class rows remain tappable (edit schedule)
//  • All utilities imported from lib/athlete-today/utils
import { useMemo, useState, useEffect } from "react";
import { Plus, Calendar, Check } from "lucide-react";
import {
  MEAL_DEFAULTS,
  MEAL_LABELS,
  classMatchesDate,
  dayPattern,
  formatTime,
} from "@/lib/athlete-today/utils";

// ─── DESIGN TOKENS - light theme, matches today.jsx card aesthetic ────────────
const T = {
  bg:       "#FFFFFF",
  bgSub:    "#F9FAFB",   // row hover / timeline track
  bgBadge:  "#F3F4F6",   // ghost pill backgrounds
  border:   "#F3F4F6",   // gray-100 - same as other cards
  borderMid:"#E5E7EB",   // gray-200 - dividers
  textPri:  "#111827",   // gray-900
  textSec:  "#374151",   // gray-700
  textMuted:"#6B7280",   // gray-500
  textFaint:"#9CA3AF",   // gray-400
  textGhost:"#D1D5DB",   // gray-300 - hour labels
};

// Event accent colours - kept vivid so they pop on white
const COL = {
  workout: "#DA3633",
  class:   "#D97706",   // amber-600 - readable on white (was #E3B341 which washed out)
  meal:    "#EA580C",   // orange-600
};

// Timeline bar: 6 AM → 11 PM
const BAR_START = 6 * 60;
const BAR_END   = 23 * 60;
const BAR_SPAN  = BAR_END - BAR_START;

function barPct(min) {
  return Math.max(0, Math.min(100, (min - BAR_START) / BAR_SPAN * 100));
}

function cx(...xs) { return xs.filter(Boolean).join(" "); }

function parseTimeToMinutes(str) {
  if (!str) return null;
  const s = String(str).trim(), isPM = /pm/i.test(s);
  const parts = s.replace(/[^0-9:]/g, "").split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return null;
  if (isPM && h < 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return h * 60 + m;
}

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────

/** Thin line + dot marking current time on the timeline bar. */
function NowMarker({ nowMin }) {
  if (nowMin === null) return null;
  const pct = barPct(nowMin);
  if (pct <= 0 || pct >= 100) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left:     `${pct}%`,
        top:      -3,
        bottom:   -3,
        width:    1.5,
        background: "#6B7280",
        zIndex:   2,
        pointerEvents: "none",
      }}
    >
      <div style={{
        position:  "absolute",
        top:       -3,
        left:      "50%",
        transform: "translateX(-50%)",
        width:     7,
        height:    7,
        borderRadius: "50%",
        background: "#374151",
        boxShadow:  "0 0 0 2px rgba(55,65,81,0.15)",
      }} />
    </div>
  );
}

/** One row in the event list. */
function EventRow({ ev, isNow, isClass, onClick, nutritionCompletion }) {
  const color    = COL[ev.type] || T.textMuted;
  const mealComp = ev.type === "meal" ? nutritionCompletion?.[ev.mealKey] : null;
  const mealDone = mealComp?.mealDone && mealComp?.hydrationDone;

  return (
    <button
      type="button"
      onClick={() => { if (isClass || ev.type === "meal") onClick?.(); }}
      style={{
        width:       "100%",
        display:     "flex",
        alignItems:  "center",
        gap:         10,
        padding:     "10px 14px",
        background:  isNow ? "#FAFAFA" : "transparent",
        border:      "none",
        borderBottom:`1px solid ${T.border}`,
        cursor:      isClass ? "pointer" : "default",
        textAlign:   "left",
        transition:  "background 0.15s",
      }}
      onMouseEnter={e => { if (isClass) e.currentTarget.style.background = "#F9FAFB"; }}
      onMouseLeave={e => { e.currentTarget.style.background = isNow ? "#FAFAFA" : "transparent"; }}
    >
      {/* Left accent pip */}
      <div style={{
        width:        3,
        height:       28,
        borderRadius: 2,
        background:   mealDone ? "#10B981" : color,
        flexShrink:   0,
        opacity:      mealDone ? 0.5 : 1,
      }} />

      {/* Time */}
      <span style={{
        fontFamily:         "var(--font-mono, monospace)",
        fontSize:           11,
        fontWeight:         500,
        color:              T.textFaint,
        width:              52,
        flexShrink:         0,
        fontVariantNumeric: "tabular-nums",
      }}>
        {formatTime(ev.startMinutes)}
      </span>

      {/* Label */}
      <span style={{
        flex:           1,
        fontSize:       13,
        fontWeight:     600,
        color:          mealDone ? T.textFaint : T.textPri,
        overflow:       "hidden",
        textOverflow:   "ellipsis",
        whiteSpace:     "nowrap",
        textDecoration: mealDone ? "line-through" : "none",
      }}>
        {ev.label}
      </span>

      {/* Right: completion check or badge */}
      {mealDone ? (
        <div style={{
          width:          18,
          height:         18,
          borderRadius:   "50%",
          background:     "rgba(16,185,129,0.1)",
          border:         "1px solid rgba(16,185,129,0.2)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          <Check size={10} color="#10B981" />
        </div>
      ) : (
        <>
          {isNow && (
            <span style={{
              fontSize:      9,
              fontWeight:    800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color:         color,
              background:    `${color}12`,
              border:        `1px solid ${color}25`,
              padding:       "2px 6px",
              borderRadius:  4,
              flexShrink:    0,
            }}>
              Now
            </span>
          )}
          {!isNow && ev.badge && (
            <span style={{
              fontSize:   10,
              fontWeight: 700,
              color:      T.textFaint,
              background: T.bgBadge,
              border:     `1px solid ${T.borderMid}`,
              padding:    "2px 7px",
              borderRadius: 4,
              flexShrink: 0,
            }}>
              {ev.badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TodayStrip({
  selectedDate,
  classSchedules,
  mealBlocks,
  dailyWorkout,
  hasPlan,              // NEW: only render meal rows when the athlete has a plan
  nutritionCompletion,  // NEW: { breakfast: { mealDone, hydrationDone }, ... }
  workoutProgress,      // NEW: { done, total } from workout hook
  onPlanDay,
  onAddClass,
  onEditClass,
}) {
  // Live "now" minutes - updates every minute, only for today's date
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  const isToday = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return selectedDate === todayISO;
  }, [selectedDate]);

  useEffect(() => {
    if (!isToday) { setNowMin(null); return; }
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // Build sorted event list
  const events = useMemo(() => {
    const out = [];

    // Coach-assigned workout - anchor at 9am as a planning reference
    if (dailyWorkout) {
      const wDone  = workoutProgress?.done  ?? 0;
      const wTotal = workoutProgress?.total ?? 0;
      const scheduledMin = dailyWorkout.ScheduledTime
        ? parseTimeToMinutes(dailyWorkout.ScheduledTime)
        : null;
      out.push({
        id:              "coach_workout",
        type:            "workout",
        label:           dailyWorkout.Title || "Workout",
        badge:           wTotal > 0 ? `${wDone}/${wTotal}` : "Coach",
        startMinutes:    scheduledMin ?? 0,
        durationMinutes: 90,
        selfSchedule:    scheduledMin === null,
      });
    }

    // Recurring classes for this date
    (classSchedules || []).forEach(cls => {
      if (!classMatchesDate(cls, selectedDate)) return;
      out.push({
        id:              `cls_${cls.id}`,
        type:            "class",
        label:           cls.title,
        badge:           dayPattern(cls.days),
        startMinutes:    cls.startMinutes,
        durationMinutes: cls.durationMinutes,
        scheduleId:      cls.id,
      });
    });

    // Meal blocks - ONLY when athlete has an active nutrition plan.
    // Previously always rendered, creating false signal for athletes with no plan.
    if (hasPlan) {
      Object.entries(MEAL_DEFAULTS).forEach(([key, def]) => {
        out.push({
          id:              `meal_${key}`,
          type:            "meal",
          mealKey:         key,
          label:           mealBlocks?.[key]?.name || MEAL_LABELS[key],
          startMinutes:    def.startMinutes,
          durationMinutes: def.durationMinutes,
        });
      });
    }

    return out.sort((a, b) => a.startMinutes - b.startMinutes);
  }, [selectedDate, classSchedules, mealBlocks, dailyWorkout, hasPlan, workoutProgress]);

  // Determine which event (if any) is happening right now
  const currentEventId = useMemo(() => {
    if (nowMin === null || !isToday) return null;
    const ev = events.find(e =>
      nowMin >= e.startMinutes && nowMin < e.startMinutes + (e.durationMinutes || 60)
    );
    return ev?.id ?? null;
  }, [events, nowMin, isToday]);

  // Upcoming event (next one starting within the next 90 minutes)
  const upcomingEvent = useMemo(() => {
    if (nowMin === null || !isToday || currentEventId) return null;
    return events.find(e => e.startMinutes > nowMin && e.startMinutes - nowMin <= 90) ?? null;
  }, [events, nowMin, isToday, currentEventId]);

  const classCount = events.filter(e => e.type === "class").length;

  return (
    <div style={{
      background:   T.bg,
      borderRadius: 16,
      overflow:     "hidden",
      border:       `1px solid ${T.border}`,
      boxShadow:    "0 1px 3px rgba(0,0,0,0.06)",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "12px 14px",
        borderBottom:   `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize:      10,
            fontWeight:    800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color:         T.textFaint,
          }}>
            Schedule
          </span>
          {classCount > 0 && (
            <span style={{
              fontSize:   11,
              fontWeight: 700,
              color:      COL.class,
              background: `${COL.class}12`,
              border:     `1px solid ${COL.class}25`,
              padding:    "1px 8px",
              borderRadius: 20,
            }}>
              {classCount} {classCount === 1 ? "class" : "classes"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={onAddClass}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        4,
              fontSize:   12,
              fontWeight: 600,
              color:      COL.class,
              background: "none",
              border:     "none",
              cursor:     "pointer",
              padding:    0,
            }}
          >
            <Plus size={13} />
            Add class
          </button>
          <button
            onClick={onPlanDay}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        4,
              fontSize:   12,
              fontWeight: 600,
              color:      T.textMuted,
              background: "none",
              border:     "none",
              cursor:     "pointer",
              padding:    0,
            }}
          >
            <Calendar size={13} />
            Plan day
          </button>
        </div>
      </div>

      {/* ── TIMELINE BAR ── */}
      <div style={{ padding: "12px 14px 4px" }}>
        <div style={{
          position:     "relative",
          height:       10,
          background:   T.bgSub,
          borderRadius: 6,
          overflow:     "visible",
          border:       `1px solid ${T.border}`,
        }}>
          {events.map(ev => {
            const left  = barPct(ev.startMinutes);
            const right = barPct(ev.startMinutes + (ev.durationMinutes || 60));
            const w     = Math.max(right - left, 1.5);
            if (left >= 100) return null;
            return (
              <div
                key={ev.id}
                title={`${ev.label} · ${formatTime(ev.startMinutes)}`}
                style={{
                  position:     "absolute",
                  top:          0,
                  height:       "100%",
                  left:         `${left}%`,
                  width:        `${w}%`,
                  background:   COL[ev.type] || T.textMuted,
                  borderRadius: 4,
                  opacity:      ev.id === currentEventId ? 0.9 : 0.4,
                  transition:   "opacity 0.2s",
                }}
              />
            );
          })}
          {isToday && <NowMarker nowMin={nowMin} />}
        </div>

        {/* Hour labels */}
        <div style={{ position: "relative", height: 18, marginTop: 2 }}>
          {[6, 9, 12, 15, 18, 21].map(h => (
            <span
              key={h}
              style={{
                position:   "absolute",
                left:       `${barPct(h * 60)}%`,
                top:        3,
                transform:  "translateX(-50%)",
                fontSize:   9,
                fontWeight: 500,
                color:      T.textGhost,
                userSelect: "none",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
            </span>
          ))}
        </div>
      </div>

      {/* ── UPCOMING NUDGE ── */}
      {upcomingEvent && (
        <div style={{
          margin:     "0 10px 4px",
          padding:    "8px 12px",
          background: `${COL[upcomingEvent.type] || T.textMuted}08`,
          border:     `1px solid ${COL[upcomingEvent.type] || T.textMuted}20`,
          borderLeft: `2px solid ${COL[upcomingEvent.type] || T.textMuted}`,
          borderRadius: 8,
          display:    "flex",
          alignItems: "center",
          gap:        10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textFaint, margin: 0 }}>
              Up next · in {upcomingEvent.startMinutes - nowMin}m
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.textSec, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {upcomingEvent.label}
            </p>
          </div>
          <span style={{ fontSize: 10, color: T.textFaint, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {formatTime(upcomingEvent.startMinutes)}
          </span>
        </div>
      )}

      {/* ── EVENT LIST ── */}
      {events.length === 0 ? (
        <div style={{ padding: "24px 14px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: T.textFaint, margin: "0 0 8px" }}>
            Nothing scheduled yet
          </p>
          <button
            onClick={onAddClass}
            style={{
              fontSize:   12,
              fontWeight: 600,
              color:      COL.class,
              background: "none",
              border:     "none",
              cursor:     "pointer",
              padding:    0,
            }}
          >
            Set up your class schedule →
          </button>
        </div>
      ) : (
        <div>
          {events.map(ev => {
            const isClass = ev.type === "class" && ev.scheduleId;
            const isNow   = ev.id === currentEventId;
            return (
              <EventRow
                key={ev.id}
                ev={ev}
                isNow={isNow}
                isClass={isClass}
                nutritionCompletion={nutritionCompletion}
                onClick={() => {
                  if (!isClass) return;
                  const cls = classSchedules.find(c => c.id === ev.scheduleId);
                  if (cls) onEditClass(cls);
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{
        padding:    "10px 14px",
        borderTop:  `1px solid ${T.border}`,
      }}>
        <button
          onClick={onPlanDay}
          style={{
            width:          "100%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            6,
            fontSize:       11,
            fontWeight:     600,
            color:          T.textFaint,
            background:     "none",
            border:         "none",
            cursor:         "pointer",
            padding:        "4px 0",
            transition:     "color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = T.textMuted; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.textFaint; }}
        >
          <Calendar size={12} />
          Open full day planner
        </button>
      </div>
    </div>
  );
}