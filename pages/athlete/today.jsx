// pages/athlete/today.jsx
// Athlete command center — workout, schedule, nutrition in one scroll.
"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import DateStrip         from "@/components/athlete-today/DateStrip";
import WorkoutCard       from "@/components/athlete-today/WorkoutCard";
import CompleteItemModal from "@/components/athlete-today/CompleteItemModal";
import NutritionCard     from "@/components/athlete-today/nutrition/NutritionCard";
import { toISODateLocal, addDays } from "@/components/athlete-today/ui.jsx";

import { useAthleteToday }          from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion }      from "@/hooks/athlete-today/useWorkoutCompletion";
import { useAthleteNutritionToday } from "@/hooks/athlete-today/useAthleteNutritionToday";

import { ChevronLeft, RefreshCw, Plus, X, Calendar } from "lucide-react";

// ─── CLASS SCHEDULE HELPERS ───────────────────────────────────────────────────
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
function formatTime(min) {
  const h = Math.floor(min / 60) % 24;
  const mn = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(mn).padStart(2, "0")} ${ampm}`;
}
function classMatchesDate(cls, dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const dow = d.getDay();
  if (!Array.isArray(cls.days) || !cls.days.includes(dow)) return false;
  if (cls.startDate && dateStr < cls.startDate) return false;
  if (cls.endDate   && dateStr > cls.endDate)   return false;
  return true;
}
function classesToday(schedules, dateStr) {
  return (schedules || [])
    .filter(cls => classMatchesDate(cls, dateStr))
    .sort((a, b) => a.startMinutes - b.startMinutes);
}
function dayPattern(days) {
  if (!Array.isArray(days) || !days.length) return "";
  const SHORT = { 0: "Su", 1: "M", 2: "T", 3: "W", 4: "Th", 5: "F", 6: "Sa" };
  return [...days]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(d => SHORT[d] || "?")
    .join("/");
}
function formatDuration(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${min}m`;
}

const lsClassKey = (tok) => `cp_classes:${tok}`;
function lsGet(k) { try { return typeof window !== "undefined" ? localStorage.getItem(k) : null; } catch { return null; } }
function lsSet(k, v) { try { if (typeof window !== "undefined") localStorage.setItem(k, v); } catch {} }

function makeEmptyCompletion() {
  return {
    breakfast: { mealDone: false, hydrationDone: false },
    lunch:     { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner:    { mealDone: false, hydrationDone: false },
  };
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

function cx(...xs) { return xs.filter(Boolean).join(" "); }

// ─── PROGRESS RING ────────────────────────────────────────────────────────────
function ProgressRing({ done, total, size = 40, stroke = 3.5 }) {
  const r     = (size - stroke) / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = total > 0 ? Math.min(done / total, 1) : 0;
  const allDone = total > 0 && done >= total;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={allDone ? "#34d399" : "#7eb8e0"}
          strokeWidth={stroke} strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {allDone ? (
          <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#34d399" opacity="0.25" />
            <path d="M6 10.5l3 3 5-6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <>
            <span className="text-[13px] font-black text-white leading-none">{done}</span>
            <span className="text-[9px] text-white/45 leading-none mt-0.5">/{total}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── SCHEDULE SECTION ─────────────────────────────────────────────────────────
function ScheduleSection({ selectedDate, classSchedules, onEditClass, onAddClass, onOpenPlanner }) {
  const classes = useMemo(() => classesToday(classSchedules, selectedDate), [classSchedules, selectedDate]);
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Schedule</span>
          {classes.length > 0 && (
            <span className="text-[11px] font-black bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
              {classes.length} today
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onAddClass} className="flex items-center gap-1 text-[12px] font-semibold text-amber-600 hover:text-amber-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add class
          </button>
          <button onClick={onOpenPlanner} className="flex items-center gap-1 text-[12px] font-semibold text-gray-400 hover:text-gray-600 transition">
            <Calendar className="w-3.5 h-3.5" /> Plan day
          </button>
        </div>
      </div>
      {classes.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-sm text-gray-400 mb-2">No classes today</p>
          <button onClick={onAddClass} className="text-[13px] font-semibold text-amber-600 hover:text-amber-700 transition">
            Set up your class schedule →
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {classes.map((cls) => {
            const pat = dayPattern(cls.days);
            return (
              <button key={cls.id} type="button" onClick={() => onEditClass(cls)}
                className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                <div className="flex-shrink-0 w-[72px]">
                  <p className="text-[13px] font-bold text-amber-600 tabular-nums leading-tight">{formatTime(cls.startMinutes)}</p>
                  <p className="text-[11px] text-gray-400 tabular-nums leading-tight mt-0.5">{formatTime(cls.startMinutes + cls.durationMinutes)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-semibold text-gray-900 truncate leading-tight">{cls.title}</span>
                    {pat && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">{pat}</span>}
                  </div>
                  {cls.notes && <p className="text-[12px] text-gray-400 truncate">{cls.notes}</p>}
                </div>
                <span className="text-[11px] text-gray-300 flex-shrink-0 tabular-nums mt-0.5">{formatDuration(cls.durationMinutes)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CLASS SCHEDULE MODAL ─────────────────────────────────────────────────────
function ClassScheduleModal({ schedule, onSave, onDelete, onClose }) {
  const [title,     setTitle]     = useState(schedule?.title           || "");
  const [days,      setDays]      = useState(schedule?.days            || []);
  const [startMin,  setStartMin]  = useState(schedule?.startMinutes    ?? 9 * 60);
  const [duration,  setDuration]  = useState(schedule?.durationMinutes ?? 75);
  const [customDur, setCustomDur] = useState(
    schedule && !DURATION_PRESETS.find(p => p.value === schedule.durationMinutes)
      ? String(schedule.durationMinutes) : ""
  );
  const [notes,     setNotes]     = useState(schedule?.notes           || "");
  const [startDate, setStartDate] = useState(schedule?.startDate       || "");
  const [endDate,   setEndDate]   = useState(schedule?.endDate         || "");
  const inputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    const touch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (!touch && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, []);

  const effectiveDuration = customDur ? (parseInt(customDur, 10) || 0) : duration;
  const canSave = title.trim().length > 0 && days.length > 0 && effectiveDuration >= 15;
  const toggleDay = (idx) =>
    setDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort());
  const daySummary = WEEK_DAYS.filter(d => days.includes(d.idx)).map(d => d.long.slice(0, 3)).join(", ");
  const save = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(), days, startMinutes: startMin,
      durationMinutes: effectiveDuration, notes: notes.trim(),
      startDate: startDate || undefined, endDate: endDate || undefined,
    });
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full bg-white rounded-t-2xl overflow-hidden"
        style={{ maxWidth: 560, maxHeight: "92dvh", display: "flex", flexDirection: "column" }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Class schedule</p>
            <p className="text-[19px] font-bold text-gray-900 leading-tight" style={{ letterSpacing: "-0.02em" }}>
              {schedule ? "Edit class" : "Add class"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Class name</label>
            <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); }}
              placeholder="Calculus 201, Sports Psychology, Film Studies..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Repeats on</label>
            {daySummary && <p className="text-[12px] text-amber-600 font-semibold mb-2">{daySummary}</p>}
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK_DAYS.map(({ idx, short }) => {
                const active = days.includes(idx);
                return (
                  <button key={idx} type="button" onClick={() => toggleDay(idx)}
                    className={cx("py-2.5 rounded-lg text-[12px] font-bold transition",
                      active ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
                    {short}
                  </button>
                );
              })}
            </div>
            {days.length === 0 && <p className="text-[11px] text-red-500 mt-1.5">Select at least one day</p>}
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Start time</label>
            <input type="time" value={minToTimeStr(startMin)} onChange={e => setStartMin(timeStrToMin(e.target.value))}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50"
              style={{ minWidth: 140 }} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Duration</label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {DURATION_PRESETS.map(({ label, value }) => {
                const active = !customDur && duration === value;
                return (
                  <button key={value} type="button" onClick={() => { setDuration(value); setCustomDur(""); }}
                    className={cx("py-2.5 rounded-xl text-[12px] font-bold transition",
                      active ? "bg-[#1E3A5F] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="15" max="300" value={customDur}
                onChange={e => { setCustomDur(e.target.value); setDuration(0); }}
                placeholder="Custom"
                className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50" />
              {customDur && <span className="text-[12px] text-gray-500">minutes</span>}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Location / notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Room 204, Johnson Hall · Prof. Williams..." rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50 resize-none leading-relaxed" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
              Semester range <span className="text-gray-300 font-normal normal-case tracking-normal">— optional</span>
            </label>
            <p className="text-[11px] text-gray-400 mb-2">Leave blank to repeat every week indefinitely.</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">Start</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">End</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 border-t border-gray-100" style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
          {schedule && (
            <button type="button" onClick={onDelete}
              className="px-5 py-4 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition border-r border-gray-100">
              Remove
            </button>
          )}
          <button type="button" onClick={save} disabled={!canSave}
            className={cx("flex-1 py-4 text-[13px] font-bold transition",
              canSave ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-gray-100 text-gray-400 cursor-not-allowed")}>
            {schedule ? "Save changes" : "Add to schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AthleteToday() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    return raw.includes("ath") ? "athlete" : raw;
  }, [user]);
  const isAthlete = role === "athlete";

  const athleteToken = useMemo(() =>
    String(user?.AthleteToken || user?.athleteToken || user?.athlete_token || "").trim(),
  [user]);

  const firstName = String(user?.name || user?.Name || user?.firstName || "").split(" ")[0] || "Athlete";

  // ── Workout ───────────────────────────────────────────────────────────────
  const {
    selectedDate, setSelectedDate,
    loading, dailyWorkout, items,
    err, setErr, reload, dateStrip, progress,
  } = useAthleteToday({ authReady, user, isAthlete });

  const {
    modalOpen, activeItem, selectedFile, coachNote,
    submittingId, acknowledgingId, optimisticStatusById,
    openModal, closeModal, setSelectedFile, setCoachNote,
    submitCompletion, quickComplete, acknowledgeCompletion,
  } = useWorkoutCompletion({ selectedDate, reload, setErr });

  // ── Nutrition ─────────────────────────────────────────────────────────────
  const nutrition = useAthleteNutritionToday({ authReady, user, isAthlete, selectedDate });
  const dailyHydrationOz = nutrition.dailyHydrationOz ?? null;

  // ── Nutrition completion ──────────────────────────────────────────────────
  const [nutritionCompletion, setNutritionCompletion] = useState(makeEmptyCompletion);

  const nutritionKey = useMemo(() => {
    const who = athleteToken || String(user?.Email || user?.email || "").trim().toLowerCase();
    if (!who) return "";
    return `checkpeak:nutritionCompletion:${who}:${selectedDate}`;
  }, [athleteToken, user, selectedDate]);

  // ─────────────────────────────────────────────────────────────────────────
  // nutHydRef (true = hydrating, block all saves)
  //   Starts TRUE so the save effect cannot fire before the very first GET
  //   has even started — eliminates the entire class of "empty write on mount"
  //   race conditions regardless of React StrictMode double-invoke or auth
  //   re-checks.
  //
  // nutHydIdRef (monotonic counter — cancellation token)
  //   Each hydration cycle claims a unique ID. The .finally block only
  //   releases the lock when its ID is still current. This prevents a stale
  //   GET (from a previous selectedDate or a StrictMode ghost run) from
  //   prematurely setting nutHydRef=false and unblocking the save effect
  //   while a newer GET is still in flight.
  // ─────────────────────────────────────────────────────────────────────────
  const nutHydRef   = useRef(true); // ← TRUE, not false
  const nutHydIdRef = useRef(0);    // cancellation token
  const nutSaveTimer = useRef(null);

  // Hydration effect — reads cache immediately, then authoritative GET.
  useEffect(() => {
    if (!authReady || !user || !isAthlete || !selectedDate) return;

    // Claim this cycle; any previous in-flight GET becomes stale.
    const myId = ++nutHydIdRef.current;
    nutHydRef.current = true;

    if (nutritionKey) {
      const c = lsGet(nutritionKey);
      setNutritionCompletion(c ? normalizeCompletion(JSON.parse(c)) : makeEmptyCompletion());
    }

    fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(selectedDate)}`, {
      method: "GET", credentials: "include",
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (myId !== nutHydIdRef.current) return; // stale — a newer cycle owns the lock
        if (!data?.ok || !data.hasRecord) return; // no record yet, keep localStorage state
        const n = normalizeCompletion(data.completion);
        setNutritionCompletion(n);
        if (nutritionKey) lsSet(nutritionKey, JSON.stringify(n));
      })
      .catch(() => {})
      .finally(() => {
        if (myId !== nutHydIdRef.current) return; // stale — do NOT release the lock
        nutHydRef.current = false; // release: saves are now allowed
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, isAthlete, selectedDate]);

  // Save effect — only runs after hydration completes.
  // The inner setTimeout guard re-checks nutHydRef so a hydration that
  // starts during the 1-second debounce window also gets blocked.
  useEffect(() => {
    if (!authReady || !user || !isAthlete || !nutritionKey || nutHydRef.current) return;
    lsSet(nutritionKey, JSON.stringify(nutritionCompletion));
    clearTimeout(nutSaveTimer.current);
    nutSaveTimer.current = setTimeout(() => {
      if (nutHydRef.current) return; // new hydration started during debounce — abort
      fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(selectedDate)}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion: nutritionCompletion }),
      }).catch(() => {});
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutritionCompletion]);

  // ── Class schedules ───────────────────────────────────────────────────────
  const [classSchedules, setClassSchedules] = useState([]);
  const [classModal, setClassModal]         = useState(null);
  const classSaveTimer = useRef(null);

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
  }, [classModal, saveClassSchedules]);

  const handleClassDelete = useCallback(() => {
    if (!classModal?.schedule?.id) return;
    setClassSchedules(prev => {
      const next = prev.filter(c => c.id !== classModal.schedule.id);
      saveClassSchedules(next);
      return next;
    });
    setClassModal(null);
  }, [classModal, saveClassSchedules]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goPrev = useCallback(() =>
    setSelectedDate(d => toISODateLocal(addDays(new Date(`${d}T12:00:00`), -1))),
  [setSelectedDate]);
  const goNext = useCallback(() =>
    setSelectedDate(d => toISODateLocal(addDays(new Date(`${d}T12:00:00`), 1))),
  [setSelectedDate]);
  const refresh = useCallback(() => {
    reload(selectedDate);
    nutrition.reload(selectedDate);
  }, [reload, selectedDate, nutrition]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const nutritionCounts = useMemo(() => computeNutritionCounts(nutritionCompletion), [nutritionCompletion]);
  const workoutDone  = progress?.done  ?? 0;
  const workoutTotal = progress?.total ?? 0;
  const totalDone    = workoutDone + nutritionCounts.done;
  const totalItems   = workoutTotal + nutritionCounts.total;

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!authReady) return null;
  if (!user)      return <div className="p-6 text-sm text-gray-600">Please log in.</div>;
  if (!isAthlete) return <div className="p-6 text-sm text-gray-600">Not authorized.</div>;

  const canonicalItem = items?.find(i => String(i?.id || "") === String(activeItem?.id || ""));
  const evRaw = String(canonicalItem?.EvidenceRequired ?? activeItem?.EvidenceRequired ?? "").toLowerCase();
  const evidenceRequired = evRaw !== "" && evRaw !== "none" && evRaw !== "false" && evRaw !== "voluntary_activity_vara";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F0F4F8" }}>

      <div style={{ backgroundColor: "#0F1E2E" }} className="relative overflow-hidden sticky top-0 z-20">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize: "12px 12px" }} />

        {/* Mobile */}
        <div className="relative sm:hidden">
          <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
            <button type="button" onClick={() => router.push("/dashboard")}
              className="flex-shrink-0 flex items-center text-white/55 hover:text-white transition" aria-label="Back to dashboard">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <DateStrip loading={loading} selectedDate={selectedDate} dateStrip={dateStrip}
                onPrev={goPrev} onNext={goNext} onSelectDate={setSelectedDate} darkBg />
            </div>
            {totalItems > 0 && <ProgressRing done={totalDone} total={totalItems} size={32} stroke={3} />}
            <button type="button" onClick={refresh} disabled={loading}
              className="flex-shrink-0 text-white/50 hover:text-white transition disabled:opacity-30" aria-label="Refresh">
              <RefreshCw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 px-4 pb-2.5 min-w-0">
            <span className="text-[11px] font-black text-white/85 flex-shrink-0">{firstName}</span>
            {dailyWorkout?.Title ? (
              <>
                <span className="text-[10px] text-white/25 flex-shrink-0">·</span>
                <span className="text-[11px] text-white/40 font-semibold truncate">{dailyWorkout.Title}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:block max-w-3xl mx-auto px-4 pt-6 pb-8">
          <div className="flex items-center justify-between mb-7">
            <button type="button" onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-white/65 hover:text-white transition text-sm font-semibold">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={refresh} disabled={loading}
              className="flex items-center gap-1.5 text-white/65 hover:text-white transition text-sm font-semibold disabled:opacity-30">
              <RefreshCw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white/55 text-[11px] font-black uppercase tracking-widest mb-1.5">Today's Session</p>
              <h1 className="text-white text-2xl sm:text-3xl font-black leading-tight truncate">{firstName}</h1>
              {dailyWorkout?.Title && (
                <p className="text-white/65 text-sm font-semibold mt-1.5 truncate">{dailyWorkout.Title}</p>
              )}
            </div>
            {totalItems > 0 && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <ProgressRing done={totalDone} total={totalItems} size={60} stroke={5} />
                <span className="text-[11px] text-white/50 font-bold uppercase tracking-widest">Today</span>
              </div>
            )}
          </div>
          <div className="mt-5">
            <DateStrip loading={loading} selectedDate={selectedDate} dateStrip={dateStrip}
              onPrev={goPrev} onNext={goNext} onSelectDate={setSelectedDate} darkBg />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {err && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        )}

        <WorkoutCard
          loading={loading} dailyWorkout={dailyWorkout} items={items}
          onUpload={openModal} onQuickComplete={quickComplete}
          submittingId={submittingId} acknowledgingId={acknowledgingId}
          optimisticStatusById={optimisticStatusById}
          onAcknowledge={({ completionId, workoutItemId }) =>
            acknowledgeCompletion({ completionId, workoutItemId })
          }
        />

        <ScheduleSection
          selectedDate={selectedDate} classSchedules={classSchedules}
          onEditClass={(cls) => setClassModal({ schedule: cls })}
          onAddClass={() => setClassModal({ schedule: null })}
          onOpenPlanner={() => router.push("/athlete/day")}
        />

        <NutritionCard
          loading={nutrition.loading} err={nutrition.err} hasPlan={nutrition.hasPlan}
          daily={nutrition.daily} mealBlocks={nutrition.mealBlocks} planJson={nutrition.planJson}
          selectedDate={selectedDate} effectiveDate={nutrition.effectiveDate}
          nextPlan={nutrition.nextPlan} isFuture={nutrition.isFuture} message={nutrition.message}
          onRefresh={() => nutrition.reload(selectedDate)}
          onOpenNutrition={() => router.push("/athlete/nutrition")}
          dailyHydrationOz={dailyHydrationOz}
          nutritionCompletion={nutritionCompletion}
          onCompletionChange={(next) => setNutritionCompletion(normalizeCompletion(next))}
        />
      </div>

      <CompleteItemModal
        open={modalOpen} item={activeItem} selectedFile={selectedFile} coachNote={coachNote}
        submitting={Boolean(submittingId && activeItem?.id === submittingId)}
        onClose={closeModal} onPickFile={setSelectedFile} onChangeNote={setCoachNote}
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

      {classModal !== null && (
        <ClassScheduleModal
          schedule={classModal.schedule}
          onSave={handleClassSave}
          onDelete={classModal.schedule ? handleClassDelete : undefined}
          onClose={() => setClassModal(null)}
        />
      )}
    </div>
  );
}