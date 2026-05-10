// components/athlete-today/WorkoutSheet.jsx
// Full "Flow State" workout experience.
// Preview → Begin → Active exercise → Rest timer → Complete
// Wired to real Airtable data via props.
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Check, X, ChevronDown, AlertCircle, Play, SkipForward, Star, Camera } from "lucide-react";
import ExerciseProgressSheet from "./ExerciseProgressSheet";

const C = {
  bg:"#0F0F0F", surface:"#161616", surface2:"#1A1A1A",
  cardLine:"#1E1E1E", line2:"#2A2A2A",
  white:"#FFFFFF", dim:"rgba(255,255,255,0.65)",
  muted:"rgba(255,255,255,0.45)", faint:"rgba(255,255,255,0.10)",
  accent:"#4FABFF", green:"#00C851", greenDim:"rgba(0,200,81,0.15)",
  greenText:"#00C851", orange:"#FF6B2B", amber:"#F59E0B", handle:"#2A2A2A",
};

const GROUP_COLORS = [
  { accent:"#4FABFF", bg:"rgba(79,171,255,0.08)",   border:"rgba(79,171,255,0.2)"   },
  { accent:"#9B5DE5", bg:"rgba(155,93,229,0.08)", border:"rgba(155,93,229,0.2)" },
  { accent:"#FF6B2B", bg:"rgba(255,107,43,0.08)", border:"rgba(255,107,43,0.2)" },
  { accent:"#00C9A7", bg:"rgba(0,201,167,0.08)",  border:"rgba(0,201,167,0.2)"  },
  { accent:"#F59E0B", bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.2)" },
];
const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildGroupMeta(subs) {
  const meta = {}; let idx = 0;
  subs.forEach(s => {
    const gid = s?.groupId || s?.item?.groupId;
    if (gid && !meta[gid]) { meta[gid] = { label:GROUP_LETTERS[idx%26], color:GROUP_COLORS[idx%GROUP_COLORS.length], count:0 }; idx++; }
    if (gid) meta[gid].count++;
  });
  Object.values(meta).forEach(m => { m.type = m.count >= 3 ? "Circuit" : "Superset"; });
  return meta;
}

function buildSegments(subs, groupMeta) {
  const segs = []; let i = 0;
  while (i < subs.length) {
    const sub = subs[i], gid = sub?.groupId || sub?.item?.groupId;
    if (gid && groupMeta[gid]) {
      const members = [sub]; let j = i+1;
      while (j < subs.length && (subs[j]?.groupId||subs[j]?.item?.groupId) === gid) { members.push(subs[j]); j++; }
      segs.push({ type:"group", groupId:gid, members }); i = j;
    } else { segs.push({ type:"single", sub }); i++; }
  }
  return segs;
}

function parseMeta(meta) {
  if (!meta) return {};
  const parts = meta.split(" · ");
  const setsRaw = parts.find(p => /sets?/i.test(p));
  const repsRaw = parts.find(p => /reps?/i.test(p));
  const restRaw = parts.find(p => /rest/i.test(p));
  const sets   = setsRaw ? setsRaw.replace(/\s*sets?/i,"").trim().split(/\s/)[0] : null;
  const reps   = repsRaw ? repsRaw.replace(/\s*reps?/i,"").trim().split(/\s/)[0] : null;
  const rest   = restRaw ? restRaw.replace(/\s*rest/i,"").trim() : null;
  const weight = parts.find(p =>
    !/sets?/i.test(p) && !/reps?/i.test(p) && !/rest/i.test(p) && p.trim().length > 0
  ) || null;
  return { sets, reps, weight, rest };
}

function parseRestSecs(sub) {
  // Try raw Airtable field first
  const raw = String(sub?.item?.Rest || sub?.item?.rest || "").trim();
  if (raw) {
    const isMin = /min/i.test(raw);
    // Handle "1:30" format
    if (/^\d+:\d+$/.test(raw)) {
      const [m, s] = raw.split(":").map(Number);
      return m * 60 + s;
    }
    const n = parseInt(raw.replace(/[^0-9]/g, "")) || 0;
    if (n > 0) return isMin ? n * 60 : n;
  }
  // Fall back to meta string
  const restPart = (sub?.meta || "").split(" · ").find(p => /rest/i.test(p));
  if (restPart) {
    const isMin = /min/i.test(restPart);
    const n = parseInt(restPart.replace(/[^0-9]/g, "")) || 0;
    if (n > 0) return isMin ? n * 60 : n;
  }
  return 60;
}

function haptic(ms=10) { try { navigator.vibrate?.(ms); } catch {} }

// Treat both "Completed" and coach-review states as done from the athlete's POV
function isDone(optimisticStatus, itemStatus) {
  const s = String(optimisticStatus || itemStatus || "").toLowerCase().trim();
  return s === "completed" || s === "pending_review" || s === "pending review" || s === "approved";
}

// ─── SET DOTS ─────────────────────────────────────────────────────────────────
function SetDots({ total, done, color }) {
  return (
    <div style={{ display:"flex", gap:8 }}>
      {Array.from({length:total},(_,i)=>(
        <div key={i} style={{ width:i<done?16:11, height:i<done?16:11, borderRadius:"50%", flexShrink:0, background:i<done?color:"transparent", border:`2px solid ${i<done?color:"rgba(255,255,255,0.28)"}`, transition:"all 0.35s cubic-bezier(0.34,1.56,0.64,1)" }} />
      ))}
    </div>
  );
}

// ─── SET LOGGER ───────────────────────────────────────────────────────────────
const EFFORT = [null,
  { label:"Easy",     color:"#22C55E" },
  { label:"Light",    color:"#84CC16" },
  { label:"Moderate", color:"#FBBF24" },
  { label:"Hard",     color:"#F97316" },
  { label:"Max",      color:"#EF4444" },
];

// ─── PERCENT CALCULATOR ───────────────────────────────────────────────────────
function PercentCalc({ exerciseTitle, percentage, weightUnit, onUse }) {
  const [userMax, setUserMax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!exerciseTitle) { setLoading(false); return; }
    fetch(
      `/api/athlete/workouts/logs?exerciseTitle=${encodeURIComponent(exerciseTitle)}&days=730&limit=500`,
      { credentials: "include" }
    )
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (data.ok && Array.isArray(data.logs)) {
          const best = Math.max(0, ...data.logs.map(l => Number(l.actualWeight) || 0));
          if (best > 0) setUserMax(best);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [exerciseTitle]);

  const target = userMax > 0 ? Math.round((percentage / 100) * userMax) : null;

  const startEdit = () => {
    setDraft(userMax === 0 ? "" : String(userMax));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commitEdit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > 0) setUserMax(n);
    setEditing(false);
  };

  return (
    <div style={{ marginTop:2 }}>

      {/* Row 1: max → target on same line */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
            autoFocus
            style={{
              flex:1, padding:"5px 8px", textAlign:"center",
              background:C.surface2, border:`1px solid rgba(79,171,255,0.45)`,
              borderRadius:7, color:C.white, fontSize:18, fontWeight:900,
              fontFamily:"inherit", letterSpacing:"-0.02em",
              outline:"none", WebkitAppearance:"none", MozAppearance:"textfield",
            }}
          />
        ) : (
          <button onClick={startEdit} style={{
            flex:1, padding:"5px 8px", textAlign:"center",
            background:C.surface2, border:`1px solid ${C.line2}`,
            borderRadius:7, cursor:"text",
            fontSize:18, fontWeight:900, color: userMax > 0 ? C.white : C.muted,
            fontFamily:"inherit", letterSpacing:"-0.02em",
            display:"flex", alignItems:"baseline", justifyContent:"center", gap:2,
          }}>
            {loading ? "…" : userMax > 0 ? userMax : "—"}
            <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>{weightUnit}</span>
          </button>
        )}

        <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>→</span>

        <div style={{ flex:1, display:"flex", alignItems:"baseline", justifyContent:"center", gap:2,
          padding:"5px 8px", background:C.faint, borderRadius:7, border:`1px solid ${C.line2}` }}>
          <span style={{ fontSize:18, fontWeight:900, color: target ? C.white : C.muted, letterSpacing:"-0.02em" }}>
            {target ?? "—"}
          </span>
          <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>{weightUnit}</span>
        </div>
      </div>

      {/* Row 3: Use button full width */}
      {target && (
        <button onClick={() => onUse(target)} style={{
          width:"100%", padding:"9px", background:C.accent, border:"none",
          borderRadius:8, fontSize:12, fontWeight:900, color:"#040A05",
          cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.02em",
        }}>
          Use {target} {weightUnit}
        </button>
      )}
    </div>
  );
}

// Stepper — tap −/+ to nudge, tap the number to type directly
function Stepper({ value, onChange, step = 1, min = 0, unit = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const inputRef = useRef(null);

  const startEdit = () => {
    setDraft(value === 0 ? "" : String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const n = parseFloat(draft);
    onChange(Number.isFinite(n) ? Math.max(min, n) : value);
    setEditing(false);
  };

  const btn = (label, onClick) => (
    <button onClick={onClick} style={{
      width:36, height:36, borderRadius:9, background:C.surface2,
      border:`1px solid ${C.line2}`, color:C.white, fontSize:20, lineHeight:1,
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"inherit", flexShrink:0, userSelect:"none",
    }}>{label}</button>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      {btn("−", () => onChange(Math.max(min, value - step)))}

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
          autoFocus
          style={{
            width:64, padding:"4px 6px", textAlign:"center",
            background:C.surface2, border:`1px solid rgba(79,171,255,0.45)`,
            borderRadius:8, color:C.white, fontSize:20, fontWeight:900,
            fontFamily:"inherit", letterSpacing:"-0.02em",
            outline:"none", WebkitAppearance:"none", MozAppearance:"textfield",
          }}
        />
      ) : (
        <button onClick={startEdit} style={{
          minWidth:52, padding:"4px 6px", textAlign:"center",
          background:"transparent", border:"1px solid transparent",
          borderRadius:8, cursor:"text",
          fontSize:20, fontWeight:900, color:C.white,
          fontFamily:"inherit", letterSpacing:"-0.02em",
          borderBottom:`1px dashed rgba(255,255,255,0.2)`,
        }}>
          {value}{unit && <span style={{ fontSize:11, fontWeight:600, color:C.muted, marginLeft:2 }}>{unit}</span>}
        </button>
      )}

      {btn("+", () => onChange(value + step))}
    </div>
  );
}

function SetLogger({ sub, setNumber, value, onChange }) {
  const { reps: tr, weight: tw } = parseMeta(sub?.meta || "");
  const isBodyWeight  = /body.?weight|^bw$/i.test(String(tw || ""));
  const weightUnit    = /kg/i.test(String(tw || "")) ? "kg" : "lb";
  const weightStep    = weightUnit === "kg" ? 2.5 : 5;

  // Detect percentage prescription e.g. "75%", "80% 1RM"
  const pctMatch      = String(tw || "").match(/^(\d+(?:\.\d+)?)\s*%/);
  const isPercent     = !!pctMatch;
  const prescribedPct = isPercent ? parseFloat(pctMatch[1]) : null;

  // Once athlete taps "Use X lb" from the calc, flip to normal stepper
  const [pctConfirmed, setPctConfirmed] = useState(false);

  // Reset when exercise changes
  useEffect(() => { setPctConfirmed(false); }, [sub?.title, setNumber]);

  const handleUseCalc = (weight) => {
    onChange({ ...value, weight });
    setPctConfirmed(true);
  };

  return (
    <div style={{ marginTop:16, padding:"16px 16px 14px", background:C.faint, borderRadius:10, border:`1px solid ${C.line2}` }}>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted, marginBottom:16 }}>
        Log Set {setNumber}
      </div>

      {/* Row 1: Reps + Weight side by side */}
      <div style={{ display:"grid", gridTemplateColumns: isBodyWeight ? "1fr" : "1fr 1fr", gap:16, marginBottom:18 }}>

        {/* REPS */}
        <div>
          <div style={{ display:"flex", alignItems:"center", height:16, marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted }}>Reps</div>
          </div>
          <Stepper value={value.reps} step={1} min={0}
            onChange={v => onChange({ ...value, reps: v })} />
        </div>

        {/* WEIGHT — stepper if confirmed/fixed, calc if percentage */}
        {!isBodyWeight && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:16, marginBottom:10 }}>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted }}>
                Weight ({weightUnit})
              </div>
              {isPercent && !pctConfirmed && (
                <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.accent }}>
                  {prescribedPct}% of max
                </div>
              )}
              {isPercent && pctConfirmed && (
                <button onClick={() => setPctConfirmed(false)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"inherit" }}>
                  <span style={{ fontSize:9, fontWeight:700, color:C.accent, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                    Recalc →
                  </span>
                </button>
              )}
            </div>
            {isPercent && !pctConfirmed ? (
              <PercentCalc
                exerciseTitle={sub?.title}
                percentage={prescribedPct}
                weightUnit={weightUnit}
                onUse={handleUseCalc}
              />
            ) : (
              <Stepper value={value.weight} step={weightStep} min={0}
                onChange={v => onChange({ ...value, weight: v })} />
            )}
          </div>
        )}
      </div>

      {/* Row 2: Difficulty */}
      <div style={{ paddingTop:16, borderTop:`1px solid ${C.line2}` }}>
        <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginBottom:10 }}>Difficulty</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", gap:10, flexShrink:0 }}>
            {[1,2,3,4,5].map(e => (
              <button key={e} onClick={() => onChange({ ...value, effort: value.effort === e ? 0 : e })}
                style={{
                  width:28, height:28, borderRadius:"50%", cursor:"pointer", flexShrink:0,
                  background: e <= value.effort ? EFFORT[value.effort]?.color : "transparent",
                  border:`2px solid ${e <= value.effort ? EFFORT[value.effort]?.color : "rgba(255,255,255,0.28)"}`,
                  transition:"all 0.15s", padding:0,
                }}
              />
            ))}
          </div>
          {value.effort > 0 && (
            <span style={{ fontSize:11, fontWeight:700, color:EFFORT[value.effort]?.color, letterSpacing:"0.02em" }}>
              {EFFORT[value.effort]?.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
function splitValueUnit(str) {
  if (!str) return { num: str, unit: "" };
  const match = String(str).match(/^([0-9\-\/\+\.]+)\s*(.*)$/);
  return match ? { num: match[1], unit: match[2].trim() } : { num: str, unit: "" };
}

function ActiveCard({ sub, currentSet, groupMeta, setLog, onSetLogChange, onViewHistory }) {
  const gid = sub?.groupId || sub?.item?.groupId;
  const gMeta = gid ? groupMeta[gid] : null;
  const accent = gMeta ? gMeta.color.accent : C.accent;
  const { sets, reps, weight } = parseMeta(sub?.meta||"");
  const rpe = sub?.item?.RPE || sub?.item?.rpe || null;
  const totalSets = parseInt(sets)||1;
  const statCols = [weight&&{v:weight,l:"load"}, reps&&{v:reps,l:"reps"}, rpe&&{v:rpe,l:"rpe"}].filter(Boolean);

  return (
    <div style={{ margin:"12px 14px 8px", background:C.surface, border:`1.5px solid ${gMeta?gMeta.color.border:C.cardLine}`, borderTop:`3px solid ${accent}`, borderRadius:16, padding:"22px 20px 20px", animation:"cardIn 0.3s ease" }}>

      {/* Top row: group badge + history link */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        {gMeta ? (
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 11px", borderRadius:20, background:gMeta.color.accent+"18", border:`1px solid ${gMeta.color.accent+"40"}` }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:gMeta.color.accent }}/>
            <span style={{ fontSize:9, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:gMeta.color.accent }}>{gMeta.type} {gMeta.label}</span>
          </div>
        ) : <div />}
        <button onClick={onViewHistory} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
          <span style={{ fontSize:12, fontWeight:600, color:C.accent, letterSpacing:"0.01em" }}>View history →</span>
        </button>
      </div>

      {/* Exercise name */}
      <div style={{ fontSize:30, fontWeight:900, color:C.white, letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:22 }}>
        {sub.title}
      </div>

      {/* Stats grid */}
      {statCols.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${statCols.length},1fr)`, border:`1px solid ${C.line2}`, borderRadius:12, overflow:"hidden", marginBottom:24 }}>
          {statCols.map((s,i) => {
            const { num, unit } = splitValueUnit(s.v);
            return (
              <div key={i} style={{ padding:"16px 10px 14px", textAlign:"center", borderRight:i<statCols.length-1?`1px solid ${C.line2}`:"none" }}>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:4 }}>
                  <span style={{ fontSize:28, fontWeight:900, color:C.white, letterSpacing:"-2px", lineHeight:1 }}>{num}</span>
                  {unit && <span style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.55)" }}>{unit}</span>}
                </div>
                <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted, marginTop:7 }}>{s.l}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Set tracker */}
      <div style={{ marginBottom:4 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted }}>Sets</span>
          <span style={{ fontSize:11, fontWeight:600, color:C.dim }}>{Math.min(currentSet,totalSets)} of {totalSets}</span>
        </div>
        <SetDots total={totalSets} done={Math.min(currentSet-1,totalSets)} color={accent}/>
      </div>

      {/* Set Logger */}
      {setLog && onSetLogChange && (
        <SetLogger sub={sub} setNumber={currentSet} value={setLog} onChange={onSetLogChange} />
      )}

      {/* Instructions */}
      {sub.instructions && (
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.50)", lineHeight:1.65, padding:"11px 14px", background:C.faint, borderRadius:8, borderLeft:`2px solid ${C.line2}`, marginTop:16 }}>
          {sub.instructions}
        </div>
      )}

      {/* Video link */}
      {sub.videoUrl && (
        <a href={sub.videoUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
          style={{ display:"inline-flex", alignItems:"center", gap:7, marginTop:14, fontSize:12, fontWeight:700, color:C.accent, textDecoration:"none", background:"rgba(79,171,255,0.12)", border:"1px solid rgba(79,171,255,0.25)", borderRadius:7, padding:"7px 13px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
          </svg>
          Watch video
        </a>
      )}

      {/* Evidence required */}
      {sub.evidenceRequired && (
        <div style={{ display:"flex", alignItems:"center", gap:9, marginTop:12, padding:"11px 14px", background:"rgba(255,165,0,0.08)", border:"1px solid rgba(255,165,0,0.2)", borderRadius:8 }}>
          <Camera size={13} color="rgba(255,165,0,0.72)"/>
          <span style={{ fontSize:12, fontWeight:700, color:"rgba(255,165,0,0.72)" }}>Photo required after completing</span>
        </div>
      )}
    </div>
  );
}

// ─── REST TIMER ───────────────────────────────────────────────────────────────
function RestTimer({ seconds, total, nextLabel, onSkip }) {
  const size=148, stroke=6, r=(size-stroke)/2, circ=2*Math.PI*r;
  const pct = Math.max(0, seconds/total);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"28px 24px" }}>
      <div style={{ fontSize:9, fontWeight:900, letterSpacing:"0.22em", textTransform:"uppercase", color:C.orange, marginBottom:24 }}>Rest</div>
      <div style={{ position:"relative", width:size, height:size, marginBottom:28 }}>
        <svg width={size} height={size} style={{ transform:"rotate(-90deg)", position:"absolute", inset:0 }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.surface} strokeWidth={stroke}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.orange} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear" }}/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:42, fontWeight:900, color:C.white, letterSpacing:"-2px", lineHeight:1 }}>{seconds}</div>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.dim, marginTop:4 }}>sec</div>
        </div>
      </div>
      {nextLabel && (
        <div style={{ width:"100%", marginBottom:24, padding:"12px 16px", background:C.surface, border:`1px solid ${C.line2}`, borderRadius:11 }}>
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted, marginBottom:4 }}>Up next</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.dim }}>{nextLabel}</div>
        </div>
      )}
      <button onClick={onSkip} style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 24px", background:"transparent", border:`1px solid ${C.line2}`, borderRadius:9, fontSize:12, fontWeight:700, color:C.dim, cursor:"pointer", fontFamily:"inherit" }}>
        <SkipForward size={12}/> Skip rest
      </button>
    </div>
  );
}

// ─── WORKOUT COMPLETE ─────────────────────────────────────────────────────────
function WorkoutComplete({ startTime, totalCount, onDone }) {
  const elapsed = startTime ? Math.round((Date.now()-startTime)/1000) : 0;
  const mm = Math.floor(elapsed/60), ss = elapsed%60;
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"36px 24px", textAlign:"center" }}>
      <div style={{ display:"flex", gap:10, marginBottom:24 }}>
        {[0.08,0,0.16].map((d,i)=>(
          <Star key={i} size={26} color={C.amber} fill={C.amber} style={{ animation:`starPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${d}s both` }}/>
        ))}
      </div>
      <div style={{ fontSize:46, fontWeight:900, color:C.white, letterSpacing:"-0.05em", lineHeight:0.92, marginBottom:10, animation:"riseUp 0.4s ease 0.28s both" }}>
        WORKOUT<br/>COMPLETE.
      </div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:32, animation:"riseUp 0.4s ease 0.4s both" }}>That's how it's done.</div>
      <div style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1fr", border:`1px solid ${C.line2}`, borderRadius:12, overflow:"hidden", marginBottom:28, animation:"riseUp 0.4s ease 0.52s both" }}>
        {[{v:totalCount,l:"exercises"},{v:`${mm}:${String(ss).padStart(2,"0")}`,l:"duration"}].map((s,i)=>(
          <div key={i} style={{ padding:"18px 10px", background:C.surface, borderRight:i<1?`1px solid ${C.line2}`:"none" }}>
            <div style={{ fontSize:24, fontWeight:900, color:C.white, letterSpacing:"-0.03em" }}>{s.v}</div>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginTop:4 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <button onClick={onDone} style={{ width:"100%", padding:"16px", background:C.green, border:"none", borderRadius:12, fontSize:14, fontWeight:900, color:"#040A05", cursor:"pointer", fontFamily:"inherit", animation:"riseUp 0.4s ease 0.64s both" }}>
        Done
      </button>
    </div>
  );
}

// ─── SWIPE HOOK ───────────────────────────────────────────────────────────────
const SWIPE_THRESHOLD = 88;
function useSwipeRight(onFire, disabled) {
  const controls = useAnimation();
  const [dragX,setDragX]=useState(0), [armed,setArmed]=useState(false);
  useEffect(()=>{ if(disabled){controls.start({x:0,transition:{type:"spring",stiffness:500,damping:40}});setDragX(0);setArmed(false);} },[disabled,controls]);
  const props = {
    drag:disabled?false:"x", dragConstraints:{left:0,right:60}, dragElastic:{left:0,right:0.08}, dragMomentum:false,
    onDrag:(_,info)=>{ if(disabled)return; const x=Math.max(0,info.offset.x); setDragX(x); setArmed(x>SWIPE_THRESHOLD*0.75); },
    onDragEnd:(_,info)=>{ if(disabled)return; controls.start({x:0,transition:{type:"spring",stiffness:500,damping:40}}); setDragX(0); setArmed(false); if(info.offset.x>SWIPE_THRESHOLD) setTimeout(onFire,0); },
    animate:controls, style:{touchAction:"pan-y",cursor:disabled?"default":"grab"},
  };
  return { props, dragX, armed };
}

// ─── STAT CELL ────────────────────────────────────────────────────────────────
function StatCell({ value, label, accent }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
      <span style={{ fontSize:13, fontWeight:700, color:accent||C.white, letterSpacing:"-0.02em", lineHeight:1 }}>{value}</span>
      <span style={{ fontSize:8, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(255,255,255,0.45)", lineHeight:1 }}>{label}</span>
    </div>
  );
}

// ─── EXERCISE ROW (preview list) ──────────────────────────────────────────────
function ExerciseRow({ sub, optimisticStatusById, onTap, isLast, isGrouped=false, groupAccent, showConnector=false }) {
  const done = isDone(optimisticStatusById?.[sub.id], sub.item?.Status);
  const prevDone=useRef(done), [flash,setFlash]=useState(false);
  useEffect(()=>{ if(!prevDone.current&&done){haptic(10);setFlash(true);const t=setTimeout(()=>setFlash(false),600);prevDone.current=true;return()=>clearTimeout(t);} if(!done)prevDone.current=false; },[done]);
  const fire=useCallback(()=>onTap(sub),[onTap,sub]);
  const {props,dragX,armed}=useSwipeRight(fire,done);
  const {sets,reps,weight,rest}=parseMeta(sub.meta);

  const stats = !done ? [
    sets    && { value:sets,   label:"sets"   },
    reps    && { value:reps,   label:"reps"   },
    weight  && { value:weight, label:"weight" },
    rest    && { value:rest,   label:"rest"   },
  ].filter(Boolean) : [];

  return (
    <div style={{ position:"relative", overflow:"hidden" }}>
      {/* Swipe reveal */}
      {!done&&<div style={{ position:"absolute",right:0,top:0,bottom:0,width:56,display:"flex",alignItems:"center",justifyContent:"center",opacity:Math.min(1,dragX/18),pointerEvents:"none" }}>
        <div style={{ width:28,height:28,borderRadius:"50%",background:armed?"rgba(0,200,81,0.25)":"rgba(0,200,81,0.12)",border:`1.5px solid ${armed?C.green:"rgba(0,200,81,0.35)"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s,border-color 0.15s",transform:armed?"scale(1.1)":"scale(1)" }}>
          <Check size={13} color={armed?C.green:"rgba(0,200,81,0.6)"} strokeWidth={3}/>
        </div>
      </div>}

      <motion.div {...props} onClick={()=>!done&&onTap(sub)}
        style={{ ...props.style, width:"100%", display:"flex", alignItems:"flex-start", gap:14,
          padding:isGrouped?"12px 20px 12px 28px":"12px 20px",
          background:flash?"rgba(0,200,81,0.07)":C.bg,
          borderBottom:isLast?"none":`1px solid ${C.cardLine}`,
          boxSizing:"border-box", userSelect:"none", position:"relative" }}>

        {isGrouped&&showConnector&&<div style={{ position:"absolute",left:20,top:"50%",bottom:-12,width:1,borderLeft:`1px dashed ${groupAccent||"rgba(255,255,255,0.2)"}`,opacity:0.4,pointerEvents:"none" }}/>}

        {/* Status circle */}
        <div style={{ width:22,height:22,borderRadius:"50%",flexShrink:0,marginTop:1,border:`1.5px solid ${done?C.green:"rgba(255,255,255,0.2)"}`,background:done?C.greenDim:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s ease" }}>
          {done&&<motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:500,damping:25}}><Check size={11} color={C.green} strokeWidth={3}/></motion.div>}
        </div>

        {/* Name + stat strip */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Exercise name */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            <div style={{ fontSize:14, fontWeight:done?400:600, color:done?C.dim:C.white, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:done?"line-through":"none", textDecorationColor:"rgba(255,255,255,0.18)", transition:"all 0.2s", flex:1, minWidth:0 }}>
              {sub.title}
            </div>
            {sub.evidenceRequired&&!done&&<AlertCircle size={13} color="rgba(255,165,0,0.55)" style={{flexShrink:0}}/>}
          </div>

          {/* Stat strip */}
          {stats.length > 0 && (
            <div style={{ display:"flex", alignItems:"flex-end", gap:16, marginTop:8 }}>
              {stats.map((s,i) => (
                <StatCell key={i} value={s.value} label={s.label}
                  accent={i===2&&groupAccent ? groupAccent : undefined}
                />
              ))}
              {/* Divider before video */}
              {sub.videoUrl && stats.length > 0 && (
                <div style={{ width:1, height:20, background:"rgba(255,255,255,0.08)", alignSelf:"center" }}/>
              )}
              {/* Video icon */}
              {sub.videoUrl && (
                <a href={sub.videoUrl} target="_blank" rel="noopener noreferrer"
                  onClick={e=>e.stopPropagation()}
                  style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, textDecoration:"none" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={groupAccent||C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill={groupAccent||C.accent} stroke="none"/>
                  </svg>
                  <span style={{ fontSize:8, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(255,255,255,0.25)", lineHeight:1 }}>video</span>
                </a>
              )}
            </div>
          )}

          {/* Done state meta */}
          {done&&sub.meta&&<div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{sub.meta}</div>}
        </div>
      </motion.div>

      {dragX>4&&<div style={{ height:2,background:"#252525",position:"absolute",bottom:0,left:0,right:0 }}>
        <motion.div style={{ height:"100%",background:armed?C.green:"#00A040",borderRadius:1 }} animate={{ width:`${Math.min(100,(dragX/SWIPE_THRESHOLD)*100)}%` }} transition={{ duration:0.05 }}/>
      </div>}
    </div>
  );
}

// ─── GROUP BLOCK ──────────────────────────────────────────────────────────────
function GroupBlock({ groupId, members, meta, optimisticStatusById, onTap }) {
  const {label,color,type}=meta;
  const doneCount=members.filter(s=>isDone(optimisticStatusById?.[s.id], s.item?.Status)).length;
  const allDone=doneCount>=members.length;
  return (
    <div style={{ margin:"6px 12px", border:`1px solid ${allDone?"rgba(0,200,81,0.25)":color.border}`, borderLeft:`3px solid ${allDone?C.green:color.accent}`, borderRadius:10, overflow:"hidden", transition:"border-color 0.3s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", background:allDone?"rgba(0,200,81,0.06)":color.bg, borderBottom:`1px solid ${allDone?"rgba(0,200,81,0.15)":color.border}`, transition:"background 0.3s" }}>
        <span style={{ fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"2px 9px",borderRadius:5,background:allDone?"rgba(0,200,81,0.15)":color.accent+"22",border:`1px solid ${allDone?"rgba(0,200,81,0.4)":color.accent+"50"}`,color:allDone?C.green:color.accent,transition:"all 0.3s" }}>
          {allDone?"✓ ":""}{type} {label}
        </span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.50)", fontWeight:500, flex:1 }}>{members.length} exercises · back to back · rest after</span>
        {doneCount>0&&!allDone&&<span style={{ fontSize:11,fontWeight:800,color:color.accent }}>{doneCount}/{members.length}</span>}
      </div>
      {members.map((sub,mi)=>(
        <ExerciseRow key={sub.id} sub={sub} optimisticStatusById={optimisticStatusById} onTap={onTap}
          isLast={mi===members.length-1} isGrouped groupAccent={color.accent} showConnector={mi<members.length-1}/>
      ))}
    </div>
  );
}

// ─── WORKOUT SHEET ────────────────────────────────────────────────────────────
export default function WorkoutSheet({ isOpen, onClose, workoutItem, dailyWorkout, optimisticStatusById, onExerciseTap, onQuickComplete, onLogSet, getExerciseSessions }) {
  useEffect(() => {
    if (!isOpen) {
      const savedY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top      = "";
      document.body.style.width    = "";
      document.body.style.overflow = "";
      if (savedY) window.scrollTo(0, parseInt(savedY) * -1);
      return;
    }
    // iOS Safari needs position:fixed to actually block scroll
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.width    = "100%";
    return () => {
      const savedY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top      = "";
      document.body.style.width    = "";
      document.body.style.overflow = "";
      if (savedY) window.scrollTo(0, parseInt(savedY) * -1);
    };
  }, [isOpen]);

  const sub = workoutItem?.sub || [];
  const groupMeta = useMemo(()=>buildGroupMeta(sub),[sub]);
  const segments  = useMemo(()=>buildSegments(sub,groupMeta),[sub,groupMeta]);

  const [mode,       setMode]       = useState("preview");
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [startTime,  setStartTime]  = useState(null);
  const [restSecs,   setRestSecs]   = useState(0);
  const [restTotal,  setRestTotal]  = useState(60);
  const [restNext,   setRestNext]   = useState("");
  const timerRef = useRef(null);

  // Set logger state — tracks what the athlete actually did this set
  const [setLog, setSetLog] = useState({ reps: 0, weight: 0, effort: 0 });

  // History sheet
  const [historyEx, setHistoryEx] = useState(null); // exercise sub-object
  const [historyOpen, setHistoryOpen] = useState(false);

  // Reset setLog when exercise or set number changes (pre-fill from target)
  useEffect(() => {
    if (!sub[activeIdx]) return;
    const { reps: tr, weight: tw } = parseMeta(sub[activeIdx]?.meta || "");
    const isBodyWeight = /body.?weight|^bw$/i.test(String(tw || ""));
    setSetLog({
      reps:   parseInt(tr) || 0,
      weight: isBodyWeight ? 0 : (parseFloat(String(tw || "").replace(/[^0-9.]/g, "")) || 0),
      effort: 0,
    });
  }, [activeIdx, currentSet]); // eslint-disable-line

  useEffect(()=>{ if(!isOpen){ const t=setTimeout(()=>{ setMode("preview"); setActiveIdx(0); setCurrentSet(1); },400); return()=>clearTimeout(t); } },[isOpen]);

  useEffect(()=>{
    if(mode!=="resting"||restSecs<=0) return;
    timerRef.current=setInterval(()=>{
      setRestSecs(prev=>{ if(prev<=1){ clearInterval(timerRef.current); setMode("active"); return 0; } return prev-1; });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[mode]);

  const firstIncomplete = useMemo(()=>{ const i=sub.findIndex(s=>!isDone(optimisticStatusById?.[s.id], s.item?.Status)); return i===-1?0:i; },[sub,optimisticStatusById]);

  const handleBegin = useCallback(()=>{ setActiveIdx(firstIncomplete); setCurrentSet(1); setStartTime(prev=>prev||Date.now()); setMode("active"); },[firstIncomplete]);

  const handleCompleteSet = useCallback(()=>{
    const curSub = sub[activeIdx]; if (!curSub) return;
    const gid = curSub.groupId || curSub.item?.groupId;

    // Save what the athlete actually did this set, regardless of path
    onLogSet?.({
      workoutItemId: curSub.id,
      exerciseTitle: curSub.title,
      setNumber:     currentSet,
      targetReps:    parseMeta(curSub.meta||"").reps,
      targetWeight:  parseMeta(curSub.meta||"").weight,
      actualReps:    setLog.reps,
      actualWeight:  setLog.weight,
      effort:        setLog.effort,
      groupId:       gid || null,
    });

    if (gid) {
      // ── GROUPED (superset / circuit) ─────────────────────────────────────
      // Flow: A1 → A2 → A3 → REST → A1 → A2 → A3 → REST → done
      const groupMembers = sub.filter(s => (s.groupId||s.item?.groupId) === gid);
      const posInGroup   = groupMembers.findIndex(s => s.id === curSub.id);
      const isLastInGroup = posInGroup === groupMembers.length - 1;
      const totalRounds   = parseInt(parseMeta(groupMembers[0].meta||"").sets) || 1;

      if (!isLastInGroup) {
        // Move to next exercise in group — no rest, no set increment
        const nextGroupEx = groupMembers[posInGroup + 1];
        const nextIdx = sub.findIndex(s => s.id === nextGroupEx.id);
        setActiveIdx(nextIdx);
        setMode("active");

      } else if (currentSet < totalRounds) {
        // Completed a full round — rest, then back to first in group
        haptic(15);
        const firstIdx = sub.findIndex(s => s.id === groupMembers[0].id);
        const restSec  = Math.max(...groupMembers.map(m => parseRestSecs(m)));
        setActiveIdx(firstIdx);
        setCurrentSet(prev => prev + 1);
        setRestTotal(restSec); setRestSecs(restSec);
        setRestNext(`${groupMembers[0].title} · Round ${currentSet + 1} of ${totalRounds}`);
        setMode("resting");

      } else {
        // All rounds done — mark every exercise in group complete, move on
        haptic(20);
        groupMembers.forEach(m => {
          if (!isDone(optimisticStatusById?.[m.id], m.item?.Status)) {
            if (m.evidenceRequired) onExerciseTap(m);
            else onQuickComplete(m);
          }
        });
        // Find next exercise after the group
        const lastGroupIdx = sub.findIndex(s => s.id === groupMembers[groupMembers.length-1].id);
        const nextIdx = sub.findIndex((s,i) => i > lastGroupIdx && !isDone(optimisticStatusById?.[s.id], s.item?.Status));
        if (nextIdx === -1) { setMode("complete"); return; }
        const nextSub = sub[nextIdx];
        const restSec = Math.max(...groupMembers.map(m => parseRestSecs(m)));
        setActiveIdx(nextIdx); setCurrentSet(1);
        setRestTotal(restSec); setRestSecs(restSec);
        const {sets:ns,reps:nr} = parseMeta(nextSub.meta||"");
        setRestNext(`${nextSub.title} · ${ns||""}×${nr||""}`);
        setMode("resting");
      }

    } else {
      // ── SINGLE EXERCISE ───────────────────────────────────────────────────
      const totalSets = parseInt(parseMeta(curSub.meta||"").sets) || 1;
      const isLastSet = currentSet >= totalSets;
      if (isLastSet) {
        haptic(20);
        if (curSub.evidenceRequired) onExerciseTap(curSub);
        else onQuickComplete(curSub);
        const nextIdx = sub.findIndex((s,i) => i > activeIdx && !isDone(optimisticStatusById?.[s.id], s.item?.Status));
        if (nextIdx === -1) { setMode("complete"); return; }
        const nextSub = sub[nextIdx];
        const restSec = parseRestSecs(curSub);
        setActiveIdx(nextIdx); setCurrentSet(1);
        setRestTotal(restSec); setRestSecs(restSec);
        const {sets:ns,reps:nr} = parseMeta(nextSub.meta||"");
        setRestNext(`${nextSub.title} · ${ns||""}×${nr||""}`);
        setMode("resting");
      } else {
        const ns = currentSet + 1; setCurrentSet(ns);
        const restSec = parseRestSecs(curSub);
        setRestTotal(restSec); setRestSecs(restSec);
        setRestNext(`${curSub.title} · Set ${ns}`);
        setMode("resting");
      }
    }
  },[sub,activeIdx,currentSet,optimisticStatusById,onExerciseTap,onQuickComplete]);

  const handleSkipRest=useCallback(()=>{ clearInterval(timerRef.current); setMode("active"); },[]);
  const handlePreviewTap=useCallback(s=>{ if(s.evidenceRequired) onExerciseTap(s); else onQuickComplete(s); },[onExerciseTap,onQuickComplete]);

  const doneCount=sub.filter(s=>isDone(optimisticStatusById?.[s.id], s.item?.Status)).length;
  const totalCount=sub.length;
  const allDone=totalCount>0&&doneCount>=totalCount;
  const pct=totalCount>0?(doneCount/totalCount)*100:0;
  const title=workoutItem?.title||dailyWorkout?.Title||"Team Workout";
  const groupAccents=Object.values(groupMeta).map(m=>m.color.accent);
  const accentBar=groupAccents.length>1?`linear-gradient(90deg,${groupAccents.join(",")})`:groupAccents.length===1?groupAccents[0]:C.accent;
  
  return (
    <>
      <AnimatePresence>
        {isOpen&&<motion.div key="ws-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}} onClick={onClose} style={{ position:"fixed",inset:0,zIndex:40,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(3px)" }}/>}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen&&(
          <motion.div key="ws-sheet" initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",stiffness:380,damping:42,mass:1}}
            style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:C.bg,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:"92dvh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif",paddingBottom:"env(safe-area-inset-bottom,0)" }}>
            <style>{`
              @keyframes cardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
              @keyframes starPop{0%{transform:scale(0) rotate(-20deg);opacity:0}65%{transform:scale(1.15) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
              @keyframes riseUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
            `}</style>

            {/* Gradient bar */}
            <div style={{ height:3, background:accentBar, flexShrink:0 }}/>

            {/* Handle */}
            <div style={{ display:"flex",justifyContent:"center",padding:"10px 0 0",flexShrink:0,cursor:"pointer" }} onClick={onClose}>
              <div style={{ width:32,height:3.5,background:C.handle,borderRadius:2 }}/>
            </div>

            {/* Header */}
            <div style={{ padding:"14px 20px 0", flexShrink:0 }}>
              <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12 }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:9,fontWeight:800,letterSpacing:"0.18em",textTransform:"uppercase",color:allDone?C.green:C.accent,marginBottom:5,transition:"color 0.4s" }}>
                    {allDone?"✓ Training complete":"Training"}
                  </div>
                  <div style={{ fontSize:24,fontWeight:800,color:allDone?"rgba(255,255,255,0.4)":C.white,letterSpacing:"-0.03em",lineHeight:1.1,transition:"color 0.5s",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {title}
                  </div>
                  {Object.keys(groupMeta).length>0&&(
                    <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginTop:6 }}>
                      {Object.values(groupMeta).map(m=>(
                        <span key={m.label} style={{ fontSize:9,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",padding:"2px 8px",borderRadius:4,background:m.color.accent+"18",border:`1px solid ${m.color.accent+"40"}`,color:m.color.accent }}>
                          {m.type} {m.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={onClose} style={{ background:"#1A1A1A",border:"none",width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginLeft:12,marginTop:2 }}>
                  <X size={14} color="rgba(255,255,255,0.5)"/>
                </button>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ height:2,background:"#252525",borderRadius:1,overflow:"hidden",marginBottom:7 }}>
                  <motion.div style={{ height:"100%",borderRadius:1,background:allDone?C.green:C.accent }} animate={{ width:`${pct}%` }} transition={{ duration:0.6,ease:[0.4,0,0.2,1] }}/>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between" }}>
                  <span style={{ fontSize:11,color:C.dim,fontWeight:500 }}>{doneCount} of {totalCount} complete</span>
                  <span style={{ fontSize:11,fontWeight:800,color:allDone?C.green:C.accent }}>{Math.round(pct)}%</span>
                </div>
              </div>
            </div>

            <div style={{ height:1,background:C.cardLine,flexShrink:0 }}/>

            {/* PREVIEW */}
            {mode==="preview"&&(
              <div style={{ overflowY:"auto",flex:1,WebkitOverflowScrolling:"touch" }}>
                <div style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 20px",borderBottom:`1px solid ${C.cardLine}`,background:"#0D0D0D" }}>
                  <ChevronDown size={11} color="rgba(255,255,255,0.2)" style={{ transform:"rotate(-90deg)" }}/>
                  <span style={{ fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:500 }}>Swipe to complete · Tap Begin for focus mode</span>
                </div>
                {segments.map((seg,si)=>
                  seg.type==="group"
                    ?<GroupBlock key={seg.groupId} groupId={seg.groupId} members={seg.members} meta={groupMeta[seg.groupId]} optimisticStatusById={optimisticStatusById} onTap={handlePreviewTap}/>
                    :<ExerciseRow key={seg.sub.id} sub={seg.sub} optimisticStatusById={optimisticStatusById} onTap={handlePreviewTap} isLast={si===segments.length-1}/>
                )}
                <AnimatePresence>
                  {allDone&&<motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} style={{ display:"flex",alignItems:"center",gap:12,padding:"18px 20px",borderTop:`1px solid ${C.cardLine}`,background:"rgba(0,200,81,0.04)" }}>
                    <div style={{ width:30,height:30,borderRadius:"50%",background:C.greenDim,border:"1px solid rgba(0,200,81,0.3)",display:"flex",alignItems:"center",justifyContent:"center" }}><Check size={14} color={C.green} strokeWidth={3}/></div>
                    <span style={{ fontSize:14,fontWeight:600,color:C.greenText }}>Workout complete</span>
                  </motion.div>}
                </AnimatePresence>
                <div style={{ height:12 }}/>
                {!allDone&&(
                  <div style={{ padding:"0 16px 32px" }}>
                    <button onClick={handleBegin} style={{ width:"100%",padding:"18px",background:C.accent,border:"none",borderRadius:14,fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"inherit",letterSpacing:"-0.01em" }}>
                      <Play size={15} fill="white"/>
                      {doneCount>0?"Continue Workout":"Begin Workout"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ACTIVE */}
            {mode==="active"&&sub[activeIdx]&&(()=>{
              const curSub = sub[activeIdx];
              const gid = curSub.groupId || curSub.item?.groupId;
              const groupMembers = gid ? sub.filter(s=>(s.groupId||s.item?.groupId)===gid) : null;
              const posInGroup   = groupMembers ? groupMembers.findIndex(s=>s.id===curSub.id) : -1;
              const isLastInGroup = groupMembers ? posInGroup===groupMembers.length-1 : true;
              const totalRounds   = groupMembers ? parseInt(parseMeta(groupMembers[0].meta||"").sets)||1 : parseInt(parseMeta(curSub.meta||"").sets)||1;
              const isLastRound   = currentSet >= totalRounds;

              // What comes after tapping the button?
              const nextInGroup   = groupMembers && !isLastInGroup ? groupMembers[posInGroup+1] : null;
              const afterThisLabel = nextInGroup
                ? `${nextInGroup.title} · Same round, no rest`
                : !isLastRound
                  ? `Rest · Then Round ${currentSet+1} of ${totalRounds}`
                  : null;

              // Button label
              const btnLabel = nextInGroup
                ? `Next: ${nextInGroup.title} →`
                : !isLastRound
                  ? `Round ${currentSet} Done · Rest`
                  : gid
                    ? `Complete Group`
                    : isLastRound
                      ? `Complete`
                      : `Set ${currentSet} Done`;

              const btnColor = nextInGroup ? C.accent : C.green;
              const btnTextColor = nextInGroup ? "#fff" : "#040A05";

              return (
                <div style={{ flex:1,display:"flex",flexDirection:"column",overflowY:"auto" }}>
                  <ActiveCard key={curSub.id} sub={curSub} currentSet={currentSet} groupMeta={groupMeta}
                    setLog={setLog} onSetLogChange={setSetLog}
                    onViewHistory={() => { setHistoryEx(curSub); setHistoryOpen(true); }}
                  />
                  {afterThisLabel && (
                    <div style={{ margin:"0 14px 10px",padding:"10px 14px",background:C.surface,border:`1px solid ${C.line2}`,borderRadius:10 }}>
                      <div style={{ fontSize:9,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:C.muted,marginBottom:4 }}>After this</div>
                      <div style={{ fontSize:13,fontWeight:600,color:C.dim }}>{afterThisLabel}</div>
                    </div>
                  )}
                  <div style={{ flex:1 }}/>
                  <div style={{ padding:"12px 14px 32px",display:"flex",gap:10,flexShrink:0 }}>
                    <button onClick={()=>setMode("preview")} style={{ padding:"13px 16px",background:"transparent",border:`1px solid ${C.line2}`,borderRadius:11,fontSize:12,fontWeight:700,color:C.muted,cursor:"pointer",fontFamily:"inherit" }}>← List</button>
                    <button onClick={handleCompleteSet} style={{ flex:1,padding:"16px",background:btnColor,border:"none",borderRadius:11,fontSize:14,fontWeight:900,color:btnTextColor,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit",letterSpacing:"-0.01em" }}>
                      {nextInGroup ? null : <Check size={15} strokeWidth={3}/>}
                      {btnLabel}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* REST */}
            {mode==="resting"&&<RestTimer seconds={restSecs} total={restTotal} nextLabel={restNext} onSkip={handleSkipRest}/>}

            {/* COMPLETE */}
            {mode==="complete"&&<WorkoutComplete startTime={startTime} totalCount={totalCount} onDone={()=>{ setMode("preview"); onClose(); }}/>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise progress / history sheet */}
      <ExerciseProgressSheet
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        exerciseTitle={historyEx?.title || ""}
        sessions={historyEx && getExerciseSessions ? getExerciseSessions(historyEx.title) : []}
      />
    </>
  );
}