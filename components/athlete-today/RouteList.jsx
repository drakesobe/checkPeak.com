// components/athlete-today/RouteList.jsx
// Skimmer-style route checklist - full design pass.
//
// Improvements in this version:
//  1. WorkoutRow visual dominance - 18px/800, 5px border, no visual equals
//  2. Completion moment - theatrical flash, spring check, ring-expand
//  3. Active item highlight - nowCtx-driven live badge + tint on current/next item
//
// Typography hierarchy:
//   Workout title  18px / 800  - hero
//   Meal title     14px / 600
//   Class title    13px / 500
//   Meta           11px / 400
//   Section label  11px / 800 uppercase

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { formatTime } from "@/lib/athlete-today/utils";

// ─── Haptic ───────────────────────────────────────────────────────────────────
function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch {} }

// ─── Keyframes ────────────────────────────────────────────────────────────────
const STYLES = `
  /* Improvement #2 - theatrical completion flash:
     immediate bright white → green wash → settle to done bg.
     Feels like a real payoff, not just a color swap. */
  @keyframes completionFlash {
    0%   { background: #fff;    }
    12%  { background: #DCFCE7; }
    45%  { background: #F0FDF4; }
    100% { background: #FAFAFA; }
  }
  @keyframes completionFlashWhite {
    0%   { background: #fff; }
    18%  { background: #F0FDF4; }
    100% { background: #fff; }
  }
  /* Ring-expand effect - animates the GreenCheck border outward */
  @keyframes ringExpand {
    0%   { box-shadow: 0 0 0 0px rgba(134,239,172,0.7); }
    60%  { box-shadow: 0 0 0 6px rgba(134,239,172,0.15); }
    100% { box-shadow: 0 0 0 10px rgba(134,239,172,0); }
  }
  @keyframes swipeNudge {
    0%,15% { transform: translateX(0px);  }
    45%    { transform: translateX(28px); }
    75%    { transform: translateX(-3px); }
    100%   { transform: translateX(0px);  }
  }
  @keyframes popIn {
    0%   { transform: scale(0.5); opacity: 0; }
    55%  { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes sh {
    from { background-position: -200% 0; }
    to   { background-position:  200% 0; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  /* Live pulsing dot for active item */
  @keyframes livePulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%     { opacity: 0.5; transform: scale(0.85); }
  }
  /* Slide-in for active badge */
  @keyframes badgePop {
    from { opacity: 0; transform: scale(0.8) translateX(4px); }
    to   { opacity: 1; transform: scale(1) translateX(0); }
  }
`;

// ─── Swipe hook - Framer Motion ───────────────────────────────────────────────
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

// ─── GreenCheck - improvement #2 ─────────────────────────────────────────────
// When `animate` is true (just completed), plays the ring-expand + popIn spring.
function GreenCheck({ size = 20, animate = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#DCFCE7", border: "1.5px solid #86EFAC",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      animation: animate ? "popIn 0.45s cubic-bezier(0.16,1,0.3,1), ringExpand 0.6s ease-out" : "none",
    }}>
      <Check size={size * 0.48} color="#16A34A" strokeWidth={3} />
    </div>
  );
}

// ─── ActiveBadge - improvement #3 ────────────────────────────────────────────
// Tiny pill that appears on the current or next item.
// isNow = solid red. isNext = amber outline.
function ActiveBadge({ isNow }) {
  return (
    <div style={{
      display:       "flex",
      alignItems:    "center",
      gap:           4,
      padding:       "2px 7px",
      borderRadius:  20,
      background:    isNow ? "#EF4444" : "transparent",
      border:        `1px solid ${isNow ? "#EF4444" : "#F59E0B"}`,
      animation:     "badgePop 0.25s ease-out",
      flexShrink:    0,
    }}>
      {isNow && (
        <div style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "#fff",
          animation: "livePulse 1.4s ease-in-out infinite",
        }} />
      )}
      <span style={{
        fontSize:      8,
        fontWeight:    800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color:         isNow ? "#fff" : "#F59E0B",
        lineHeight:    1,
      }}>
        {isNow ? "Now" : "Next"}
      </span>
    </div>
  );
}

// ─── Mini completion ring ─────────────────────────────────────────────────────
function MiniRing({ done, total }) {
  const r    = 9;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? Math.min(done / total, 1) : 0;
  const all  = total > 0 && done >= total;
  return (
    <svg width={24} height={24} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={12} cy={12} r={r} fill="none" stroke="#E2E8F0" strokeWidth={2.5} />
      <circle cx={12} cy={12} r={r} fill="none"
        stroke={all ? "#22C55E" : "#3B82F6"}
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
  Morning:   "until noon",
  Midday:    "12–3pm",
  Afternoon: "3–7pm",
  Evening:   "7pm+",
};

function SectionHeader({ label, dot, done, total, collapsed, onToggleCollapse, isReadOnly }) {
  const allDone   = done >= total && total > 0;
  const pct       = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const timeRange = TIME_RANGES[label] || "";

  return (
    <div
      onClick={onToggleCollapse}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "13px 18px 5px",
        cursor: "pointer", userSelect: "none",
      }}
    >
      <div style={{
        width: 7, height: 7, borderRadius: "50%",
        background: allDone ? "#22C55E" : dot,
        flexShrink: 0, transition: "background 0.4s",
      }} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 5, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isReadOnly ? "#C8CCE0" : allDone ? "#22C55E" : "#4B5563",
          transition: "color 0.3s",
        }}>
          {label}
        </span>
        {timeRange && (
          <span style={{ fontSize: 10, fontWeight: 400, color: "#C4CADB" }}>· {timeRange}</span>
        )}
      </div>

      {total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <div style={{ width: 40, height: 2.5, borderRadius: 2, background: "#F0F2F7", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${pct}%`,
              background: allDone ? "#22C55E" : dot,
              transition: "width 0.5s ease, background 0.4s",
            }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, minWidth: 26, textAlign: "right",
            color: allDone ? "#22C55E" : dot, transition: "color 0.3s",
          }}>
            {done}/{total}
          </span>
        </div>
      )}

      <div style={{ marginLeft: 4, transition: "transform 0.2s", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
        <ChevronDown size={12} color={allDone ? "#86EFAC" : "#CBD5E1"} />
      </div>
    </div>
  );
}

// ─── WORKOUT ROW - improvement #1 ────────────────────────────────────────────
// Hero card. Single tap → WorkoutSheet.
// 18px/800 title. 5px border. No visual equals on the page.
// Active state: left accent shifts to red, top stripe appears.
function WorkoutRow({ item, onTap, optimisticStatusById, isReadOnly, isActive }) {
  const subDone  = item.sub?.filter(s =>
    (optimisticStatusById?.[s.id] || s.item?.Status) === "Completed"
  ).length ?? 0;
  const subTotal = item.sub?.length ?? 0;
  const allDone  = subTotal > 0 && subDone >= subTotal;
  const prevDone = useRef(allDone);
  const [flash,  setFlash] = useState(false);

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

  // Border color: done = green, active = red (live), readonly = muted, default = blue
  const borderColor = allDone
    ? "#22C55E"
    : isReadOnly
      ? "#D0D5E8"
      : isActive
        ? "#EF4444"
        : "#3B82F6";

  return (
    <div
      onClick={() => !isReadOnly && onTap(item)}
      style={{
        background:   allDone ? "#F0FDF4" : isActive ? "#FFF5F5" : "#F0F4FF",
        borderBottom: "0.5px solid #E2E8F0",
        borderLeft:   `5px solid ${borderColor}`,
        cursor:       isReadOnly ? "default" : "pointer",
        animation:    flash ? "completionFlash 0.7s ease both" : "none",
        transition:   "border-color 0.4s, background 0.3s",
        userSelect:   "none",
        position:     "relative",
      }}
    >
      {/* Improvement #3 - active indicator: top stripe on isActive */}
      {isActive && !allDone && (
        <div style={{
          position:   "absolute",
          top:        0, left: 0, right: 0,
          height:     2,
          background: "linear-gradient(90deg, #EF4444, #F97316)",
          borderRadius: "0 2px 0 0",
        }} />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "15px 16px 0" }}>
        {/* Status */}
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          {allDone ? (
            <GreenCheck size={22} animate={flash} />
          ) : (
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: isReadOnly ? "#EEF0FA" : "#EFF6FF",
              border: `2px solid ${isReadOnly ? "#D0D5E8" : "#93C5FD"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isReadOnly ? "#B0B8D0" : "#3B82F6" }} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Improvement #1 - 18px/800. Largest text on the page. */}
          <div style={{
            fontSize:      18,
            fontWeight:    800,
            letterSpacing: "-0.4px",
            lineHeight:    1.15,
            color:         allDone ? "#A0A8C0" : isReadOnly ? "#9AA0B4" : "#0F172A",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
            transition:    "color 0.3s",
          }}>
            {item.title}
          </div>

          {/* Coach tag */}
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:      isReadOnly ? "#C8CCE0" : "#6366F1",
              background: isReadOnly ? "#F3F4F6" : "#EEF2FF",
              border:     `1px solid ${isReadOnly ? "#E5E7EB" : "#C7D2FE"}`,
              borderRadius: 4, padding: "1px 6px",
            }}>
              Coach assigned
            </span>
          </div>
        </div>

        {/* Right: badge + time + ring + chevron */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {/* Improvement #3 - active badge */}
          {isActive && !allDone && <ActiveBadge isNow={true} />}

          <div style={{ fontSize: 11, color: "#9AA0B4", fontWeight: 500 }}>
            {formatTime(item.startMinutes)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {subTotal > 0 && <MiniRing done={subDone} total={subTotal} />}
            {!isReadOnly && <ChevronRight size={13} color="#CBD5E1" />}
          </div>
        </div>
      </div>

      {/* Progress bar - full bleed, generous height */}
      <div style={{ margin: "12px 0 0", height: 3, background: "#E8EDF8", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width:  `${pct}%`,
          background: allDone ? "#22C55E" : isActive ? "#EF4444" : "#3B82F6",
          transition: "width 0.5s ease, background 0.4s",
        }} />
      </div>
    </div>
  );
}

// ─── MEAL ROW - improvements #2 + #3 ─────────────────────────────────────────
function MealRow({ item, nutritionCompletion, expanded, onToggleExpand, onToggleField, isReadOnly, showHint, isActive, isNext }) {
  const comp          = nutritionCompletion?.[item.mealKey] || {};
  const mealDone      = Boolean(comp.mealDone);
  const hydrationDone = Boolean(comp.hydrationDone);
  const allDone       = mealDone && hydrationDone;
  const partialDone   = (mealDone || hydrationDone) && !allDone;

  const prevDone = useRef(allDone);
  const [flash,  setFlash] = useState(false);
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    if (!prevDone.current && allDone) {
      haptic(10);
      setFlash(true);
      setJustDone(true);
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

  // Improvement #3 - active meal gets a distinct tint
  const rowBg = flash
    ? undefined
    : allDone
      ? "#FAFAFA"
      : isActive
        ? "#FFFBF0"
        : "#fff";

  return (
    <div style={{
      borderBottom: "0.5px solid #F0F2F7",
      // Improvement #3 - subtle left accent on active/next meal
      borderLeft: isActive
        ? "3px solid #F59E0B"
        : isNext
          ? "3px solid rgba(245,158,11,0.3)"
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
              background: armed ? "#DCFCE7" : "#F0FDF4",
              border: `1.5px solid ${armed ? "#86EFAC" : "#D1FAE5"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
              transform: armed ? "scale(1.1)" : "scale(1)",
            }}>
              <Check size={13} color={armed ? "#16A34A" : "#6EE7B7"} strokeWidth={3} />
            </div>
          </div>
        )}

        <motion.div
          {...dragProps}
          onClick={onToggleExpand}
          style={{
            ...dragProps.style,
            width: "100%", boxSizing: "border-box",
            display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
            background: rowBg,
            // Improvement #2 - completionFlash plays on swipe done, completionFlashWhite plays on toggle
            animation: flash
              ? "completionFlash 0.7s ease both"
              : (showHint && !allDone ? "swipeNudge 1.2s ease-out 0.9s both" : "none"),
            userSelect: "none",
          }}
        >
          {/* Status dot / GreenCheck */}
          {allDone
            ? <GreenCheck size={18} animate={justDone} />
            : <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: partialDone ? "#93C5FD" : isReadOnly ? "#D0D5E8" : "#3B82F6",
                transition: "background 0.2s",
              }} />
          }

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, letterSpacing: "-0.1px",
              color: allDone ? "#B0B8D0" : isReadOnly ? "#9AA0B4" : "#1E2740",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.title}
            </div>
            {allDone ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#DCFCE7", border: "1px solid #86EFAC",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={5} color="#16A34A" strokeWidth={3} />
                </div>
                <span style={{ fontSize: 11, color: "#B0B8D0", fontWeight: 400 }}>Logged</span>
              </div>
            ) : (
              item.meta && <div style={{ fontSize: 11, color: "#9AA0B4", marginTop: 2 }}>{item.meta}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            {/* Improvement #3 - active/next badge on meal */}
            {(isActive || isNext) && !allDone && (
              <ActiveBadge isNow={isActive} />
            )}
            <div style={{ fontSize: 11, color: "#9AA0B4" }}>{formatTime(item.startMinutes)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {allDone ? (
                <ChevronDown size={11} color="#D0D5E8"
                  style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              ) : (
                <>
                  <div style={{ display: "flex", gap: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: mealDone ? "#22C55E" : "#E5E7EB", transition: "background 0.2s" }} />
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: hydrationDone ? "#3B82F6" : "#E5E7EB", transition: "background 0.2s" }} />
                  </div>
                  {expanded ? <ChevronDown size={11} color="#C8CCE0" /> : <ChevronRight size={11} color="#C8CCE0" />}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Swipe progress bar */}
      {!allDone && !isReadOnly && dragX > 4 && (
        <div style={{ height: 2, background: "#F0F2F7" }}>
          <motion.div
            style={{ height: "100%", background: armed ? "#16A34A" : "#86EFAC", borderRadius: 1 }}
            animate={{ width: `${Math.min(100, (dragX / SWIPE_THRESHOLD) * 100)}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div style={{ background: "#FAFBFF", borderTop: "0.5px solid #EEF4FF", animation: "fadeSlideUp 0.18s ease" }}>

          {/* Action toggles - primary, always first */}
          {!isReadOnly && (
            <div style={{ padding: "12px 16px 10px", display: "flex", gap: 8 }}>
              {[
                { field: "mealDone",      label: "Meal",    done: mealDone,      color: "#22C55E", lightBg: "#F0FDF4", lightBorder: "#86EFAC" },
                { field: "hydrationDone", label: hydLabel,  done: hydrationDone, color: "#3B82F6", lightBg: "#EFF6FF", lightBorder: "#93C5FD" },
              ].map(({ field, label, done, color, lightBg, lightBorder }) => (
                <button
                  key={field}
                  onClick={e => { e.stopPropagation(); haptic(8); onToggleField(item.mealKey, field); }}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 10px",
                    background: done ? lightBg : "#fff",
                    border: `1.5px solid ${done ? lightBorder : "#E5E7EB"}`,
                    borderRadius: 10, cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    color: done ? color : "#9CA3AF",
                    transition: "all 0.15s",
                  }}
                >
                  {/* Improvement #2 - check springs in on done */}
                  {done && <Check size={12} color={color} strokeWidth={3} style={{ animation: "popIn 0.35s cubic-bezier(0.16,1,0.3,1)" }} />}
                  {label}
                </button>
              ))}
            </div>
          )}

          {isReadOnly && allDone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#DCFCE7", border: "1.5px solid #86EFAC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Check size={8} color="#16A34A" strokeWidth={3} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#B0B8D0" }}>Meal and hydration logged</span>
            </div>
          )}

          {/* Notes */}
          {(item.notes || item.diningHallNotes) && (
            <div style={{ padding: "0 16px 10px", borderTop: "0.5px solid #EEF0FA" }}>
              {item.notes && (
                <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, margin: "10px 0 0" }}>{item.notes}</p>
              )}
              {item.diningHallNotes && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #EEF0FA" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4CADB", marginBottom: 4 }}>
                    Dining hall
                  </div>
                  <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>{item.diningHallNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Macro targets */}
          {hasMacros && (
            <div style={{ padding: "4px 16px 14px", borderTop: "0.5px solid #EEF0FA" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                {[
                  { label: "Cal",   value: item.targets?.calories, unit: "",  color: "#F59E0B" },
                  { label: "Pro",   value: item.targets?.protein,  unit: "g", color: "#EF4444" },
                  { label: "Carbs", value: item.targets?.carbs,    unit: "g", color: "#8B5CF6" },
                  { label: "Fat",   value: item.targets?.fat,      unit: "g", color: "#6B7280" },
                ].filter(m => m.value != null && m.value !== "").map(({ label, value, unit, color }) => (
                  <div key={label} style={{ background: "#fff", border: "1px solid #EEF0FA", borderRadius: 8, padding: "7px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.3px" }}>
                      {value}<span style={{ fontSize: 9, fontWeight: 600, opacity: 0.6, marginLeft: 1 }}>{unit}</span>
                    </div>
                    <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4CADB", marginTop: 3 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              {(item.targets?.hydrationOz || item.hydrationOz) && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6 8 4 13 4 15a8 8 0 0016 0c0-2-2-7-8-13z"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2563EB" }}>
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

// ─── CLASS ROW - improvement #3 ──────────────────────────────────────────────
function ClassRow({ item, done, onComplete, onCompleteWithPhoto, onTap, isReadOnly, showHint, isNext }) {
  const [expanded,   setExpanded]   = useState(false);
  const [photo,      setPhoto]      = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef(null);
  const prevDone     = useRef(done);
  const [flash, setFlash]   = useState(false);
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
      borderBottom: "0.5px solid #F5F5F7",
      animation: flash ? "completionFlash 0.7s ease both" : "none",
      // Improvement #3 - next class gets amber accent
      borderLeft: isNext && !done
        ? "3px solid rgba(245,158,11,0.4)"
        : "3px solid transparent",
      transition: "border-left-color 0.3s",
    }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} style={{ display: "none" }} aria-hidden="true" />

      <div style={{ position: "relative", overflow: "hidden" }}>
        {!done && !isReadOnly && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: Math.min(1, cdx / 18), pointerEvents: "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: ca ? "#FEF3C7" : "#FFFBEB",
              border: `1.5px solid ${ca ? "#FCD34D" : "#FDE68A"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s, border-color 0.15s",
              transform: ca ? "scale(1.1)" : "scale(1)",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={ca ? "#D97706" : "#FBBF24"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>
        )}

        <motion.div
          {...(!isReadOnly ? dragProps : {})}
          onClick={() => !isReadOnly && setExpanded(e => !e)}
          style={{
            ...(!isReadOnly ? dragProps.style : {}),
            width: "100%", boxSizing: "border-box",
            display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
            background: expanded ? "#FFFBEB" : done ? "#FAFAFA" : "#fff",
            animation: showHint && !done ? "swipeNudge 1.2s ease-out 0.9s both" : "none",
            userSelect: "none",
          }}
        >
          {done
            ? <GreenCheck size={17} animate={justDone} />
            : <div style={{ width: 6, height: 6, borderRadius: "50%", background: isReadOnly ? "#D0D5E8" : "#F59E0B", flexShrink: 0 }} />
          }

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 500,
              color: done ? "#B0B8D0" : isReadOnly ? "#9AA0B4" : "#374151",
              textDecoration: done ? "line-through" : "none",
              textDecorationColor: "#D0D5E8",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.title}
            </div>
            {item.meta && (
              <div style={{ fontSize: 11, color: "#C4CADB", marginTop: 1 }}>{item.meta}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
            {/* Improvement #3 - next badge on upcoming class */}
            {isNext && !done && <ActiveBadge isNow={false} />}
            <div style={{ fontSize: 11, color: "#B0B8D0" }}>{formatTime(item.startMinutes)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {item.badge && (
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 5px", borderRadius: 3, background: "#FFFBEB", color: "#D97706" }}>
                  {item.badge}
                </div>
              )}
              {!isReadOnly && (expanded
                ? <ChevronDown size={11} color="#D97706" />
                : <ChevronRight size={11} color="#E2E8F0" />
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Expanded class actions */}
      {expanded && !isReadOnly && (
        <div style={{ background: "#FFFBEB", borderTop: "0.5px solid #FDE68A", animation: "fadeSlideUp 0.18s ease" }}>
          {!photo && (
            <div onClick={() => { setExpanded(false); onTap(item); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "0.5px solid #FDE68A", cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "#FEF3C7", border: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E2740" }}>Edit class</div>
                <div style={{ fontSize: 11, color: "#9AA0B4", marginTop: 1 }}>Update schedule, time, or location</div>
              </div>
            </div>
          )}
          {!photo && !done && (
            <div onClick={openCamera}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "#DCFCE7", border: "1px solid #86EFAC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E2740" }}>Mark attended</div>
                <div style={{ fontSize: 11, color: "#9AA0B4", marginTop: 1 }}>Snap a quick photo as proof</div>
              </div>
            </div>
          )}
          {photo && (
            <div style={{ padding: "12px 16px", animation: "fadeSlideUp 0.2s ease" }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <img src={photo.preview} alt="Classroom"
                  style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #FDE68A", display: "block" }} />
                <button onClick={openCamera}
                  style={{ position: "absolute", top: 7, right: 7, display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", border: "none", borderRadius: 20, padding: "4px 9px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 600 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Retake
                </button>
              </div>
              {photoError && (
                <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 8, padding: "7px 10px", background: "#FEF2F2", borderRadius: 7, border: "1px solid #FECACA" }}>
                  {photoError}
                </div>
              )}
              <button onClick={handleSubmit} disabled={submitting}
                style={{ width: "100%", padding: 11, background: submitting ? "#D1FAE5" : "#16A34A", border: "none", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: submitting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {submitting
                  ? <><svg style={{ animation: "spin 1s linear infinite" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Submitting…</>
                  : <><Check size={14} strokeWidth={2.5} />Submit attendance</>
                }
              </button>
              <button onClick={() => setPhoto(null)}
                style={{ width: "100%", marginTop: 7, padding: 8, background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#9AA0B4" }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: "#F9FAFB", borderBottom: "0.5px solid #E5E7EB" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>Viewing {dateLabel} - read only</span>
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
            background: "linear-gradient(90deg, #F0F2F7 25%, #E8EBF5 50%, #F0F2F7 75%)",
            backgroundSize: "200% 100%",
            animation: `sh 1.4s ${i * 0.08}s infinite`,
          }} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ padding: "64px 32px", textAlign: "center", animation: "fadeSlideUp 0.3s ease" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F3F4F6", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 8, letterSpacing: "-0.2px" }}>
        {isPastDay ? "No activity recorded" : "Nothing assigned yet"}
      </div>
      <div style={{ fontSize: 13, color: "#9AA0B4", lineHeight: 1.65, maxWidth: 260, margin: "0 auto 24px" }}>
        {isPastDay
          ? "Your coach hadn't assigned anything for this day."
          : "Check back once your coach posts today's workout."}
      </div>
      {!isPastDay && onAddClass && (
        <button onClick={onAddClass}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
          <Plus size={14} /> Add a class
        </button>
      )}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
// New prop: `activeItemId` - the id of the item that is happening right now
//           `nextItemId`   - the id of the next upcoming item (within ~75 min)
// Both come from useNowContext in today.jsx.
export default function RouteList({
  groups,
  loading,
  completedIds,
  expandedIds,
  nutritionCompletion,
  optimisticStatusById,
  onWorkoutTap,
  onCompleteClass,
  onCompleteWithPhoto,
  onToggleExpand,
  onNutritionToggle,
  onClassTap,
  onAddClass,
  activeItemId  = null,   // currently happening - red accent
  nextItemId    = null,   // up next - amber accent
  isReadOnly    = false,
  isPastDay     = false,
  dateLabel     = "",
  showSwipeHint = false,
}) {
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  function toggleSection(label) {
    setCollapsedSections(prev => {
      const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n;
    });
  }

  // Auto-collapse completed sections after 900ms
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

  // First swipeable row gets the hint nudge
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
                  <motion.div
                    key="section-items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    {group.items.map(item => {
                      if (item.type === "workout") {
                        return (
                          <WorkoutRow
                            key={item.id}
                            item={item}
                            onTap={onWorkoutTap}
                            optimisticStatusById={optimisticStatusById}
                            isReadOnly={isReadOnly}
                            isActive={item.id === activeItemId}
                          />
                        );
                      }
                      if (item.type === "meal") {
                        return (
                          <MealRow
                            key={item.id}
                            item={item}
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
                      return (
                        <ClassRow
                          key={item.id}
                          item={item}
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