// pages/athlete/journal.jsx
// Workout Journal — chart-first progress tracking across all lifts.
// Select a lift → see your weight/volume trend over time.
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0A0A0A",
  s1:     "#111111",
  s2:     "#181818",
  s3:     "#222222",
  line:   "#232323",
  line2:  "#2C2C2C",
  white:  "#FFFFFF",
  dim:    "rgba(255,255,255,0.45)",
  muted:  "rgba(255,255,255,0.25)",
  faint:  "rgba(255,255,255,0.08)",
  accent: "#4FABFF",
  green:  "#00C851",
  orange: "#FF6B2B",
};

const EFFORT_COLORS = ["","#22C55E","#84CC16","#FBBF24","#F97316","#EF4444"];
const EFFORT_LABELS = ["","Easy","Light","Moderate","Hard","Max"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return "";
  return new Date(`${str}T12:00:00`).toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

function groupIntoSessions(logs) {
  const byDate = {};
  logs.forEach(l => {
    const d = l.date || new Date(l.timestamp).toISOString().slice(0,10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });
  return Object.entries(byDate)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .map(([date, sets]) => {
      const weights = sets.map(s => Number(s.actualWeight)).filter(w => w > 0);
      const reps    = sets.map(s => Number(s.actualReps)).filter(r => r > 0);
      const volume  = sets.reduce((sum, s) => sum + (Number(s.actualWeight)||0) * (Number(s.actualReps)||0), 0);
      return { date, sets, maxWeight: weights.length ? Math.max(...weights) : 0, maxReps: reps.length ? Math.max(...reps) : 0, totalSets: sets.length, volume };
    });
}

function groupByExercise(logs) {
  const byEx = {};
  logs.forEach(l => { if (!l.exerciseTitle) return; if (!byEx[l.exerciseTitle]) byEx[l.exerciseTitle]=[]; byEx[l.exerciseTitle].push(l); });
  return Object.entries(byEx).map(([title, logs]) => {
    const sessions = groupIntoSessions(logs);
    const weights  = logs.map(l => Number(l.actualWeight)).filter(w => w > 0);
    const prWeight = weights.length ? Math.max(...weights) : 0;
    const prReps   = Math.max(...logs.map(l => Number(l.actualReps)).filter(r => r > 0), 0);
    const lastDate = sessions[0]?.date || "";
    const sw = sessions.map(s => s.maxWeight).filter(w => w > 0).reverse();
    let trend = "flat";
    if (sw.length >= 3) {
      const half = Math.floor(sw.length/2);
      const early = sw.slice(0,half).reduce((a,b)=>a+b,0)/half;
      const late  = sw.slice(-half).reduce((a,b)=>a+b,0)/half;
      if (late > early+2) trend = "up";
      if (late < early-2) trend = "down";
    }
    return { title, sessions, prWeight, prReps, lastDate, trend, totalSets: logs.length };
  }).sort((a,b) => b.lastDate.localeCompare(a.lastDate));
}

// ─── Chart ────────────────────────────────────────────────────────────────────
function ProgressChart({ sessions, metric }) {
  const containerRef = useRef(null);
  const [width, setWidth]   = useState(320);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.offsetWidth || 320);
    update();
    const obs = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(update) : null;
    obs?.observe(el);
    return () => obs?.disconnect();
  }, []);

  // Oldest first for left → right trend
  const data = sessions
    .slice()
    .reverse()
    .map(s => ({
      date:    s.date,
      label:   formatDate(s.date),
      value:   metric === "weight" ? s.maxWeight : s.volume,
      session: s,
    }))
    .filter(d => d.value > 0);

  const H = 220;
  const PAD = { top: 24, right: 16, bottom: 44, left: 48 };
  const cW  = Math.max(width - PAD.left - PAD.right, 1);
  const cH  = H - PAD.top - PAD.bottom;

  if (data.length === 0) {
    return (
      <div ref={containerRef} style={{ width:"100%", height:H, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:13, color:C.muted }}>No data for this metric yet</span>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const range  = maxV - minV || 1;
  const pad    = range * 0.1; // breathing room above/below

  const getX = i  => data.length < 2 ? cW / 2 : (i / (data.length - 1)) * cW;
  const getY = v  => cH - ((v - (minV - pad)) / (range + pad * 2)) * cH;

  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value), ...d }));
  const linePath = points.map((p,i) => `${i===0?"M":"L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = data.length > 1
    ? `${linePath} L ${points[points.length-1].x.toFixed(1)} ${cH} L 0 ${cH} Z`
    : null;

  // Y-axis gridlines
  const yTicks = 4;
  const gridLines = Array.from({length: yTicks+1}, (_,i) => {
    const t = i / yTicks;
    const v = (minV - pad) + (range + pad * 2) * t;
    return { y: cH - t * cH, v: Math.round(v) };
  });

  // X-axis labels — show max 6, always show first and last
  const xLabels = points.filter((_, i) => {
    if (i === 0 || i === points.length - 1) return true;
    const every = Math.max(1, Math.floor(points.length / 5));
    return i % every === 0;
  });

  return (
    <div ref={containerRef} style={{ position:"relative", width:"100%" }}>
      <svg width={width} height={H} style={{ display:"block", overflow:"visible" }}>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid lines + Y labels */}
          {gridLines.map((gl, i) => (
            <g key={i}>
              <line x1={0} y1={gl.y} x2={cW} y2={gl.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>
              <text x={-8} y={gl.y+4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.28)" fontFamily="-apple-system,sans-serif">
                {metric==="volume" && gl.v > 1000 ? `${(gl.v/1000).toFixed(1)}k` : gl.v}
              </text>
            </g>
          ))}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill={C.accent+"14"}/>}

          {/* Line */}
          {data.length > 1 && <path d={linePath} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>}

          {/* Dots */}
          {points.map((p, i) => (
            <g key={i} style={{ cursor:"pointer" }}
              onMouseEnter={() => setTooltip(p)}
              onMouseLeave={() => setTooltip(null)}
              onTouchStart={() => setTooltip(p)}
            >
              <circle cx={p.x} cy={p.y} r={10} fill="transparent"/>
              <circle cx={p.x} cy={p.y} r={5} fill={C.bg} stroke={C.accent} strokeWidth={2}/>
              {tooltip?.date === p.date && <circle cx={p.x} cy={p.y} r={3} fill={C.accent}/>}
            </g>
          ))}

          {/* X-axis labels */}
          {xLabels.map((p, i) => (
            <text key={i} x={p.x} y={cH+20} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.28)" fontFamily="-apple-system,sans-serif">
              {p.label}
            </text>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key={tooltip.date}
            initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            transition={{ duration:0.12 }}
            style={{
              position: "absolute",
              left:     Math.min(Math.max(tooltip.x + PAD.left, 60), width - 60),
              top:      tooltip.y + PAD.top - 72,
              transform:"translateX(-50%)",
              background: C.s2,
              border: `1px solid ${C.line2}`,
              borderRadius: 10,
              padding: "10px 14px",
              pointerEvents: "none",
              zIndex: 10,
              minWidth: 110,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>{tooltip.label}</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.accent, letterSpacing:"-0.03em" }}>
              {metric==="weight"
                ? `${tooltip.value} lb`
                : tooltip.value > 1000
                  ? `${(tooltip.value/1000).toFixed(1)}k`
                  : tooltip.value}
            </div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
              {tooltip.session.totalSets} sets
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────
function SessionRow({ session, isLast }) {
  return (
    <div style={{ padding:"12px 20px", borderBottom: isLast ? "none" : `1px solid ${C.line}`, display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ minWidth:60 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.white }}>{formatDate(session.date)}</div>
        <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{session.totalSets} sets</div>
      </div>
      <div style={{ flex:1, display:"flex", gap:6, flexWrap:"wrap" }}>
        {session.sets.map((set, i) => (
          <div key={i} style={{ padding:"4px 8px", background:C.faint, border:`1px solid ${C.line2}`, borderRadius:6, display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>S{set.setNumber}</span>
            {set.actualWeight > 0 && <span style={{ fontSize:11, fontWeight:700, color:C.dim }}>{set.actualWeight}lb</span>}
            {set.actualReps > 0   && <span style={{ fontSize:11, fontWeight:700, color:C.dim }}>×{set.actualReps}</span>}
            {set.difficulty > 0   && <div style={{ width:6, height:6, borderRadius:"50%", background:EFFORT_COLORS[set.difficulty], flexShrink:0 }} title={EFFORT_LABELS[set.difficulty]}/>}
          </div>
        ))}
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        {session.maxWeight > 0 && <div style={{ fontSize:13, fontWeight:800, color:C.white }}>{session.maxWeight} lb</div>}
        {session.maxReps > 0   && <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{session.maxReps} reps</div>}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function WorkoutJournal() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const [logs,      setLogs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null); // exercise title
  const [metric,    setMetric]    = useState("weight"); // "weight" | "volume"
  const [days,      setDays]      = useState(90);

  const pillsRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/athlete/workouts/logs?days=${days}&limit=1000`, { credentials:"include" });
      const data = await res.json();
      if (data.ok) setLogs(data.logs || []);
    } catch(e) { console.error("Journal fetch:", e); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { if (authReady && user) fetchLogs(); }, [authReady, user, fetchLogs]);

  const exercises = useMemo(() => groupByExercise(logs), [logs]);

  // Auto-select first exercise when data loads
  useEffect(() => {
    if (exercises.length > 0 && !selected) setSelected(exercises[0].title);
  }, [exercises, selected]);

  // Reset selection if selected exercise disappears (day filter change)
  useEffect(() => {
    if (selected && exercises.length > 0 && !exercises.find(e => e.title === selected)) {
      setSelected(exercises[0].title);
    }
  }, [exercises, selected]);

  const activeEx = useMemo(() => exercises.find(e => e.title === selected), [exercises, selected]);

  const TrendIcon  = activeEx?.trend === "up" ? TrendingUp : activeEx?.trend === "down" ? TrendingDown : Minus;
  const trendColor = activeEx?.trend === "up" ? C.green : activeEx?.trend === "down" ? C.orange : C.muted;
  const trendLabel = activeEx?.trend === "up" ? "Improving" : activeEx?.trend === "down" ? "Declining" : "Steady";

  if (!authReady) return null;

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.2} }
        ::-webkit-scrollbar { display: none; }
        .pills-scroll { display:flex; gap:8px; overflow-x:auto; padding:0 16px 2px; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
      `}</style>

      {/* ── Sticky header ── */}
      <div style={{ background:C.bg, borderBottom:`1px solid ${C.line}`, position:"sticky", top:0, zIndex:20, paddingTop:"env(safe-area-inset-top,0)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px 10px" }}>
          <button onClick={()=>router.back()} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:0, flexShrink:0 }}>
            <ChevronLeft size={20} color={C.dim}/>
          </button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color:C.accent, marginBottom:3 }}>Athlete</div>
            <div style={{ fontSize:20, fontWeight:900, color:C.white, letterSpacing:"-0.03em" }}>Workout Journal</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Day range */}
            {[30,90,180].map(d=>(
              <button key={d} onClick={()=>{ setDays(d); setSelected(null); }}
                style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${days===d?C.accent:C.line2}`, background:days===d?C.accent+"22":"transparent", color:days===d?C.accent:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
                {d}d
              </button>
            ))}
            <button onClick={fetchLogs} disabled={loading} style={{ background:"none", border:"none", cursor:loading?"not-allowed":"pointer", opacity:loading?0.4:1, padding:4 }}>
              <RefreshCw size={14} color={C.dim} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:"40px 16px", display:"flex", flexDirection:"column", gap:12 }}>
          {[120,220,80].map((h,i)=><div key={i} style={{ height:h, background:C.s1, borderRadius:12, animation:"pulse 1.5s ease-in-out infinite" }}/>)}
        </div>
      ) : exercises.length === 0 ? (
        <div style={{ textAlign:"center", padding:"100px 32px" }}>
          <div style={{ fontSize:40, marginBottom:16 }}>📈</div>
          <div style={{ fontSize:18, fontWeight:800, color:C.dim, marginBottom:8 }}>No data yet</div>
          <div style={{ fontSize:14, color:C.muted, lineHeight:1.7 }}>Complete workouts and log your sets.<br/>Your progress will appear here.</div>
        </div>
      ) : (
        <>
          {/* ── Exercise pills ── */}
          <div style={{ padding:"14px 0 10px", borderBottom:`1px solid ${C.line}` }}>
            <div className="pills-scroll" ref={pillsRef}>
              {exercises.map(ex => {
                const isActive = ex.title === selected;
                const tc = ex.trend==="up" ? C.green : ex.trend==="down" ? C.orange : C.accent;
                return (
                  <button key={ex.title} onClick={()=>setSelected(ex.title)}
                    style={{
                      flexShrink:0, padding:"8px 16px",
                      borderRadius:20,
                      border:`1.5px solid ${isActive ? tc : C.line2}`,
                      background: isActive ? tc+"22" : C.faint,
                      color: isActive ? tc : C.muted,
                      fontSize:12, fontWeight:700, cursor:"pointer",
                      fontFamily:"inherit", whiteSpace:"nowrap",
                      transition:"all 0.2s",
                    }}>
                    {ex.title}
                  </button>
                );
              })}
            </div>
          </div>

          {activeEx && (
            <div>
              {/* ── Exercise header ── */}
              <div style={{ padding:"20px 20px 0" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.white, letterSpacing:"-0.02em", marginBottom:6 }}>
                      {activeEx.title}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                      {activeEx.prWeight > 0 && (
                        <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                          <span style={{ fontSize:22, fontWeight:900, color:C.white, letterSpacing:"-0.04em" }}>{activeEx.prWeight}</span>
                          <span style={{ fontSize:11, color:C.muted, fontWeight:600 }}>lb PR</span>
                        </div>
                      )}
                      <span style={{ fontSize:11, color:C.muted }}>·</span>
                      <span style={{ fontSize:12, color:C.muted }}>{activeEx.sessions.length} sessions</span>
                      <span style={{ fontSize:11, color:C.muted }}>·</span>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <TrendIcon size={12} color={trendColor}/>
                        <span style={{ fontSize:12, fontWeight:700, color:trendColor }}>{trendLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric toggle */}
                  <div style={{ display:"flex", background:C.s2, border:`1px solid ${C.line2}`, borderRadius:8, padding:3, gap:2, flexShrink:0 }}>
                    {[{k:"weight",l:"Weight"},{k:"volume",l:"Volume"}].map(({k,l})=>(
                      <button key={k} onClick={()=>setMetric(k)}
                        style={{ padding:"5px 12px", borderRadius:6, border:"none", background:metric===k?C.accent+"33":"transparent", color:metric===k?C.accent:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Chart ── */}
              <div style={{ padding:"0 8px 8px" }}>
                <ProgressChart sessions={activeEx.sessions} metric={metric}/>
              </div>

              {/* Axis label */}
              <div style={{ paddingLeft:20, paddingBottom:16 }}>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted }}>
                  {metric==="weight" ? "Max weight per session (lb)" : "Volume per session (lb × reps)"}
                </span>
              </div>

              <div style={{ height:1, background:C.line }}/>

              {/* ── Session list ── */}
              <div>
                <div style={{ padding:"14px 20px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted }}>
                    Recent sessions
                  </span>
                  <span style={{ fontSize:11, color:C.muted }}>{activeEx.sessions.length} total</span>
                </div>
                {activeEx.sessions.slice(0, 10).map((session, i) => (
                  <SessionRow key={session.date} session={session} isLast={i === Math.min(activeEx.sessions.length, 10) - 1}/>
                ))}
              </div>

              <div style={{ height:48 }}/>
            </div>
          )}
        </>
      )}
    </div>
  );
}