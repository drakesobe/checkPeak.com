// components/athlete-today/WorkoutCard.jsx
// The primary visual of the athlete's day.
// Full-width dark card. Always expanded — the athlete sees their full workout
// the moment they open the page. No accordion. No hiding the most important
// information behind a tap.
//
// Design language: Nike Training Club × YEEZY. High contrast. Typography-forward.
// Numbers breathe. One accent color. Nothing decorative that isn't functional.

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  card:        "#0F0F0F",
  cardBorder:  "#1E1E1E",
  cardSurface: "#161616",
  cardLine:    "#282828",
  white:       "#FFFFFF",
  dim:         "rgba(255,255,255,0.35)",
  muted:       "rgba(255,255,255,0.18)",
  accent:      "#0057FF",
  green:       "#00C851",
  greenDim:    "rgba(0,200,81,0.15)",
};

// ─── Haptic ───────────────────────────────────────────────────────────────────
function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch {} }

// ─── Parse exercise meta into parts ──────────────────────────────────────────
function parseMeta(meta) {
  if (!meta) return {};
  const parts = meta.split(" · ");
  const sets   = parts.find(p => p.includes("set"))?.replace(" sets","").replace(" set","") || null;
  const reps   = parts.find(p => p.includes("rep"))?.replace(" reps","").replace(" rep","") || null;
  const weight = parts.find(p => !p.includes("set") && !p.includes("rep") && !p.includes("rest") && p.length > 0 && parts.indexOf(p) === 2) || null;
  const rest   = parts.find(p => p.includes("rest"))?.replace(" rest","") || null;
  return { sets, reps, weight, rest };
}

// ─── EXERCISE ROW ─────────────────────────────────────────────────────────────
function ExerciseRow({ sub, optimisticStatusById, onTap, isReadOnly, isLast }) {
  const done     = (optimisticStatusById?.[sub.id] || sub.item?.Status) === "Completed";
  const prevDone = useRef(done);
  const [flash,  setFlash] = useState(false);
  const { sets, reps, weight } = parseMeta(sub.meta);

  useEffect(() => {
    if (!prevDone.current && done) {
      haptic(10);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevDone.current = true;
      return () => clearTimeout(t);
    }
    if (!done) prevDone.current = false;
  }, [done]);

  return (
    <div
      onClick={() => !isReadOnly && onTap(sub)}
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           16,
        padding:       "13px 24px",
        borderBottom:  isLast ? "none" : `1px solid ${C.cardLine}`,
        cursor:        isReadOnly ? "default" : "pointer",
        background:    flash ? "rgba(0,200,81,0.06)" : "transparent",
        transition:    "background 0.3s",
        userSelect:    "none",
      }}
    >
      {/* Status indicator */}
      <div style={{
        width:          22,
        height:         22,
        borderRadius:   "50%",
        flexShrink:     0,
        border:         `1.5px solid ${done ? C.green : "rgba(255,255,255,0.2)"}`,
        background:     done ? C.greenDim : "transparent",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        transition:     "all 0.25s ease",
      }}>
        {done && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Check size={11} color={C.green} strokeWidth={3} />
          </motion.div>
        )}
      </div>

      {/* Exercise name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:       14,
          fontWeight:     done ? 400 : 600,
          color:          done ? C.dim : C.white,
          letterSpacing:  "-0.01em",
          overflow:       "hidden",
          textOverflow:   "ellipsis",
          whiteSpace:     "nowrap",
          textDecoration: done ? "line-through" : "none",
          textDecorationColor: "rgba(255,255,255,0.2)",
          transition:     "all 0.2s",
        }}>
          {sub.title}
        </div>
      </div>

      {/* Sets × Reps / Weight — right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {sets && reps && (
          <span style={{
            fontSize:      12,
            fontWeight:    700,
            color:         done ? C.muted : "rgba(255,255,255,0.6)",
            letterSpacing: "0.02em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {sets}×{reps}
          </span>
        )}
        {weight && (
          <span style={{
            fontSize:      11,
            fontWeight:    600,
            color:         done ? C.muted : C.accent,
            background:    done ? "rgba(255,255,255,0.04)" : "rgba(0,87,255,0.15)",
            border:        `1px solid ${done ? "rgba(255,255,255,0.06)" : "rgba(0,87,255,0.3)"}`,
            borderRadius:  4,
            padding:       "2px 7px",
            transition:    "all 0.2s",
          }}>
            {weight}
          </span>
        )}
        {/* Evidence required indicator */}
        {sub.evidenceRequired && !done && (
          <AlertCircle size={13} color="rgba(255,165,0,0.6)" />
        )}
      </div>
    </div>
  );
}

// ─── WORKOUT CARD ─────────────────────────────────────────────────────────────
export default function WorkoutCard({
  dailyWorkout,
  exercises,          // array of exercise sub-objects
  optimisticStatusById,
  onExerciseTap,
  loading,
  isReadOnly,
  selectedDate,
}) {
  const [showAll, setShowAll] = useState(false);

  if (loading && !dailyWorkout) {
    return (
      <div style={{ background: C.card, margin: "0 0 2px", padding: "28px 24px" }}>
        <div style={{ height: 12, width: 80, background: "#222", borderRadius: 3, marginBottom: 16 }} />
        <div style={{ height: 28, width: "60%", background: "#1A1A1A", borderRadius: 3, marginBottom: 24 }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 44, background: "#161616", borderRadius: 2, marginBottom: 1 }} />
        ))}
      </div>
    );
  }

  if (!dailyWorkout) return null;

  const doneCount  = exercises.filter(s => (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed").length;
  const totalCount = exercises.length;
  const allDone    = totalCount > 0 && doneCount >= totalCount;
  const pct        = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  // Show first 5 exercises by default, expand on demand
  const PREVIEW_COUNT = 5;
  const hasMore       = exercises.length > PREVIEW_COUNT;
  const visible       = showAll ? exercises : exercises.slice(0, PREVIEW_COUNT);

  return (
    <div style={{ background: C.card, marginBottom: 2 }}>

      {/* ── Card header ── */}
      <div style={{ padding: "24px 24px 0" }}>

        {/* Eyebrow — label + date */}
        <div style={{
          display:       "flex",
          alignItems:    "center",
          justifyContent: "space-between",
          marginBottom:  16,
        }}>
          <span style={{
            fontSize:      9,
            fontWeight:    800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color:         allDone ? C.green : C.accent,
            transition:    "color 0.4s",
          }}>
            {allDone ? "✓ Training complete" : "Training"}
          </span>
          <span style={{
            fontSize:      9,
            fontWeight:    600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         C.dim,
          }}>
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
          </span>
        </div>

        {/* Workout name — the hero element */}
        <div style={{
          fontSize:      28,
          fontWeight:    800,
          color:         allDone ? "rgba(255,255,255,0.4)" : C.white,
          letterSpacing: "-0.03em",
          lineHeight:    1.1,
          marginBottom:  20,
          transition:    "color 0.5s",
        }}>
          {dailyWorkout.Title || "Team Workout"}
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            height:       2,
            background:   "#252525",
            borderRadius: 1,
            overflow:     "hidden",
            marginBottom: 8,
          }}>
            <motion.div
              style={{ height: "100%", borderRadius: 1, background: allDone ? C.green : C.accent }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: C.dim, fontWeight: 500 }}>
              {doneCount} of {totalCount} complete
            </span>
            <span style={{
              fontSize:  11,
              fontWeight: 800,
              color:      allDone ? C.green : C.accent,
              letterSpacing: "0.05em",
            }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: C.cardLine, margin: "0 24px" }} />

      {/* ── Exercise list ── */}
      <AnimatePresence initial={false}>
        <div>
          {visible.map((sub, i) => (
            <ExerciseRow
              key={sub.id}
              sub={sub}
              optimisticStatusById={optimisticStatusById}
              onTap={onExerciseTap}
              isReadOnly={isReadOnly}
              isLast={i === visible.length - 1 && !hasMore}
            />
          ))}
        </div>
      </AnimatePresence>

      {/* ── Show more / less ── */}
      {hasMore && (
        <div
          onClick={() => setShowAll(v => !v)}
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            6,
            padding:        "13px 24px",
            cursor:         "pointer",
            borderTop:      `1px solid ${C.cardLine}`,
            color:          C.dim,
            fontSize:       12,
            fontWeight:     600,
            letterSpacing:  "0.05em",
          }}
        >
          {showAll ? (
            <><ChevronUp size={13} /> Show less</>
          ) : (
            <><ChevronDown size={13} /> {exercises.length - PREVIEW_COUNT} more exercises</>
          )}
        </div>
      )}

      {/* ── All done state ── */}
      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            10,
            padding:        "16px 24px",
            borderTop:      `1px solid ${C.cardLine}`,
            background:     "rgba(0,200,81,0.05)",
          }}
        >
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   "50%",
            background:     C.greenDim,
            border:         `1px solid rgba(0,200,81,0.3)`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
          }}>
            <Check size={13} color={C.green} strokeWidth={3} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>
            Workout complete
          </span>
        </motion.div>
      )}
    </div>
  );
}