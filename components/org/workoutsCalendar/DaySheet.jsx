// components/org/workoutsCalendar/DaySheet.jsx
"use client";

import { Plus, ClipboardList, Users, Dumbbell, CheckCircle2, X } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import WorkoutCard from "./WorkoutCard";
import WorkoutDetailModal from "./WorkoutDetailModal";
import { isoToDate, isSameISO } from "@/lib/org/workoutsCalendar/date";
import { normalizeSport } from "@/lib/org/workoutsCalendar/sports";
import { useEffect, useState } from "react";

function sumCounts(list) {
  const ws = Array.isArray(list) ? list : [];
  let wc = ws.length, ac = 0, ic = 0;
  ws.forEach((w) => { ac += Number(w?.athleteCount || 0); ic += Number(w?.itemCount || 0); });
  return { workoutsCount: wc, athleteCount: ac, itemCount: ic };
}

function SmBtn({ children, onClick, variant = "secondary", fullWidth = false }) {
  const base = {
    display:         "inline-flex",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             "5px",
    padding:         "7px 14px",
    fontSize:        "11px",
    fontWeight:      900,
    textTransform:   "uppercase",
    letterSpacing:   "0.06em",
    cursor:          "pointer",
    transition:      "background-color 0.12s",
    border:          `1px solid ${variant === "primary" ? DS.brand : DS.border}`,
    backgroundColor: variant === "primary" ? DS.brand : DS.cardBg,
    color:           variant === "primary" ? "#fff" : DS.labelText,
    width:           fullWidth ? "100%" : "auto",
  };
  return (
    <button type="button" onClick={onClick} style={base}
      onMouseEnter={(e) => {
        if (variant === "primary") { e.currentTarget.style.backgroundColor = DS.brandLight; }
        else { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = variant === "primary" ? DS.brand : DS.cardBg;
        e.currentTarget.style.borderColor      = variant === "primary" ? DS.brand : DS.border;
        e.currentTarget.style.color            = variant === "primary" ? "#fff" : DS.labelText;
      }}
    >
      {children}
    </button>
  );
}

export default function DaySheet({
  open, onClose,
  titleISO, todayISO, loading,
  workoutsByDate,
  selectedSports,
  onCreateForDay,
  onRefresh,        // () => void — called after any mutation in WorkoutDetailModal
}) {
  // Internal: which workout is open in detail modal
  const [detailWorkout, setDetailWorkout] = useState(null);
  const [detailOpen,    setDetailOpen]    = useState(false);

  const openDetail  = (w) => { setDetailWorkout(w); setDetailOpen(true); };
  const closeDetail = ()  => { setDetailOpen(false); };

  // After a detail mutation: close detail, trigger data refresh; DaySheet stays open
  const handleDetailRefresh = () => {
    onRefresh?.();
    setDetailOpen(false);
  };

  // Scroll lock + ESC — only active when detail is NOT open (detail manages its own)
  useEffect(() => {
    if (!open || detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose, detailOpen]);

  if (!open) return null;

  const selectedDayISO = String(titleISO || "").slice(0, 10);
  const isToday        = isSameISO(selectedDayISO, todayISO);

  const dayTitle = (() => {
    const d = isoToDate(selectedDayISO);
    return d.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  })();

  const dayListRaw = workoutsByDate?.[selectedDayISO] || [];
  const dayList    = (() => {
    const s = Array.isArray(selectedSports) ? selectedSports : [];
    if (!s.length) return dayListRaw;
    return dayListRaw.filter((w) => s.includes(normalizeSport(w?.Sport || "")));
  })();

  const counts = sumCounts(dayList);

  const handleCreate = () => {
    onClose?.();
    onCreateForDay?.(selectedDayISO);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999]">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Close"
        />

        {/* Panel */}
        <div className="absolute inset-0 flex items-center justify-center px-3 py-4 sm:px-6 sm:py-8">
          <div
            className="w-full flex flex-col"
            style={{
              maxWidth:        "680px",
              backgroundColor: DS.cardBg,
              border:          `1px solid ${DS.border}`,
              borderTop:       `3px solid ${isToday ? DS.safe : DS.brand}`,
              maxHeight:       "calc(100dvh - 32px)",
              overflow:        "hidden",
            }}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-start justify-between gap-4 shrink-0"
              style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
                    {dayTitle}
                  </p>
                  {isToday && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold"
                      style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}>
                      <CheckCircle2 className="w-3 h-3" /> Today
                    </span>
                  )}
                </div>

                {/* Stat chips */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { icon: ClipboardList, value: counts.workoutsCount, label: "workouts" },
                    { icon: Users,         value: counts.athleteCount,  label: "athletes"  },
                    { icon: Dumbbell,      value: counts.itemCount,     label: "items"     },
                  ].map(({ icon: Icon, value, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5 text-xs">
                      <Icon className="w-3.5 h-3.5" style={{ color: DS.brand }} />
                      <span className="font-black tabular-nums" style={{ color: DS.bodyText }}>{loading ? "…" : value}</span>
                      <span className="font-bold uppercase tracking-wide" style={{ color: DS.dimText }}>{label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <SmBtn onClick={handleCreate} variant="primary">
                  <Plus className="w-3.5 h-3.5" /> Create
                </SmBtn>
                <button type="button" onClick={onClose}
                  style={{ padding: "7px", border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.pageBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}>
                  <X className="w-4 h-4" style={{ color: DS.dimText }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-2">
              {loading ? (
                <div className="py-8 text-center">
                  <p className="text-xs font-bold" style={{ color: DS.dimText }}>Loading workouts…</p>
                </div>
              ) : dayList.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-3"
                  style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
                  <p className="text-sm font-black" style={{ color: DS.bodyText }}>No workouts scheduled.</p>
                  <p className="text-xs" style={{ color: DS.dimText }}>
                    {selectedSports?.length > 0
                      ? "Try clearing the sport filter, or create one for this day."
                      : "Create a workout to get this day started."}
                  </p>
                  <SmBtn onClick={handleCreate} variant="primary">
                    <Plus className="w-3.5 h-3.5" /> Create workout
                  </SmBtn>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-xs font-black uppercase tracking-wide" style={{ color: DS.brand }}>
                      Workouts
                    </p>
                    <div className="flex items-center gap-3">
                      {dayListRaw.length !== dayList.length && (
                        <p className="text-xs" style={{ color: DS.dimText }}>
                          {dayList.length} / {dayListRaw.length} shown
                        </p>
                      )}
                      <p className="text-xs" style={{ color: DS.dimText }}>
                        Click a workout to manage it
                      </p>
                    </div>
                  </div>
                  {dayList.map((w) => (
                    <WorkoutCard
                      key={w.id}
                      w={w}
                      onOpen={openDetail}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 flex justify-end"
              style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
              <SmBtn onClick={onClose}>Close</SmBtn>
            </div>
          </div>
        </div>
      </div>

      {/* WorkoutDetailModal stacked above DaySheet (z-index 10002 > 9999) */}
      <WorkoutDetailModal
        open={detailOpen}
        onClose={closeDetail}
        workout={detailWorkout}
        onRefresh={handleDetailRefresh}
      />
    </>
  );
}