// components/athlete-today/WorkoutSheet.jsx
// Dark bottom sheet that slides up when the athlete taps the workout row.
// Swipe right on any exercise = quick-complete.
// Tap an exercise that requires evidence = opens CompleteItemModal.
// Design language matches WorkoutCard: #0F0F0F, blue accent, green done state.
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Check, X, ChevronDown, AlertCircle } from "lucide-react";

// ─── Design tokens (matches WorkoutCard exactly) ──────────────────────────────
const C = {
  bg:        "#0F0F0F",
  surface:   "#161616",
  cardLine:  "#1E1E1E",
  white:     "#FFFFFF",
  dim:       "rgba(255,255,255,0.35)",
  muted:     "rgba(255,255,255,0.18)",
  accent:    "#0057FF",
  green:     "#00C851",
  greenDim:  "rgba(0,200,81,0.15)",
  greenText: "#00C851",
  handle:    "#2A2A2A",
};

// ─── Haptic ───────────────────────────────────────────────────────────────────
function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch {} }

// ─── Parse meta string into chip parts ───────────────────────────────────────
function parseMeta(meta) {
  if (!meta) return [];
  return meta.split(" · ").filter(Boolean).map((part, i) => {
    const colors = [
      { bg: "rgba(0,87,255,0.18)",   text: "#79B8FF", border: "rgba(0,87,255,0.3)"   }, // sets - blue
      { bg: "rgba(139,92,246,0.18)", text: "#C4B5FD", border: "rgba(139,92,246,0.3)" }, // reps - purple
      { bg: "rgba(245,158,11,0.18)", text: "#FCD34D", border: "rgba(245,158,11,0.3)" }, // weight - amber
      { bg: "rgba(34,197,94,0.15)",  text: "#86EFAC", border: "rgba(34,197,94,0.25)" }, // rest - green
    ];
    return { label: part, ...colors[Math.min(i, colors.length - 1)] };
  });
}

// ─── Swipe hook (Framer Motion) ───────────────────────────────────────────────
const SWIPE_THRESHOLD = 88;

function useSwipeRight(onFire, disabled) {
  const controls = useAnimation();
  const [dragX,  setDragX]  = useState(0);
  const [armed,  setArmed]  = useState(false);

  useEffect(() => {
    if (disabled) {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 40 } });
      setDragX(0); setArmed(false);
    }
  }, [disabled, controls]);

  const props = {
    drag:            disabled ? false : "x",
    dragConstraints: { left: 0, right: 60 },
    dragElastic:     { left: 0, right: 0.08 },
    dragMomentum:    false,
    onDrag: (_, info) => {
      if (disabled) return;
      const x = Math.max(0, info.offset.x);
      setDragX(x);
      setArmed(x > SWIPE_THRESHOLD * 0.75);
    },
    onDragEnd: (_, info) => {
      if (disabled) return;
      controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 40 } });
      setDragX(0); setArmed(false);
      if (info.offset.x > SWIPE_THRESHOLD) setTimeout(onFire, 0);
    },
    animate: controls,
    style: { touchAction: "pan-y", cursor: disabled ? "default" : "grab" },
  };

  return { props, dragX, armed };
}

// ─── EXERCISE ROW ─────────────────────────────────────────────────────────────
function ExerciseRow({ sub, optimisticStatusById, onTap, isLast }) {
  const done     = (optimisticStatusById?.[sub.id] || sub.item?.Status) === "Completed";
  const prevDone = useRef(done);
  const [flash,  setFlash] = useState(false);

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

  const fire    = useCallback(() => onTap(sub), [onTap, sub]);
  const { props, dragX, armed } = useSwipeRight(fire, done);
  const chips   = parseMeta(sub.meta);

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Reveal - invisible at rest, fades in as row moves */}
      {!done && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 56,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: Math.min(1, dragX / 18), pointerEvents: "none",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: armed ? "rgba(0,200,81,0.25)" : "rgba(0,200,81,0.12)",
            border: `1.5px solid ${armed ? C.green : "rgba(0,200,81,0.35)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s, border-color 0.15s",
            transform: armed ? "scale(1.1)" : "scale(1)",
          }}>
            <Check size={13} color={armed ? C.green : "rgba(0,200,81,0.6)"} strokeWidth={3} />
          </div>
        </div>
      )}

      {/* Row */}
      <motion.div
        {...props}
        onClick={() => !done && onTap(sub)}
        style={{
          ...props.style,
          width: "100%",
          display: "flex", alignItems: "flex-start", gap: 14,
          padding: "13px 20px",
          background: flash ? "rgba(0,200,81,0.07)" : C.bg,
          borderBottom: isLast ? "none" : `1px solid ${C.cardLine}`,
          boxSizing: "border-box",
          userSelect: "none",
        }}
      >
        {/* Status circle */}
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          border: `1.5px solid ${done ? C.green : "rgba(255,255,255,0.2)"}`,
          background: done ? C.greenDim : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s ease",
          marginTop: 1,
        }}>
          {done && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Check size={11} color={C.green} strokeWidth={3} />
            </motion.div>
          )}
        </div>

        {/* Name + chips */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: done ? 400 : 600,
            color: done ? C.dim : C.white,
            letterSpacing: "-0.01em", lineHeight: 1.25,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textDecoration: done ? "line-through" : "none",
            textDecorationColor: "rgba(255,255,255,0.2)",
            transition: "all 0.2s",
          }}>
            {sub.title}
          </div>

          {!done && chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
              {chips.map((chip, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 700,
                  background: chip.bg, color: chip.text,
                  border: `1px solid ${chip.border}`,
                  borderRadius: 4, padding: "2px 7px",
                  letterSpacing: "0.01em",
                }}>
                  {chip.label}
                </span>
              ))}
            </div>
          )}

          {/* Instructions */}
          {!done && sub.instructions ? (
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 7,
              lineHeight: 1.55, fontWeight: 400,
            }}>
              {sub.instructions}
            </div>
          ) : null}

          {/* Video link */}
          {!done && sub.videoUrl ? (
            <a
              href={sub.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                marginTop: 8,
                fontSize: 11, fontWeight: 700, color: C.accent,
                textDecoration: "none",
                background: "rgba(0,87,255,0.12)",
                border: "1px solid rgba(0,87,255,0.25)",
                borderRadius: 5, padding: "3px 9px",
                letterSpacing: "0.01em",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
              </svg>
              Watch video
            </a>
          ) : null}

          {done && sub.meta && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub.meta}</div>
          )}
        </div>

        {/* Evidence required indicator */}
        {sub.evidenceRequired && !done && (
          <div style={{ flexShrink: 0, marginTop: 3 }}>
            <AlertCircle size={14} color="rgba(255,165,0,0.6)" />
          </div>
        )}
      </motion.div>

      {/* Swipe progress bar */}
      {dragX > 4 && (
        <div style={{ height: 2, background: "#252525", position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <motion.div
            style={{ height: "100%", background: armed ? C.green : "#00A040", borderRadius: 1 }}
            animate={{ width: `${Math.min(100, (dragX / SWIPE_THRESHOLD) * 100)}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      )}
    </div>
  );
}

// ─── WORKOUT SHEET ────────────────────────────────────────────────────────────
export default function WorkoutSheet({
  isOpen,
  onClose,
  workoutItem,        // the route item: { title, meta, sub: [...] }
  dailyWorkout,       // raw Airtable workout record for title fallback
  optimisticStatusById,
  onExerciseTap,      // (sub) → opens CompleteItemModal for evidence-required
  onQuickComplete,    // (sub) → instant complete for non-evidence
}) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = "hidden"; }
    else        { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleExerciseTap = useCallback((sub) => {
    if (sub.evidenceRequired) onExerciseTap(sub);
    else onQuickComplete(sub);
  }, [onExerciseTap, onQuickComplete]);

  const sub        = workoutItem?.sub || [];
  const doneCount  = sub.filter(s => (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed").length;
  const totalCount = sub.length;
  const allDone    = totalCount > 0 && doneCount >= totalCount;
  const pct        = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const title = workoutItem?.title || dailyWorkout?.Title || "Team Workout";

  return (
    <>
      {/* ── Backdrop ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ws-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 40,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(3px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Sheet ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ws-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 42, mass: 1 }}
            style={{
              position: "fixed",
              bottom: 0, left: 0, right: 0,
              zIndex: 50,
              background: C.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "92dvh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
              paddingBottom: "env(safe-area-inset-bottom, 0)",
            }}
          >
            {/* Pull handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
              <div style={{ width: 32, height: 3.5, background: C.handle, borderRadius: 2 }} onClick={onClose} />
            </div>

            {/* ── Header ── */}
            <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Eyebrow */}
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: allDone ? C.green : C.accent,
                    marginBottom: 6, transition: "color 0.4s",
                  }}>
                    {allDone ? "✓ Training complete" : "Training"}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontSize: 26, fontWeight: 800,
                    color: allDone ? "rgba(255,255,255,0.4)" : C.white,
                    letterSpacing: "-0.03em", lineHeight: 1.1,
                    transition: "color 0.5s",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {title}
                  </div>
                </div>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: "#1A1A1A", border: "none",
                    width: 32, height: 32, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", flexShrink: 0, marginLeft: 12, marginTop: 4,
                  }}
                >
                  <X size={14} color="rgba(255,255,255,0.5)" />
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 2, background: "#252525", borderRadius: 1, overflow: "hidden", marginBottom: 8 }}>
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
                  <span style={{ fontSize: 11, fontWeight: 800, color: allDone ? C.green : C.accent, letterSpacing: "0.05em" }}>
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.cardLine, flexShrink: 0 }} />

            {/* ── Exercise list (scrollable) ── */}
            <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>

              {/* Hint row - first time only */}
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 20px", borderBottom: `1px solid ${C.cardLine}`,
                background: "#0D0D0D",
              }}>
                <ChevronDown size={11} color="rgba(255,255,255,0.2)" style={{ transform: "rotate(-90deg)" }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", fontWeight: 500 }}>
                  Swipe right to complete · Tap to log with photo
                </span>
              </div>

              {sub.map((s, i) => (
                <ExerciseRow
                  key={s.id}
                  sub={s}
                  optimisticStatusById={optimisticStatusById}
                  onTap={handleExerciseTap}
                  isLast={i === sub.length - 1}
                />
              ))}

              {/* All done state */}
              <AnimatePresence>
                {allDone && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "18px 20px",
                      borderTop: `1px solid ${C.cardLine}`,
                      background: "rgba(0,200,81,0.04)",
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: C.greenDim, border: `1px solid rgba(0,200,81,0.3)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={14} color={C.green} strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.greenText }}>
                      Workout complete
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom padding */}
              <div style={{ height: 32 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes popIn { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }`}</style>
    </>
  );
}