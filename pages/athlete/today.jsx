// pages/athlete/today.jsx
// Athlete command center - Skimmer route checklist.
// Workout row tap → WorkoutSheet (dark bottom sheet, swipeable exercises).
// Meal rows → inline dual toggles. Class rows → photo completion.
"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import CompleteItemModal  from "@/components/athlete-today/CompleteItemModal";
import ClassScheduleModal from "@/components/athlete-today/ClassScheduleModal";
import DayPlannerSheet    from "@/components/athlete-today/DayPlannerSheet";
import RouteList          from "@/components/athlete-today/RouteList";
import WorkoutSheet       from "@/components/athlete-today/WorkoutSheet";

import { useAthleteToday }          from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion }      from "@/hooks/athlete-today/useWorkoutCompletion";
import { useAthleteNutritionToday } from "@/hooks/athlete-today/useAthleteNutritionToday";
import { useClassSchedules }        from "@/hooks/athlete-today/useClassSchedules";
import { useWorkoutLog }           from "@/hooks/athlete-today/useWorkoutLog";

import {
  makeEmptyCompletion, normalizeCompletion,
  classMatchesDate, dayPattern, MEAL_LABELS,
  lsGet, lsSet,
} from "@/lib/athlete-today/utils";

import { ChevronLeft, RefreshCw, Check, Calendar, Plus } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

// ─── Date helpers ─────────────────────────────────────────────────────────────
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ─── Streak ───────────────────────────────────────────────────────────────────
function computeStreak(who) {
  if (!who || typeof window === "undefined") return 0;
  let streak = 0;
  const d = new Date();
  const todayStr = localDateStr(d);
  for (let i = 0; i <= 60; i++) {
    const ds  = localDateStr(d);
    const raw = localStorage.getItem(`checkpeak:nutritionCompletion:${who}:${ds}`);
    let hasActivity = false;
    if (raw) {
      try { hasActivity = Object.values(JSON.parse(raw)).some(m => m?.mealDone || m?.hydrationDone); }
      catch {}
    }
    if (hasActivity) {
      streak++;
    } else if (ds === todayStr) {
      // Today not yet logged - skip it, check yesterday
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MEAL_TIMES = { breakfast: 7*60, lunch: 12*60, afternoon: 15*60, dinner: 18*60+30 };
const DAY_GROUPS = [
  { label: "Anytime",   dot: "#64748B", range: [0,        5*60+59]  },
  { label: "Morning",   dot: "#F59E0B", range: [6*60,     11*60+59] },
  { label: "Midday",    dot: "#1A6FE8", range: [12*60,    14*60+59] },
  { label: "Afternoon", dot: "#22C55E", range: [15*60,    18*60+59] },
  { label: "Evening",   dot: "#8B5CF6", range: [19*60,    24*60]    },
];
const SWIPE_HINT_KEY = "cp_swipe_hint:shown";

// ─── parseTimeToMinutes ───────────────────────────────────────────────────────
function parseTimeToMinutes(str) {
  if (!str) return null;
  const s = String(str).trim();
  const isPM = /pm/i.test(s);
  const isAM = /am/i.test(s);
  const parts = s.replace(/[^0-9:]/g, "").split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return null;
  // Only apply 12-hour conversion when am/pm is explicitly in the string
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  // 24-hour strings ("12:00", "13:00") are used as-is
  return h * 60 + m;
}

// ─── buildDayRoute ────────────────────────────────────────────────────────────
function buildDayRoute({
  dailyWorkout, items, dailyWorkouts, mealBlocks, hasPlan,
  classSchedules, selectedDate, optimisticStatusById,
  dailyHydrationOz, loading, mealTimeOverrides = {}, workoutTimeOverrides = {}, plannerPersonalEvents = [],
  daily = null, planPrescription = "",
}) {
  const events = [];

  const workoutList = Array.isArray(dailyWorkouts) && dailyWorkouts.length
    ? dailyWorkouts
    : (dailyWorkout ? [{ dailyWorkout, items }] : []);

  if (!loading) {
    workoutList.forEach(({ dailyWorkout: dw, items: dwItems }, idx) => {
      if (!dw) return;

      const rawDate = String(
        dw.Date         ||
        dw.WorkoutDate  ||
        dw.date         ||
        dw.workout_date ||
        dw.fields?.Date ||
        ""
      ).trim().slice(0, 10);

      const dateMatches = !rawDate || rawDate === selectedDate;
      if (!dateMatches) return;

      const sub = (dwItems || []).map(item => {
        const evRaw = String(item.EvidenceRequired || "").toLowerCase();
        const rawVideo = String(
          item.VideoURL || item.VideoUrl || item.Video ||
          item.video_url || item.video || item.VideoLink || ""
        ).trim();
        const videoUrl = rawVideo.startsWith("http") ? rawVideo : "";
        return {
          id: item.id, title: item.ExerciseName || "Exercise",
          meta: [
            item.Sets   && `${item.Sets} sets`,
            item.Reps   && `${item.Reps} reps`,
            item.Weight && item.Weight,
            item.Rest   && `${item.Rest} rest`,
          ].filter(Boolean).join(" · "),
          instructions: String(item.Instructions || item.instructions || item.Notes || "").trim(),
          videoUrl,
          evidenceRequired: evRaw !== "" && evRaw !== "none" && evRaw !== "false" && evRaw !== "voluntary_activity_vara",
          groupId: item.groupId || item.GroupId || null,
          item,
        };
      });

      const isScheduled = !!(workoutTimeOverrides?.[dw.id] ?? dw.ScheduledMinutes ?? dw.ScheduledTime);
      const scheduledMin = workoutTimeOverrides?.[dw.id]
        ?? dw.ScheduledMinutes
        ?? (dw.ScheduledTime ? parseTimeToMinutes(dw.ScheduledTime) : null)
        ?? (5 * 60 + idx * 30);

      events.push({
        id: `workout_session_${dw.id || idx}`,
        type: "workout",
        title: dw.Title || "Team Workout",
        meta: `${sub.length} exercise${sub.length !== 1 ? "s" : ""} · Coach assigned`,
        startMinutes: scheduledMin,
        durationMinutes: dw.ScheduledDuration || 90,
        sub,
        selfSchedule: !isScheduled,
      });
    });
  }

  if (hasPlan) {
    Object.entries(MEAL_TIMES).forEach(([key, defaultStart]) => {
      const startMinutes = mealTimeOverrides?.[key] ?? defaultStart;
      const block   = mealBlocks?.[key];
      const blockTargets = block?.targets || {};

      // Fall back to daily plan totals when there are no per-meal targets
      const hasBlockTargets = blockTargets.calories || blockTargets.protein || blockTargets.carbs || blockTargets.fat;
      const isDailyTarget   = !hasBlockTargets;
      const targets = hasBlockTargets ? blockTargets : {
        calories:    daily?.calories    || null,
        protein:     daily?.protein     || null,
        carbs:       daily?.carbs       || null,
        fat:         daily?.fat         || null,
        hydrationOz: daily?.hydrationOz || null,
      };

      const macroParts = [];
      if (targets.calories) macroParts.push(`${targets.calories} cal`);
      if (targets.protein)  macroParts.push(`${targets.protein}g pro`);
      if (targets.carbs)    macroParts.push(`${targets.carbs}g carbs`);
      // When showing daily totals, prefix the collapsed row meta so athletes
      // know these aren't per-meal numbers
      const meta = macroParts.length === 0 ? ""
        : isDailyTarget ? `Daily · ${macroParts.slice(0, 2).join(" · ")}`
        : macroParts.join(" · ");

      const mealHydOz = targets.hydrationOz ?? targets.hydration ?? dailyHydrationOz;
      events.push({
        id: `meal_${key}`, type: "meal", mealKey: key,
        title: block?.name || MEAL_LABELS[key], meta,
        isDailyTarget,
        startMinutes, durationMinutes: 45,
        targets: {
          calories:    targets.calories    ?? null,
          protein:     targets.protein     ?? null,
          carbs:       targets.carbs       ?? null,
          fat:         targets.fat         ?? null,
          hydrationOz: mealHydOz           ?? null,
        },
        notes: block?.notes || block?.coachNotes || planPrescription || "",
        diningHallNotes: block?.diningHallNotes || block?.diningNotes || "",
        hydrationOz: mealHydOz,
      });
    });
  }

  (classSchedules || []).forEach(cls => {
    if (!classMatchesDate(cls, selectedDate)) return;
    events.push({
      id: `cls_${cls.id}`, type: "class",
      title: cls.title, meta: cls.notes || "",
      startMinutes: cls.startMinutes, durationMinutes: cls.durationMinutes,
      badge: dayPattern(cls.days) || "Class", scheduleId: cls.id,
    });
  });

  (plannerPersonalEvents || []).forEach(ev => {
    events.push({
      id: ev.id,
      type: "personal",
      title: ev.title,
      meta: ev.notes || "",
      startMinutes: ev.startMinutes,
      durationMinutes: ev.durationMinutes || 60,
    });
  });

  events.sort((a, b) => a.startMinutes - b.startMinutes);
  const grouped = DAY_GROUPS.map(g => ({ ...g, items: [] }));
  events.forEach(ev => {
    const g = grouped.find(g => ev.startMinutes >= g.range[0] && ev.startMinutes <= g.range[1]);
    (g || grouped[grouped.length - 1]).items.push(ev);
  });
  return grouped.filter(g => g.items.length > 0);
}

// ─── PROGRESS RING ────────────────────────────────────────────────────────────
function ProgressRing({ done, total, size = 38, stroke = 3 }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const all = total > 0 && done >= total;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={all ? "#4ADE80" : "#4FABFF"} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {all
          ? <svg width={size*0.42} height={size*0.42} viewBox="0 0 20 20" fill="none"><path d="M5 10l3.5 3.5L15 7" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{done}</span>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", lineHeight: 1, marginTop: 1 }}>/{total}</span>
            </>
        }
      </div>
    </div>
  );
}

// ─── WEEK STRIP ───────────────────────────────────────────────────────────────
function WeekStrip({ selectedDate, onSelectDate, classSchedules, todayHasContent, completionMap = {} }) {
  const todayISO = localDateStr();
  const days = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    const sun = new Date(d); sun.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(sun); day.setDate(sun.getDate() + i);
      const ds  = localDateStr(day);
      const isToday = ds === todayISO;
      return {
        ds, num: day.getDate(), lbl: ["S","M","T","W","T","F","S"][i],
        isSelected: ds === selectedDate, isToday,
        isPast: ds < todayISO,
        isFuture: ds > todayISO,
        hasItems: (isToday && todayHasContent) || (!isToday && (classSchedules || []).some(c => classMatchesDate(c, ds))),
        completion: completionMap[ds] || null,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, classSchedules, todayHasContent, completionMap]);

  return (
    <div style={{ display: "flex", paddingTop: 10, paddingBottom: 2, borderTop: "0.5px solid rgba(255,255,255,0.07)", marginTop: 6 }}>
      {days.map(day => {
        const dotColor = day.isSelected
          ? "#4FABFF"
          : day.completion === "full"
            ? "#00C851"
            : day.completion === "partial"
              ? "rgba(0,200,81,0.45)"
              : day.isFuture && day.hasItems
                ? "rgba(96,165,250,0.35)"
                : day.isToday && day.hasItems
                  ? "rgba(96,165,250,0.5)"
                  : "transparent";

        const numColor = day.isSelected ? "#fff"
          : day.isToday ? "rgba(255,255,255,0.85)"
          : day.completion ? "rgba(255,255,255,0.6)"
          : "rgba(255,255,255,0.35)";

        const ringColor = day.isSelected
          ? "rgba(255,255,255,0.12)"
          : day.completion === "full" && !day.isSelected
            ? "rgba(0,200,81,0.1)"
            : "transparent";

        return (
          <div key={day.ds} onClick={() => onSelectDate(day.ds)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", paddingBottom: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
              color: day.isSelected ? "#93C5FD" : day.completion ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.25)" }}>
              {day.lbl}
            </div>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", position: "relative",
              background: ringColor,
              border: day.completion === "full" && !day.isSelected ? "1px solid rgba(0,200,81,0.25)" : "1px solid transparent",
              transition: "all 0.25s" }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, color: numColor, transition: "color 0.2s" }}>
                {day.num}
              </div>
              {day.completion === "full" && !day.isSelected && (
                <div style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%",
                  background: "#00C851", border: "1.5px solid #0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="4" height="4" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: dotColor, transition: "background 0.25s" }} />
          </div>
        );
      })}
    </div>
  );
}

// ─── NOW CONTEXT ──────────────────────────────────────────────────────────────
function useNowContext(groups, nutritionCompletion, optimisticStatusById, isToday) {
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  return useMemo(() => {
    if (!isToday) return null;
    const all = groups.flatMap(g => g.items);

    function itemDone(ev) {
      if (ev.type === "meal") { const c = nutritionCompletion?.[ev.mealKey]; return Boolean(c?.mealDone && c?.hydrationDone); }
      if (ev.type === "workout" && ev.sub) return ev.sub.length > 0 && ev.sub.every(s => (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed");
      return false;
    }

    const current  = all.find(ev => nowMin >= ev.startMinutes && nowMin < ev.startMinutes + (ev.durationMinutes || 60));
    const upcoming = all.find(ev => ev.startMinutes > nowMin);
    const colorMap = { workout: "#EF4444", meal: "#4FABFF", class: "#FBBF24" };

    if (current && !itemDone(current)) {
      return {
        label: "Right now", title: current.title, isNow: true,
        color: colorMap[current.type] || "#9AA0B4", type: "current",
        activeItemId: current.id,
        nextItemId:   null,
      };
    }
    if (upcoming) {
      const minOut = upcoming.startMinutes - nowMin;
      if (minOut <= 75) {
        return {
          label: `Up next · in ${minOut}m`, title: upcoming.title, isNow: false,
          color: colorMap[upcoming.type] || "#9AA0B4", type: "upcoming",
          activeItemId: null,
          nextItemId:   upcoming.id,
        };
      }
      const h = Math.floor(upcoming.startMinutes / 60) % 24, m = upcoming.startMinutes % 60;
      const ap = h >= 12 ? "pm" : "am", dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const timeStr = m === 0 ? `${dh}${ap}` : `${dh}:${String(m).padStart(2,"0")}${ap}`;
      return {
        label: "All clear", title: `Next up at ${timeStr} · ${upcoming.title}`, isNow: false,
        color: "#9AA0B4", type: "clear",
        activeItemId: null,
        nextItemId:   upcoming.id,
      };
    }
    const allDone = all.length > 0 && all.every(ev => itemDone(ev));
    if (allDone) {
      return {
        label: "Day complete", title: "All items checked off", isNow: false,
        color: "#4ADE80", type: "done",
        activeItemId: null, nextItemId: null,
      };
    }
    return null;
  }, [groups, nowMin, nutritionCompletion, optimisticStatusById, isToday]);
}

// ─── ALL DONE CELEBRATION ─────────────────────────────────────────────────────
function AllDoneState({ firstName, totalDone, workoutDone, workoutTotal, nutritionDone, nutritionTotal, hasPlan, onReview, onTomorrow, streak }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "65vh",
      padding: "48px 28px 56px", textAlign: "center",
      background: "#0A0A0A", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes dayIn { 0%{opacity:0;transform:translateY(32px) skewY(2deg)} 100%{opacity:1;transform:translateY(0) skewY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes streakIn { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(0,200,81,0.08) 0%, transparent 70%)",
        animation: "glowPulse 3s ease-in-out infinite",
      }} />

      {/* Check ring */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "rgba(0,200,81,0.1)", border: "1.5px solid rgba(0,200,81,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 24, position: "relative", zIndex: 1,
        boxShadow: "0 0 0 12px rgba(0,200,81,0.05), 0 0 40px rgba(0,200,81,0.12)",
        animation: "fadeUp 0.5s ease both",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l4.5 4.5L19 7" stroke="#00C851" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: "'Barlow Condensed', -apple-system, sans-serif",
        fontWeight: 900, fontStyle: "italic",
        fontSize: "clamp(3rem, 12vw, 5rem)",
        lineHeight: 0.9, letterSpacing: "-0.03em",
        textTransform: "uppercase", color: "#FFFFFF",
        marginBottom: 10, position: "relative", zIndex: 1,
        animation: "dayIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both",
      }}>
        Day<br /><span style={{ color: "#00C851" }}>Cleared.</span>
      </div>

      {/* Subtext */}
      <div style={{
        fontSize: 13, color: "rgba(255,255,255,0.32)", fontWeight: 500,
        marginBottom: streak > 0 ? 20 : 32, position: "relative", zIndex: 1,
        animation: "fadeUp 0.4s ease 0.25s both",
      }}>
        {firstName}, you finished {totalDone} {totalDone === 1 ? "thing" : "things"} today.
      </div>

      {/* Streak callout */}
      {streak > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.2)",
          borderRadius: 24, padding: "7px 16px 7px 12px",
          marginBottom: 32, position: "relative", zIndex: 1,
          animation: "streakIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.45s both",
        }}>
          <svg width="32" height="14" viewBox="0 0 32 14" fill="none">
            <polyline points="0,10 4,10 6,4 8,12 10,7 12,9 16,2 20,11 22,8 24,10 28,10 32,10"
              stroke="#4FABFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#4FABFF", letterSpacing: "0.02em" }}>
            {streak} day streak
          </span>
        </div>
      )}

      {/* Summary card */}
      <div style={{
        width: "100%", maxWidth: 280,
        background: "#111111", border: "1px solid #1E1E1E",
        borderRadius: 14, overflow: "hidden",
        marginBottom: 28, position: "relative", zIndex: 1,
        animation: "fadeUp 0.4s ease 0.35s both",
      }}>
        {workoutTotal > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderBottom: hasPlan ? "1px solid #1E1E1E" : "none" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Workout</span>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: workoutDone >= workoutTotal ? "#00C851" : "rgba(255,255,255,0.4)" }}>
                {workoutDone}/{workoutTotal}
              </span>
              {workoutDone >= workoutTotal && (
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(0,200,81,0.15)", border: "1px solid rgba(0,200,81,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={9} color="#00C851" strokeWidth={3}/>
                </div>
              )}
            </div>
          </div>
        )}
        {hasPlan && nutritionTotal > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Nutrition</span>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: nutritionDone >= nutritionTotal ? "#00C851" : "rgba(255,255,255,0.4)" }}>
                {nutritionDone}/{nutritionTotal}
              </span>
              {nutritionDone >= nutritionTotal && (
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(0,200,81,0.15)", border: "1px solid rgba(0,200,81,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={9} color="#00C851" strokeWidth={3}/>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 280, position: "relative", zIndex: 1, animation: "fadeUp 0.4s ease 0.5s both" }}>
        {onTomorrow && (
          <button onClick={onTomorrow} style={{
            flex: 1, padding: "12px 0",
            background: "#1A2B40", border: "1px solid rgba(79,171,255,0.25)",
            borderRadius: 12, fontSize: 13, fontWeight: 700,
            color: "#93C5FD", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}>
            Tomorrow
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        )}
        <button onClick={onReview} style={{
          flex: 1, padding: "12px 0",
          background: "transparent", border: "1px solid #2A2A2A",
          borderRadius: 12, fontSize: 13, fontWeight: 600,
          color: "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "inherit",
        }}>
          Review
        </button>
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

  // ── Streak ────────────────────────────────────────────────────────────────
  const [streak, setStreak] = useState(0);
  const recomputeStreak = useCallback(() => {
    const who = athleteToken || String(user?.Email || user?.email || "").trim().toLowerCase();
    setStreak(computeStreak(who));
  }, [athleteToken, user]);
  useEffect(() => { recomputeStreak(); }, [recomputeStreak]);

  // ── Workout ───────────────────────────────────────────────────────────────
  const { selectedDate, setSelectedDate, loading, dailyWorkout, dailyWorkouts, items, err, setErr, reload } =
    useAthleteToday({ authReady, user, isAthlete });

  const {
    modalOpen, activeItem, selectedFile, coachNote,
    submittingId, optimisticStatusById,
    openModal, closeModal, setSelectedFile, setCoachNote,
    submitCompletion, quickComplete, acknowledgeCompletion,
  } = useWorkoutCompletion({ selectedDate, reload, setErr });

  const { saveSetLog, getExerciseSessions } = useWorkoutLog({ athleteToken, selectedDate });

  // ── Nutrition ─────────────────────────────────────────────────────────────
  const nutrition        = useAthleteNutritionToday({ authReady, user, isAthlete, selectedDate });
  const dailyHydrationOz = nutrition.dailyHydrationOz ?? null;

  // ── Nutrition completion ──────────────────────────────────────────────────
  const [nutritionCompletion, setNutritionCompletion] = useState(makeEmptyCompletion);
  const nKey = useMemo(() => {
    const who = athleteToken || String(user?.Email || user?.email || "").trim().toLowerCase();
    return who ? `checkpeak:nutritionCompletion:${who}:${selectedDate}` : "";
  }, [athleteToken, user, selectedDate]);

  const nutHydIdRef  = useRef(0);
  const nutSaveTimer = useRef(null);
  const isDirtyRef   = useRef(false);

  useEffect(() => {
    if (!authReady || !user || !isAthlete || !selectedDate) return;
    const myId = ++nutHydIdRef.current;
    isDirtyRef.current = false;
    if (nKey) {
      const cached = lsGet(nKey);
      setNutritionCompletion(cached ? normalizeCompletion(JSON.parse(cached)) : makeEmptyCompletion());
    }
    fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(selectedDate)}`, { method: "GET", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (myId !== nutHydIdRef.current) return;
        if (!data?.ok) return;
        if (isDirtyRef.current) return;
        const n = normalizeCompletion(data.completion ?? null);
        setNutritionCompletion(n);
        if (nKey) lsSet(nKey, JSON.stringify(n));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, isAthlete, selectedDate]);

  useEffect(() => {
    if (!authReady || !user || !isAthlete || !nKey) return;
    if (!isDirtyRef.current) return;
    lsSet(nKey, JSON.stringify(nutritionCompletion));
    clearTimeout(nutSaveTimer.current);
    nutSaveTimer.current = setTimeout(() => {
      if (!isDirtyRef.current) return;
      fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(selectedDate)}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion: nutritionCompletion }),
      }).then(r => {
        if (!r.ok) toast.error("Nutrition sync failed — progress saved locally", { id: "nut-sync", duration: 4000 });
      }).catch(() => {
        toast.error("Nutrition sync failed — progress saved locally", { id: "nut-sync", duration: 4000 });
      });
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutritionCompletion]);

  // Recompute streak whenever a meal is checked off (nutritionCompletion now in scope)
  useEffect(() => { recomputeStreak(); }, [nutritionCompletion, recomputeStreak]);

  // ── Flush dirty nutrition state on page hide/close ────────────────────────
  useEffect(() => {
    if (!isAthlete || !nKey) return;
    function flush() {
      if (!isDirtyRef.current) return;
      clearTimeout(nutSaveTimer.current);
      isDirtyRef.current = false;
      fetch(`/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(selectedDate)}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion: nutritionCompletion }),
        keepalive: true,
      }).catch(() => {});
    }
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
    };
  }, [isAthlete, nKey, selectedDate, nutritionCompletion]);

  // ── Week completion map (for strip dots) ──────────────────────────────────
  const weekCompletionMap = useMemo(() => {
    if (typeof window === "undefined") return {};
    const who = athleteToken || String(user?.Email || user?.email || "").trim().toLowerCase();
    if (!who) return {};
    const map = {};
    for (let i = 0; i <= 13; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds  = localDateStr(d);
      const raw = localStorage.getItem(`checkpeak:nutritionCompletion:${who}:${ds}`);
      if (!raw) continue;
      try {
        const vals  = Object.values(JSON.parse(raw));
        const total = vals.length * 2;
        const done  = vals.reduce((a, m) => a + (m?.mealDone ? 1 : 0) + (m?.hydrationDone ? 1 : 0), 0);
        if (done >= total && total > 0) map[ds] = "full";
        else if (done > 0)              map[ds] = "partial";
      } catch {}
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteToken, user, nutritionCompletion]);

  // ── Class schedules ───────────────────────────────────────────────────────
  const { classSchedules, upsertSchedule, removeSchedule } = useClassSchedules({ authReady, isAthlete, athleteToken });
  const [classModal, setClassModal] = useState(null);

  const handleClassSave   = useCallback(data => { upsertSchedule(data, classModal?.schedule?.id || null); setClassModal(null); }, [classModal, upsertSchedule]);
  const handleClassDelete = useCallback(() => { if (classModal?.schedule?.id) removeSchedule(classModal.schedule.id); setClassModal(null); }, [classModal, removeSchedule]);

  // ── Route state ───────────────────────────────────────────────────────────
  const [expandedIds,  setExpandedIds]  = useState(new Set());
  const [completedIds, setCompletedIds] = useState(new Set());

  const toggleExpand = useCallback(id => {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // ── Workout sheet ─────────────────────────────────────────────────────────
  const [workoutSheetOpen, setWorkoutSheetOpen] = useState(false);
  const [workoutSheetItem, setWorkoutSheetItem] = useState(null);

  // ── Day planner sheet ─────────────────────────────────────────────────────
  const [plannerOpen, setPlannerOpen] = useState(false);

  const [plannerMealTimeOverrides, setPlannerMealTimeOverrides] = useState({});
  const handleNutritionTimesChange = useCallback((times) => {
    setPlannerMealTimeOverrides(prev => ({ ...prev, ...times }));
  }, []);

  const [workoutTimeOverrides, setWorkoutTimeOverrides] = useState({});
  const [plannerEvents, setPlannerEvents] = useState([]);
  const handleWorkoutTimesChange = useCallback((times) => {
    setWorkoutTimeOverrides(prev => ({ ...prev, ...times }));
  }, []);

  // Reset overrides on date change
  useEffect(() => {
    setPlannerMealTimeOverrides({});
    setWorkoutTimeOverrides({});
  }, [selectedDate]);

  // ── Planner personal events ───────────────────────────────────────────────
  // useCallback declared first so the useEffects below can reference it.
  const prevPlannerOpenRef = useRef(false);
  const fetchPlannerEvents = useCallback(() => {
    if (!authReady || !user || !isAthlete || !selectedDate) return;
    fetch(`/api/athlete/day-planner/upsert?date=${encodeURIComponent(selectedDate)}`, { method: "GET", credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.ok || !data.hasRecord) { setPlannerEvents([]); return; }
        setPlannerEvents((data.events || []).filter(e =>
          e.source !== "nutrition" && e.source !== "coach_workout" &&
          e.source !== "coachworkout" && e.title
        ));
      })
      .catch(() => setPlannerEvents([]));
  }, [authReady, user, isAthlete, selectedDate]);

  // Fetch on mount and whenever auth/date deps change
  useEffect(() => { fetchPlannerEvents(); }, [fetchPlannerEvents]);

  // Re-fetch when planner closes so newly created events appear immediately
  useEffect(() => {
    if (prevPlannerOpenRef.current && !plannerOpen) fetchPlannerEvents();
    prevPlannerOpenRef.current = plannerOpen;
  }, [plannerOpen, fetchPlannerEvents]);

  // ── Workout tap / sheet ───────────────────────────────────────────────────
  const handleWorkoutTap = useCallback((item) => {
    setWorkoutSheetItem(item);
    setWorkoutSheetOpen(true);
  }, []);

  const handleSheetExerciseTap = useCallback((sub) => {
    if (sub.evidenceRequired) {
      setWorkoutSheetOpen(false);
      setTimeout(() => openModal(sub.item), 250);
    } else {
      quickComplete(sub.item);
    }
  }, [openModal, quickComplete]);

  const sheetWasOpenRef = useRef(false);
  useEffect(() => {
    if (modalOpen) sheetWasOpenRef.current = workoutSheetOpen;
    else if (sheetWasOpenRef.current) { sheetWasOpenRef.current = false; setWorkoutSheetOpen(true); }
  }, [modalOpen]); // eslint-disable-line

  // ── Swipe hint ────────────────────────────────────────────────────────────
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(SWIPE_HINT_KEY)) {
      const t = setTimeout(() => {
        setShowSwipeHint(true);
        localStorage.setItem(SWIPE_HINT_KEY, "1");
        setTimeout(() => setShowSwipeHint(false), 2500);
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNutritionToggle = useCallback((mealKey, field) => {
    isDirtyRef.current = true;
    setNutritionCompletion(prev => {
      if (field === "both") return { ...prev, [mealKey]: { mealDone: true, hydrationDone: true } };
      return { ...prev, [mealKey]: { ...prev[mealKey], [field]: !prev[mealKey][field] } };
    });
  }, []);

  const handleCompleteClass = useCallback(id => {
    setCompletedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleClassTap = useCallback(item => {
    const cls = classSchedules.find(c => c.id === item.scheduleId);
    if (cls) setClassModal({ schedule: cls });
  }, [classSchedules]);

  const handleCompleteWithPhoto = useCallback(async (item, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    formData.append("classId", item.scheduleId || item.id);
    formData.append("classTitle", item.title || "");
    formData.append("date", selectedDate);
    const res  = await fetch("/api/athlete/class/complete", { method: "POST", credentials: "include", body: formData });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
    setCompletedIds(prev => { const n = new Set(prev); n.add(item.id); return n; });
  }, [selectedDate]);

  // ── Route + counts ────────────────────────────────────────────────────────
  const groups = useMemo(() => buildDayRoute({
    dailyWorkout, items, dailyWorkouts,
    mealBlocks: nutrition.mealBlocks, hasPlan: nutrition.hasPlan,
    classSchedules, selectedDate, optimisticStatusById, dailyHydrationOz,
    loading,
    mealTimeOverrides: plannerMealTimeOverrides,
    workoutTimeOverrides,
    plannerPersonalEvents: plannerEvents,
    daily: nutrition.daily,
    planPrescription: nutrition.plan?.prescription || "",
  }), [
    dailyWorkout, items, dailyWorkouts,
    nutrition.mealBlocks, nutrition.hasPlan, nutrition.daily, nutrition.plan,
    classSchedules, selectedDate, optimisticStatusById, dailyHydrationOz,
    loading, plannerMealTimeOverrides, workoutTimeOverrides, plannerEvents,
  ]);

  const { totalDone, totalItems, workoutDone, workoutTotal, nutritionDone, nutritionTotal } = useMemo(() => {
    let wD = 0, wT = 0, nD = 0, nT = 0;
    groups.forEach(g => g.items.forEach(item => {
      if (item.type === "workout") {
        (item.sub || []).forEach(s => { wT++; if ((optimisticStatusById?.[s.id] || s.item?.Status) === "Completed") wD++; });
      } else if (item.type === "meal" && nutrition.hasPlan) {
        nT += 2;
        if (nutritionCompletion?.[item.mealKey]?.mealDone)      nD++;
        if (nutritionCompletion?.[item.mealKey]?.hydrationDone) nD++;
      }
    }));
    return { workoutDone: wD, workoutTotal: wT, nutritionDone: nD, nutritionTotal: nT, totalDone: wD + nD, totalItems: wT + nT };
  }, [groups, optimisticStatusById, nutritionCompletion, nutrition.hasPlan]);

  const refresh = useCallback(() => { reload(selectedDate); nutrition.reload(selectedDate); }, [reload, selectedDate, nutrition]);

  // ── Date context ──────────────────────────────────────────────────────────
  const todayStr  = localDateStr();
  const isToday   = selectedDate === todayStr;
  const isPastDay = selectedDate < todayStr;
  const dateLabel = isToday
    ? "Today"
    : new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  // ── All-done state ────────────────────────────────────────────────────────
  const [showAllDone, setShowAllDone] = useState(false);
  const [reviewMode,  setReviewMode]  = useState(false);
  // True once we've seen at least one incomplete item this session -
  // prevents the celebration firing on page load when everything is pre-done.
  const seenIncompleteRef = useRef(false);

  useEffect(() => {
    if (totalItems > 0 && totalDone < totalItems) seenIncompleteRef.current = true;
  }, [totalItems, totalDone]);

  useEffect(() => {
    if (!isToday || reviewMode) return;
    if (totalItems > 0 && totalDone >= totalItems && seenIncompleteRef.current) {
      seenIncompleteRef.current = false;
      const t = setTimeout(() => setShowAllDone(true), 700);
      return () => clearTimeout(t);
    }
  }, [totalDone, totalItems, isToday, reviewMode]);

  useEffect(() => { setShowAllDone(false); setReviewMode(false); seenIncompleteRef.current = false; }, [selectedDate]);

  // ── Now context ───────────────────────────────────────────────────────────
  const nowCtx = useNowContext(groups, nutritionCompletion, optimisticStatusById, isToday);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!authReady) return null;
  if (!user)      return <div style={{ padding: 24, fontSize: 14, color: "#6B7280" }}>Please log in.</div>;
  if (!isAthlete) return <div style={{ padding: 24, fontSize: 14, color: "#6B7280" }}>Not authorized.</div>;

  const canonicalItem    = items?.find(i => String(i?.id || "") === String(activeItem?.id || ""));
  const evRaw            = String(canonicalItem?.EvidenceRequired ?? activeItem?.EvidenceRequired ?? "").toLowerCase();
  const evidenceRequired = evRaw !== "" && evRaw !== "none" && evRaw !== "false" && evRaw !== "voluntary_activity_vara";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0A0A0A" }}>
      <Toaster position="bottom-center" toastOptions={{ style: { background: "#1A1A1A", color: "#fff", fontSize: 13, fontWeight: 600, border: "1px solid #2A2A2A" }, error: { iconTheme: { primary: "#EF4444", secondary: "#1A1A1A" } } }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes nowPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#1A2B40", position: "sticky", top: 0, zIndex: 20, paddingTop: "env(safe-area-inset-top, 0)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px 0" }}>
          <button type="button" onClick={() => router.push("/dashboard")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px 0 0", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <ChevronLeft size={20} color="rgba(255,255,255,0.45)" />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {dateLabel}
              </div>
              {streak > 0 && isToday && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(0,87,255,0.15)", border: "0.5px solid rgba(0,87,255,0.3)", borderRadius: 20, padding: "3px 9px 3px 7px", flexShrink: 0 }}>
                  <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                    <polyline points="0,10 4,10 6,4 8,12 10,7 12,9 14,2 16,11 18,8 20,10 24,10 28,10" stroke="#4FABFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#4FABFF" }}>{streak}</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginTop: 1 }}>
              {firstName}
              {isToday   && <span style={{ color: "rgba(96,165,250,0.65)", marginLeft: 5 }}>· Live</span>}
              {isPastDay && <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: 5 }}>· Past</span>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button type="button" onClick={refresh} disabled={loading}
              style={{ background: "none", border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.35 : 1, padding: 4, display: "flex" }}>
              <RefreshCw size={15} color="rgba(255,255,255,0.45)" style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
            {totalItems > 0 && <ProgressRing done={totalDone} total={totalItems} />}
          </div>
        </div>

        <div style={{ padding: "0 18px" }}>
          <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} classSchedules={classSchedules} todayHasContent={groups.length > 0} completionMap={weekCompletionMap} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px 10px", borderTop: "0.5px solid rgba(255,255,255,0.06)", minHeight: 38 }}>
          {nowCtx ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", background: nowCtx.color, flexShrink: 0,
                animation: nowCtx.isNow ? "nowPulse 1.5s ease-in-out infinite" : "none",
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: nowCtx.isNow ? nowCtx.color : "rgba(255,255,255,0.3)", lineHeight: 1 }}>
                  {nowCtx.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: nowCtx.type === "done" ? "#4ADE80" : "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                  {nowCtx.title}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 500, color: err ? "#FCA5A5" : "rgba(255,255,255,0.28)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {err ? `⚠ ${err}` : isPastDay ? dateLabel : totalItems > 0 ? `${totalDone} of ${totalItems} complete` : "Swipe items right to complete"}
            </div>
          )}

          {!isPastDay && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button type="button" onClick={() => setClassModal({ schedule: null })}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.14)", borderRadius: 7, padding: "5px 9px", cursor: "pointer", color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600 }}>
                <Plus size={11} /> Class
              </button>
              <button type="button" onClick={() => setPlannerOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(96,165,250,0.12)", border: "0.5px solid rgba(96,165,250,0.25)", borderRadius: 7, padding: "5px 9px", cursor: "pointer", color: "#93C5FD", fontSize: 11, fontWeight: 600 }}>
                <Calendar size={11} /> Plan day
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ background: "#0A0A0A", minHeight: "calc(100dvh - 160px)" }}>
        {showAllDone && !reviewMode ? (
          <AllDoneState
            firstName={firstName} totalDone={totalDone}
            workoutDone={workoutDone} workoutTotal={workoutTotal}
            nutritionDone={nutritionDone} nutritionTotal={nutritionTotal}
            hasPlan={nutrition.hasPlan}
            streak={streak}
            onReview={() => { setReviewMode(true); setShowAllDone(false); }}
            onTomorrow={() => {
              const d = new Date(`${selectedDate}T12:00:00`);
              d.setDate(d.getDate() + 1);
              setSelectedDate(localDateStr(d));
              setShowAllDone(false);
              setReviewMode(false);
            }}
          />
        ) : (
          <RouteList
            groups={groups}
            loading={loading || nutrition.loading}
            completedIds={completedIds}
            expandedIds={expandedIds}
            nutritionCompletion={nutritionCompletion}
            optimisticStatusById={optimisticStatusById}
            onWorkoutTap={handleWorkoutTap}
            onCompleteClass={handleCompleteClass}
            onCompleteWithPhoto={handleCompleteWithPhoto}
            onToggleExpand={toggleExpand}
            onNutritionToggle={handleNutritionToggle}
            onClassTap={handleClassTap}
            onAddClass={() => setClassModal({ schedule: null })}
            activeItemId={nowCtx?.activeItemId || null}
            nextItemId={nowCtx?.nextItemId || null}
            isReadOnly={isPastDay}
            isPastDay={isPastDay}
            dateLabel={dateLabel}
            showSwipeHint={showSwipeHint}
          />
        )}
      </div>

      {/* ── WORKOUT SHEET ── */}
      <WorkoutSheet
        isOpen={workoutSheetOpen}
        onClose={() => setWorkoutSheetOpen(false)}
        workoutItem={workoutSheetItem}
        dailyWorkout={dailyWorkout}
        optimisticStatusById={optimisticStatusById}
        onExerciseTap={handleSheetExerciseTap}
        onQuickComplete={(sub) => quickComplete(sub.item)}
        onLogSet={saveSetLog}
        getExerciseSessions={getExerciseSessions}
        onAcknowledgeRejection={({ workoutItemId }) => acknowledgeCompletion({ workoutItemId })}
      />

      {/* ── MODALS ── */}
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

      <DayPlannerSheet
        isOpen={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        classSchedules={classSchedules}
        onUpsertClass={(data, existingId) => upsertSchedule(data, existingId)}
        onRemoveClass={(id) => removeSchedule(id)}
        authReady={authReady}
        user={user}
        isAthlete={isAthlete}
        athleteToken={athleteToken}
        firstName={firstName}
        onNutritionTimesChange={handleNutritionTimesChange}
        onWorkoutTimeChange={handleWorkoutTimesChange}
      />
    </div>
  );
}