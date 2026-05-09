// pages/athlete/journal.jsx
// Workout Journal — PR-first progress tracking + lift merge tool.
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, RefreshCw,
  TrendingUp, TrendingDown, Minus,
  Flame, Award, BarChart2,
  GitMerge, X, Check, ChevronRight,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Brand tokens — matches pages/index.js exactly ───────────────────────────
const C = {
  bg:     "#060810",
  s1:     "#0C1220",
  s2:     "#121B2E",
  s3:     "#1A2340",
  line:   "#1C2A42",
  line2:  "#243050",
  white:  "#FFFFFF",
  dim:    "rgba(255,255,255,0.45)",
  muted:  "rgba(255,255,255,0.25)",
  faint:  "rgba(255,255,255,0.07)",
  accent: "#4FABFF",
  green:  "#00C851",
  orange: "#FF6B2B",
  amber:  "#F59E0B",
  red:    "#EF4444",
};

const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const EFFORT_COLORS = ["", "#22C55E", "#84CC16", "#FBBF24", "#F97316", "#EF4444"];
const EFFORT_LABELS = ["", "Easy", "Light", "Moderate", "Hard", "Max"];
const BASELINE_LIFTS = [
  { key: "squat",         label: "Squat",        unit: "lb", type: "weight"   },
  { key: "bench",         label: "Bench",         unit: "lb", type: "weight"   },
  { key: "deadlift",      label: "Deadlift",      unit: "lb", type: "weight"   },
  { key: "powerClean",    label: "Power Clean",   unit: "lb", type: "weight"   },
  { key: "fortyYardDash", label: "40 Yard Dash",  unit: "s",  type: "time"     },
  { key: "verticalJump",  label: "Vertical Jump", unit: "in", type: "distance" },
  { key: "broadJump",     label: "Broad Jump",    unit: "in", type: "distance" },
];

const BASELINE_KEYWORDS = {
  squat:         ["squat"],
  bench:         ["bench"],
  deadlift:      ["deadlift"],
  powerClean:    ["power clean", "clean"],
  fortyYardDash: ["40", "forty"],
  verticalJump:  ["vertical"],
  broadJump:     ["broad"],
};

// ─── Data helpers ─────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return "";
  return new Date(`${str}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupIntoSessions(logs) {
  const byDate = {};
  logs.forEach(l => {
    const d = l.date || new Date(l.timestamp).toISOString().slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(l);
  });
  return Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, sets]) => {
      const weights   = sets.map(s => Number(s.actualWeight)).filter(w => w > 0);
      const reps      = sets.map(s => Number(s.actualReps)).filter(r => r > 0);
      const volume    = sets.reduce((sum, s) => sum + (Number(s.actualWeight)||0)*(Number(s.actualReps)||0), 0);
      const maxEffort = Math.max(0, ...sets.map(s => Number(s.difficulty||0)));
      return { date, sets, maxWeight: weights.length ? Math.max(...weights) : 0, maxReps: reps.length ? Math.max(...reps) : 0, totalSets: sets.length, volume, maxEffort };
    });
}

function groupByExercise(logs) {
  const byEx = {};
  logs.forEach(l => { if (!l.exerciseTitle) return; if (!byEx[l.exerciseTitle]) byEx[l.exerciseTitle]=[]; byEx[l.exerciseTitle].push(l); });
  return Object.entries(byEx).map(([title, exLogs]) => {
    const sessions = groupIntoSessions(exLogs);
    const weights  = exLogs.map(l => Number(l.actualWeight)).filter(w => w > 0);
    const prWeight = weights.length ? Math.max(...weights) : 0;
    const lastDate = sessions[0]?.date || "";
    const sw       = sessions.map(s => s.maxWeight).filter(w => w > 0).reverse();
    let trend = "flat", pctChange = 0;
    if (sw.length >= 3) {
      const half = Math.floor(sw.length/2);
      const early = sw.slice(0,half).reduce((a,b)=>a+b,0)/half;
      const late  = sw.slice(-half).reduce((a,b)=>a+b,0)/half;
      if (late > early+2) trend = "up";
      if (late < early-2) trend = "down";
    }
    if (sw.length >= 2) pctChange = Math.round(((sw[sw.length-1]-sw[0])/sw[0])*100);
    return { title, sessions, prWeight, lastDate, trend, pctChange, totalSets: exLogs.length };
  }).sort((a,b) => b.lastDate.localeCompare(a.lastDate));
}

function calcBestPR(exercises) {
  return exercises.reduce((best,ex) => ex.prWeight>best.weight ? {weight:ex.prWeight,title:ex.title} : best, {weight:0,title:""});
}

function getInsight(activeEx) {
  if (!activeEx||!activeEx.sessions.length) return null;
  const lastSession = activeEx.sessions[0];
  if (lastSession.maxWeight>0 && lastSession.maxWeight>=activeEx.prWeight && activeEx.sessions.length>1)
    return { type:"pr", text:`New PR. ${activeEx.prWeight} lb on ${activeEx.title}. That's the work paying off.` };
  if (Math.abs(activeEx.pctChange)>=5) {
    if (activeEx.pctChange>0) return { type:"up",   text:`Up ${activeEx.pctChange}% since you started tracking. The trend is real.` };
    return                            { type:"down", text:`Down ${Math.abs(activeEx.pctChange)}% over this period. Reassess the program.` };
  }
  if (activeEx.lastDate) {
    const days = Math.floor((Date.now()-new Date(activeEx.lastDate+"T12:00:00"))/86400000);
    if (days>10) return { type:"warn", text:`${days} days since your last ${activeEx.title.toLowerCase()} session.` };
  }
  return { type:"neutral", text:`${activeEx.sessions.length} sessions logged. Consistency is the edge.` };
}
function BaselinesSection({ baselines, exercises, onEdit }) {
  const findLoggedPR = (keywords) => {
  for (const ex of exercises) {
    const title = ex.title.toLowerCase().trim();
    if (keywords.some(kw => title === kw || title.startsWith(kw + " ") || title.startsWith(kw + "  "))) {
      return ex.prWeight > 0 ? ex.prWeight : null;
    }
  }
  return null;
};

  const hasAnyBaseline = BASELINE_LIFTS.some(l => baselines[l.key]);

  return (
    <div style={{ padding: "20px 0 16px", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 12px" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted }}>
          Baselines
        </span>
        <button
          onClick={onEdit}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.line2}`, background: "transparent", color: C.muted, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.color = C.amber; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.line2; e.currentTarget.style.color = C.muted; }}
        >
          {hasAnyBaseline ? "Edit" : "+ Set baselines"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "4px 20px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {BASELINE_LIFTS.map(lift => {
  const baseline     = baselines[lift.key];
  const loggedPR     = lift.type === "weight" ? findLoggedPR(BASELINE_KEYWORDS[lift.key]) : null;
  const hasBaseline  = baseline !== undefined && baseline !== "" && baseline !== null;
  const beatBaseline = loggedPR && hasBaseline && loggedPR > baseline;

  return (
    <div key={lift.key} onClick={onEdit} style={{
      flexShrink: 0, width: 110, padding: "10px 10px 8px",
      background: C.s1,
      border: `1.5px solid ${beatBaseline ? `${C.green}40` : C.line}`,
      borderTop: `3px solid ${beatBaseline ? C.green : hasBaseline ? C.amber : C.line2}`,
      borderRadius: 10, cursor: "pointer", transition: "border-color 0.2s",
    }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: hasBaseline ? C.amber : C.muted, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lift.label}
      </div>

      {hasBaseline ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: loggedPR ? 4 : 0 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, fontStyle: "italic", color: C.white, letterSpacing: "-0.03em", lineHeight: 1 }}>{baseline}</span>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 9, color: C.muted, fontWeight: 600 }}>{lift.unit}</span>
        </div>
      ) : (
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: loggedPR ? 4 : 0 }}>—</div>
      )}

      {loggedPR && (
        <div style={{ paddingTop: 4, borderTop: `1px solid ${C.line2}` }}>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}>Logged</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 900, color: beatBaseline ? C.green : C.accent, letterSpacing: "-0.01em" }}>{loggedPR}</span>
            <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 8, color: C.muted }}>{lift.unit}</span>
            {beatBaseline && <span style={{ fontSize: 8, marginLeft: 1 }}>🏆</span>}
          </div>
        </div>
      )}
    </div>
  );
})}
      </div>
    </div>
  );
}

function BaselinesSheet({ open, onClose, baselines, onSave }) {
  const [values,  setValues]  = useState({});
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    if (open) { setValues({ ...baselines }); setErr(""); }
  }, [open, baselines]);

  const handleSave = async () => {
    setSaving(true); setErr("");
    try { await onSave(values); onClose(); }
    catch { setErr("Failed to save. Try again."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <AnimatePresence>
        {open && <motion.div key="bl-bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }} />}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div key="bl-sh" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 380, damping: 42, mass: 1 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, background: C.bg, borderTop: `3px solid ${C.amber}`, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85dvh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "-apple-system,'SF Pro Display',sans-serif", paddingBottom: "env(safe-area-inset-bottom,0)" }}>

            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
              <div style={{ width: 32, height: 3.5, background: C.line2, borderRadius: 2 }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", flexShrink: 0, borderBottom: `1px solid ${C.line}` }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 3 }}>Performance</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase", color: C.white, letterSpacing: "-0.02em", lineHeight: 1 }}>My Baselines</div>
              </div>
              <button onClick={onClose} style={{ background: C.s1, border: `1px solid ${C.line}`, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={14} color={C.dim} />
              </button>
            </div>

            <div style={{ padding: "10px 20px 6px", flexShrink: 0 }}>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: C.dim, margin: 0, lineHeight: 1.5 }}>
                Enter your current bests. These stay separate from your logged PRs so you can track both.
              </p>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "12px 20px 0", WebkitOverflowScrolling: "touch" }}>
              {BASELINE_LIFTS.map(lift => (
                <div key={lift.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>{lift.label}</span>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, color: C.muted }}>{lift.unit}</span>
                  </div>
                  <input
                    type="number"
                    inputMode={lift.type === "time" ? "decimal" : "numeric"}
                    step={lift.type === "time" ? "0.01" : "1"}
                    value={values[lift.key] ?? ""}
                    onChange={e => setValues(prev => ({ ...prev, [lift.key]: e.target.value === "" ? "" : lift.type === "time" ? parseFloat(e.target.value) : parseInt(e.target.value) }))}
                    placeholder={lift.type === "time" ? "e.g. 4.52" : lift.type === "distance" ? "e.g. 32" : "e.g. 315"}
                    style={{ width: "100%", padding: "12px 14px", background: C.s1, border: `1px solid ${C.line2}`, borderRadius: 10, fontSize: 16, fontWeight: 700, color: C.white, fontFamily: "inherit", outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" }}
                    onFocus={e => { e.target.style.borderColor = C.amber; }}
                    onBlur={e  => { e.target.style.borderColor = C.line2; }}
                  />
                </div>
              ))}
            </div>

            {err && <div style={{ padding: "8px 20px", background: "rgba(239,68,68,0.08)", flexShrink: 0 }}><p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 700, color: C.red, margin: 0 }}>⚠ {err}</p></div>}

            <div style={{ padding: "12px 20px 20px", borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
              <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "15px", background: saving ? C.s1 : C.amber, border: "none", borderRadius: 12, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: saving ? C.muted : C.bg, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
                {saving ? <><div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.muted}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} /> Saving...</> : "Save Baselines"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Merge Sheet ──────────────────────────────────────────────────────────────
function MergeSheet({ exercises, open, onClose, onMerged }) {
  const [step,     setStep]    = useState("select");
  const [selected, setSelected]= useState(new Set());
  const [keep,     setKeep]    = useState("");
  const [result,   setResult]  = useState(null);
  const [err,      setErr]     = useState("");

  useEffect(() => {
    if (open) { setStep("select"); setSelected(new Set()); setKeep(""); setResult(null); setErr(""); }
  }, [open]);

  const toggle = (title) => setSelected(prev => { const n=new Set(prev); n.has(title)?n.delete(title):n.add(title); return n; });

  const handleNext = () => {
    if (selected.size<2) return;
    setKeep(Array.from(selected)[0]);
    setStep("keep");
  };

  const handleMerge = async () => {
    if (!keep) return;
    setStep("loading"); setErr("");
    try {
      const remove = Array.from(selected).filter(t=>t!==keep);
      const res    = await fetch("/api/athlete/workouts/mergeLifts", {
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ keep, remove }),
      });
      const data = await res.json();
      if (!res.ok||!data.ok) throw new Error(data?.error||"Merge failed");
      setResult(data);
      setStep("done");
      onMerged?.(keep, Array.from(selected).filter(t=>t!==keep));
    } catch(e) { setErr(e?.message||"Something went wrong"); setStep("keep"); }
  };

  const selectedTitles = Array.from(selected);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div key="mb" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.22}}
            onClick={onClose} style={{position:"fixed",inset:0,zIndex:50,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(4px)"}}/>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div key="ms" initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}}
            transition={{type:"spring",stiffness:380,damping:42,mass:1}}
            style={{position:"fixed",bottom:0,left:0,right:0,zIndex:60,background:C.bg,borderTop:`3px solid ${C.accent}`,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:"85dvh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"-apple-system,'SF Pro Display',sans-serif",paddingBottom:"env(safe-area-inset-bottom,0)"}}>

            {/* Handle */}
            <div style={{display:"flex",justifyContent:"center",padding:"10px 0 0",flexShrink:0}}>
              <div style={{width:32,height:3.5,background:C.line2,borderRadius:2}}/>
            </div>

            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px 12px",flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
              <div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.18em",textTransform:"uppercase",color:C.accent,marginBottom:3}}>
                  {step==="select"?"Step 1 of 2":step==="keep"?"Step 2 of 2":""}
                </div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,fontStyle:"italic",textTransform:"uppercase",color:C.white,letterSpacing:"-0.02em",lineHeight:1}}>
                  {step==="select"?"Select Lifts to Merge":step==="keep"?"Choose the Name to Keep":step==="loading"?"Merging...":"Merge Complete"}
                </div>
              </div>
              <button onClick={onClose} style={{background:C.s1,border:`1px solid ${C.line}`,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                <X size={14} color={C.dim}/>
              </button>
            </div>

            {err && (
              <div style={{padding:"8px 20px",background:"rgba(239,68,68,0.08)",borderBottom:"1px solid rgba(239,68,68,0.2)",flexShrink:0}}>
                <p style={{fontFamily:"'Barlow',sans-serif",fontSize:12,fontWeight:700,color:C.red,margin:0}}>⚠ {err}</p>
              </div>
            )}

            {/* STEP: SELECT */}
            {step==="select" && (
              <>
                <div style={{padding:"10px 20px 6px",flexShrink:0}}>
                  <p style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:C.dim,margin:0,lineHeight:1.5}}>
                    Select 2 or more lifts that are the same exercise named differently. Their data will be combined under one name.
                  </p>
                </div>
                <div style={{overflowY:"auto",flex:1}}>
                  {exercises.map((ex,i)=>{
                    const isSel = selected.has(ex.title);
                    return (
                      <button key={ex.title} onClick={()=>toggle(ex.title)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"13px 20px",background:isSel?`${C.accent}0D`:"transparent",border:"none",borderBottom:i<exercises.length-1?`1px solid ${C.line}`:"none",cursor:"pointer",textAlign:"left",transition:"background 0.15s"}}>
                        <div style={{width:20,height:20,borderRadius:5,flexShrink:0,border:`2px solid ${isSel?C.accent:C.line2}`,background:isSel?C.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                          {isSel && <Check size={11} color={C.bg} strokeWidth={3}/>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,color:isSel?C.white:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",transition:"color 0.15s"}}>{ex.title}</div>
                          <div style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:C.muted,marginTop:2}}>{ex.sessions.length} sessions · {ex.prWeight>0?`${ex.prWeight} lb PR`:"no weight logged"}</div>
                        </div>
                        <ChevronRight size={14} color={C.muted}/>
                      </button>
                    );
                  })}
                </div>
                <div style={{padding:"12px 20px 20px",borderTop:`1px solid ${C.line}`,flexShrink:0}}>
                  {selected.size>=2 && (
                    <div style={{marginBottom:10,display:"flex",gap:6,flexWrap:"wrap"}}>
                      {selectedTitles.map(t=>(
                        <span key={t} style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,padding:"3px 10px",background:`${C.accent}18`,border:`1px solid ${C.accent}40`,borderRadius:20,color:C.accent,letterSpacing:"0.04em"}}>{t}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={handleNext} disabled={selected.size<2} style={{width:"100%",padding:"15px",background:selected.size>=2?C.accent:C.s1,border:`1px solid ${selected.size>=2?"transparent":C.line}`,borderRadius:12,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,letterSpacing:"0.08em",textTransform:"uppercase",color:selected.size>=2?C.bg:C.muted,cursor:selected.size>=2?"pointer":"not-allowed",transition:"all 0.2s"}}>
                    {selected.size<2?"Select at least 2 lifts":"Next — Choose Name →"}
                  </button>
                </div>
              </>
            )}

            {/* STEP: KEEP */}
            {step==="keep" && (
              <>
                <div style={{padding:"10px 20px 6px",flexShrink:0}}>
                  <p style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:C.dim,margin:0,lineHeight:1.5}}>
                    Pick the name to keep. All sessions from the others will be merged into it and those names removed permanently.
                  </p>
                </div>
                <div style={{overflowY:"auto",flex:1}}>
                  {selectedTitles.map((title,i)=>{
                    const ex     = exercises.find(e=>e.title===title);
                    const isKeep = keep===title;
                    return (
                      <button key={title} onClick={()=>setKeep(title)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 20px",background:isKeep?`${C.green}0D`:"transparent",border:"none",borderBottom:i<selectedTitles.length-1?`1px solid ${C.line}`:"none",cursor:"pointer",textAlign:"left",transition:"background 0.15s"}}>
                        <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,border:`2px solid ${isKeep?C.green:C.line2}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                          {isKeep && <div style={{width:8,height:8,borderRadius:"50%",background:C.green}}/>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:700,color:isKeep?C.white:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
                          {ex && <div style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:C.muted,marginTop:2}}>{ex.sessions.length} sessions · {ex.prWeight>0?`${ex.prWeight} lb PR`:"no weight"}</div>}
                        </div>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.1em",textTransform:"uppercase",padding:"3px 8px",borderRadius:4,background:isKeep?`${C.green}18`:`${C.orange}12`,border:`1px solid ${isKeep?`${C.green}35`:`${C.orange}30`}`,color:isKeep?C.green:C.orange,flexShrink:0}}>
                          {isKeep?"Keep":"Remove"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{padding:"12px 20px 20px",background:C.s1,borderTop:`1px solid ${C.line}`,flexShrink:0}}>
                  <p style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:C.muted,margin:"0 0 12px",lineHeight:1.6}}>
                    <span style={{color:C.white,fontWeight:700}}>"{keep}"</span> will be the name going forward.{" "}
                    {selectedTitles.filter(t=>t!==keep).map(t=>`"${t}"`).join(" and ")} will be removed and their data merged in.
                  </p>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>setStep("select")} style={{padding:"13px 18px",background:"transparent",border:`1px solid ${C.line2}`,borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,cursor:"pointer"}}>← Back</button>
                    <button onClick={handleMerge} style={{flex:1,padding:"13px",background:C.green,border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:14,letterSpacing:"0.08em",textTransform:"uppercase",color:C.bg,cursor:"pointer"}}>Confirm Merge</button>
                  </div>
                </div>
              </>
            )}

            {/* STEP: LOADING */}
            {step==="loading" && (
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:"40px 20px"}}>
                <div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${C.line2}`,borderTopColor:C.accent,animation:"spin 0.8s linear infinite"}}/>
                <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,margin:0}}>Rewriting your data...</p>
              </div>
            )}

            {/* STEP: DONE */}
            {step==="done" && result && (
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:"40px 24px",textAlign:"center"}}>
                <div style={{width:56,height:56,borderRadius:"50%",background:`${C.green}18`,border:`2px solid ${C.green}40`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:4}}>
                  <Check size={24} color={C.green} strokeWidth={2.5}/>
                </div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,fontStyle:"italic",textTransform:"uppercase",color:C.white,letterSpacing:"-0.02em",lineHeight:1}}>Merged</div>
                <div style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:C.dim,lineHeight:1.7}}>
                  <span style={{color:C.white,fontWeight:700}}>{result.updated}</span> sets moved into{" "}
                  <span style={{color:C.accent,fontWeight:700}}>"{result.into}"</span>.<br/>Your journal has been updated.
                </div>
                <button onClick={onClose} style={{marginTop:8,padding:"13px 32px",background:C.accent,border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:"0.1em",textTransform:"uppercase",color:C.bg,cursor:"pointer"}}>Done</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Hero Stats ───────────────────────────────────────────────────────────────
function HeroStats({ totalDays, bestPR, streak }) {
  const stats = [
    { value: totalDays, label: "Sessions", sub: "", sublabel: null, color: C.accent, Icon: BarChart2 },
    { value: bestPR.weight > 0 ? bestPR.weight : "—", sub: bestPR.weight > 0 ? "lb" : "", label: "Best PR", sublabel: bestPR.title || null, color: C.amber, Icon: Award },
    { value: streak, label: "Day Streak", sub: "", sublabel: null, color: streak > 0 ? C.orange : C.muted, Icon: Flame },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: C.line }}>
      {stats.map(({ value, label, sub, sublabel, color, Icon }, i) => (
        <div key={i} style={{ background: C.bg, padding: "22px 12px 18px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${color}0A 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 10 }}>
            <Icon size={11} color={color} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>{label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 900, fontStyle: "italic", color, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</span>
            {sub && <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: C.muted, fontWeight: 600 }}>{sub}</span>}
          </div>
          {sublabel && (
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 8, fontWeight: 700, color: C.muted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {sublabel}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── PR Board ─────────────────────────────────────────────────────────────────
function PRCard({ ex, isActive, onClick }) {
  const tc = ex.trend==="up"?C.green:ex.trend==="down"?C.orange:C.muted;
  const TI = ex.trend==="up"?TrendingUp:ex.trend==="down"?TrendingDown:Minus;
  const ds = ex.lastDate ? Math.floor((Date.now()-new Date(ex.lastDate+"T12:00:00"))/86400000) : null;
  return (
    <motion.button onClick={onClick} whileTap={{scale:0.97}} style={{flexShrink:0,width:164,padding:"16px 14px 14px",background:isActive?C.s2:C.s1,border:`1.5px solid ${isActive?C.accent:C.line}`,borderTop:`3px solid ${isActive?C.accent:C.line2}`,borderRadius:12,cursor:"pointer",textAlign:"left",transition:"border-color 0.2s,background 0.2s",boxShadow:isActive?`0 0 0 1px ${C.accent}20,0 8px 32px rgba(79,171,255,0.10)`:"none",position:"relative",overflow:"hidden"}}>
      {isActive && <div aria-hidden style={{position:"absolute",top:-30,right:-30,width:90,height:90,borderRadius:"50%",background:`radial-gradient(circle, ${C.accent}15 0%, transparent 70%)`,pointerEvents:"none"}}/>}
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.14em",textTransform:"uppercase",color:isActive?C.accent:C.muted,marginBottom:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ex.title}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:12}}>
        {ex.prWeight>0
          ?<><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:34,fontWeight:900,fontStyle:"italic",color:C.white,letterSpacing:"-0.04em",lineHeight:1}}>{ex.prWeight}</span><span style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:C.muted,fontWeight:600}}>lb</span></>
          :<span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,color:C.muted}}>No data</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:3}}>
          <TI size={10} color={tc}/>
          {ex.pctChange!==0 && <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:10,fontWeight:900,color:tc}}>{ex.pctChange>0?"+":""}{ex.pctChange}%</span>}
        </div>
        {ds!==null && <span style={{fontFamily:"'Barlow',sans-serif",fontSize:9,color:C.muted}}>{ds===0?"today":`${ds}d ago`}</span>}
      </div>
    </motion.button>
  );
}

function PRBoard({ exercises, selected, onSelect }) {
  const scrollRef = useRef(null);
  useEffect(()=>{
    if (!scrollRef.current||!selected) return;
    const idx = exercises.findIndex(e=>e.title===selected);
    scrollRef.current.children[idx]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  },[selected,exercises]);
  return (
    <div style={{padding:"20px 0 16px",borderBottom:`1px solid ${C.line}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px 12px"}}>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.18em",textTransform:"uppercase",color:C.muted}}>Lift PRs</span>
        <span style={{fontFamily:"'Barlow',sans-serif",fontSize:10,color:C.muted}}>{exercises.length} lifts tracked</span>
      </div>
      <div ref={scrollRef} style={{display:"flex",gap:10,overflowX:"auto",padding:"4px 20px",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        {exercises.map(ex=><PRCard key={ex.title} ex={ex} isActive={ex.title===selected} onClick={()=>onSelect(ex.title)}/>)}
      </div>
    </div>
  );
}

// ─── Insight Strip ────────────────────────────────────────────────────────────
function InsightStrip({ insight }) {
  if (!insight) return null;
  const cfgMap = { pr:{bg:"rgba(0,200,81,0.07)",border:"rgba(0,200,81,0.2)",accent:C.green,icon:"🏆"}, up:{bg:"rgba(79,171,255,0.07)",border:"rgba(79,171,255,0.2)",accent:C.accent,icon:"↑"}, down:{bg:"rgba(255,107,43,0.07)",border:"rgba(255,107,43,0.2)",accent:C.orange,icon:"↓"}, warn:{bg:"rgba(245,158,11,0.07)",border:"rgba(245,158,11,0.2)",accent:C.amber,icon:"·"}, neutral:{bg:C.faint,border:C.line2,accent:C.dim,icon:"·"} };
  const cfg = cfgMap[insight.type]||cfgMap.neutral;
  return (
    <motion.div key={insight.text} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.35}} style={{margin:"16px 20px 0",padding:"12px 16px",background:cfg.bg,border:`1px solid ${cfg.border}`,borderLeft:`3px solid ${cfg.accent}`,borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:16,flexShrink:0,lineHeight:1}}>{cfg.icon}</span>
      <p style={{fontFamily:"'Barlow',sans-serif",fontSize:13,fontWeight:600,color:C.white,lineHeight:1.55,margin:0}}>{insight.text}</p>
    </motion.div>
  );
}

// ─── Progress Chart ───────────────────────────────────────────────────────────
function ProgressChart({ sessions, metric, prWeight }) {
  const cRef = useRef(null);
  const [width, setWidth] = useState(320);
  const [tooltip, setTooltip] = useState(null);
  useEffect(()=>{
    const el=cRef.current; if(!el) return;
    const update=()=>setWidth(el.offsetWidth||320); update();
    const obs=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
    obs?.observe(el); return()=>obs?.disconnect();
  },[]);
  const data = sessions.slice().reverse().map(s=>({date:s.date,label:fmtDate(s.date),value:metric==="weight"?s.maxWeight:s.volume,session:s})).filter(d=>d.value>0);
  const H=220,PAD={top:28,right:40,bottom:44,left:52};
  const cW=Math.max(width-PAD.left-PAD.right,1),cH=H-PAD.top-PAD.bottom;
  if (!data.length) return <div ref={cRef} style={{width:"100%",height:H,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:C.muted}}>No data yet</span></div>;
  const vals=data.map(d=>d.value),minV=Math.min(...vals),maxV=Math.max(...vals),range=maxV-minV||1,pad=range*0.12;
  const cMin=Math.min(minV-pad,metric==="weight"&&prWeight>0?prWeight-pad:Infinity);
  const cMax=Math.max(maxV+pad,metric==="weight"&&prWeight>0?prWeight+pad:-Infinity);
  const cRange=cMax-cMin||1;
  const gX=i=>data.length<2?cW/2:(i/(data.length-1))*cW;
  const gY=v=>cH-((v-cMin)/cRange)*cH;
  const pts=data.map((d,i)=>({x:gX(i),y:gY(d.value),...d}));
  const lp=pts.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const ap=data.length>1?`${lp} L ${pts[pts.length-1].x.toFixed(1)} ${cH} L 0 ${cH} Z`:null;
  const gl=Array.from({length:5},(_,i)=>{const t=i/4;return{y:cH-t*cH,v:Math.round(cMin+cRange*t)};});
  const xl=pts.filter((_,i)=>i===0||i===pts.length-1||i%Math.max(1,Math.floor(pts.length/5))===0);
  const showPR=metric==="weight"&&prWeight>0&&prWeight>=cMin&&prWeight<=cMax;
  const prY=showPR?gY(prWeight):null;
  return (
    <div ref={cRef} style={{position:"relative",width:"100%"}}>
      <svg width={width} height={H} style={{display:"block",overflow:"visible"}}>
        <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.18"/><stop offset="100%" stopColor={C.accent} stopOpacity="0.01"/></linearGradient></defs>
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {gl.map((g,i)=><g key={i}><line x1={0} y1={g.y} x2={cW} y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/><text x={-10} y={g.y+4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.25)" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700">{metric==="volume"&&g.v>1000?`${(g.v/1000).toFixed(1)}k`:g.v}</text></g>)}
          {showPR&&<g><line x1={0} y1={prY} x2={cW} y2={prY} stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7}/><rect x={cW+4} y={prY-8} width={26} height={14} rx={3} fill={C.amber} opacity={0.15}/><text x={cW+17} y={prY+4} textAnchor="middle" fontSize={8} fontWeight="900" fill={C.amber} fontFamily="'Barlow Condensed',sans-serif">PR</text></g>}
          {ap&&<path d={ap} fill="url(#ag)"/>}
          {data.length>1&&<path d={lp} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>}
          {pts.map((p,i)=>{const isPR=showPR&&Math.abs(p.value-prWeight)<1;return<g key={i} style={{cursor:"pointer"}} onMouseEnter={()=>setTooltip(p)} onMouseLeave={()=>setTooltip(null)} onTouchStart={()=>setTooltip(p)}><circle cx={p.x} cy={p.y} r={12} fill="transparent"/>{isPR&&<circle cx={p.x} cy={p.y} r={9} fill={C.amber} opacity={0.15}/>}<circle cx={p.x} cy={p.y} r={isPR?5:4} fill={C.bg} stroke={isPR?C.amber:C.accent} strokeWidth={2}/>{tooltip?.date===p.date&&<circle cx={p.x} cy={p.y} r={2.5} fill={isPR?C.amber:C.accent}/>}</g>;})}
          {xl.map((p,i)=><text key={i} x={p.x} y={cH+20} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.25)" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700">{p.label}</text>)}
        </g>
      </svg>
      <AnimatePresence>
        {tooltip&&<motion.div key={tooltip.date} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.12}} style={{position:"absolute",left:Math.min(Math.max(tooltip.x+PAD.left,70),width-70),top:tooltip.y+PAD.top-76,transform:"translateX(-50%)",background:C.s2,border:`1px solid ${C.line2}`,borderRadius:10,padding:"10px 14px",pointerEvents:"none",zIndex:10,minWidth:110,textAlign:"center"}}>
          <div style={{fontFamily:"'Barlow',sans-serif",fontSize:10,color:C.muted,marginBottom:3}}>{tooltip.label}</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,fontStyle:"italic",color:C.accent,letterSpacing:"-0.03em"}}>{metric==="weight"?`${tooltip.value} lb`:tooltip.value>1000?`${(tooltip.value/1000).toFixed(1)}k`:tooltip.value}</div>
          <div style={{fontFamily:"'Barlow',sans-serif",fontSize:10,color:C.muted,marginTop:2}}>{tooltip.session.totalSets} sets</div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────
function SessionRow({ session, isLast }) {
  const topSet = session.sets.reduce((best,s)=>{
    const vol=(Number(s.actualWeight)||0)*(Number(s.actualReps)||0);
    return vol>(Number(best?.actualWeight)||0)*(Number(best?.actualReps)||0)?s:best;
  },session.sets[0]);
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",borderBottom:isLast?"none":`1px solid ${C.line}`}}>
      <div style={{minWidth:54,flexShrink:0}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:C.white}}>{fmtDate(session.date)}</div>
        <div style={{fontFamily:"'Barlow',sans-serif",fontSize:10,color:C.muted,marginTop:1}}>{session.totalSets} sets</div>
      </div>
      <div style={{width:1,height:30,background:C.line,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        {topSet&&<div style={{display:"flex",alignItems:"baseline",gap:4}}>
          {topSet.actualWeight>0&&<><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:900,fontStyle:"italic",color:C.white,letterSpacing:"-0.03em",lineHeight:1}}>{topSet.actualWeight}</span><span style={{fontFamily:"'Barlow',sans-serif",fontSize:10,color:C.muted,fontWeight:600}}>lb</span></>}
          {topSet.actualReps>0&&<span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:C.dim,fontWeight:600}}>× {topSet.actualReps}</span>}
        </div>}
        <div style={{fontFamily:"'Barlow',sans-serif",fontSize:9,color:C.muted,marginTop:2,letterSpacing:"0.04em",textTransform:"uppercase"}}>top set</div>
      </div>
      {session.volume>0&&<div style={{textAlign:"right",flexShrink:0}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:700,color:C.dim}}>{session.volume>1000?`${(session.volume/1000).toFixed(1)}k`:session.volume}</div>
        <div style={{fontFamily:"'Barlow',sans-serif",fontSize:9,color:C.muted,marginTop:1,textTransform:"uppercase",letterSpacing:"0.04em"}}>vol</div>
      </div>}
      {session.maxEffort>0&&<div title={EFFORT_LABELS[session.maxEffort]} style={{width:8,height:8,borderRadius:"50%",background:EFFORT_COLORS[session.maxEffort]||C.muted,flexShrink:0}}/>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{padding:"0 0 40px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:C.line,marginBottom:1}}>
        {[0,1,2].map(i=><div key={i} style={{background:C.bg,padding:"22px 12px 18px",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><div style={{width:60,height:8,background:C.s2,borderRadius:4,animation:"pulse 1.4s ease-in-out infinite"}}/><div style={{width:48,height:36,background:C.s2,borderRadius:6,animation:"pulse 1.4s ease-in-out infinite"}}/></div>)}
      </div>
      <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${C.line}`}}>
        <div style={{width:80,height:8,background:C.s2,borderRadius:4,marginBottom:14,animation:"pulse 1.4s ease-in-out infinite"}}/>
        <div style={{display:"flex",gap:10}}>{[0,1,2].map(i=><div key={i} style={{flexShrink:0,width:164,height:100,background:C.s1,borderRadius:12,animation:"pulse 1.4s ease-in-out infinite"}}/>)}</div>
      </div>
      <div style={{padding:"24px 20px 0"}}>
        <div style={{width:"40%",height:12,background:C.s2,borderRadius:4,marginBottom:20,animation:"pulse 1.4s ease-in-out infinite"}}/>
        <div style={{width:"100%",height:220,background:C.s1,borderRadius:10,animation:"pulse 1.4s ease-in-out infinite"}}/>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function WorkoutJournal() {
  const router              = useRouter();
  const { user, authReady } = useAuthContext();
  const [logs,      setLogs]     = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [selected,  setSelected] = useState(null);
  const [metric,    setMetric]   = useState("weight");
  const [days,      setDays]     = useState(90);
  const [mergeOpen, setMergeOpen]= useState(false);
  const [baselines,     setBaselines]     = useState({});
const [baselinesOpen, setBaselinesOpen] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
  const userId = user?.id || user?.AthleteToken || user?.athleteToken || "";
  if (!userId) return;
  getDoc(doc(db, "streaks", userId))
    .then(snap => {
      if (!snap.exists()) return;
      const data      = snap.data();
      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const active    = data.lastDate === today || data.lastDate === yesterday;
      setStreak(active ? (data.current || 0) : 0);
    })
    .catch(e => console.error("Streak fetch:", e));
}, [user]);

useEffect(() => {
  const userId = user?.id || user?.AthleteToken || user?.athleteToken || "";
  if (!userId) return;
  getDoc(doc(db, "baselines", userId))
    .then(snap => { if (snap.exists()) setBaselines(snap.data()); })
    .catch(e => console.error("Baselines fetch:", e));
}, [user]);

const saveBaselines = useCallback(async (newValues) => {
  const userId = user?.id || user?.AthleteToken || user?.athleteToken || "";
  if (!userId) throw new Error("Not logged in");
  await setDoc(doc(db, "baselines", userId), { ...newValues, updatedAt: new Date().toISOString() });
  setBaselines(newValues);
}, [user]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/athlete/workouts/logs?days=${days}&limit=1000`,{credentials:"include"});
      const data = await res.json();
      if (data.ok) setLogs(data.logs||[]);
    } catch(e) { console.error("Journal fetch:",e); }
    finally { setLoading(false); }
  },[days]);

  useEffect(()=>{ if(authReady&&user) fetchLogs(); },[authReady,user,fetchLogs]);

  const exercises = useMemo(()=>groupByExercise(logs),[logs]);
  useEffect(()=>{ if(exercises.length>0&&!selected) setSelected(exercises[0].title); },[exercises,selected]);
  useEffect(()=>{ if(selected&&exercises.length>0&&!exercises.find(e=>e.title===selected)) setSelected(exercises[0].title); },[exercises,selected]);

  const handleMerged = useCallback((keptName) => {
    setMergeOpen(false);
    setSelected(keptName);
    fetchLogs();
  },[fetchLogs]);

  const activeEx   = useMemo(()=>exercises.find(e=>e.title===selected),[exercises,selected]);
  const insight    = useMemo(()=>getInsight(activeEx),[activeEx]);
  const totalDays  = useMemo(()=>new Set(logs.map(l=>l.date||new Date(l.timestamp).toISOString().slice(0,10))).size,[logs]);
  const bestPR     = useMemo(()=>calcBestPR(exercises),[exercises]);
  const trendColor = activeEx?.trend==="up"?C.green:activeEx?.trend==="down"?C.orange:C.muted;
  const TrendIcon  = activeEx?.trend==="up"?TrendingUp:activeEx?.trend==="down"?TrendingDown:Minus;

  if (!authReady) return null;

  return (
    <div style={{minHeight:"100dvh",background:C.bg,fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;600&display=swap');
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.2} }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      <div aria-hidden style={{position:"fixed",inset:0,backgroundImage:GRAIN,backgroundRepeat:"repeat",backgroundSize:"256px 256px",opacity:0.025,mixBlendMode:"screen",pointerEvents:"none",zIndex:0}}/>

      <div style={{position:"relative",zIndex:1}}>
        {/* Header */}
        <div style={{background:C.bg,borderBottom:`1px solid ${C.line}`,position:"sticky",top:0,zIndex:20,paddingTop:"env(safe-area-inset-top,0)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px 12px"}}>
            <button onClick={()=>router.back()} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:0,flexShrink:0}}>
              <ChevronLeft size={20} color={C.dim}/>
            </button>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.2em",textTransform:"uppercase",color:C.accent,marginBottom:2}}>Athlete</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,fontStyle:"italic",color:C.white,letterSpacing:"-0.02em",textTransform:"uppercase",lineHeight:1}}>Workout Journal</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {exercises.length>=2&&(
                <button onClick={()=>setMergeOpen(true)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,border:`1px solid ${C.line2}`,background:"transparent",color:C.muted,fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.line2;e.currentTarget.style.color=C.muted;}}>
                  <GitMerge size={11}/> Merge
                </button>
              )}
              {[30,90,180].map(d=>(
                <button key={d} onClick={()=>{setDays(d);setSelected(null);}} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${d===days?C.accent:C.line2}`,background:d===days?`${C.accent}22`:"transparent",color:d===days?C.accent:C.muted,fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,cursor:"pointer",transition:"all 0.2s"}}>{d}d</button>
              ))}
              <button onClick={fetchLogs} disabled={loading} style={{background:"none",border:"none",cursor:loading?"not-allowed":"pointer",opacity:loading?0.4:1,padding:4}}>
                <RefreshCw size={14} color={C.dim} style={{animation:loading?"spin 1s linear infinite":"none"}}/>
              </button>
            </div>
          </div>
        </div>

        {loading && <Skeleton/>}

        {!loading&&exercises.length===0&&(
          <div style={{textAlign:"center",padding:"100px 32px"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:64,fontWeight:900,fontStyle:"italic",color:C.line2,letterSpacing:"-0.04em",marginBottom:16,lineHeight:1}}>0</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,fontStyle:"italic",textTransform:"uppercase",color:C.dim,marginBottom:10}}>No sessions yet</div>
            <div style={{fontFamily:"'Barlow',sans-serif",fontSize:14,color:C.muted,lineHeight:1.7}}>Complete workouts and log your sets.<br/>Your progress will appear here.</div>
          </div>
        )}

        {!loading&&exercises.length>0&&(
          <>
            <HeroStats totalDays={totalDays} bestPR={bestPR} streak={streak}/>
            <div style={{height:1,background:`linear-gradient(to right, transparent, ${C.accent}40, transparent)`}}/>
            <BaselinesSection baselines={baselines} exercises={exercises} onEdit={()=>setBaselinesOpen(true)}/>
            <PRBoard exercises={exercises} selected={selected} onSelect={setSelected}/>

            {activeEx&&(
              <AnimatePresence mode="wait">
                <motion.div key={activeEx.title} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.3}}>
                  <div style={{padding:"20px 20px 0"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,fontStyle:"italic",textTransform:"uppercase",color:C.white,letterSpacing:"-0.02em",marginBottom:6,lineHeight:1}}>{activeEx.title}</div>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          {activeEx.prWeight>0&&<div style={{display:"flex",alignItems:"baseline",gap:4}}><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,fontStyle:"italic",color:C.white,letterSpacing:"-0.04em"}}>{activeEx.prWeight}</span><span style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:C.amber,fontWeight:700}}>lb PR</span></div>}
                          <span style={{fontSize:10,color:C.muted}}>·</span>
                          <span style={{fontFamily:"'Barlow',sans-serif",fontSize:12,color:C.muted}}>{activeEx.sessions.length} sessions</span>
                          <span style={{fontSize:10,color:C.muted}}>·</span>
                          <div style={{display:"flex",alignItems:"center",gap:4}}><TrendIcon size={11} color={trendColor}/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,color:trendColor,letterSpacing:"0.06em",textTransform:"uppercase"}}>{activeEx.trend==="up"?"Improving":activeEx.trend==="down"?"Declining":"Steady"}</span></div>
                        </div>
                      </div>
                      <div style={{display:"flex",background:C.s2,border:`1px solid ${C.line2}`,borderRadius:8,padding:3,gap:2,flexShrink:0}}>
                        {[{k:"weight",l:"Weight"},{k:"volume",l:"Volume"}].map(({k,l})=>(
                          <button key={k} onClick={()=>setMetric(k)} style={{padding:"5px 12px",borderRadius:6,border:"none",background:metric===k?`${C.accent}33`:"transparent",color:metric===k?C.accent:C.muted,fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:900,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <InsightStrip insight={insight}/>

                  <div style={{padding:"20px 8px 0"}}>
                    <ProgressChart sessions={activeEx.sessions} metric={metric} prWeight={activeEx.prWeight}/>
                  </div>
                  <div style={{paddingLeft:20,paddingBottom:4}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.12em",textTransform:"uppercase",color:C.muted}}>
                      {metric==="weight"?"Max weight per session (lb)  ·  dashed = all-time PR":"Volume per session (lb × reps)"}
                    </span>
                  </div>

                  <div style={{height:1,background:C.line,margin:"16px 0 0"}}/>

                  <div>
                    <div style={{padding:"14px 20px 10px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:9,fontWeight:900,letterSpacing:"0.16em",textTransform:"uppercase",color:C.muted}}>Recent Sessions</span>
                      <span style={{fontFamily:"'Barlow',sans-serif",fontSize:11,color:C.muted}}>{activeEx.sessions.length} total</span>
                    </div>
                    {activeEx.sessions.slice(0,12).map((s,i)=><SessionRow key={s.date} session={s} isLast={i===Math.min(activeEx.sessions.length,12)-1}/>)}
                  </div>
                  <div style={{height:56}}/>
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>

      <MergeSheet exercises={exercises} open={mergeOpen} onClose={()=>setMergeOpen(false)} onMerged={handleMerged}/>
        <BaselinesSheet
          open={baselinesOpen}
          onClose={()=>setBaselinesOpen(false)}
          baselines={baselines}
          onSave={saveBaselines}
        />
    </div>
  );
}