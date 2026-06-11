// components/athlete-today/RouteList.jsx
// Dark redesign - matches WorkoutCard/WorkoutSheet/Journal/mobile app.
// All logic preserved, only colors changed.
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { formatTime } from "@/lib/athlete-today/utils";

// ─── Dark tokens - matches WorkoutCard + WorkoutSheet ─────────────────────────
const D = {
  bg:       "#0A0A0A",
  s1:       "#111111",
  s2:       "#161616",
  s3:       "#1A1A1A",
  line:     "#1E1E1E",
  line2:    "#2A2A2A",
  white:    "#FFFFFF",
  dim:      "rgba(255,255,255,0.65)",
  muted:    "rgba(255,255,255,0.45)",
  faint:    "rgba(255,255,255,0.10)",
  accent:   "#4FABFF",
  green:    "#00C851",
  greenDim: "rgba(0,200,81,0.12)",
  amber:    "#F59E0B",
  amberDim: "rgba(245,158,11,0.08)",
  red:      "#FF453A",
  redDim:   "rgba(255,69,58,0.08)",
  orange:   "#FF6B2B",
};

// ─── Haptic ───────────────────────────────────────────────────────────────────
function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch {} }

// ─── Keyframes ────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes completionFlash {
    0%   { background: rgba(0,200,81,0.22); }
    25%  { background: rgba(0,200,81,0.12); }
    100% { background: #111111; }
  }
  @keyframes completionFlashAmber {
    0%   { background: rgba(245,158,11,0.2); }
    100% { background: #111111; }
  }
  @keyframes ringExpand {
    0%   { box-shadow: 0 0 0 0px rgba(0,200,81,0.5); }
    60%  { box-shadow: 0 0 0 6px rgba(0,200,81,0.1); }
    100% { box-shadow: 0 0 0 10px rgba(0,200,81,0); }
  }
  @keyframes popIn {
    0%   { transform: scale(0.5); opacity: 0; }
    55%  { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes swipeNudge {
    0%,15% { transform: translateX(0px); }
    45%    { transform: translateX(28px); }
    75%    { transform: translateX(-3px); }
    100%   { transform: translateX(0px); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sh {
    from { background-position: -200% 0; }
    to   { background-position:  200% 0; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes livePulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%     { opacity: 0.5; transform: scale(0.85); }
  }
  @keyframes badgePop {
    from { opacity: 0; transform: scale(0.8) translateX(4px); }
    to   { opacity: 1; transform: scale(1) translateX(0); }
  }
`;

// ─── Swipe hook ───────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 52;

function useSwipeRight(onFire, disabled) {
  const controls = useAnimation();
  const [dragX, setDragX] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 40 } });
    setDragX(0); setArmed(false);
  }, [disabled, controls]);

  const dragProps = {
    drag:            disabled ? false : "x",
    dragConstraints: { left: 0, right: 60 },
    dragElastic:     { left: 0, right: 0.1 },
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

  return { controls, dragProps, dragX, armed };
}

// ─── GreenCheck ───────────────────────────────────────────────────────────────
function GreenCheck({ size = 20, animate = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: D.greenDim,
      border: `1.5px solid rgba(0,200,81,0.4)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      animation: animate ? "popIn 0.45s cubic-bezier(0.16,1,0.3,1), ringExpand 0.6s ease-out" : "none",
    }}>
      <Check size={size * 0.48} color={D.green} strokeWidth={3} />
    </div>
  );
}

// ─── ActiveBadge ─────────────────────────────────────────────────────────────
function ActiveBadge({ isNow }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 20,
      background: isNow ? D.red : "transparent",
      border: `1px solid ${isNow ? D.red : D.amber}`,
      animation: "badgePop 0.25s ease-out", flexShrink: 0,
    }}>
      {isNow && (
        <div style={{
          width: 5, height: 5, borderRadius: "50%", background: "#fff",
          animation: "livePulse 1.4s ease-in-out infinite",
        }} />
      )}
      <span style={{
        fontSize: 8, fontWeight: 800, letterSpacing: "0.12em",
        textTransform: "uppercase", color: isNow ? "#fff" : D.amber, lineHeight: 1,
      }}>
        {isNow ? "Now" : "Next"}
      </span>
    </div>
  );
}

// ─── Mini ring ────────────────────────────────────────────────────────────────
function MiniRing({ done, total }) {
  const r = 9, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const all = total > 0 && done >= total;
  return (
    <svg width={24} height={24} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={12} cy={12} r={r} fill="none" stroke={D.line2} strokeWidth={2.5} />
      <circle cx={12} cy={12} r={r} fill="none"
        stroke={all ? D.green : D.accent}
        strokeWidth={2.5}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
      />
    </svg>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
const TIME_RANGES = {
  Anytime:   "self-schedule",
  Morning:   "until noon",
  Midday:    "12–3pm",
  Afternoon: "3–7pm",
  Evening:   "7pm+",
};

function SectionHeader({ label, dot, done, total, collapsed, onToggleCollapse, isReadOnly }) {
  const allDone = done >= total && total > 0;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const timeRange = TIME_RANGES[label] || "";

  return (
    <div onClick={onToggleCollapse} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "14px 18px 6px", cursor: "pointer", userSelect: "none",
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: allDone ? D.green : dot, flexShrink: 0,
        transition: "background 0.4s",
      }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: "'Barlow Condensed', -apple-system, sans-serif",
          fontSize: 11, fontWeight: 900, letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: isReadOnly ? D.muted : allDone ? D.green : D.dim,
          transition: "color 0.3s",
        }}>
          {label}
        </span>
        {timeRange && (
          <span style={{ fontSize: 10, fontWeight: 500, color: D.muted }}>· {timeRange}</span>
        )}
      </div>
      {total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <div style={{ width: 40, height: 2, borderRadius: 2, background: D.line2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2, width: `${pct}%`,
              background: allDone ? D.green : dot,
              transition: "width 0.5s ease, background 0.4s",
            }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, minWidth: 26, textAlign: "right",
            color: allDone ? D.green : dot, transition: "color 0.3s",
          }}>
            {done}/{total}
          </span>
        </div>
      )}
      <div style={{ marginLeft: 4, transition: "transform 0.2s", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
        <ChevronDown size={12} color={allDone ? "rgba(0,200,81,0.5)" : D.line2} />
      </div>
    </div>
  );
}

// ─── WORKOUT ROW ──────────────────────────────────────────────────────────────
function WorkoutRow({ item, onTap, optimisticStatusById, isReadOnly, isActive, selfSchedule }) {
  const subDone = item.sub?.filter(s =>
    (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed"
  ).length ?? 0;
  const subTotal = item.sub?.length ?? 0;
  const allDone  = subTotal > 0 && subDone >= subTotal;
  const prevDone = useRef(allDone);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!prevDone.current && allDone) {
      haptic(15); setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      prevDone.current = true;
      return () => clearTimeout(t);
    }
    if (!allDone) prevDone.current = false;
  }, [allDone]);

  const pct = subTotal > 0 ? (subDone / subTotal) * 100 : 0;

  const borderColor = allDone ? D.green
    : isReadOnly ? D.line2
    : isActive   ? D.red
    : D.accent;

  return (
    <div onClick={() => !isReadOnly && onTap(item)} style={{
      background:   allDone ? "rgba(0,200,81,0.04)" : isActive ? "rgba(255,69,58,0.05)" : D.s1,
      borderBottom: `1px solid ${D.line}`,
      borderLeft:   `4px solid ${borderColor}`,
      cursor:       isReadOnly ? "default" : "pointer",
      animation:    flash ? "completionFlash 0.7s ease both" : "none",
      transition:   "border-color 0.4s, background 0.3s",
      userSelect:   "none", position: "relative",
    }}>
      {/* Active top stripe */}
      {isActive && !allDone && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${D.red}, ${D.orange})`,
        }} />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "15px 18px 0" }}>
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          {allDone ? (
            <GreenCheck size={22} animate={flash} />
          ) : (
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: isReadOnly ? D.faint : "rgba(79,171,255,0.1)",
              border: `2px solid ${isReadOnly ? D.line2 : "rgba(79,171,255,0.35)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isReadOnly ? D.muted : D.accent }} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', -apple-system, sans-serif",
            fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1,
            color: allDone ? D.muted : isReadOnly ? D.dim : D.white,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            transition: "color 0.3s",
          }}>
            {item.title}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontFamily: "'Barlow Condensed', -apple-system, sans-serif",
              fontSize: 9, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: isReadOnly ? D.muted : D.accent,
              background: isReadOnly ? D.faint : "rgba(79,171,255,0.1)",
              border: `1px solid ${isReadOnly ? D.line2 : "rgba(79,171,255,0.25)"}`,
              borderRadius: 4, padding: "1px 7px",
            }}>
              Coach assigned
            </span>
            {selfSchedule && !allDone && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 5,
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke={D.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{
                  fontSize: 10, fontWeight: 500, color: D.muted, lineHeight: 1,
                }}>
                  Self-schedule · use Plan Day to set a time
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {isActive && !allDone && <ActiveBadge isNow={true} />}
          <div style={{ fontSize: 11, color: D.muted, fontWeight: 500 }}>
            {formatTime(item.startMinutes)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {subTotal > 0 && <MiniRing done={subDone} total={subTotal} />}
            {!isReadOnly && <ChevronRight size={13} color={D.line2} />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ margin: "12px 0 0", height: 2, background: D.line2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: allDone ? D.green : isActive ? D.red : D.accent,
          transition: "width 0.5s ease, background 0.4s",
        }} />
      </div>
    </div>
  );
}

// ─── MEAL ROW ────────────────────────────────────────────────────────────────
function MealRow({ item, nutritionCompletion, expanded, onToggleExpand, onToggleField, isReadOnly, showHint, isActive, isNext }) {
  const comp          = nutritionCompletion?.[item.mealKey] || {};
  const mealDone      = Boolean(comp.mealDone);
  const hydrationDone = Boolean(comp.hydrationDone);
  const allDone       = mealDone && hydrationDone;
  const partialDone   = (mealDone || hydrationDone) && !allDone;

  const prevDone = useRef(allDone);
  const [flash, setFlash] = useState(false);
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    if (!prevDone.current && allDone) {
      haptic(10); setFlash(true); setJustDone(true);
      const t1 = setTimeout(() => setFlash(false), 700);
      const t2 = setTimeout(() => setJustDone(false), 1200);
      prevDone.current = true;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (!allDone) prevDone.current = false;
  }, [allDone]);

  const handleSwipe = useCallback(() => {
    haptic(12); onToggleField(item.mealKey, "both");
  }, [onToggleField, item.mealKey]);

  const { dragProps, dragX, armed } = useSwipeRight(handleSwipe, allDone || isReadOnly);

  const hydLabel = item.targets?.hydrationOz
    ? `Hydration · ${item.targets.hydrationOz}oz`
    : item.hydrationOz ? `Hydration · ${item.hydrationOz}oz` : "Hydration";

  const hasMacros = item.targets?.calories || item.targets?.protein
    || item.targets?.carbs || item.targets?.fat || item.targets?.hydrationOz;

  const rowBg = allDone ? "rgba(0,200,81,0.04)"
    : isActive ? D.amberDim
    : D.s1;

  return (
    <div style={{
      borderBottom: `1px solid ${D.line}`,
      borderLeft: isActive
        ? `3px solid ${D.amber}`
        : isNext
          ? `3px solid rgba(245,158,11,0.25)`
          : "3px solid transparent",
      transition: "border-left-color 0.3s",
    }}>
      {/* Swipeable row */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {!allDone && !isReadOnly && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: Math.min(1, dragX / 18), pointerEvents: "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: armed ? D.greenDim : "rgba(0,200,81,0.07)",
              border: `1.5px solid ${armed ? "rgba(0,200,81,0.5)" : "rgba(0,200,81,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
              transform: armed ? "scale(1.1)" : "scale(1)",
            }}>
              <Check size={13} color={armed ? D.green : "rgba(0,200,81,0.6)"} strokeWidth={3} />
            </div>
          </div>
        )}

        <motion.div {...dragProps} onClick={onToggleExpand}
          style={{
            ...dragProps.style, width: "100%", boxSizing: "border-box",
            display: "flex", alignItems: "center", gap: 12, padding: "13px 18px",
            background: flash ? undefined : rowBg,
            animation: flash
              ? "completionFlash 0.7s ease both"
              : (showHint && !allDone ? "swipeNudge 1.2s ease-out 0.9s both" : "none"),
            userSelect: "none",
          }}>

          {allDone
            ? <GreenCheck size={18} animate={justDone} />
            : <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: partialDone ? D.accent : isReadOnly ? D.line2 : D.accent,
                opacity: partialDone ? 1 : 0.5,
                transition: "background 0.2s",
              }} />
          }

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, letterSpacing: "-0.1px",
              color: allDone ? D.muted : isReadOnly ? D.dim : D.white,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.title}
            </div>
            {allDone ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: D.greenDim, border: "1px solid rgba(0,200,81,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={5} color={D.green} strokeWidth={3} />
                </div>
                <span style={{ fontSize: 11, color: D.muted, fontWeight: 400 }}>Logged</span>
              </div>
            ) : (
              item.meta && <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>{item.meta}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            {(isActive || isNext) && !allDone && <ActiveBadge isNow={isActive} />}
            <div style={{ fontSize: 11, color: D.muted }}>{formatTime(item.startMinutes)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {allDone ? (
                <ChevronDown size={11} color={D.line2}
                  style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              ) : (
                <>
                  <div style={{ display: "flex", gap: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: mealDone ? D.green : D.line2, transition: "background 0.2s" }} />
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: hydrationDone ? D.accent : D.line2, transition: "background 0.2s" }} />
                  </div>
                  {expanded ? <ChevronDown size={11} color={D.muted} /> : <ChevronRight size={11} color={D.muted} />}
                </>
              )}
            </div>
            {/* Persistent swipe affordance — faint hint so athletes always know the gesture */}
            {!allDone && !isReadOnly && !expanded && (
              <div style={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.18 }}>
                <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: D.white }}>swipe</span>
                <ChevronRight size={7} color={D.white} />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Swipe progress */}
      {!allDone && !isReadOnly && dragX > 4 && (
        <div style={{ height: 2, background: D.line }}>
          <motion.div
            style={{ height: "100%", background: armed ? D.green : "rgba(0,200,81,0.4)", borderRadius: 1 }}
            animate={{ width: `${Math.min(100, (dragX / SWIPE_THRESHOLD) * 100)}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div style={{ background: D.s2, borderTop: `1px solid ${D.line}`, animation: "fadeSlideUp 0.18s ease" }}>

          {/* Action toggles */}
          {!isReadOnly && (
            <div style={{ padding: "14px 18px 12px", display: "flex", gap: 10 }}>
              {[
                { field: "mealDone",      label: "Meal logged",  done: mealDone,      color: D.green,  bg: "rgba(0,200,81,0.12)",    border: "rgba(0,200,81,0.45)",    glowColor: "rgba(0,200,81,0.15)"  },
                { field: "hydrationDone", label: hydLabel,        done: hydrationDone, color: D.accent, bg: "rgba(79,171,255,0.12)",  border: "rgba(79,171,255,0.45)",  glowColor: "rgba(79,171,255,0.15)" },
              ].map(({ field, label, done, color, bg, border, glowColor }) => (
                <button key={field}
                  onClick={e => { e.stopPropagation(); haptic(8); onToggleField(item.mealKey, field); }}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "14px 10px",
                    background: done ? bg : "#1C1C1C",
                    border: `1.5px solid ${done ? border : "rgba(255,255,255,0.14)"}`,
                    borderRadius: 14, cursor: "pointer",
                    boxShadow: done ? `0 0 0 3px ${glowColor}` : "none",
                    transition: "all 0.18s",
                    WebkitTapHighlightColor: "transparent",
                  }}>
                  {/* Icon */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: done ? bg : "rgba(255,255,255,0.06)",
                    border: `1.5px solid ${done ? border : "rgba(255,255,255,0.18)"}`,
                    flexShrink: 0,
                    transition: "all 0.18s",
                  }}>
                    {done
                      ? <Check size={13} color={color} strokeWidth={3} style={{ animation: "popIn 0.35s cubic-bezier(0.16,1,0.3,1)" }} />
                      : <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
                    }
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
                    color: done ? color : "rgba(255,255,255,0.4)",
                    lineHeight: 1, textAlign: "center",
                    transition: "color 0.18s",
                  }}>{label}</span>
                  {/* Tap hint — only when not done */}
                  {!done && (
                    <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)" }}>
                      tap to mark
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isReadOnly && allDone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: D.greenDim, border: "1.5px solid rgba(0,200,81,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={8} color={D.green} strokeWidth={3} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: D.muted }}>Meal and hydration logged</span>
            </div>
          )}

          {/* Notes */}
          {(item.notes || item.diningHallNotes) && (
            <div style={{ padding: "0 18px 10px", borderTop: `1px solid ${D.line}` }}>
              {item.notes && (
                <p style={{ fontSize: 12, color: D.dim, lineHeight: 1.6, margin: "10px 0 0" }}>{item.notes}</p>
              )}
              {item.diningHallNotes && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: D.faint, borderRadius: 8, border: `1px solid ${D.line2}` }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: D.muted, marginBottom: 4 }}>
                    Dining hall
                  </div>
                  <p style={{ fontSize: 12, color: D.dim, lineHeight: 1.6, margin: 0 }}>{item.diningHallNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Macro targets */}
          {hasMacros && (
            <div style={{ padding: "4px 18px 14px", borderTop: `1px solid ${D.line}` }}>
              {item.isDailyTarget && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, marginTop: 4 }}>
                  <div style={{ width: 3, height: 3, borderRadius: "50%", background: D.muted, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.muted }}>
                    Daily targets — distribute across your meals
                  </span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                {[
                  { label: "Cal",   value: item.targets?.calories, color: D.amber  },
                  { label: "Pro",   value: item.targets?.protein,  color: D.red    },
                  { label: "Carbs", value: item.targets?.carbs,    color: "#9B5DE5" },
                  { label: "Fat",   value: item.targets?.fat,      color: D.muted  },
                ].filter(m => m.value != null && m.value !== "").map(({ label, value, color }) => (
                  <div key={label} style={{ background: D.s3, border: `1px solid ${D.line2}`, borderRadius: 8, padding: "7px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.3px" }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: D.muted, marginTop: 4 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              {(item.targets?.hydrationOz || item.hydrationOz) && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", background: "rgba(79,171,255,0.08)", borderRadius: 8, border: "1px solid rgba(79,171,255,0.2)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={D.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6 8 4 13 4 15a8 8 0 0016 0c0-2-2-7-8-13z"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: D.accent }}>
                    {item.targets?.hydrationOz || item.hydrationOz} oz hydration
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PERSONAL ROW ─────────────────────────────────────────────────────────────
function PersonalRow({ item }) {
  const h = Math.floor(item.startMinutes / 60) % 24;
  const m = item.startMinutes % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = `${dh}:${String(m).padStart(2, "0")} ${ap}`;
  return (
    <div style={{
      borderBottom: `1px solid ${D.line}`,
      borderLeft: "3px solid #64748B",
      background: D.s1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748B", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: D.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          {item.meta && (
            <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>{item.meta}</div>
          )}
        </div>
        <div style={{ fontSize: 11, color: D.muted, flexShrink: 0 }}>{timeStr}</div>
      </div>
    </div>
  );
}

// ─── CLASS ROW ────────────────────────────────────────────────────────────────
function ClassRow({ item, done, onComplete, onCompleteWithPhoto, onTap, isReadOnly, showHint, isNext }) {
  const [expanded,   setExpanded]   = useState(false);
  const [photo,      setPhoto]      = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef(null);
  const prevDone     = useRef(done);
  const [flash,    setFlash]    = useState(false);
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    if (!prevDone.current && done) {
      haptic(12); setFlash(true); setJustDone(true);
      const t1 = setTimeout(() => setFlash(false), 700);
      const t2 = setTimeout(() => setJustDone(false), 1200);
      prevDone.current = true;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (!done) prevDone.current = false;
  }, [done]);

  useEffect(() => { if (done) { setExpanded(false); setPhoto(null); } }, [done]);
  useEffect(() => { return () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); }; }, [photo]);

  function openCamera() { setPhotoError(""); fileInputRef.current?.click(); }
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return; e.target.value = "";
    if (!file.type.startsWith("image/")) { setPhotoError("Please select an image file."); return; }
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }
  async function handleSubmit() {
    if (!photo?.file || submitting) return;
    setSubmitting(true); setPhotoError("");
    try {
      await onCompleteWithPhoto(item, photo.file);
      setPhoto(null); setExpanded(false);
    } catch (err) {
      setPhotoError(err?.message || "Failed. Try again.");
      setSubmitting(false);
    }
  }

  const { dragProps, dragX: cdx, armed: ca } = useSwipeRight(openCamera, done || isReadOnly);

  return (
    <div style={{
      borderBottom: `1px solid ${D.line}`,
      animation: flash ? "completionFlashAmber 0.7s ease both" : "none",
      borderLeft: isNext && !done
        ? `3px solid rgba(245,158,11,0.3)`
        : "3px solid transparent",
      transition: "border-left-color 0.3s",
    }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} style={{ display: "none" }} />

      <div style={{ position: "relative", overflow: "hidden" }}>
        {!done && !isReadOnly && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: Math.min(1, cdx / 18), pointerEvents: "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: ca ? D.amberDim : "rgba(245,158,11,0.05)",
              border: `1.5px solid ${ca ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
              transform: ca ? "scale(1.1)" : "scale(1)",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={ca ? D.amber : "rgba(245,158,11,0.6)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
        )}

        <motion.div {...(!isReadOnly ? dragProps : {})}
          onClick={() => !isReadOnly && setExpanded(e => !e)}
          style={{
            ...(!isReadOnly ? dragProps.style : {}),
            width: "100%", boxSizing: "border-box",
            display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
            background: expanded ? D.amberDim : done ? "rgba(0,200,81,0.04)" : D.s1,
            animation: showHint && !done ? "swipeNudge 1.2s ease-out 0.9s both" : "none",
            userSelect: "none",
          }}>
          {done
            ? <GreenCheck size={17} animate={justDone} />
            : <div style={{ width: 6, height: 6, borderRadius: "50%", background: isReadOnly ? D.line2 : D.amber, flexShrink: 0 }} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500,
              color: done ? D.muted : isReadOnly ? D.dim : D.white,
              textDecoration: done ? "line-through" : "none",
              textDecorationColor: D.line2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.title}
            </div>
            {item.meta && <div style={{ fontSize: 11, color: D.muted, marginTop: 1 }}>{item.meta}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
            {isNext && !done && <ActiveBadge isNow={false} />}
            <div style={{ fontSize: 11, color: D.muted }}>{formatTime(item.startMinutes)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {item.badge && (
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 3, background: D.amberDim, color: D.amber }}>
                  {item.badge}
                </div>
              )}
              {!isReadOnly && (expanded
                ? <ChevronDown size={11} color={D.amber} />
                : <ChevronRight size={11} color={D.line2} />
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Expanded */}
      {expanded && !isReadOnly && (
        <div style={{ background: D.amberDim, borderTop: `1px solid rgba(245,158,11,0.2)`, animation: "fadeSlideUp 0.18s ease" }}>
          {!photo && (
            <div onClick={() => { setExpanded(false); onTap(item); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid rgba(245,158,11,0.15)`, cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(245,158,11,0.12)", border: `1px solid rgba(245,158,11,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: D.white }}>Edit class</div>
                <div style={{ fontSize: 11, color: D.muted, marginTop: 1 }}>Update schedule, time, or location</div>
              </div>
            </div>
          )}
          {!photo && !done && (
            <div onClick={openCamera}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: D.greenDim, border: `1px solid rgba(0,200,81,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: D.white }}>Mark attended</div>
                <div style={{ fontSize: 11, color: D.muted, marginTop: 1 }}>Snap a quick photo as proof</div>
              </div>
            </div>
          )}
          {photo && (
            <div style={{ padding: "12px 18px", animation: "fadeSlideUp 0.2s ease" }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <img src={photo.preview} alt="Classroom"
                  style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, border: `1px solid rgba(245,158,11,0.25)`, display: "block" }} />
                <button onClick={openCamera}
                  style={{ position: "absolute", top: 7, right: 7, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", border: "none", borderRadius: 20, padding: "4px 9px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 600 }}>
                  Retake
                </button>
              </div>
              {photoError && (
                <div style={{ fontSize: 12, color: D.red, marginBottom: 8, padding: "7px 10px", background: D.redDim, borderRadius: 7, border: `1px solid rgba(255,69,58,0.25)` }}>
                  {photoError}
                </div>
              )}
              <button onClick={handleSubmit} disabled={submitting}
                style={{ width: "100%", padding: 11, background: submitting ? D.greenDim : D.green, border: "none", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: submitting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, color: submitting ? D.green : "#040A05" }}>
                {submitting
                  ? <><svg style={{ animation: "spin 1s linear infinite" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Submitting…</>
                  : <><Check size={14} strokeWidth={2.5} />Submit attendance</>
                }
              </button>
              <button onClick={() => setPhoto(null)}
                style={{ width: "100%", marginTop: 7, padding: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: D.muted }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Past day banner ──────────────────────────────────────────────────────────
function PastDayBanner({ dateLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: D.s2, borderBottom: `1px solid ${D.line}` }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={D.muted} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={{ fontSize: 12, fontWeight: 500, color: D.muted }}>Viewing {dateLabel} - read only</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ loading, isPastDay, onAddClass }) {
  if (loading) {
    return (
      <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {[80, 54, 80, 54, 68].map((h, i) => (
          <div key={i} style={{
            height: h, borderRadius: 8,
            background: `linear-gradient(90deg, ${D.s1} 25%, ${D.s2} 50%, ${D.s1} 75%)`,
            backgroundSize: "200% 100%",
            animation: `sh 1.4s ${i * 0.08}s infinite`,
          }} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ padding: "64px 32px", textAlign: "center", animation: "fadeSlideUp 0.3s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: D.s1, border: `1px solid ${D.line}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={D.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div style={{ fontFamily: "'Barlow Condensed', -apple-system, sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", color: D.dim, marginBottom: 8 }}>
        {isPastDay ? "No activity recorded" : "Nothing assigned yet"}
      </div>
      <div style={{ fontSize: 13, color: D.muted, lineHeight: 1.65, maxWidth: 260, margin: "0 auto 24px" }}>
        {isPastDay
          ? "Your coach hadn't assigned anything for this day."
          : "Check back once your coach posts today's workout."}
      </div>
      {!isPastDay && onAddClass && (
        <button onClick={onAddClass}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", background: D.faint, border: `1px solid ${D.line2}`, borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: D.dim }}>
          <Plus size={14} /> Add a class
        </button>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function RouteList({
  groups, loading, completedIds, expandedIds,
  nutritionCompletion, optimisticStatusById,
  onWorkoutTap, onCompleteClass, onCompleteWithPhoto,
  onToggleExpand, onNutritionToggle, onClassTap, onAddClass,
  activeItemId = null, nextItemId = null,
  isReadOnly = false, isPastDay = false,
  dateLabel = "", showSwipeHint = false,
}) {
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  function toggleSection(label) {
    setCollapsedSections(prev => {
      const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n;
    });
  }

  useEffect(() => {
    if (!groups?.length) return;
    groups.forEach(group => {
      const done = group.items.filter(item => {
        if (item.type === "workout") return item.sub?.every(s => (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed");
        if (item.type === "meal")    return nutritionCompletion?.[item.mealKey]?.mealDone && nutritionCompletion?.[item.mealKey]?.hydrationDone;
        return completedIds.has(item.id);
      }).length;
      if (done >= group.items.length && group.items.length > 0) {
        setTimeout(() => {
          setCollapsedSections(prev => {
            if (prev.has(group.label)) return prev;
            return new Set([...prev, group.label]);
          });
        }, 900);
      }
    });
  }, [groups, optimisticStatusById, nutritionCompletion, completedIds]);

  let hintTargetKey = null;
  if (showSwipeHint && groups?.length) {
    outer: for (const group of groups) {
      for (const item of group.items) {
        if (item.type === "meal" || item.type === "class") { hintTargetKey = item.id; break outer; }
      }
    }
  }

  if (!groups?.length) return (
    <>
      <style>{STYLES}</style>
      {isPastDay && <PastDayBanner dateLabel={dateLabel} />}
      <EmptyState loading={loading} isPastDay={isPastDay} onAddClass={onAddClass} />
    </>
  );

  return (
    <>
      <style>{STYLES}</style>
      {isPastDay && <PastDayBanner dateLabel={dateLabel} />}
      <div style={{ paddingBottom: 80 }}>
        {groups.map(group => {
          const groupDone = group.items.filter(item => {
            if (item.type === "workout") return item.sub?.every(s => (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed");
            if (item.type === "meal")    return nutritionCompletion?.[item.mealKey]?.mealDone && nutritionCompletion?.[item.mealKey]?.hydrationDone;
            return completedIds.has(item.id);
          }).length;

          const isCollapsed = collapsedSections.has(group.label);

          return (
            <div key={group.label}>
              <SectionHeader
                label={group.label} dot={group.dot}
                done={groupDone} total={group.items.length}
                isReadOnly={isReadOnly}
                collapsed={isCollapsed}
                onToggleCollapse={() => toggleSection(group.label)}
              />
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div key="section-items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    {group.items.map(item => {
                      if (item.type === "workout") {
                        return (
                          <WorkoutRow key={item.id} item={item}
                            onTap={onWorkoutTap}
                            optimisticStatusById={optimisticStatusById}
                            isReadOnly={isReadOnly}
                            isActive={item.id === activeItemId}
                            selfSchedule={item.selfSchedule}
                          />
                        );
                      }
                      if (item.type === "meal") {
                        return (
                          <MealRow key={item.id} item={item}
                            nutritionCompletion={nutritionCompletion}
                            expanded={expandedIds.has(item.id)}
                            onToggleExpand={() => onToggleExpand(item.id)}
                            onToggleField={onNutritionToggle}
                            isReadOnly={isReadOnly}
                            showHint={item.id === hintTargetKey}
                            isActive={item.id === activeItemId}
                            isNext={item.id === nextItemId}
                          />
                        );
                      }
                      if (item.type === "personal") {
                        return <PersonalRow key={item.id} item={item} />;
                      }
                      return (
                        <ClassRow key={item.id} item={item}
                          done={completedIds.has(item.id)}
                          onComplete={onCompleteClass}
                          onCompleteWithPhoto={onCompleteWithPhoto}
                          onTap={onClassTap}
                          isReadOnly={isReadOnly}
                          showHint={item.id === hintTargetKey}
                          isNext={item.id === nextItemId}
                        />
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}