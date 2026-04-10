// pages/athlete/day.jsx
// Replaces /athlete/today
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useAthleteToday } from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion } from "@/hooks/athlete-today/useWorkoutCompletion";
import { useAthleteNutritionToday } from "@/hooks/athlete-today/useAthleteNutritionToday";
import CompleteItemModal from "@/components/athlete-today/CompleteItemModal";
import { ChevronLeft, ChevronRight, Plus, X, Check, RefreshCw } from "lucide-react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:          "#0D1117",
  bgBlock:     "#13181F",
  bgElevated:  "#161B22",
  border:      "#21262D",
  borderMid:   "#30363D",
  textPrimary: "#F0F6FC",
  textSecond:  "#C9D1D9",
  textMuted:   "#8B949E",
  textFaint:   "#6B7280",
  textTiny:    "#30363D",
  red:         "#DA3633",
  redBg:       "#1C0B0B",
  redText:     "#FF7B72",
  blue:        "#1F6FEB",
  blueBg:      "#0D1526",
  blueText:    "#79B8FF",
  green:       "#238636",
  greenBg:     "#0D1F12",
  greenText:   "#3FB950",
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const HOUR_HEIGHT  = 96;
const TOTAL_HEIGHT = HOUR_HEIGHT * 24;
const SNAP_MINUTES = 15;
const MIN_DURATION = 15;
const MIN_BLOCK_PX = 60;
const HOURS        = Array.from({ length: 24 }, (_, i) => i);

const BLOCK_TYPES = {
  workout:  { label: "Workout",  border: "#DA3633", bg: "#1C0B0B", title: "#F0F6FC", meta: "#6B7280" },
  practice: { label: "Practice", border: "#238636", bg: "#0D1F12", title: "#F0F6FC", meta: "#6B7280" },
  class:    { label: "Class",    border: "#E3B341", bg: "#1C1609", title: "#F0F6FC", meta: "#6B7280" },
  training: { label: "Training", border: "#8957E5", bg: "#13091C", title: "#F0F6FC", meta: "#6B7280" },
  meal:     { label: "Meal",     border: "#F0883E", bg: "#1C1009", title: "#F0F6FC", meta: "#6B7280" },
  break:    { label: "Break",    border: "#8B949E", bg: "#13181F", title: "#C9D1D9", meta: "#6B7280" },
};

const MEAL_DEFAULTS = {
  breakfast: { startMinutes: 7 * 60,       durationMinutes: 45 },
  lunch:     { startMinutes: 12 * 60,      durationMinutes: 45 },
  afternoon: { startMinutes: 15 * 60,      durationMinutes: 30 },
  dinner:    { startMinutes: 18 * 60 + 30, durationMinutes: 45 },
};

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner" };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const minutesToY    = (m) => (m / 60) * HOUR_HEIGHT;
const yToMinutes    = (y) => Math.round((y / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES;
const clamp         = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toISODate     = (d) => d.toISOString().split("T")[0];
const isToday       = (d) => toISODate(d) === toISODate(new Date());
const getCurrentMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const safeNum       = (v) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : null; };

function formatHour(h) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function formatTime(m) {
  const h = Math.floor(m / 60) % 24;
  const mn = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(mn).padStart(2, "0")} ${ampm}`;
}
function formatDateShort(d) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const lsKey = (tok, date) => `cp_day:${tok}:${date}`;
const lsClassKey = (tok) => `cp_classes:${tok}`;
function lsGet(k) { try { return typeof window !== "undefined" ? localStorage.getItem(k) : null; } catch { return null; } }
function lsSet(k, v) { try { if (typeof window !== "undefined") localStorage.setItem(k, v); } catch {} }

// Class schedule — days use JS getDay() values: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
// Ordered Mon–Sun for display
const WEEK_DAYS = [
  { idx: 1, short: "Mo", long: "Monday"    },
  { idx: 2, short: "Tu", long: "Tuesday"   },
  { idx: 3, short: "We", long: "Wednesday" },
  { idx: 4, short: "Th", long: "Thursday"  },
  { idx: 5, short: "Fr", long: "Friday"    },
  { idx: 6, short: "Sa", long: "Saturday"  },
  { idx: 0, short: "Su", long: "Sunday"    },
];

const DURATION_PRESETS = [
  { label: "50 min", value: 50  },
  { label: "75 min", value: 75  },
  { label: "90 min", value: 90  },
  { label: "3 hrs",  value: 180 },
];

// "10:00" ↔ minutes
function timeStrToMin(str) {
  if (!str) return 9 * 60;
  const [h, m] = str.split(":").map(Number);
  return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
}
function minToTimeStr(min) {
  const h = Math.floor((min ?? 540) / 60) % 24;
  const m = (min ?? 540) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Does a class schedule appear on a given date?
function classMatchesDate(cls, dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay(); // 0–6
  if (!Array.isArray(cls.days) || !cls.days.includes(dow)) return false;
  if (cls.startDate && dateStr < cls.startDate) return false;
  if (cls.endDate   && dateStr > cls.endDate)   return false;
  return true;
}

// Build synthetic event objects from class schedules for a given date
function classesToDayEvents(schedules, dateStr) {
  return (schedules || [])
    .filter(cls => classMatchesDate(cls, dateStr))
    .map(cls => ({
      id:              `cls_${cls.id}_${dateStr}`,
      scheduleId:      cls.id,
      source:          "class_schedule",
      type:            "class",
      title:           cls.title,
      startMinutes:    cls.startMinutes,
      durationMinutes: cls.durationMinutes,
      notes:           cls.notes || "",
    }));
}

function makeEmptyCompletion() {
  return { breakfast: { mealDone: false, hydrationDone: false }, lunch: { mealDone: false, hydrationDone: false }, afternoon: { mealDone: false, hydrationDone: false }, dinner: { mealDone: false, hydrationDone: false } };
}
function normalizeCompletion(raw) {
  const base = makeEmptyCompletion();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    const row = (raw[k] && typeof raw[k] === "object") ? raw[k] : {};
    out[k] = { mealDone: Boolean(row.mealDone), hydrationDone: Boolean(row.hydrationDone) };
  }
  return out;
}
function computeNutritionCounts(comp) {
  let done = 0, total = 0;
  for (const k of Object.keys(makeEmptyCompletion())) {
    total += 2;
    if (comp?.[k]?.mealDone)      done++;
    if (comp?.[k]?.hydrationDone) done++;
  }
  return { done, total };
}
function buildNutritionDefaults(mealBlocks) {
  return Object.entries(MEAL_DEFAULTS).map(([mealKey, defaults]) => ({
    id: `nutrition_${mealKey}`, source: "nutrition", mealKey,
    title: mealBlocks?.[mealKey]?.name || MEAL_LABELS[mealKey] || mealKey,
    type: "meal", ...defaults,
  }));
}

// ─── DRAG HOOK ────────────────────────────────────────────────────────────────
function usePointerDrag({ gridRef, events, setEvents }) {
  const dragRef   = useRef(null);
  const resizeRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);

  const getY = useCallback((clientY) => {
    if (!gridRef.current) return 0;
    const r = gridRef.current.getBoundingClientRect();
    return clientY - r.top + gridRef.current.scrollTop;
  }, [gridRef]);

  const startDrag = useCallback((e, id) => {
    if (e.type === "mousedown") e.preventDefault();
    const ev = events.find(x => x.id === id);
    if (!ev) return;
    const y = getY(e.clientY ?? e.touches?.[0]?.clientY ?? 0);
    dragRef.current = { id, offsetMinutes: yToMinutes(y) - ev.startMinutes };
    setDragging(id);
  }, [events, getY]);

  const startResize = useCallback((e, id) => {
    if (e.type === "mousedown") e.preventDefault();
    resizeRef.current = { id };
    setResizing(id);
  }, []);

  useEffect(() => {
    const move = (e) => {
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const y = getY(clientY);
      if (dragRef.current) {
        const { id, offsetMinutes } = dragRef.current;
        const ev = events.find(x => x.id === id);
        if (!ev) return;
        const newStart = clamp(Math.round((yToMinutes(y) - offsetMinutes) / SNAP_MINUTES) * SNAP_MINUTES, 0, 24 * 60 - ev.durationMinutes);
        setEvents(prev => prev.map(x => x.id === id ? { ...x, startMinutes: newStart } : x));
      }
      if (resizeRef.current) {
        const { id } = resizeRef.current;
        const ev = events.find(x => x.id === id);
        if (!ev) return;
        const endMin = clamp(Math.round(yToMinutes(y) / SNAP_MINUTES) * SNAP_MINUTES, ev.startMinutes + MIN_DURATION, 24 * 60);
        setEvents(prev => prev.map(x => x.id === id ? { ...x, durationMinutes: endMin - x.startMinutes } : x));
      }
    };
    const up = () => { dragRef.current = null; resizeRef.current = null; setDragging(null); setResizing(null); };
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [events, getY, setEvents]);

  return { dragging, resizing, startDrag, startResize };
}

// ─── PROGRESS RING ────────────────────────────────────────────────────────────
function ProgressRing({ done, total, size = 34, stroke = 3 }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const allDone = total > 0 && done >= total;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={allDone ? T.green : T.greenText}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {allDone
          ? <span style={{ fontSize: 10, color: T.greenText, fontWeight: 700 }}>✓</span>
          : <span style={{ fontSize: 9, fontWeight: 700, color: T.textPrimary, fontVariantNumeric: "tabular-nums" }}>{done}</span>
        }
      </div>
    </div>
  );
}

// ─── PROGRESS STRIP ───────────────────────────────────────────────────────────
function ProgressStrip({ workoutDone, workoutTotal, nutritionDone, nutritionTotal }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[
        { label: "Workout",   done: workoutDone,    total: workoutTotal,    dot: T.red,   val: T.redText   },
        { label: "Nutrition", done: nutritionDone,   total: nutritionTotal,  dot: T.green, val: T.greenText },
      ].map(({ label, done, total, dot, val }) => (
        <div key={label} style={{ flex: 1, background: T.bgElevated, padding: "6px 10px", display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 5, height: 5, background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 500 }}>{label}</span>
          {total > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: val, marginLeft: "auto", fontVariantNumeric: "tabular-nums", opacity: done >= total ? 1 : 0.8 }}>
              {done}/{total}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── RESIZE HANDLE ────────────────────────────────────────────────────────────
function ResizeHandle({ color, onMouseDown, onTouchStart }) {
  return (
    <div
      data-resize="true"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 16,
        cursor: "s-resize",
        background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ width: 24, height: 2, background: color, opacity: 0.5, borderRadius: 1 }} />
    </div>
  );
}

// ─── SAVE DOT ─────────────────────────────────────────────────────────────────
function SaveDot({ status }) {
  if (!status) return null;
  const color = { saving: T.textFaint, saved: T.greenText, error: T.red }[status] || T.textFaint;
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, transition: "background 0.3s", flexShrink: 0 }} />;
}

// ─── CLASS SCHEDULE MODAL ─────────────────────────────────────────────────────
// Used for both creating and editing a recurring class.
// schedule = existing class object (edit) or null (create)
function ClassScheduleModal({ schedule, defaultStartMinutes, onSave, onDelete, onClose }) {
  const [title,     setTitle]     = useState(schedule?.title            || "");
  const [days,      setDays]      = useState(schedule?.days             || []);
  const [startMin,  setStartMin]  = useState(schedule?.startMinutes     ?? defaultStartMinutes ?? 9 * 60);
  const [duration,  setDuration]  = useState(schedule?.durationMinutes  ?? 75);
  const [customDur, setCustomDur] = useState(
    schedule && !DURATION_PRESETS.find(p => p.value === schedule.durationMinutes)
      ? String(schedule.durationMinutes) : ""
  );
  const [notes,     setNotes]     = useState(schedule?.notes            || "");
  const [startDate, setStartDate] = useState(schedule?.startDate        || "");
  const [endDate,   setEndDate]   = useState(schedule?.endDate          || "");
  const inputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (!isTouch && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, []);

  const effectiveDuration = customDur ? (parseInt(customDur, 10) || 0) : duration;
  const canSave = title.trim().length > 0 && days.length > 0 && effectiveDuration >= 15;

  const toggleDay = (idx) =>
    setDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort());

  const save = () => {
    if (!canSave) return;
    onSave({
      title:           title.trim(),
      days,
      startMinutes:    startMin,
      durationMinutes: effectiveDuration,
      notes:           notes.trim(),
      startDate:       startDate || undefined,
      endDate:         endDate   || undefined,
    });
  };

  // Friendly day summary e.g. "Mon, Wed, Fri"
  const daySummary = WEEK_DAYS.filter(d => days.includes(d.idx)).map(d => d.long.slice(0, 3)).join(", ");

  const sharedInputStyle = {
    width: "100%", padding: "11px 12px",
    border: `0.5px solid ${T.border}`, background: T.bgBlock,
    fontSize: 14, color: T.textPrimary, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ background: T.bgElevated, width: "100%", maxWidth: 480, borderTop: `0.5px solid ${T.borderMid}`, maxHeight: "92dvh", overflowY: "auto" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", position: "sticky", top: 0, background: T.bgElevated, zIndex: 1 }}>
          <div style={{ width: 28, height: 3, background: T.borderMid, borderRadius: 1.5 }} />
        </div>

        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 13, background: T.bgElevated, zIndex: 1 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: BLOCK_TYPES.class.border, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 2px" }}>
              Class schedule
            </p>
            <p style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>
              {schedule ? "Edit class" : "Add class"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: T.bgBlock, border: `0.5px solid ${T.border}`, color: T.textMuted, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Title */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Class name</label>
            <input
              ref={inputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); }}
              placeholder="Calculus 201, Econ 101, Film Studies..."
              style={sharedInputStyle}
            />
          </div>

          {/* Day selector */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Repeats on</label>
            {daySummary && (
              <p style={{ fontSize: 11, color: T.blueText, margin: "0 0 10px", fontWeight: 500 }}>{daySummary}</p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
              {WEEK_DAYS.map(({ idx, short }) => {
                const active = days.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    style={{
                      padding: "10px 0",
                      border: `0.5px solid ${active ? T.blue : T.border}`,
                      background: active ? T.blueBg : "transparent",
                      color: active ? T.blueText : T.textFaint,
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", transition: "all 0.1s",
                    }}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
            {days.length === 0 && (
              <p style={{ fontSize: 11, color: T.red, margin: "6px 0 0" }}>Select at least one day</p>
            )}
          </div>

          {/* Time */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Start time</label>
            <input
              type="time"
              value={minToTimeStr(startMin)}
              onChange={e => setStartMin(timeStrToMin(e.target.value))}
              style={{
                ...sharedInputStyle,
                width: "auto", minWidth: 140,
                colorScheme: "dark",
              }}
            />
          </div>

          {/* Duration */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Duration</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
              {DURATION_PRESETS.map(({ label, value }) => {
                const active = !customDur && duration === value;
                return (
                  <button
                    key={value}
                    onClick={() => { setDuration(value); setCustomDur(""); }}
                    style={{
                      padding: "10px 0",
                      border: `0.5px solid ${active ? T.blue : T.border}`,
                      background: active ? T.blueBg : "transparent",
                      color: active ? T.blueText : T.textFaint,
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", transition: "all 0.1s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                min="15"
                max="300"
                value={customDur}
                onChange={e => { setCustomDur(e.target.value); setDuration(0); }}
                placeholder="Custom"
                style={{ ...sharedInputStyle, width: 100, fontSize: 13 }}
              />
              {customDur && <span style={{ fontSize: 12, color: T.textMuted }}>minutes</span>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Professor, room number, building..."
              rows={2}
              style={{ ...sharedInputStyle, resize: "none", lineHeight: 1.6 }}
            />
          </div>

          {/* Semester dates (optional) */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
              Semester range <span style={{ color: T.textFaint, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— optional</span>
            </label>
            <p style={{ fontSize: 11, color: T.textFaint, margin: "0 0 8px", lineHeight: 1.5 }}>
              Leave blank to repeat indefinitely. Set end date to stop after finals week.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: T.textFaint, display: "block", marginBottom: 4 }}>Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ ...sharedInputStyle, fontSize: 12, colorScheme: "dark" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, color: T.textFaint, display: "block", marginBottom: 4 }}>End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ ...sharedInputStyle, fontSize: 12, colorScheme: "dark" }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", borderTop: `0.5px solid ${T.border}`, margin: "0 -18px" }}>
            {schedule && (
              <button
                onClick={onDelete}
                style={{ padding: "15px 18px", border: "none", borderRight: `0.5px solid ${T.border}`, background: "transparent", color: T.red, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Remove
              </button>
            )}
            <button
              onClick={save}
              disabled={!canSave}
              style={{ flex: 1, padding: "15px", border: "none", background: canSave ? BLOCK_TYPES.class.border : T.bgBlock, color: canSave ? "#fff" : T.textFaint, fontSize: 13, fontWeight: 600, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.12s" }}
            >
              {schedule ? "Save changes" : "Add to schedule"}
            </button>
          </div>
        </div>

        <div style={{ height: "max(env(safe-area-inset-bottom), 16px)" }} />
      </div>
    </div>
  );
}

// ─── CLASS BLOCK (recurring — shown on grid, not draggable) ───────────────────
function ClassBlock({ event, schedule, onClick }) {
  const cfg    = BLOCK_TYPES.class;
  const height = Math.max(minutesToY(event.durationMinutes), MIN_BLOCK_PX);
  const tall   = height >= 88;

  // Build a compact day pattern string: "MWF", "TR", "M only", etc.
  const dayPattern = useMemo(() => {
    if (!Array.isArray(schedule?.days) || schedule.days.length === 0) return null;
    const SHORT = { 0: "Su", 1: "M", 2: "T", 3: "W", 4: "Th", 5: "F", 6: "Sa" };
    const sorted = [...schedule.days].sort((a, b) => {
      // Sort Mon–Sun: treat Sunday (0) as 7 for display order
      return (a === 0 ? 7 : a) - (b === 0 ? 7 : b);
    });
    return sorted.map(d => SHORT[d] || "?").join("/");
  }, [schedule?.days]);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(event); }}
      style={{
        position: "absolute", left: 4, right: 4,
        top: minutesToY(event.startMinutes), height,
        background: cfg.bg,
        borderLeft: `3px solid ${cfg.border}`,
        padding: "9px 10px",
        cursor: "pointer", userSelect: "none",
        zIndex: 2, overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        transition: "opacity 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: cfg.title, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em", flex: 1 }}>
          {event.title}
        </p>
        {/* Day pattern badge — the key orientation signal */}
        {dayPattern && (
          <span style={{ fontSize: 9, fontWeight: 700, color: cfg.border, background: "rgba(227,179,65,0.12)", padding: "2px 6px", flexShrink: 0, letterSpacing: "0.05em", border: `0.5px solid rgba(227,179,65,0.3)` }}>
            {dayPattern}
          </span>
        )}
      </div>
      {tall && (
        <p style={{ fontSize: 11, color: cfg.meta, margin: 0, fontVariantNumeric: "tabular-nums" }}>
          {formatTime(event.startMinutes)} — {formatTime(event.startMinutes + event.durationMinutes)}
          {event.notes ? <span style={{ color: T.textFaint }}> · {event.notes}</span> : null}
        </p>
      )}
    </div>
  );
}

// ─── MACRO MODAL ──────────────────────────────────────────────────────────────
function MacroModal({ mealKey, mealData, event, nutritionCompletion, onToggle, onClose }) {
  const targets = mealData?.targets || {};
  const macros  = [
    { k: "Cals",    v: safeNum(targets.calories), unit: "kcal" },
    { k: "Protein", v: safeNum(targets.protein),  unit: "g"    },
    { k: "Carbs",   v: safeNum(targets.carbs),    unit: "g"    },
    { k: "Fat",     v: safeNum(targets.fat),       unit: "g"    },
  ].filter(m => m.v != null);
  const hyd  = safeNum(targets.hydrationOz);
  const comp = nutritionCompletion?.[mealKey] || {};

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ background: T.bgElevated, width: "100%", maxWidth: 480, borderTop: `0.5px solid ${T.borderMid}` }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 28, height: 3, background: T.borderMid, borderRadius: 1.5 }} />
        </div>

        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.blueText, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 3px" }}>
              Nutrition target
            </p>
            <p style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>
              {mealData?.name || MEAL_LABELS[mealKey] || mealKey}
            </p>
            {event && (
              <p style={{ fontSize: 11, color: T.textFaint, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                {formatTime(event.startMinutes)} — {formatTime(event.startMinutes + event.durationMinutes)}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: T.bgBlock, border: `0.5px solid ${T.border}`, color: T.textMuted, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>

        {/* Macro numbers */}
        {macros.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${macros.length}, 1fr)`, borderBottom: `0.5px solid ${T.border}` }}>
            {macros.map(({ k, v, unit }, i) => (
              <div key={k} style={{ padding: "16px 0 14px", textAlign: "center", borderRight: i < macros.length - 1 ? `0.5px solid ${T.border}` : "none" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 6px" }}>{k}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: 0, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{v}</p>
                <p style={{ fontSize: 9, color: T.textFaint, margin: "3px 0 0" }}>{unit}</p>
              </div>
            ))}
          </div>
        )}

        {/* Log */}
        <div style={{ padding: "14px 16px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 10px" }}>Log completion</p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { field: "mealDone",      label: "Meal done"               },
              ...(hyd != null ? [{ field: "hydrationDone", label: `Water — ${hyd} oz` }] : []),
            ].map(({ field, label }) => {
              const done = comp[field];
              return (
                <button
                  key={field}
                  onClick={() => onToggle(mealKey, field)}
                  style={{
                    flex: 1, padding: "12px 10px",
                    border: `0.5px solid ${done ? T.green : T.border}`,
                    background: done ? "rgba(35,134,54,0.12)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: 14, height: 14, border: `1.5px solid ${done ? T.greenText : T.textMuted}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {done && <Check size={9} color={T.greenText} strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: done ? T.greenText : T.textMuted }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {(mealData?.diningHallRules || mealData?.homeExamples) && (
          <div style={{ borderTop: `0.5px solid ${T.border}`, padding: "12px 16px" }}>
            {mealData?.diningHallRules && (
              <div style={{ marginBottom: mealData?.homeExamples ? 10 : 0 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 5px" }}>Dining hall</p>
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.6 }}>{mealData.diningHallRules}</p>
              </div>
            )}
            {mealData?.homeExamples && (
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: T.textFaint, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 5px" }}>At home</p>
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.6 }}>{mealData.homeExamples}</p>
              </div>
            )}
          </div>
        )}

        <div style={{ height: "max(env(safe-area-inset-bottom), 20px)" }} />
      </div>
    </div>
  );
}

// ─── WORKOUT DETAIL MODAL ─────────────────────────────────────────────────────
function WorkoutDetailModal({ dailyWorkout, items, optimisticStatusById, onClose, onOpenItem }) {
  const sorted = useMemo(() =>
    [...(items || [])].sort((a, b) => (Number(a.Order) || 0) - (Number(b.Order) || 0)),
  [items]);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ background: T.bgElevated, width: "100%", maxWidth: 480, maxHeight: "88vh", borderTop: `0.5px solid ${T.borderMid}`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 28, height: 3, background: T.borderMid, borderRadius: 1.5 }} />
        </div>

        <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: T.redText, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 3px" }}>Coach assigned</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>
              {dailyWorkout?.Title || "Today's Workout"}
            </p>
            <p style={{ fontSize: 11, color: T.textFaint, margin: "2px 0 0" }}>
              {sorted.length} exercise{sorted.length !== 1 ? "s" : ""} — tap to log
            </p>
          </div>
          <button onClick={onClose} style={{ background: T.bgBlock, border: `0.5px solid ${T.border}`, color: T.textMuted, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {sorted.map((item, idx) => {
            const done = (optimisticStatusById?.[item.id] || item.Status) === "Completed";
            return (
              <div
                key={item.id || idx}
                onClick={() => onOpenItem?.(item)}
                style={{ padding: "14px 18px", borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              >
                <div style={{ width: 18, height: 18, border: `1.5px solid ${done ? T.greenText : T.borderMid}`, background: done ? "rgba(63,185,80,0.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {done && <Check size={10} color={T.greenText} strokeWidth={3} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: done ? T.textMuted : T.textPrimary, margin: "0 0 5px", letterSpacing: "-0.01em", textDecoration: done ? "line-through" : "none" }}>
                    {item.ExerciseName || "Exercise"}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                    {[
                      item.Sets   && `${item.Sets} sets`,
                      item.Reps   && `${item.Reps} reps`,
                      item.Weight && item.Weight,
                      item.Rest   && `${item.Rest} rest`,
                    ].filter(Boolean).map((s, i) => (
                      <span key={i} style={{ fontSize: 11, color: T.textFaint, fontVariantNumeric: "tabular-nums" }}>{s}</span>
                    ))}
                  </div>
                  {item.Instructions && (
                    <p style={{ fontSize: 11, color: T.textFaint, margin: "4px 0 0", lineHeight: 1.5 }}>{item.Instructions}</p>
                  )}
                </div>
                <ChevronRight size={14} color={T.textFaint} style={{ flexShrink: 0 }} />
              </div>
            );
          })}
          <div style={{ height: "max(env(safe-area-inset-bottom), 20px)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── EVENT MODAL ──────────────────────────────────────────────────────────────
// When user selects "Class" type, we prompt them to open the ClassScheduleModal
// instead of saving a one-off block.
function EventModal({ event, defaultStartMinutes, onSave, onDelete, onClose, onOpenClassSchedule }) {
  const [title, setTitle] = useState(event?.title || "");
  const [type,  setType]  = useState(event?.type  || "workout");
  const [notes, setNotes] = useState(event?.notes || "");
  const inputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (!isTouch && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, []);

  const save = () => {
    // Classes are never saved as one-off events — they belong in the semester schedule.
    // Intercept here so Enter key on the title input also routes correctly.
    if (type === "class") {
      onClose();
      onOpenClassSchedule({ startMinutes: defaultStartMinutes });
      return;
    }
    if (title.trim()) onSave({ title: title.trim(), type, notes });
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ background: T.bgElevated, width: "100%", maxWidth: 480, borderTop: `0.5px solid ${T.borderMid}` }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 28, height: 3, background: T.borderMid, borderRadius: 1.5 }} />
        </div>

        <div style={{ padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 20, fontWeight: 600, color: T.textPrimary, margin: 0, letterSpacing: "-0.02em" }}>
            {event?.id ? "Edit block" : "New block"}
          </p>
          <button onClick={onClose} style={{ background: T.bgBlock, border: `0.5px solid ${T.border}`, color: T.textMuted, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Title — hidden for Class since ClassScheduleModal has its own title field */}
          {type !== "class" && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Title</label>
              <input
                ref={inputRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); }}
                placeholder="Morning lift, film room, recovery..."
                style={{ width: "100%", padding: "11px 12px", border: `0.5px solid ${T.border}`, background: T.bgBlock, fontSize: 14, color: T.textPrimary, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(BLOCK_TYPES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  style={{
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                    border: `0.5px solid ${type === key ? cfg.border : T.border}`,
                    background: type === key ? cfg.bg : "transparent",
                    color: type === key ? cfg.title : T.textMuted,
                    transition: "all 0.1s",
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Class — full redirect, nothing else shown */}
          {type === "class" && (
            <div style={{ background: T.bgBlock, border: `0.5px solid ${BLOCK_TYPES.class.border}`, padding: "16px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                Classes repeat weekly
              </p>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 14px", lineHeight: 1.6 }}>
                Pick the days it meets (Mon/Wed, Tue/Thu, once a week — whatever the pattern) and the time. It'll show up automatically every week for the semester.
              </p>
              <button
                onClick={() => { onClose(); onOpenClassSchedule({ startMinutes: defaultStartMinutes }); }}
                style={{ width: "100%", padding: "13px", border: "none", background: BLOCK_TYPES.class.border, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em" }}
              >
                Set up class schedule →
              </button>
            </div>
          )}

          {type !== "class" && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any details..."
                rows={2}
                style={{ width: "100%", padding: "11px 12px", border: `0.5px solid ${T.border}`, background: T.bgBlock, fontSize: 13, color: T.textPrimary, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit" }}
              />
            </div>
          )}

          {type !== "class" && (
            <div style={{ display: "flex", borderTop: `0.5px solid ${T.border}`, margin: "0 -18px" }}>
              {event?.id && (
                <button
                  onClick={onDelete}
                  style={{ padding: "15px 18px", border: "none", borderRight: `0.5px solid ${T.border}`, background: "transparent", color: T.red, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={save}
                disabled={!title.trim()}
                style={{ flex: 1, padding: "15px", border: "none", background: title.trim() ? T.red : T.bgBlock, color: title.trim() ? "#fff" : T.textFaint, fontSize: 13, fontWeight: 600, cursor: title.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.12s" }}
              >
                {event?.id ? "Save changes" : "Add block"}
              </button>
            </div>
          )}
        </div>

        <div style={{ height: "max(env(safe-area-inset-bottom), 16px)" }} />
      </div>
    </div>
  );
}

// ─── NUTRITION BLOCK ──────────────────────────────────────────────────────────
function NutritionBlock({ event, mealData, nutritionCompletion, onDragStart, onResizeStart, onClick, isDragging, isResizing }) {
  const targets  = mealData?.targets || {};
  const cal      = safeNum(targets.calories);
  const prot     = safeNum(targets.protein);
  const comp     = nutritionCompletion?.[event.mealKey] || {};
  const bothDone = comp.mealDone && comp.hydrationDone;
  const active   = isDragging || isResizing;
  const height   = Math.max(minutesToY(event.durationMinutes), MIN_BLOCK_PX);
  const tall     = height >= 88;

  const pd = (e) => { if (e.target.dataset.resize) return; e.stopPropagation(); onDragStart(e, event.id); };

  return (
    <div
      onMouseDown={pd} onTouchStart={pd}
      onClick={(e) => { e.stopPropagation(); if (!active) onClick(event); }}
      style={{
        position: "absolute", left: 4, right: 4,
        top: minutesToY(event.startMinutes), height,
        background: bothDone ? "rgba(35,134,54,0.12)" : T.blueBg,
        borderLeft: `3px solid ${bothDone ? T.green : T.blue}`,
        padding: "9px 10px 18px",
        cursor: active ? "grabbing" : "grab",
        userSelect: "none", touchAction: "none",
        boxShadow: active ? "0 12px 32px rgba(0,0,0,0.5)" : "none",
        transform: active ? "scale(1.015) translateZ(0)" : "translateZ(0)",
        transition: active ? "none" : "transform 0.15s, border-color 0.2s, background 0.2s",
        zIndex: active ? 10 : 2, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: bothDone ? T.greenText : T.blueText, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
          {MEAL_LABELS[event.mealKey] || event.title}
        </p>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, background: comp.mealDone ? T.green : T.border, transition: "background 0.2s" }} />
          <div style={{ width: 6, height: 6, background: comp.hydrationDone ? T.blue : T.border, transition: "background 0.2s" }} />
        </div>
      </div>
      {tall && cal != null && (
        <p style={{ fontSize: 11, color: T.textFaint, margin: "3px 0 0", fontVariantNumeric: "tabular-nums" }}>
          {cal} kcal{prot != null ? ` · ${prot}g protein` : ""}
        </p>
      )}
      <ResizeHandle
        color={bothDone ? T.green : T.blue}
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, event.id); }}
        onTouchStart={(e) => { e.stopPropagation(); onResizeStart(e, event.id); }}
      />
    </div>
  );
}

// ─── ATHLETE BLOCK ────────────────────────────────────────────────────────────
function EventBlock({ event, onDragStart, onResizeStart, onClick, isDragging, isResizing }) {
  const cfg    = BLOCK_TYPES[event.type] || BLOCK_TYPES.workout;
  const top    = minutesToY(event.startMinutes);
  const height = Math.max(minutesToY(event.durationMinutes), MIN_BLOCK_PX);
  const tall   = height >= 88;
  const active = isDragging || isResizing;

  const pd = (e) => { if (e.target.dataset.resize) return; e.stopPropagation(); onDragStart(e, event.id); };

  return (
    <div
      onMouseDown={pd} onTouchStart={pd}
      onClick={(e) => { e.stopPropagation(); if (!active) onClick(event); }}
      style={{
        position: "absolute", left: 4, right: 4, top, height,
        background: cfg.bg,
        borderLeft: `3px solid ${cfg.border}`,
        padding: "9px 10px 18px",
        cursor: active ? "grabbing" : "grab",
        userSelect: "none", touchAction: "none",
        boxShadow: active ? "0 12px 32px rgba(0,0,0,0.5)" : "none",
        transform: active ? "scale(1.015) translateZ(0)" : "translateZ(0)",
        transition: active ? "none" : "transform 0.15s",
        zIndex: active ? 10 : 2, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: cfg.title, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em", flex: 1 }}>
          {event.title}
        </p>
        {tall && (
          <span style={{ fontSize: 10, color: T.textFaint, flexShrink: 0, fontVariantNumeric: "tabular-nums", marginTop: 1 }}>
            {formatTime(event.startMinutes)}
          </span>
        )}
      </div>
      {tall && (
        <p style={{ fontSize: 11, color: cfg.meta, margin: "3px 0 0", fontVariantNumeric: "tabular-nums" }}>
          {formatTime(event.startMinutes)} — {formatTime(event.startMinutes + event.durationMinutes)}
          {event.notes ? <span style={{ color: T.textFaint }}> · {event.notes}</span> : null}
        </p>
      )}
      <ResizeHandle
        color={cfg.border}
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, event.id); }}
        onTouchStart={(e) => { e.stopPropagation(); onResizeStart(e, event.id); }}
      />
    </div>
  );
}

// ─── COACH WORKOUT BLOCK ──────────────────────────────────────────────────────
function CoachWorkoutBlock({ dailyWorkout, items, optimisticStatusById, onClick }) {
  const startMinutes    = 9 * 60;
  const durationMinutes = Math.min(Math.max(60, (items?.length || 1) * 20), 120);
  const doneCount  = items?.filter(i => (optimisticStatusById?.[i.id] || i.Status) === "Completed").length || 0;
  const totalCount = items?.length || 0;
  const allDone    = totalCount > 0 && doneCount >= totalCount;
  const height     = Math.max(minutesToY(durationMinutes), MIN_BLOCK_PX);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position: "absolute", left: 4, right: 4,
        top: minutesToY(startMinutes), height,
        background: allDone ? "rgba(35,134,54,0.12)" : T.redBg,
        borderLeft: `3px solid ${allDone ? T.green : T.red}`,
        padding: "9px 10px",
        cursor: "pointer", userSelect: "none",
        zIndex: 3, overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: allDone ? T.greenText : T.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em", flex: 1 }}>
          {dailyWorkout?.Title || "Coach Workout"}
        </p>
        <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? T.greenText : T.redText, background: allDone ? "rgba(35,134,54,0.2)" : "rgba(218,54,51,0.15)", padding: "2px 8px", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {totalCount > 0 ? `${doneCount}/${totalCount}` : "Locked"}
        </span>
      </div>
      <p style={{ fontSize: 11, color: T.textFaint, margin: 0, fontVariantNumeric: "tabular-nums" }}>
        {formatTime(startMinutes)} — Tap to log
      </p>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DayPlanner() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const isAthlete    = useMemo(() => String(user?.role || user?.Role || "").trim().toLowerCase().includes("ath"), [user]);
  const athleteToken = useMemo(() => String(user?.AthleteToken || user?.athleteToken || user?.athlete_token || "").trim(), [user]);
  const firstName    = String(user?.name || user?.Name || user?.firstName || "").split(" ")[0] || "Athlete";

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const dateStr   = toISODate(currentDate);
  const todayFlag = isToday(currentDate);
  const goToDate  = useCallback((offset) => {
    setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + offset); return n; });
  }, []);

  // Workout + completion
  const workout = useAthleteToday({ authReady, user, isAthlete });
  useEffect(() => { if (workout.setSelectedDate) workout.setSelectedDate(dateStr); }, [dateStr]); // eslint-disable-line
  const { dailyWorkout, items: workoutItems, loading: workoutLoading, setErr } = workout;

  const {
    modalOpen, activeItem, selectedFile, coachNote,
    submittingId, optimisticStatusById,
    openModal, closeModal, setSelectedFile, setCoachNote, submitCompletion,
  } = useWorkoutCompletion({ selectedDate: dateStr, reload: workout.reload, setErr });

  // Nutrition
  const nutrition = useAthleteNutritionToday({ authReady, user, isAthlete, selectedDate: dateStr });
  const { mealBlocks, loading: nutritionLoading } = nutrition;

  // Nutrition completion
  const [nutritionCompletion, setNutritionCompletion] = useState(makeEmptyCompletion);
  const nutritionKey  = useMemo(() => {
    const who = athleteToken || String(user?.Email || user?.email || "").trim().toLowerCase();
    return who ? `cp:nc:${who}:${dateStr}` : "";
  }, [athleteToken, user, dateStr]);
  const nutHydRef    = useRef(false);
  const nutSaveTimer = useRef(null);

  useEffect(() => {
    if (!authReady || !user || !isAthlete || !dateStr) return;
    nutHydRef.current = true;
    if (nutritionKey) {
      const c = lsGet(nutritionKey);
      setNutritionCompletion(c ? normalizeCompletion(JSON.parse(c)) : makeEmptyCompletion());
    }
    fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(dateStr)}`, { method: "GET", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok || !data.hasRecord) return;
        const n = normalizeCompletion(data.completion);
        setNutritionCompletion(n);
        if (nutritionKey) lsSet(nutritionKey, JSON.stringify(n));
      })
      .catch(() => {})
      .finally(() => { setTimeout(() => { nutHydRef.current = false; }, 0); });
  }, [authReady, user, isAthlete, dateStr]); // eslint-disable-line

  useEffect(() => {
    if (!authReady || !user || !isAthlete || !nutritionKey || nutHydRef.current) return;
    lsSet(nutritionKey, JSON.stringify(nutritionCompletion));
    clearTimeout(nutSaveTimer.current);
    nutSaveTimer.current = setTimeout(() => {
      fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(dateStr)}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion: nutritionCompletion }),
      }).catch(() => {});
    }, 1000);
  }, [nutritionCompletion]); // eslint-disable-line

  const handleNutritionToggle = useCallback((mealKey, field) => {
    setNutritionCompletion(prev => ({ ...prev, [mealKey]: { ...prev[mealKey], [field]: !prev[mealKey][field] } }));
  }, []);

  // Events / day planner state
  const [events, setEvents]               = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [saveStatus, setSaveStatus]       = useState(null);
  const hydratingRef = useRef(false);
  const saveTimer    = useRef(null);
  const gridRef      = useRef(null);

  useEffect(() => {
    if (!authReady || !user || !isAthlete || !athleteToken) return;
    hydratingRef.current = true;
    setLoadingEvents(true);
    const cached = lsGet(lsKey(athleteToken, dateStr));
    if (cached) { try { setEvents(JSON.parse(cached)); } catch { setEvents([]); } } else { setEvents([]); }
    fetch(`/api/athlete/day-planner/upsert?date=${encodeURIComponent(dateStr)}`, { method: "GET", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok || !data.hasRecord) return;
        const n = Array.isArray(data.events) ? data.events : [];
        setEvents(n);
        lsSet(lsKey(athleteToken, dateStr), JSON.stringify(n));
      })
      .catch(() => {})
      .finally(() => { hydratingRef.current = false; setLoadingEvents(false); });
  }, [authReady, user, isAthlete, athleteToken, dateStr]); // eslint-disable-line

  useEffect(() => {
    if (loadingEvents || nutritionLoading || !mealBlocks) return;
    setEvents(prev => {
      if (prev.some(e => e.source === "nutrition")) return prev;
      return [...prev, ...buildNutritionDefaults(mealBlocks)];
    });
  }, [loadingEvents, nutritionLoading, mealBlocks]);

  const saveToAirtable = useCallback((evts) => {
    if (!athleteToken || !dateStr) return;
    setSaveStatus("saving");
    fetch(`/api/athlete/day-planner/upsert?date=${encodeURIComponent(dateStr)}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: evts }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data?.ok) {
          setSaveStatus("saved");
          lsSet(lsKey(athleteToken, dateStr), JSON.stringify(evts));
          setTimeout(() => setSaveStatus(null), 2500);
        } else setSaveStatus("error");
      })
      .catch(() => setSaveStatus("error"));
  }, [athleteToken, dateStr]);

  useEffect(() => {
    if (hydratingRef.current || !authReady || !isAthlete || !athleteToken) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToAirtable(events), 800);
    return () => clearTimeout(saveTimer.current);
  }, [events]); // eslint-disable-line

  // Now line
  const [nowMinutes, setNowMinutes] = useState(null);
  useEffect(() => {
    setNowMinutes(getCurrentMin());
    const t = setInterval(() => setNowMinutes(getCurrentMin()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (gridRef.current && todayFlag && nowMinutes !== null) {
      gridRef.current.scrollTo({ top: Math.max(0, minutesToY(nowMinutes) - window.innerHeight / 3), behavior: "smooth" });
    }
  }, [nowMinutes, todayFlag]);

  // Drag
  const { dragging, resizing, startDrag, startResize } = usePointerDrag({ gridRef, events, setEvents });

  // Modals
  const [modal, setModal]               = useState(null);
  const [macroModal, setMacroModal]     = useState(null);
  const [workoutModal, setWorkoutModal] = useState(false);
  const [classModal, setClassModal]     = useState(null); // null | { schedule?: existing, defaultStartMinutes? }

  // ── Class schedules ──────────────────────────────────────────────────────────
  const [classSchedules, setClassSchedules] = useState([]);
  const classSaveTimer = useRef(null);

  // Load from localStorage then API on mount
  useEffect(() => {
    if (!authReady || !isAthlete || !athleteToken) return;
    const cached = lsGet(lsClassKey(athleteToken));
    if (cached) { try { setClassSchedules(JSON.parse(cached)); } catch {} }
    fetch("/api/athlete/class-schedule", { method: "GET", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok || !Array.isArray(data.schedules)) return;
        setClassSchedules(data.schedules);
        lsSet(lsClassKey(athleteToken), JSON.stringify(data.schedules));
      })
      .catch(() => {});
  }, [authReady, isAthlete, athleteToken]);

  // Persist class schedules on change
  const saveClassSchedules = useCallback((schedules) => {
    if (!athleteToken) return;
    lsSet(lsClassKey(athleteToken), JSON.stringify(schedules));
    clearTimeout(classSaveTimer.current);
    classSaveTimer.current = setTimeout(() => {
      fetch("/api/athlete/class-schedule", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      }).catch(() => {});
    }, 800);
  }, [athleteToken]);

  const handleClassSave = useCallback((data) => {
    setClassSchedules(prev => {
      const isEdit = classModal?.schedule?.id;
      const next = isEdit
        ? prev.map(c => c.id === classModal.schedule.id ? { ...c, ...data } : c)
        : [...prev, { id: `cls_${Date.now()}`, ...data }];
      saveClassSchedules(next);
      return next;
    });
    setClassModal(null);

    // If the current day isn't one of the class days, jump forward to the
    // nearest upcoming occurrence so the athlete immediately sees it on the grid.
    const currentDow = currentDate.getDay();
    if (Array.isArray(data.days) && !data.days.includes(currentDow)) {
      let offset = 1;
      while (offset <= 7) {
        const candidate = new Date(currentDate);
        candidate.setDate(candidate.getDate() + offset);
        if (data.days.includes(candidate.getDay())) {
          setCurrentDate(candidate);
          break;
        }
        offset++;
      }
    }
  }, [classModal, saveClassSchedules, currentDate]);

  const handleClassDelete = useCallback(() => {
    if (!classModal?.schedule?.id) return;
    setClassSchedules(prev => {
      const next = prev.filter(c => c.id !== classModal.schedule.id);
      saveClassSchedules(next);
      return next;
    });
    setClassModal(null);
  }, [classModal, saveClassSchedules]);

  // Class events for the current date (injected into grid, separate from athlete events)
  const classEvents = useMemo(() => classesToDayEvents(classSchedules, dateStr), [classSchedules, dateStr]);

  const anyModal = Boolean(modal || macroModal || workoutModal || modalOpen || classModal);
  const savedScrollRef = useRef(0);
  useEffect(() => {
    if (!gridRef.current) return;
    if (anyModal) { savedScrollRef.current = gridRef.current.scrollTop; gridRef.current.style.overflow = "hidden"; }
    else { gridRef.current.style.overflow = "auto"; gridRef.current.scrollTop = savedScrollRef.current; }
  }, [anyModal]);

  // Ghost hover (desktop)
  const [ghostMinutes, setGhostMinutes] = useState(null);
  const handleGridMouseMove = useCallback((e) => {
    if (dragging || resizing || !gridRef.current || e.touches) return;
    const r = gridRef.current.getBoundingClientRect();
    setGhostMinutes(Math.round(yToMinutes(e.clientY - r.top + gridRef.current.scrollTop) / SNAP_MINUTES) * SNAP_MINUTES);
  }, [dragging, resizing]);

  // Grid click
  const handleGridClick = useCallback((e) => {
    if (dragging || resizing) return;
    const r = gridRef.current.getBoundingClientRect();
    const startMinutes = clamp(Math.round(yToMinutes(e.clientY - r.top + gridRef.current.scrollTop) / SNAP_MINUTES) * SNAP_MINUTES, 0, 24 * 60 - 60);
    setModal({ event: { type: "workout", startMinutes, durationMinutes: 60 }, mode: "create", defaultStartMinutes: startMinutes });
  }, [dragging, resizing]);

  const handleModalSave = useCallback((data) => {
    if (modal.mode === "create") setEvents(prev => [...prev, { id: `ev_${Date.now()}`, ...modal.event, ...data }]);
    else setEvents(prev => prev.map(ev => ev.id === modal.event.id ? { ...ev, ...data } : ev));
    setModal(null);
  }, [modal]);

  const handleModalDelete = useCallback(() => {
    setEvents(prev => prev.filter(ev => ev.id !== modal.event.id));
    setModal(null);
  }, [modal]);

  // Swipe date nav
  const swipeX = useRef(null);
  const handleTouchStart = useCallback((e) => { swipeX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd   = useCallback((e) => {
    if (swipeX.current === null || dragging || resizing) return;
    const d = e.changedTouches[0].clientX - swipeX.current;
    if (Math.abs(d) > 60) goToDate(d < 0 ? 1 : -1);
    swipeX.current = null;
  }, [dragging, resizing, goToDate]);

  // Counts
  const nutritionCounts = useMemo(() => computeNutritionCounts(nutritionCompletion), [nutritionCompletion]);
  const workoutDone  = useMemo(() => workoutItems?.filter(i => (optimisticStatusById?.[i.id] || i.Status) === "Completed").length || 0, [workoutItems, optimisticStatusById]);
  const workoutTotal = workoutItems?.length || 0;
  const isLoading    = workoutLoading || nutritionLoading || loadingEvents;

  if (!authReady) return null;
  if (!user)      return <div style={{ padding: 24, fontSize: 14, color: T.textMuted }}>Please log in.</div>;
  if (!isAthlete) return <div style={{ padding: 24, fontSize: 14, color: T.textMuted }}>Not authorized.</div>;

  const nutritionEvents = events.filter(e => e.source === "nutrition");
  const athleteEvents   = events.filter(e => e.source !== "nutrition");
  const canonicalItem   = workoutItems?.find(i => String(i?.id || "") === String(activeItem?.id || ""));
  const evRaw = String(canonicalItem?.EvidenceRequired ?? activeItem?.EvidenceRequired ?? "").toLowerCase();
  const evidenceRequired = evRaw !== "" && evRaw !== "none" && evRaw !== "false" && evRaw !== "voluntary_activity_vara";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: T.bg, fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ background: T.bg, borderBottom: `0.5px solid ${T.border}`, flexShrink: 0, paddingTop: "env(safe-area-inset-top, 0)" }}>

        {/* Row 1 — back + date nav + progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 0" }}>

          <button
            onClick={() => router.push("/dashboard")}
            style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", padding: "0 2px 0 0", display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <ChevronLeft size={20} />
          </button>

          <button onClick={() => goToDate(-1)} style={{ background: "none", border: `0.5px solid ${T.border}`, color: T.textMuted, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronLeft size={14} />
          </button>

          {/* Date block — centre */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                {todayFlag
                  ? "Today"
                  : currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {todayFlag && (
                <span style={{ fontSize: 9, fontWeight: 800, background: T.red, color: "#fff", padding: "2px 6px", letterSpacing: "0.1em", textTransform: "uppercase" }}>LIVE</span>
              )}
            </div>
            {todayFlag && (
              <div style={{ fontSize: 12, color: T.textFaint, marginTop: 1 }}>{firstName}</div>
            )}
          </div>

          <button onClick={() => goToDate(1)} style={{ background: "none", border: `0.5px solid ${T.border}`, color: T.textMuted, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronRight size={14} />
          </button>

          {/* Ring */}
          {(workoutTotal + nutritionCounts.total) > 0 && (
            <ProgressRing done={workoutDone + nutritionCounts.done} total={workoutTotal + nutritionCounts.total} size={36} stroke={3} />
          )}

          {isLoading
            ? <RefreshCw size={13} color={T.textFaint} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
            : <SaveDot status={saveStatus} />
          }
        </div>

        {/* Row 2 — completion counts + jump to today */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 10px" }}>
          {!todayFlag && (
            <button
              onClick={() => setCurrentDate(new Date())}
              style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, background: T.bgElevated, border: `0.5px solid ${T.border}`, padding: "5px 12px", cursor: "pointer" }}
            >
              Jump to today
            </button>
          )}
          <div style={{ flex: 1 }} />
          {workoutTotal > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, background: T.red, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: workoutDone >= workoutTotal ? T.greenText : T.textSecond, fontVariantNumeric: "tabular-nums" }}>
                {workoutDone}/{workoutTotal}
              </span>
              <span style={{ fontSize: 12, color: T.textFaint }}>workout</span>
            </div>
          )}
          {workoutTotal > 0 && nutritionCounts.total > 0 && (
            <div style={{ width: "0.5px", height: 14, background: T.border }} />
          )}
          {nutritionCounts.total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, background: T.green, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: nutritionCounts.done >= nutritionCounts.total ? T.greenText : T.textSecond, fontVariantNumeric: "tabular-nums" }}>
                {nutritionCounts.done}/{nutritionCounts.total}
              </span>
              <span style={{ fontSize: 12, color: T.textFaint }}>nutrition</span>
            </div>
          )}
        </div>
      </div>

      {/* ── GRID ── */}
      <div
        ref={gridRef}
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative", WebkitOverflowScrolling: "touch" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{ display: "flex", minHeight: TOTAL_HEIGHT, position: "relative" }}
          onClick={handleGridClick}
          onMouseMove={handleGridMouseMove}
          onMouseLeave={() => setGhostMinutes(null)}
        >
          {/* Time labels — every 2 hours only, keeps the grid clean */}
          <div style={{ width: 44, flexShrink: 0, position: "relative" }}>
            {HOURS.map(h => (
              h % 2 === 0 && h > 0 ? (
                <div key={h} style={{ position: "absolute", top: minutesToY(h * 60) - 8, left: 0, right: 0, display: "flex", justifyContent: "flex-end", paddingRight: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: todayFlag && h === Math.floor((nowMinutes ?? 0) / 60) ? T.red : T.textTiny }}>
                    {formatHour(h)}
                  </span>
                </div>
              ) : null
            ))}
          </div>

          {/* Events area */}
          <div style={{ flex: 1, position: "relative", marginRight: 6 }}>
            {/* Hour lines — labeled hours slightly more visible */}
            {HOURS.map(h => (
              <div key={h} style={{ position: "absolute", left: 0, right: 0, top: minutesToY(h * 60), height: "0.5px", background: h === 0 ? "transparent" : h % 2 === 0 ? "#1A2030" : "#131820" }} />
            ))}
            {/* Half-hour lines — very faint */}
            {HOURS.map(h => (
              <div key={`h${h}`} style={{ position: "absolute", left: 0, right: 0, top: minutesToY(h * 60 + 30), height: "0.5px", background: "#0F1318" }} />
            ))}

            {/* Ghost cursor (desktop) */}
            {ghostMinutes !== null && !dragging && !resizing && (
              <div style={{ position: "absolute", left: 0, right: 0, top: minutesToY(ghostMinutes), pointerEvents: "none", zIndex: 1, display: "flex", alignItems: "center" }}>
                <div style={{ flex: 1, height: "0.5px", background: T.red, opacity: 0.3 }} />
                <span style={{ fontSize: 10, color: T.redText, background: T.redBg, padding: "2px 6px", marginLeft: 6, fontVariantNumeric: "tabular-nums", border: `0.5px solid rgba(218,54,51,0.3)` }}>
                  {formatTime(ghostMinutes)}
                </span>
              </div>
            )}

            {/* Now indicator */}
            {todayFlag && nowMinutes !== null && (
              <div style={{ position: "absolute", left: -4, right: 0, top: minutesToY(nowMinutes), pointerEvents: "none", zIndex: 5, display: "flex", alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.red, flexShrink: 0, boxShadow: "0 0 0 2.5px rgba(218,54,51,0.25)" }} />
                <div style={{ flex: 1, height: 1, background: T.red, opacity: 0.65 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: T.redText, background: T.redBg, padding: "2px 6px", marginLeft: 4, flexShrink: 0, fontVariantNumeric: "tabular-nums", border: `0.5px solid rgba(218,54,51,0.3)` }}>
                  {formatTime(nowMinutes)}
                </span>
              </div>
            )}

            {/* Coach workout */}
            {dailyWorkout && (
              <CoachWorkoutBlock
                dailyWorkout={dailyWorkout}
                items={workoutItems}
                optimisticStatusById={optimisticStatusById}
                onClick={() => setWorkoutModal(true)}
              />
            )}

            {/* Nutrition blocks */}
            {nutritionEvents.map(ev => (
              <NutritionBlock
                key={ev.id} event={ev}
                mealData={mealBlocks?.[ev.mealKey]}
                nutritionCompletion={nutritionCompletion}
                onDragStart={startDrag} onResizeStart={startResize}
                onClick={(e) => setMacroModal({ event: e, mealKey: e.mealKey })}
                isDragging={dragging === ev.id} isResizing={resizing === ev.id}
              />
            ))}

            {/* Class schedule blocks (recurring) */}
            {classEvents.map(ev => {
              const schedule = classSchedules.find(c => c.id === ev.scheduleId);
              return (
                <ClassBlock
                  key={ev.id} event={ev} schedule={schedule}
                  onClick={() => schedule && setClassModal({ schedule })}
                />
              );
            })}

            {/* Athlete one-off blocks */}
            {athleteEvents.map(ev => (
              <EventBlock
                key={ev.id} event={ev}
                onDragStart={startDrag} onResizeStart={startResize}
                onClick={(e) => setModal({ event: e, mode: "edit", defaultStartMinutes: e.startMinutes })}
                isDragging={dragging === ev.id} isResizing={resizing === ev.id}
              />
            ))}

            {/* Empty state */}
            {athleteEvents.length === 0 && !dailyWorkout && nutritionEvents.length === 0 && classEvents.length === 0 && !isLoading && (
              <div style={{ position: "absolute", top: minutesToY(8 * 60), left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none", whiteSpace: "nowrap" }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: T.bgElevated, margin: "0 0 4px", letterSpacing: "-0.01em" }}>Tap anywhere to add a block</p>
                <p style={{ fontSize: 11, color: T.bgElevated }}>Or use the + below</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => setModal({ event: { type: "workout", startMinutes: nowMinutes ?? 9 * 60, durationMinutes: 60 }, mode: "create", defaultStartMinutes: nowMinutes ?? 9 * 60 })}
        style={{
          position: "fixed",
          bottom: "max(24px, env(safe-area-inset-bottom, 24px))",
          right: 18,
          width: 50, height: 50, borderRadius: "50%",
          background: T.red, color: "#fff", border: "none",
          boxShadow: "0 4px 20px rgba(218,54,51,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 15,
        }}
        aria-label="Add block"
      >
        <Plus size={22} />
      </button>

      {/* ── MODALS ── */}
      {modal && (
        <EventModal
          event={modal.event}
          defaultStartMinutes={modal.defaultStartMinutes}
          onSave={handleModalSave}
          onDelete={modal.mode === "edit" ? handleModalDelete : undefined}
          onClose={() => setModal(null)}
          onOpenClassSchedule={(opts) => setClassModal({ schedule: null, defaultStartMinutes: opts.startMinutes })}
        />
      )}
      {classModal !== null && (
        <ClassScheduleModal
          schedule={classModal.schedule || null}
          defaultStartMinutes={classModal.defaultStartMinutes}
          onSave={handleClassSave}
          onDelete={classModal.schedule ? handleClassDelete : undefined}
          onClose={() => setClassModal(null)}
        />
      )}
      {macroModal && (
        <MacroModal
          mealKey={macroModal.mealKey}
          mealData={mealBlocks?.[macroModal.mealKey]}
          event={macroModal.event}
          nutritionCompletion={nutritionCompletion}
          onToggle={handleNutritionToggle}
          onClose={() => setMacroModal(null)}
        />
      )}
      {workoutModal && (
        <WorkoutDetailModal
          dailyWorkout={dailyWorkout}
          items={workoutItems}
          optimisticStatusById={optimisticStatusById}
          onClose={() => setWorkoutModal(false)}
          onOpenItem={(item) => { setWorkoutModal(false); openModal(item); }}
        />
      )}
      {modalOpen && (
        <CompleteItemModal
          open={modalOpen}
          item={activeItem}
          selectedFile={selectedFile}
          coachNote={coachNote}
          submitting={Boolean(submittingId && activeItem?.id === submittingId)}
          onClose={closeModal}
          onPickFile={setSelectedFile}
          onChangeNote={setCoachNote}
          evidenceRequiredOverride={evidenceRequired}
          onSubmit={() => {
            if (evidenceRequired && !selectedFile) return;
            submitCompletion({
              workoutItemId:    String(activeItem?.id || ""),
              evidenceRequired: String(canonicalItem?.EvidenceRequired ?? activeItem?.EvidenceRequired ?? ""),
              dailyWorkoutId:   String(dailyWorkout?.id || dailyWorkout?.ID || dailyWorkout?.recordId || ""),
            });
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}