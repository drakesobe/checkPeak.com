// pages/athlete/journal.jsx
// Workout Journal — athlete's full training history across all lifts.
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import ExerciseProgressSheet from "@/components/athlete-today/ExerciseProgressSheet";

const C = {
  bg:"#0A0A0A", s1:"#111111", s2:"#181818",
  line:"#232323", line2:"#2C2C2C",
  white:"#FFFFFF", dim:"rgba(255,255,255,0.45)",
  muted:"rgba(255,255,255,0.25)", faint:"rgba(255,255,255,0.08)",
  accent:"#4FABFF", green:"#00C851", orange:"#FF6B2B",
};

const EFFORT_COLORS = ["","#22C55E","#84CC16","#FBBF24","#F97316","#EF4444"];
const EFFORT_LABELS = ["","Easy","Light","Moderate","Hard","Max"];

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
      return {
        date, sets,
        maxWeight: weights.length ? Math.max(...weights) : 0,
        avgWeight: weights.length ? Math.round(weights.reduce((a,b)=>a+b,0)/weights.length) : 0,
        maxReps:   reps.length    ? Math.max(...reps)    : 0,
        totalSets: sets.length,
      };
    });
}

function groupByExercise(logs) {
  const byEx = {};
  logs.forEach(l => { if (!l.exerciseTitle) return; if (!byEx[l.exerciseTitle]) byEx[l.exerciseTitle]=[]; byEx[l.exerciseTitle].push(l); });
  return Object.entries(byEx).map(([title, logs]) => {
    const sessions = groupIntoSessions(logs);
    const weights  = logs.map(l => Number(l.actualWeight)).filter(w => w > 0);
    const reps     = logs.map(l => Number(l.actualReps)).filter(r => r > 0);
    const prWeight = weights.length ? Math.max(...weights) : 0;
    const prReps   = reps.length    ? Math.max(...reps)    : 0;
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
    return { title, logs, sessions, prWeight, prReps, lastDate, trend, totalSets:logs.length };
  }).sort((a,b) => b.lastDate.localeCompare(a.lastDate));
}

function MiniSparkline({ sessions, color=C.accent }) {
  const weights = sessions.map(s=>s.maxWeight).filter(w=>w>0).reverse();
  if (weights.length < 2) return (
    <div style={{ height:32, display:"flex", alignItems:"center" }}>
      <span style={{ fontSize:11, color:C.muted }}>Log more sets to see trend</span>
    </div>
  );
  const min=Math.min(...weights), max=Math.max(...weights), range=max-min||1, h=32, n=weights.length;
  const x=i=>(i/(n-1))*100, y=w=>h-((w-min)/range)*(h-6)-3;
  const d=weights.map((w,i)=>`${i===0?"M":"L"} ${x(i).toFixed(1)} ${y(w).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ display:"block" }}>
      <path d={`${d} L ${x(n-1).toFixed(1)} ${h} L 0 ${h} Z`} fill={color+"18"}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <circle cx={x(n-1)} cy={y(weights[n-1])} r="2.5" fill={color} vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function ExerciseCard({ exercise, onOpenHistory }) {
  const [expanded, setExpanded] = useState(false);
  const { title, sessions, prWeight, prReps, lastDate, trend, totalSets } = exercise;
  const TrendIcon  = trend==="up" ? TrendingUp : trend==="down" ? TrendingDown : Minus;
  const trendColor = trend==="up" ? C.green : trend==="down" ? C.orange : C.muted;
  const accentColor= trend==="up" ? C.green : trend==="down" ? C.orange : C.accent;

  return (
    <div style={{ background:C.s1, border:`1px solid ${C.line}`, borderLeft:`3px solid ${accentColor}`, borderRadius:14, overflow:"hidden", marginBottom:12 }}>
      <div style={{ padding:"16px 18px 14px", cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.white, letterSpacing:"-0.02em", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:11, color:C.muted }}>{sessions.length} session{sessions.length!==1?"s":""} · {totalSets} sets</span>
              {lastDate&&<span style={{ fontSize:11, color:C.muted }}>Last {formatDate(lastDate)}</span>}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <TrendIcon size={13} color={trendColor}/>
              <span style={{ fontSize:11, fontWeight:700, color:trendColor }}>
                {trend==="up"?"Improving":trend==="down"?"Declining":"Steady"}
              </span>
            </div>
            {expanded ? <ChevronUp size={14} color={C.muted}/> : <ChevronDown size={14} color={C.muted}/>}
          </div>
        </div>

        {/* PRs */}
        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          {prWeight>0&&(
            <div style={{ padding:"7px 12px", background:C.faint, border:`1px solid ${C.line2}`, borderRadius:8 }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, letterSpacing:"-0.03em" }}>{prWeight} <span style={{ fontSize:11, fontWeight:600, color:C.muted }}>lb</span></div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginTop:2 }}>Best weight</div>
            </div>
          )}
          {prReps>0&&(
            <div style={{ padding:"7px 12px", background:C.faint, border:`1px solid ${C.line2}`, borderRadius:8 }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, letterSpacing:"-0.03em" }}>{prReps}</div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginTop:2 }}>Best reps</div>
            </div>
          )}
        </div>

        <MiniSparkline sessions={sessions} color={accentColor}/>
      </div>

      <AnimatePresence initial={false}>
        {expanded&&(
          <motion.div key="exp" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.25}} style={{overflow:"hidden"}}>
            <div style={{ borderTop:`1px solid ${C.line}` }}>
              {sessions.slice(0,8).map((session,si)=>(
                <div key={session.date} style={{ padding:"12px 18px", borderBottom:si<Math.min(sessions.length,8)-1?`1px solid ${C.line}`:"none" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:C.white }}>{formatDate(session.date)}</span>
                      {si===0&&<span style={{ fontSize:9, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", padding:"2px 7px", borderRadius:4, background:C.accent+"22", border:`1px solid ${C.accent}40`, color:C.accent }}>Latest</span>}
                    </div>
                    <div style={{ display:"flex", gap:14 }}>
                      {session.maxWeight>0&&<div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, fontWeight:800, color:C.white }}>{session.maxWeight} lb</div>
                        <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>max</div>
                      </div>}
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, fontWeight:800, color:C.white }}>{session.totalSets}</div>
                        <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>sets</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {session.sets.map((set,i)=>(
                      <div key={i} style={{ padding:"4px 9px", background:C.faint, border:`1px solid ${C.line2}`, borderRadius:6, display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ fontSize:10, color:C.muted, fontWeight:600 }}>S{set.setNumber}</span>
                        {set.actualWeight>0&&<span style={{ fontSize:11, fontWeight:700, color:C.dim }}>{set.actualWeight}lb</span>}
                        {set.actualReps>0&&<span style={{ fontSize:11, fontWeight:700, color:C.dim }}>×{set.actualReps}</span>}
                        {set.difficulty>0&&<div style={{ width:6, height:6, borderRadius:"50%", background:EFFORT_COLORS[set.difficulty], flexShrink:0 }} title={EFFORT_LABELS[set.difficulty]}/>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ padding:"12px 18px" }}>
                <button onClick={()=>onOpenHistory(exercise)} style={{ width:"100%", padding:"12px", background:"transparent", border:`1px solid ${C.line2}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.dim, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Full history & chart →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryBar({ exercises, totalSets }) {
  const improving = exercises.filter(e=>e.trend==="up").length;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:28 }}>
      {[{v:exercises.length,l:"Exercises"},{v:totalSets,l:"Total sets"},{v:improving,l:"Improving"}].map((s,i)=>(
        <div key={i} style={{ padding:"14px 12px", background:C.s1, border:`1px solid ${C.line}`, borderRadius:12, textAlign:"center" }}>
          <div style={{ fontSize:24, fontWeight:900, color:C.white, letterSpacing:"-0.04em" }}>{s.v}</div>
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginTop:4 }}>{s.l}</div>
        </div>
      ))}
    </div>
  );
}

export default function WorkoutJournal() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [days,    setDays]    = useState(90);
  const [historyTarget, setHistoryTarget] = useState(null);

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
  const totalSets = useMemo(() => logs.length, [logs]);

  if (!authReady) return null;

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:.6}50%{opacity:.3}} ::-webkit-scrollbar{display:none}`}</style>

      {/* Header */}
      <div style={{ background:C.bg, borderBottom:`1px solid ${C.line}`, position:"sticky", top:0, zIndex:20, paddingTop:"env(safe-area-inset-top,0)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px" }}>
          <button onClick={()=>router.back()} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", padding:0, flexShrink:0 }}>
            <ChevronLeft size={20} color={C.dim}/>
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, fontWeight:900, letterSpacing:"0.18em", textTransform:"uppercase", color:C.accent, marginBottom:3 }}>Athlete</div>
            <div style={{ fontSize:20, fontWeight:900, color:C.white, letterSpacing:"-0.03em" }}>Workout Journal</div>
          </div>
          <button onClick={fetchLogs} disabled={loading} style={{ background:"none", border:"none", cursor:loading?"not-allowed":"pointer", opacity:loading?0.4:1, padding:4 }}>
            <RefreshCw size={15} color={C.dim} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
          </button>
        </div>

        {/* Day range pills */}
        <div style={{ display:"flex", gap:6, padding:"0 18px 14px" }}>
          {[30,90,180,365].map(d=>(
            <button key={d} onClick={()=>setDays(d)} style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${days===d?C.accent:C.line2}`, background:days===d?C.accent+"22":"transparent", color:days===d?C.accent:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"24px 16px 48px" }}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[1,2,3].map(i=><div key={i} style={{ height:140, background:C.s1, borderRadius:14, border:`1px solid ${C.line}`, animation:"pulse 1.5s ease-in-out infinite" }}/>)}
          </div>
        ) : exercises.length===0 ? (
          <div style={{ textAlign:"center", padding:"80px 24px" }}>
            <div style={{ fontSize:40, marginBottom:16 }}>📋</div>
            <div style={{ fontSize:18, fontWeight:800, color:C.dim, marginBottom:8 }}>No data yet</div>
            <div style={{ fontSize:14, color:C.muted, lineHeight:1.6 }}>Complete workouts and log your sets.<br/>Your progress will appear here.</div>
          </div>
        ) : (
          <>
            <SummaryBar exercises={exercises} totalSets={totalSets}/>
            {exercises.map(ex=>(
              <ExerciseCard key={ex.title} exercise={ex} onOpenHistory={ex=>setHistoryTarget(ex)}/>
            ))}
          </>
        )}
      </div>

      <ExerciseProgressSheet
        isOpen={Boolean(historyTarget)}
        onClose={()=>setHistoryTarget(null)}
        exerciseTitle={historyTarget?.title||""}
        sessions={historyTarget?.sessions||[]}
      />
    </div>
  );
}