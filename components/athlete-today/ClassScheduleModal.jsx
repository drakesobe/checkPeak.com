// components/athlete-today/ClassScheduleModal.jsx
// Shared by TodayStrip (today.jsx) and DayPlannerSheet.
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

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
function cx(...xs) { return xs.filter(Boolean).join(" "); }

export default function ClassScheduleModal({
  schedule,
  defaultStartMinutes,
  onSave,
  onDelete,
  onClose,
}) {
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

  const daySummary = WEEK_DAYS
    .filter(d => days.includes(d.idx))
    .map(d => d.long.slice(0, 3))
    .join(", ");

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

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full bg-white rounded-t-2xl overflow-hidden"
        style={{ maxWidth: 560, maxHeight: "92dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-8 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-0.5">
              Class schedule
            </p>
            <p className="text-[19px] font-bold text-gray-900 leading-tight" style={{ letterSpacing: "-0.02em" }}>
              {schedule ? "Edit class" : "Add class"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Class name</label>
            <input
              ref={inputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); }}
              placeholder="Calculus 201, Sports Psychology, Film Studies..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50"
            />
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
                      active ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}>
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
                      active ? "bg-[#1E3A5F] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="15" max="300" value={customDur}
                onChange={e => { setCustomDur(e.target.value); setDuration(0); }}
                placeholder="Custom"
                className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:border-amber-400 transition bg-gray-50" />
              {customDur && <span className="text-[12px] text-gray-500">minutes</span>}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Location / notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Room 204, Johnson Hall · Prof. Williams..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-amber-400 transition bg-gray-50 resize-none leading-relaxed" />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
              Semester range <span className="text-gray-300 font-normal normal-case tracking-normal">- optional</span>
            </label>
            <p className="text-[11px] text-gray-400 mb-2">Leave blank to repeat every week indefinitely.</p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">Start</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] focus:outline-none focus:border-amber-400 transition bg-gray-50" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-400 mb-1">End</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[12px] focus:outline-none focus:border-amber-400 transition bg-gray-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 border-t border-gray-100" style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}>
          {schedule && (
            <button type="button" onClick={onDelete}
              className="px-5 py-4 text-[13px] font-semibold text-red-500 hover:bg-red-50 transition border-r border-gray-100">
              Remove
            </button>
          )}
          <button type="button" onClick={save} disabled={!canSave}
            className={cx("flex-1 py-4 text-[13px] font-bold transition",
              canSave ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}>
            {schedule ? "Save changes" : "Add to schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}