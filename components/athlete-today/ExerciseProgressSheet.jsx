// components/athlete-today/ExerciseProgressSheet.jsx
// Dark bottom sheet showing an athlete's logged history for one exercise.
// Triggered from the WorkoutSheet active card.
"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";

const C = {
  bg:"#0F0F0F", surface:"#161616", surface2:"#1C1C1C",
  line:"#1E1E1E", line2:"#2A2A2A",
  white:"#FFFFFF", dim:"rgba(255,255,255,0.35)",
  muted:"rgba(255,255,255,0.18)", faint:"rgba(255,255,255,0.07)",
  accent:"#0057FF", green:"#00C851", orange:"#FF6B2B", amber:"#F59E0B",
  handle:"#2A2A2A",
};

const EFFORT_LABELS = ["", "Easy", "Light", "Moderate", "Hard", "Max"];
const EFFORT_COLORS = ["", "#22C55E", "#84CC16", "#FBBF24", "#F97316", "#EF4444"];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Simple SVG sparkline for weight over sessions
function Sparkline({ sessions, height = 60, width = "100%" }) {
  const weights = sessions.map(s => s.maxWeight).filter(w => w > 0);
  if (weights.length < 2) return null;

  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const pts = weights.slice().reverse(); // oldest first for left→right trend
  const n = pts.length;

  const getX = (i) => (i / (n - 1)) * 100;
  const getY = (w) => height - ((w - min) / range) * (height - 10) - 5;

  const pathD = pts.map((w, i) =>
    `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(w).toFixed(1)}`
  ).join(" ");

  // Trend direction
  const first = pts[0], last = pts[pts.length - 1];
  const trend = last > first + 2 ? "up" : last < first - 2 ? "down" : "flat";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? C.green : trend === "down" ? C.orange : C.muted;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>Weight trend</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <TrendIcon size={12} color={trendColor} />
          <span style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>
            {trend === "up" ? `+${(last - first).toFixed(1)} lb` : trend === "down" ? `${(last - first).toFixed(1)} lb` : "Steady"}
          </span>
        </div>
      </div>
      <div style={{ position: "relative", background: C.faint, borderRadius: 8, padding: "8px 4px", overflow: "hidden" }}>
        <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {/* Area fill */}
          <path
            d={`${pathD} L ${getX(n - 1).toFixed(1)} ${height} L 0 ${height} Z`}
            fill="rgba(0,87,255,0.08)"
          />
          {/* Line */}
          <path d={pathD} fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {/* Dots */}
          {pts.map((w, i) => (
            <circle key={i} cx={getX(i)} cy={getY(w)} r="2" fill={C.accent} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {/* Min / Max labels */}
        <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 9, color: C.muted, fontWeight: 600 }}>{min} lb</div>
        <div style={{ position: "absolute", top: 6,    left: 8, fontSize: 9, color: C.muted, fontWeight: 600 }}>{max} lb</div>
      </div>
    </div>
  );
}

// PR badge
function PRBadge({ label, value }) {
  return (
    <div style={{ flex: 1, padding: "12px 10px", background: C.surface, border: `1px solid ${C.line2}`, borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: "-0.03em" }}>{value || "—"}</div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function ExerciseProgressSheet({ isOpen, onClose, exerciseTitle, sessions = [] }) {
  const prWeight = useMemo(() => {
    const w = Math.max(...sessions.map(s => s.maxWeight).filter(Boolean));
    return isFinite(w) ? `${w} lb` : null;
  }, [sessions]);

  const prReps = useMemo(() => {
    const r = Math.max(...sessions.map(s => s.maxReps).filter(Boolean));
    return isFinite(r) ? r : null;
  }, [sessions]);

  const totalSets = useMemo(() =>
    sessions.reduce((a, s) => a + s.totalSets, 0), [sessions]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="eps-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }} onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div key="eps-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 42 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
              background: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
              maxHeight: "85dvh", display: "flex", flexDirection: "column",
              overflow: "hidden",
              fontFamily: "-apple-system,'SF Pro Display','Helvetica Neue',sans-serif",
              paddingBottom: "env(safe-area-inset-bottom,0)",
            }}
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0, cursor: "pointer" }} onClick={onClose}>
              <div style={{ width: 32, height: 3.5, background: C.handle, borderRadius: 2 }} />
            </div>

            {/* Header */}
            <div style={{ padding: "14px 20px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: C.accent, marginBottom: 5 }}>
                    Progress
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                    {exerciseTitle}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {totalSets} total sets
                  </div>
                </div>
                <button onClick={onClose} style={{ background: "#1A1A1A", border: "none", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={14} color={C.dim} />
                </button>
              </div>

              {/* PRs */}
              {sessions.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                  <PRBadge label="Best weight" value={prWeight} />
                  <PRBadge label="Best reps" value={prReps} />
                  <PRBadge label="Sessions" value={sessions.length} />
                </div>
              )}
            </div>

            <div style={{ height: 1, background: C.line, flexShrink: 0 }} />

            {/* Scrollable content */}
            <div style={{ overflowY: "auto", flex: 1, padding: "20px 20px 32px", WebkitOverflowScrolling: "touch" }}>

              {sessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.dim, marginBottom: 8 }}>No history yet</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Log your sets and your progress will appear here.</div>
                </div>
              ) : (
                <>
                  {/* Sparkline */}
                  <Sparkline sessions={sessions} />

                  {/* Session history */}
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
                    Session history
                  </div>

                  {sessions.map((session, si) => (
                    <div key={session.date} style={{ marginBottom: 12, border: `1px solid ${C.line2}`, borderRadius: 12, overflow: "hidden", background: C.surface }}>
                      {/* Session header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.line2}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{formatDate(session.date)}</span>
                          {si === 0 && (
                            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(0,87,255,0.18)", border: "1px solid rgba(0,87,255,0.3)", color: C.accent }}>
                              Latest
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 14 }}>
                          {session.maxWeight > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{session.maxWeight} lb</div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>weight</div>
                            </div>
                          )}
                          {session.maxReps > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{session.maxReps}</div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>reps</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Individual sets */}
                      {session.sets.map((set, i) => (
                        <div key={set.id || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: i < session.sets.length - 1 ? `1px solid ${C.line}` : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, minWidth: 40 }}>Set {set.setNumber}</span>
                            <div style={{ display: "flex", gap: 8 }}>
                              {set.actualReps > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>{set.actualReps} reps</span>
                              )}
                              {set.actualWeight > 0 && (
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>{set.actualWeight} lb</span>
                              )}
                            </div>
                          </div>
                          {set.effort > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ display: "flex", gap: 3 }}>
                                {[1,2,3,4,5].map(e => (
                                  <div key={e} style={{ width: 6, height: 6, borderRadius: "50%", background: e <= set.effort ? EFFORT_COLORS[set.effort] : "rgba(255,255,255,0.1)" }} />
                                ))}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: EFFORT_COLORS[set.effort] }}>
                                {EFFORT_LABELS[set.effort]}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}