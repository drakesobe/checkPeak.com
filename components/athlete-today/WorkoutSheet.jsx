// components/athlete-today/WorkoutSheet.jsx
// Full "Flow State" workout experience.
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Check, X, ChevronDown, AlertCircle, Play, SkipForward, Star, Camera, AlertTriangle } from "lucide-react";
import ExerciseProgressSheet from "./ExerciseProgressSheet";

const C = {
  bg:"#0F0F0F", surface:"#161616", surface2:"#1A1A1A",
  cardLine:"#1E1E1E", line2:"#2A2A2A",
  white:"#FFFFFF", dim:"rgba(255,255,255,0.65)",
  muted:"rgba(255,255,255,0.45)", faint:"rgba(255,255,255,0.10)",
  accent:"#4FABFF", green:"#00C851", greenDim:"rgba(0,200,81,0.15)",
  greenText:"#00C851", orange:"#FF6B2B", amber:"#F59E0B", handle:"#2A2A2A",
  red:"#EF4444", redDim:"rgba(239,68,68,0.12)",
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
    const gid = s?.groupId || s?.item?.groupId || s?.item?.GroupId;
    if (gid && !meta[gid]) { meta[gid] = { label:GROUP_LETTERS[idx%26], color:GROUP_COLORS[idx%GROUP_COLORS.length], count:0 }; idx++; }
    if (gid) meta[gid].count++;
  });
  Object.values(meta).forEach(m => { m.type = m.count >= 3 ? "Circuit" : "Superset"; });
  return meta;
}

function buildSegments(subs, groupMeta) {
  const segs = []; let i = 0;
  while (i < subs.length) {
    const sub = subs[i], gid = sub?.groupId || sub?.item?.groupId || sub?.item?.GroupId;
    if (gid && groupMeta[gid]) {
      const members = [sub]; let j = i+1;
      while (j < subs.length && (subs[j]?.groupId||subs[j]?.item?.groupId||subs[j]?.item?.GroupId) === gid) { members.push(subs[j]); j++; }
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
  const raw = String(sub?.item?.Rest || sub?.item?.rest || "").trim();
  if (raw) {
    const isMin = /min/i.test(raw);
    if (/^\d+:\d+$/.test(raw)) {
      const [m, s] = raw.split(":").map(Number);
      return m * 60 + s;
    }
    const n = parseInt(raw.replace(/[^0-9]/g, "")) || 0;
    if (n > 0) return isMin ? n * 60 : n;
  }
  const restPart = (sub?.meta || "").split(" · ").find(p => /rest/i.test(p));
  if (restPart) {
    const isMin = /min/i.test(restPart);
    const n = parseInt(restPart.replace(/[^0-9]/g, "")) || 0;
    if (n > 0) return isMin ? n * 60 : n;
  }
  return 60;
}

function haptic(ms=10) { try { navigator.vibrate?.(ms); } catch {} }

function isDone(optimisticStatus, itemStatus) {
  const s = String(optimisticStatus || itemStatus || "").toLowerCase().trim();
  return s === "completed" || s === "pending_review" || s === "pending review" || s === "approved";
}

function isRejected(optimisticStatus, itemStatus) {
  if (optimisticStatus) return false;
  return String(itemStatus || "").toLowerCase().trim() === "rejected";
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

// ─── EFFORT SCALE ─────────────────────────────────────────────────────────────
const EFFORT = [null,
  { label:"Easy",     color:"#22C55E" },
  { label:"Light",    color:"#84CC16" },
  { label:"Moderate", color:"#FBBF24" },
  { label:"Hard",     color:"#F97316" },
  { label:"Max",      color:"#EF4444" },
];

// ─── STEPPER ──────────────────────────────────────────────────────────────────
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
          onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
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

// ─── SET LOGGER ───────────────────────────────────────────────────────────────
function SetLogger({ sub, setNumber, value, onChange, pendingVideo, onPendingVideoChange }) {
  const { reps: tr, weight: tw } = parseMeta(sub?.meta || "");
  const isBodyWeight  = /body.?weight|^bw$/i.test(String(tw || ""));
  const weightUnit    = /kg/i.test(String(tw || "")) ? "kg" : "lb";
  const weightStep    = weightUnit === "kg" ? 2.5 : 5;

  const pctMatch      = String(tw || "").match(/^(\d+(?:\.\d+)?)\s*%/);
  const isPercent     = !!pctMatch;
  const prescribedPct = isPercent ? parseFloat(pctMatch[1]) : null;

  const [prMax,       setPrMax]       = useState(0);
  const [prLoading,   setPrLoading]   = useState(false);
  const [prevSession, setPrevSession] = useState(null);
  const [noteOpen,    setNoteOpen]    = useState(false);
  const autoFilledRef = useRef(false);
  const videoInputRef = useRef(null);

  useEffect(() => {
    if (!sub?.title) return;
    autoFilledRef.current = false;
    setPrMax(0);
    setPrevSession(null);
    setNoteOpen(false);
    if (isPercent) setPrLoading(true);

    fetch(
      `/api/athlete/workouts/logs?exerciseTitle=${encodeURIComponent(sub.title)}&days=730&limit=500`,
      { credentials: "include" }
    )
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        if (!data.ok || !Array.isArray(data.logs)) return;

        if (isPercent) {
          const best = Math.max(0, ...data.logs.map(l => Number(l.actualWeight) || 0));
          if (best > 0) {
            setPrMax(best);
            if (!autoFilledRef.current) {
              autoFilledRef.current = true;
              onChange({ ...value, weight: Math.round((prescribedPct / 100) * best) });
            }
          }
        }

        const today = new Date().toISOString().slice(0, 10);
        const byDate = {};
        data.logs.forEach(l => {
          const d = l.date || "";
          if (d && d !== today) {
            if (!byDate[d]) byDate[d] = [];
            byDate[d].push(l);
          }
        });
        const dates = Object.keys(byDate).sort().reverse();
        if (dates.length > 0) {
          const lastDate = dates[0];
          const sets = byDate[lastDate];
          const maxW = Math.max(0, ...sets.map(s => Number(s.actualWeight) || 0));
          const maxR = Math.max(0, ...sets.map(s => Number(s.actualReps) || 0));
          const effortSets = sets.filter(s => (s.difficulty || 0) > 0);
          const avgE = effortSets.length > 0
            ? effortSets.reduce((a, s) => a + (s.difficulty || 0), 0) / effortSets.length
            : null;
          const dateLabel = new Date(`${lastDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          setPrevSession({ dateLabel, maxWeight: maxW, maxReps: maxR, totalSets: sets.length, avgEffort: avgE });
        }
      })
      .catch(() => {})
      .finally(() => setPrLoading(false));
  }, [sub?.title, setNumber]); // eslint-disable-line

  const hintText = isPercent
    ? prLoading      ? "Fetching your max…"
    : prMax > 0      ? `${prescribedPct}% of ${prMax} ${weightUnit} max`
    : `${prescribedPct}% of max`
    : null;

  return (
    <div style={{ marginTop:16, padding:"16px 16px 14px", background:C.faint, borderRadius:10, border:`1px solid ${C.line2}` }}>
      <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted, marginBottom:16 }}>
        Log Set {setNumber}
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isBodyWeight ? "1fr" : "1fr 1fr", gap:16, marginBottom:18 }}>
        <div>
          <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginBottom:10 }}>Reps</div>
          <Stepper value={value.reps} step={1} min={0} onChange={v => onChange({ ...value, reps: v })} />
        </div>
        {!isBodyWeight && (
          <div>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginBottom:10 }}>Weight ({weightUnit})</div>
            <Stepper value={value.weight} step={weightStep} min={0} onChange={v => onChange({ ...value, weight: v })} />
            {hintText && (
              <div style={{ fontSize:9, fontWeight:600, color:C.muted, marginTop:6, letterSpacing:"0.02em" }}>{hintText}</div>
            )}
          </div>
        )}
      </div>

      {/* Last session card */}
      {prevSession && (prevSession.maxWeight > 0 || prevSession.maxReps > 0) && (
        <div style={{ marginBottom:16, padding:"10px 12px", background:"rgba(79,171,255,0.05)", border:"1px solid rgba(79,171,255,0.1)", borderRadius:9 }}>
          <div style={{ fontSize:8, fontWeight:900, letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(79,171,255,0.5)", marginBottom:6 }}>
            Last session · {prevSession.dateLabel}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {prevSession.maxWeight > 0 && (
              <div style={{ display:"flex", alignItems:"baseline", gap:2 }}>
                <span style={{ fontSize:18, fontWeight:900, color:C.accent, letterSpacing:"-0.03em" }}>{prevSession.maxWeight}</span>
                <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>{weightUnit}</span>
              </div>
            )}
            {prevSession.maxWeight > 0 && prevSession.maxReps > 0 && (
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.25)" }}>×</span>
            )}
            {prevSession.maxReps > 0 && (
              <div style={{ display:"flex", alignItems:"baseline", gap:2 }}>
                <span style={{ fontSize:18, fontWeight:900, color:"rgba(255,255,255,0.65)", letterSpacing:"-0.03em" }}>{prevSession.maxReps}</span>
                <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>reps</span>
              </div>
            )}
            {prevSession.totalSets > 0 && (
              <span style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.25)", marginLeft:2 }}>
                · {prevSession.totalSets} set{prevSession.totalSets !== 1 ? "s" : ""}
              </span>
            )}
            {prevSession.avgEffort && (
              <div style={{ marginLeft:"auto" }}>
                <span style={{ fontSize:10, fontWeight:700, color:EFFORT[Math.round(prevSession.avgEffort)]?.color || C.muted }}>
                  {EFFORT[Math.round(prevSession.avgEffort)]?.label || ""}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Difficulty */}
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

      {/* Record max attempt — appears when effort = Max (5) */}
      {value.effort === 5 && (
        <div style={{ paddingTop:14, marginTop:14, borderTop:`1px solid ${C.line2}` }}>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            style={{ display:"none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file || !file.type.startsWith("video/")) return;
              if (file.size > 200 * 1024 * 1024) { alert("Video must be under 200 MB"); return; }
              onPendingVideoChange?.(file);
              e.target.value = "";
            }}
          />
          {pendingVideo ? (
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"rgba(0,200,81,0.08)", border:"1px solid rgba(0,200,81,0.25)", borderRadius:10 }}>
              <Camera size={13} color={C.green}/>
              <span style={{ fontSize:12, fontWeight:700, color:C.green, flex:1 }}>Video ready · attaches on log</span>
              <button onClick={() => onPendingVideoChange?.(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.35)", fontFamily:"inherit" }}>Remove</button>
            </div>
          ) : (
            <button onClick={() => videoInputRef.current?.click()} style={{ width:"100%", padding:"12px 14px", background:"rgba(239,68,68,0.06)", border:"1px dashed rgba(239,68,68,0.35)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8, cursor:"pointer", fontFamily:"inherit" }}>
              <Camera size={14} color={C.red}/>
              <span style={{ fontSize:12, fontWeight:700, color:C.red, letterSpacing:"0.02em" }}>Record your max</span>
            </button>
          )}
        </div>
      )}

      {/* Notes */}
      <div style={{ paddingTop:14, marginTop:14, borderTop:`1px solid ${C.line2}` }}>
        {!noteOpen && !value.notes ? (
          <button onClick={() => setNoteOpen(true)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:0, fontSize:11, fontWeight:600, color:C.muted, fontFamily:"inherit", letterSpacing:"0.01em" }}>
            + Add note
          </button>
        ) : (
          <>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginBottom:8 }}>Note</div>
            <textarea
              value={value.notes || ""}
              onChange={e => onChange({ ...value, notes: e.target.value.slice(0, 200) })}
              placeholder="Short ROM, felt unstable, left knee tight…"
              rows={2}
              autoFocus={noteOpen && !value.notes}
              style={{
                width:"100%", boxSizing:"border-box", background:C.surface2,
                border:`1px solid ${C.line2}`, borderRadius:8, padding:"8px 10px",
                fontSize:12, color:C.white, fontFamily:"inherit", resize:"vertical",
                outline:"none", lineHeight:1.5,
              }}
            />
            {value.notes?.length > 0 && (
              <div style={{ fontSize:9, color:C.muted, textAlign:"right", marginTop:4 }}>{value.notes.length}/200</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function splitValueUnit(str) {
  if (!str) return { num: str, unit: "" };
  const match = String(str).match(/^([0-9\-\/\+\.]+)\s*(.*)$/);
  return match ? { num: match[1], unit: match[2].trim() } : { num: str, unit: "" };
}

function ActiveCard({ sub, currentSet, groupMeta, setLog, onSetLogChange, onViewHistory, pendingVideo, onPendingVideoChange }) {
  const gid = sub?.groupId || sub?.item?.groupId || sub?.item?.GroupId;
  const gMeta = gid ? groupMeta[gid] : null;
  const accent = gMeta ? gMeta.color.accent : C.accent;
  const { sets, reps, weight } = parseMeta(sub?.meta||"");
  const rpe = sub?.item?.RPE || sub?.item?.rpe || null;
  const totalSets = parseInt(sets)||1;
  const statCols = [weight&&{v:weight,l:"load"}, reps&&{v:reps,l:"reps"}, rpe&&{v:rpe,l:"rpe"}].filter(Boolean);

  return (
    <div style={{ margin:"12px 14px 8px", background:C.surface, border:`1.5px solid ${gMeta?gMeta.color.border:C.cardLine}`, borderTop:`3px solid ${accent}`, borderRadius:16, padding:"22px 20px 20px", animation:"cardIn 0.3s ease" }}>
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

      <div style={{ fontSize:30, fontWeight:900, color:C.white, letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:22 }}>
        {sub.title}
      </div>

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

      <div style={{ marginBottom:4 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted }}>Sets</span>
          <span style={{ fontSize:11, fontWeight:600, color:C.dim }}>{Math.min(currentSet,totalSets)} of {totalSets}</span>
        </div>
        <SetDots total={totalSets} done={Math.min(currentSet-1,totalSets)} color={accent}/>
      </div>

      {setLog && onSetLogChange && (
        <SetLogger sub={sub} setNumber={currentSet} value={setLog} onChange={onSetLogChange} pendingVideo={pendingVideo} onPendingVideoChange={onPendingVideoChange} />
      )}

      {sub.instructions && (
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.50)", lineHeight:1.65, padding:"11px 14px", background:C.faint, borderRadius:8, borderLeft:`2px solid ${C.line2}`, marginTop:16 }}>
          {sub.instructions}
        </div>
      )}

      {sub.videoUrl && (
        <a href={sub.videoUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
          style={{ display:"inline-flex", alignItems:"center", gap:7, marginTop:14, fontSize:12, fontWeight:700, color:C.accent, textDecoration:"none", background:"rgba(79,171,255,0.12)", border:"1px solid rgba(79,171,255,0.25)", borderRadius:7, padding:"7px 13px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
          </svg>
          Watch video
        </a>
      )}

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
function WorkoutComplete({ startTime, totalCount, sessionLogs, onDone }) {
  const elapsed = startTime ? Math.round((Date.now()-startTime)/1000) : 0;
  const mm = Math.floor(elapsed/60), ss = elapsed%60;

  const logs        = sessionLogs || [];
  const totalVolume = logs.reduce((acc, l) => acc + (Number(l.actualReps)||0) * (Number(l.actualWeight)||0), 0);
  const effortLogs  = logs.filter(l => (l.effort||0) > 0);
  const avgEffort   = effortLogs.length > 0
    ? effortLogs.reduce((a, l) => a + (l.effort||0), 0) / effortLogs.length
    : null;
  const setsLogged  = logs.length;
  const fmtVol = v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`;

  const row1 = [{ v: totalCount, l: "exercises" }, { v: `${mm}:${String(ss).padStart(2,"0")}`, l: "duration" }];
  const row2 = [
    setsLogged > 0 ? { v: setsLogged, l: "sets logged" } : null,
    totalVolume > 0 ? { v: `${fmtVol(totalVolume)} lb`, l: "total volume" } : null,
  ].filter(Boolean);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px 28px", textAlign:"center" }}>
      <div style={{ display:"flex", gap:10, marginBottom:22 }}>
        {[0.08,0,0.16].map((d,i)=>(
          <Star key={i} size={26} color={C.amber} fill={C.amber} style={{ animation:`starPop 0.5s cubic-bezier(0.34,1.56,0.64,1) ${d}s both` }}/>
        ))}
      </div>
      <div style={{ fontSize:44, fontWeight:900, color:C.white, letterSpacing:"-0.05em", lineHeight:0.9, marginBottom:8, animation:"riseUp 0.4s ease 0.28s both" }}>
        WORKOUT<br/>COMPLETE.
      </div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:24, animation:"riseUp 0.4s ease 0.4s both" }}>
        That&apos;s how it&apos;s done.
      </div>
      <div style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1fr", border:`1px solid ${C.line2}`, borderRadius:12, overflow:"hidden", marginBottom:8, animation:"riseUp 0.4s ease 0.52s both" }}>
        {row1.map((s,i)=>(
          <div key={i} style={{ padding:"16px 10px", background:C.surface, borderRight:i<1?`1px solid ${C.line2}`:"none" }}>
            <div style={{ fontSize:22, fontWeight:900, color:C.white, letterSpacing:"-0.03em" }}>{s.v}</div>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginTop:4 }}>{s.l}</div>
          </div>
        ))}
      </div>
      {row2.length > 0 && (
        <div style={{ width:"100%", display:"grid", gridTemplateColumns:`repeat(${row2.length},1fr)`, border:`1px solid ${C.line2}`, borderRadius:12, overflow:"hidden", marginBottom:8, animation:"riseUp 0.4s ease 0.62s both" }}>
          {row2.map((s,i)=>(
            <div key={i} style={{ padding:"14px 10px", background:C.surface, borderRight:i<row2.length-1?`1px solid ${C.line2}`:"none" }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.accent, letterSpacing:"-0.02em" }}>{s.v}</div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginTop:4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}
      {avgEffort && (
        <div style={{ width:"100%", padding:"12px 14px", background:C.surface, border:`1px solid ${C.line2}`, borderRadius:12, marginBottom:8, animation:"riseUp 0.4s ease 0.72s both" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
            <span style={{ fontSize:9, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted }}>Avg difficulty</span>
            <span style={{ fontSize:11, fontWeight:700, color:EFFORT[Math.round(avgEffort)]?.color || C.amber }}>
              {EFFORT[Math.round(avgEffort)]?.label} · {avgEffort.toFixed(1)}/5
            </span>
          </div>
          <div style={{ height:4, background:"#252525", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:2, background:EFFORT[Math.round(avgEffort)]?.color || C.amber, width:`${(avgEffort/5)*100}%`, transition:"width 0.9s ease 0.8s" }}/>
          </div>
        </div>
      )}
      {setsLogged === 0 && (
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", marginBottom:8, animation:"riseUp 0.4s ease 0.72s both" }}>
          Log sets next time for volume &amp; effort stats
        </div>
      )}
      <div style={{ height:8 }}/>
      <button onClick={onDone} style={{ width:"100%", padding:"16px", background:C.green, border:"none", borderRadius:12, fontSize:14, fontWeight:900, color:"#040A05", cursor:"pointer", fontFamily:"inherit", animation:"riseUp 0.4s ease 0.84s both" }}>
        Done
      </button>
    </div>
  );
}

// ─── BIDIRECTIONAL SWIPE HOOK ─────────────────────────────────────────────────
// Right drag → complete (green). Left drag → skip (orange).
const SWIPE_THRESHOLD = 88;
function useSwipeBidir({ onRight, onLeft, disabledRight, disabledLeft }) {
  const controls = useAnimation();
  const [dragX, setDragX] = useState(0);
  const allDisabled = disabledRight && disabledLeft;

  useEffect(() => {
    if (allDisabled) {
      controls.start({ x:0, transition:{ type:"spring", stiffness:500, damping:40 } });
      setDragX(0);
    }
  }, [allDisabled, controls]);

  const armedRight = dragX >  SWIPE_THRESHOLD * 0.75;
  const armedLeft  = dragX < -SWIPE_THRESHOLD * 0.75;

  const props = {
    drag: allDisabled ? false : "x",
    dragConstraints: {
      left:  disabledLeft  ? 0 : -60,
      right: disabledRight ? 0 :  60,
    },
    dragElastic: {
      left:  disabledLeft  ? 0 : 0.08,
      right: disabledRight ? 0 : 0.08,
    },
    dragMomentum: false,
    onDrag: (_, info) => {
      if (allDisabled) return;
      setDragX(info.offset.x);
    },
    onDragEnd: (_, info) => {
      if (allDisabled) return;
      controls.start({ x:0, transition:{ type:"spring", stiffness:500, damping:40 } });
      setDragX(0);
      if      (info.offset.x >  SWIPE_THRESHOLD && !disabledRight) setTimeout(onRight, 0);
      else if (info.offset.x < -SWIPE_THRESHOLD && !disabledLeft)  setTimeout(onLeft,  0);
    },
    animate: controls,
    style: { touchAction:"pan-y", cursor: allDisabled ? "default" : "grab" },
  };

  return { props, dragX, armedRight, armedLeft };
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
function ExerciseRow({ sub, optimisticStatusById, skippedIds, onTap, onSkip, isLast, isGrouped=false, groupAccent, showConnector=false }) {
  const done     = isDone(optimisticStatusById?.[sub.id], sub.item?.Status);
  const rejected = isRejected(optimisticStatusById?.[sub.id], sub.item?.Status);
  const skipped  = skippedIds?.has(sub.id) && !done && !rejected;

  const prevDone=useRef(done), [flash,setFlash]=useState(false);
  useEffect(()=>{ if(!prevDone.current&&done){haptic(10);setFlash(true);const t=setTimeout(()=>setFlash(false),600);prevDone.current=true;return()=>clearTimeout(t);} if(!done)prevDone.current=false; },[done]);

  const fire    = useCallback(()=>onTap(sub),[onTap,sub]);
  const fireSkip= useCallback(()=>onSkip?.(sub),[onSkip,sub]);

  const { props, dragX, armedRight, armedLeft } = useSwipeBidir({
    onRight:       fire,
    onLeft:        fireSkip,
    disabledRight: done || rejected,
    disabledLeft:  done || rejected || skipped,
  });

  const {sets,reps,weight,rest}=parseMeta(sub.meta);
  const stats = !done && !skipped ? [
    sets    && { value:sets,   label:"sets"   },
    reps    && { value:reps,   label:"reps"   },
    weight  && { value:weight, label:"weight" },
    rest    && { value:rest,   label:"rest"   },
  ].filter(Boolean) : [];

  return (
    <div style={{ position:"relative", overflow:"hidden" }}>
      {/* Right reveal — complete (green) */}
      {!done && !rejected && !skipped && (
        <div style={{ position:"absolute",right:0,top:0,bottom:0,width:56,display:"flex",alignItems:"center",justifyContent:"center",opacity:Math.min(1,Math.max(0,dragX)/18),pointerEvents:"none" }}>
          <div style={{ width:28,height:28,borderRadius:"50%",background:armedRight?"rgba(0,200,81,0.25)":"rgba(0,200,81,0.12)",border:`1.5px solid ${armedRight?C.green:"rgba(0,200,81,0.35)"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s,border-color 0.15s",transform:armedRight?"scale(1.1)":"scale(1)" }}>
            <Check size={13} color={armedRight?C.green:"rgba(0,200,81,0.6)"} strokeWidth={3}/>
          </div>
        </div>
      )}

      {/* Left reveal — skip (orange) */}
      {!done && !rejected && !skipped && (
        <div style={{ position:"absolute",left:0,top:0,bottom:0,width:56,display:"flex",alignItems:"center",justifyContent:"center",opacity:Math.min(1,Math.max(0,-dragX)/18),pointerEvents:"none" }}>
          <div style={{ width:28,height:28,borderRadius:"50%",background:armedLeft?"rgba(255,107,43,0.25)":"rgba(255,107,43,0.1)",border:`1.5px solid ${armedLeft?C.orange:"rgba(255,107,43,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s,border-color 0.15s",transform:armedLeft?"scale(1.1)":"scale(1)" }}>
            <SkipForward size={11} color={armedLeft?C.orange:"rgba(255,107,43,0.6)"}/>
          </div>
        </div>
      )}

      <motion.div {...props} onClick={()=>!(done||rejected)&&onTap(sub)}
        style={{ ...props.style, width:"100%", display:"flex", alignItems:"flex-start", gap:14,
          padding:isGrouped?"12px 20px 12px 28px":"12px 20px",
          background: flash?"rgba(0,200,81,0.07)": skipped?"rgba(255,107,43,0.03)": rejected?"rgba(255,107,43,0.03)":C.bg,
          borderBottom:isLast?"none":`1px solid ${C.cardLine}`,
          borderLeft: rejected ? `2px solid rgba(255,107,43,0.35)` : skipped ? `2px solid rgba(255,107,43,0.18)` : "none",
          boxSizing:"border-box", userSelect:"none", position:"relative",
          opacity: skipped ? 0.65 : 1,
        }}>
        {isGrouped&&showConnector&&<div style={{ position:"absolute",left:20,top:"50%",bottom:-12,width:1,borderLeft:`1px dashed ${groupAccent||"rgba(255,255,255,0.2)"}`,opacity:0.4,pointerEvents:"none" }}/>}

        {/* Status indicator */}
        <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0, marginTop:1,
          border:`${skipped?"1.5px dashed":"1.5px solid"} ${done ? C.green : rejected ? C.orange : skipped ? "rgba(255,107,43,0.3)" : "rgba(255,255,255,0.2)"}`,
          background: done ? C.greenDim : rejected ? "rgba(255,107,43,0.12)" : "transparent",
          display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.25s ease",
        }}>
          {done     && <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:500,damping:25}}><Check size={11} color={C.green} strokeWidth={3}/></motion.div>}
          {rejected && <AlertTriangle size={10} color={C.orange} strokeWidth={2.5}/>}
          {skipped  && <SkipForward size={9} color="rgba(255,107,43,0.45)"/>}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            <div style={{ fontSize:14, fontWeight:done||skipped?400:600, color:done?C.dim:skipped?"rgba(255,255,255,0.3)":rejected?"rgba(255,255,255,0.75)":C.white, letterSpacing:"-0.01em", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:done?"line-through":skipped?"line-through":"none", textDecorationColor:"rgba(255,255,255,0.18)", transition:"all 0.2s", flex:1, minWidth:0 }}>
              {sub.title}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
              {rejected && (
                <span style={{ fontSize:8, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:C.orange, background:"rgba(255,107,43,0.1)", border:"1px solid rgba(255,107,43,0.25)", borderRadius:4, padding:"2px 6px" }}>Returned</span>
              )}
              {skipped && (
                <span style={{ fontSize:8, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(255,107,43,0.5)", background:"rgba(255,107,43,0.08)", border:"1px solid rgba(255,107,43,0.18)", borderRadius:4, padding:"2px 6px" }}>Skipped</span>
              )}
              {sub.evidenceRequired&&!done&&!rejected&&!skipped&&<AlertCircle size={13} color="rgba(255,165,0,0.55)" style={{flexShrink:0}}/>}
            </div>
          </div>

          {rejected && sub.item?.ReviewNote && (
            <div style={{ fontSize:11, color:"rgba(255,107,43,0.55)", marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {sub.item.ReviewNote}
            </div>
          )}

          {!rejected && !skipped && stats.length > 0 && (
            <div style={{ display:"flex", alignItems:"flex-end", gap:16, marginTop:8 }}>
              {stats.map((s,i) => (
                <StatCell key={i} value={s.value} label={s.label} accent={i===2&&groupAccent ? groupAccent : undefined}/>
              ))}
              {sub.videoUrl && stats.length > 0 && <div style={{ width:1, height:20, background:"rgba(255,255,255,0.08)", alignSelf:"center" }}/>}
              {sub.videoUrl && (
                <a href={sub.videoUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2, textDecoration:"none" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={groupAccent||C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill={groupAccent||C.accent} stroke="none"/>
                  </svg>
                  <span style={{ fontSize:8, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(255,255,255,0.25)", lineHeight:1 }}>video</span>
                </a>
              )}
            </div>
          )}

          {done&&sub.meta&&<div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{sub.meta}</div>}

          {rejected && (
            <div style={{ fontSize:10, color:"rgba(255,107,43,0.45)", marginTop:5, fontWeight:600, letterSpacing:"0.01em" }}>
              Tap to see feedback and resubmit →
            </div>
          )}
          {skipped && (
            <div style={{ fontSize:10, color:"rgba(255,107,43,0.35)", marginTop:5, fontWeight:600 }}>
              Tap to restore →
            </div>
          )}
        </div>
      </motion.div>

      {/* Progress bar — right (complete) */}
      {dragX > 4 && (
        <div style={{ height:2, background:"#252525", position:"absolute", bottom:0, right:0, width:`${Math.min(100,(dragX/SWIPE_THRESHOLD)*100)}%` }}>
          <div style={{ height:"100%", background:armedRight?C.green:"#00A040", borderRadius:1 }}/>
        </div>
      )}
      {/* Progress bar — left (skip) */}
      {dragX < -4 && (
        <div style={{ height:2, background:"#252525", position:"absolute", bottom:0, left:0, width:`${Math.min(100,(Math.abs(dragX)/SWIPE_THRESHOLD)*100)}%` }}>
          <div style={{ height:"100%", background:armedLeft?C.orange:"rgba(255,107,43,0.5)", borderRadius:1 }}/>
        </div>
      )}
    </div>
  );
}

// ─── GROUP BLOCK ──────────────────────────────────────────────────────────────
function GroupBlock({ groupId, members, meta, optimisticStatusById, skippedIds, onTap, onSkip }) {
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
        <ExerciseRow key={sub.id} sub={sub} optimisticStatusById={optimisticStatusById} skippedIds={skippedIds}
          onTap={onTap} onSkip={onSkip}
          isLast={mi===members.length-1} isGrouped groupAccent={color.accent} showConnector={mi<members.length-1}/>
      ))}
    </div>
  );
}

// ─── WORKOUT SHEET ────────────────────────────────────────────────────────────
export default function WorkoutSheet({ isOpen, onClose, workoutItem, dailyWorkout, optimisticStatusById, onExerciseTap, onQuickComplete, onLogSet, getExerciseSessions, onAcknowledgeRejection }) {

  // Body scroll lock
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

  const sub       = workoutItem?.sub || [];
  const groupMeta = useMemo(()=>buildGroupMeta(sub),[sub]);
  const segments  = useMemo(()=>buildSegments(sub,groupMeta),[sub,groupMeta]);

  const SESSION_KEY = workoutItem?.id ? `checkpeak:ws:${workoutItem.id}` : null;

  // ── Core workout state ───────────────────────────────────────────────────
  const [mode,       setMode]       = useState("preview");
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [startTime,  setStartTime]  = useState(null);
  const [restSecs,   setRestSecs]   = useState(0);
  const [restTotal,  setRestTotal]  = useState(60);
  const [restNext,   setRestNext]   = useState("");
  const [skippedIds, setSkippedIds] = useState(() => new Set());
  const timerRef = useRef(null);

  const [setLog,            setSetLog]            = useState({ reps: 0, weight: 0, effort: 0, notes: "" });
  const [pendingVideoFile,  setPendingVideoFile]  = useState(null);
  const [historyEx,         setHistoryEx]         = useState(null);
  const [historyOpen,  setHistoryOpen]  = useState(false);
  const [rejectedItem, setRejectedItem] = useState(null);

  const sessionLogsRef = useRef([]);
  const restoredRef    = useRef(false);
  const closeTimerRef  = useRef(null);

  // ── Sheet open/close ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      closeTimerRef.current = setTimeout(() => {
        setMode("preview");
        setActiveIdx(0);
        setCurrentSet(1);
        setStartTime(null);
        setRejectedItem(null);
        setSkippedIds(new Set());
        sessionLogsRef.current = [];
        restoredRef.current = false;
        closeTimerRef.current = null;
      }, 400);
    } else {
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [isOpen]);

  // ── Restore session from localStorage ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !SESSION_KEY || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Date.now() - (saved.savedAt || 0) > 4 * 60 * 60 * 1000) return;

      if (saved.mode === "active" || saved.mode === "resting") {
        if (saved.activeIdx  !== undefined) setActiveIdx(saved.activeIdx);
        if (saved.currentSet !== undefined) setCurrentSet(saved.currentSet);
        if (saved.startTime) setStartTime(saved.startTime);
        if (Array.isArray(saved.skippedIds)) setSkippedIds(new Set(saved.skippedIds));

        if (saved.mode === "resting" && saved.restEndTime) {
          const remaining = Math.round((saved.restEndTime - Date.now()) / 1000);
          if (remaining > 1) {
            setRestTotal(saved.restTotal || 60);
            setRestSecs(remaining);
            setRestNext(saved.restNext || "");
            setMode("resting");
          } else {
            setMode("active");
          }
        } else if (saved.mode === "active") {
          setMode("active");
        }
      }
    } catch {}
  }, [isOpen, SESSION_KEY]); // eslint-disable-line

  // ── Save session state ────────────────────────────────────────────────────
  useEffect(() => {
    if (!SESSION_KEY || !isOpen) return;
    if (mode === "complete") { try { localStorage.removeItem(SESSION_KEY); } catch {} return; }
    if (mode === "preview" || mode === "rejection") return;

    const state = {
      mode, activeIdx, currentSet, startTime,
      restEndTime: mode === "resting" ? Date.now() + restSecs * 1000 : null,
      restTotal, restNext,
      skippedIds: [...skippedIds],
      savedAt: Date.now(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeIdx, currentSet, startTime, skippedIds, SESSION_KEY, isOpen]);

  // ── Auto-fill set defaults when exercise or set changes ──────────────────
  useEffect(() => {
    if (!sub[activeIdx]) return;
    const { reps: tr, weight: tw } = parseMeta(sub[activeIdx]?.meta || "");
    const isBodyWeight = /body.?weight|^bw$/i.test(String(tw || ""));
    const isPercent    = /^\d+(\.\d+)?\s*%/.test(String(tw || ""));
    setSetLog({
      reps:   parseInt(tr) || 0,
      weight: isBodyWeight || isPercent ? 0 : (parseFloat(String(tw || "").replace(/[^0-9.]/g, "")) || 0),
      effort: 0,
      notes:  "",
    });
    setPendingVideoFile(null);
  }, [activeIdx, currentSet]); // eslint-disable-line

  // ── Rest timer countdown ──────────────────────────────────────────────────
  useEffect(()=>{
    if(mode!=="resting"||restSecs<=0) return;
    timerRef.current=setInterval(()=>{
      setRestSecs(prev=>{ if(prev<=1){ clearInterval(timerRef.current); setMode("active"); return 0; } return prev-1; });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[mode]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const isNotAvailable = useCallback((s) =>
    isDone(optimisticStatusById?.[s.id], s.item?.Status) || skippedIds.has(s.id),
  [optimisticStatusById, skippedIds]);

  const firstIncomplete = useMemo(()=>{
    const i = sub.findIndex(s => !isNotAvailable(s));
    return i === -1 ? 0 : i;
  },[sub, isNotAvailable]);

  const handleBegin = useCallback(()=>{
    setActiveIdx(firstIncomplete);
    setCurrentSet(1);
    setStartTime(prev=>prev||Date.now());
    setMode("active");
  },[firstIncomplete]);

  const handleCompleteSet = useCallback(()=>{
    const curSub = sub[activeIdx]; if (!curSub) return;
    const gid = curSub.groupId || curSub.item?.groupId || curSub.item?.GroupId;

    // Capture and clear pending video before navigation resets it
    const videoFile = pendingVideoFile;
    if (videoFile) setPendingVideoFile(null);

    const logPromise = onLogSet?.({
      workoutItemId: curSub.id, exerciseTitle: curSub.title, setNumber: currentSet,
      targetReps: parseMeta(curSub.meta||"").reps, targetWeight: parseMeta(curSub.meta||"").weight,
      actualReps: setLog.reps, actualWeight: setLog.weight, effort: setLog.effort,
      notes: setLog.notes || "", groupId: gid || null,
    });

    // Background video upload once the Supabase row ID resolves
    if (videoFile && logPromise) {
      Promise.resolve(logPromise).then(result => {
        const sid = result?.supabaseId;
        if (!sid) return;
        const fd = new FormData();
        fd.append("file", videoFile);
        fd.append("setLogId", sid);
        fetch("/api/athlete/pr-video", { method:"POST", credentials:"include", body:fd }).catch(()=>{});
      }).catch(()=>{});
    }

    sessionLogsRef.current = [...sessionLogsRef.current, {
      exerciseTitle: curSub.title,
      setNumber:     currentSet,
      actualReps:    setLog.reps,
      actualWeight:  setLog.weight,
      effort:        setLog.effort,
      notes:         setLog.notes || "",
    }];

    if (gid) {
      const groupMembers = sub.filter(s => (s.groupId||s.item?.groupId||s.item?.GroupId) === gid);
      const posInGroup   = groupMembers.findIndex(s => s.id === curSub.id);
      const isLastInGroup = posInGroup === groupMembers.length - 1;
      const totalRounds   = parseInt(parseMeta(groupMembers[0].meta||"").sets) || 1;

      if (!isLastInGroup) {
        const nextGroupEx = groupMembers[posInGroup + 1];
        setActiveIdx(sub.findIndex(s => s.id === nextGroupEx.id));
        setMode("active");
      } else if (currentSet < totalRounds) {
        haptic(15);
        const firstIdx = sub.findIndex(s => s.id === groupMembers[0].id);
        const restSec  = Math.max(...groupMembers.map(m => parseRestSecs(m)));
        setActiveIdx(firstIdx); setCurrentSet(prev => prev + 1);
        setRestTotal(restSec); setRestSecs(restSec);
        setRestNext(`${groupMembers[0].title} · Round ${currentSet + 1} of ${totalRounds}`);
        setMode("resting");
      } else {
        haptic(20);
        groupMembers.forEach(m => {
          if (!isDone(optimisticStatusById?.[m.id], m.item?.Status)) {
            if (m.evidenceRequired) onExerciseTap(m); else onQuickComplete(m);
          }
        });
        const lastGroupIdx = sub.findIndex(s => s.id === groupMembers[groupMembers.length-1].id);
        const nextIdx = sub.findIndex((s,i) => i > lastGroupIdx && !isNotAvailable(s));
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
      const totalSets = parseInt(parseMeta(curSub.meta||"").sets) || 1;
      const isLastSet = currentSet >= totalSets;

      if (isLastSet) {
        haptic(20);
        if (curSub.evidenceRequired) onExerciseTap(curSub); else onQuickComplete(curSub);
        const nextIdx = sub.findIndex((s,i) => i > activeIdx && !isNotAvailable(s));
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
  },[sub,activeIdx,currentSet,setLog,pendingVideoFile,optimisticStatusById,isNotAvailable,onExerciseTap,onQuickComplete,onLogSet,setPendingVideoFile]);

  const handleSkipRest = useCallback(()=>{ clearInterval(timerRef.current); setMode("active"); },[]);

  // Skip from active mode — advance without completing, no rest timer
  const handleSkipExercise = useCallback(() => {
    const curSub = sub[activeIdx]; if (!curSub) return;
    haptic(8);
    const newSkipped = new Set([...skippedIds, curSub.id]);
    setSkippedIds(newSkipped);
    const nextIdx = sub.findIndex((s, i) =>
      i > activeIdx &&
      !isDone(optimisticStatusById?.[s.id], s.item?.Status) &&
      !newSkipped.has(s.id)
    );
    if (nextIdx === -1) {
      setMode("preview");
    } else {
      setActiveIdx(nextIdx);
      setCurrentSet(1);
      setMode("active");
    }
  }, [sub, activeIdx, skippedIds, optimisticStatusById]);

  // Skip from preview swipe-left
  const handleSkipFromPreview = useCallback((s) => {
    haptic(8);
    setSkippedIds(prev => new Set([...prev, s.id]));
  }, []);

  const handlePreviewTap = useCallback(s => {
    // Tapping a skipped item un-skips it
    if (skippedIds.has(s.id)) {
      setSkippedIds(prev => { const n = new Set(prev); n.delete(s.id); return n; });
      return;
    }
    const liveStatus = String(optimisticStatusById?.[s.id] || s.item?.Status || "").toLowerCase();
    if (liveStatus === "rejected") {
      setRejectedItem(s);
      setMode("rejection");
    } else if (s.evidenceRequired) {
      onExerciseTap(s);
    } else {
      onQuickComplete(s);
    }
  }, [skippedIds, onExerciseTap, onQuickComplete, optimisticStatusById]);

  // ── Derived values ────────────────────────────────────────────────────────
  const doneCount  = sub.filter(s=>isDone(optimisticStatusById?.[s.id], s.item?.Status)).length;
  const totalCount = sub.length;
  const allDone    = totalCount>0 && doneCount>=totalCount;
  const pct        = totalCount>0 ? (doneCount/totalCount)*100 : 0;
  const title      = workoutItem?.title || dailyWorkout?.Title || "Team Workout";
  const groupAccents = Object.values(groupMeta).map(m=>m.color.accent);
  const accentBar    = groupAccents.length>1
    ? `linear-gradient(90deg,${groupAccents.join(",")})`
    : groupAccents.length===1 ? groupAccents[0] : C.accent;

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

            {/* Accent strip */}
            <div style={{ height:3, background:accentBar, flexShrink:0 }}/>

            {/* Drag handle */}
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

            {/* ── PREVIEW ── */}
            {mode==="preview"&&(
              <div style={{ overflowY:"auto",flex:1,WebkitOverflowScrolling:"touch" }}>
                <div style={{ display:"flex",alignItems:"center",gap:7,padding:"9px 20px",borderBottom:`1px solid ${C.cardLine}`,background:"#0D0D0D" }}>
                  <ChevronDown size={11} color="rgba(255,255,255,0.2)" style={{ transform:"rotate(-90deg)" }}/>
                  <span style={{ fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:500 }}>Swipe → complete · Swipe ← skip · Tap Begin for focus mode</span>
                </div>
                {segments.map((seg,si)=>
                  seg.type==="group"
                    ?<GroupBlock key={seg.groupId} groupId={seg.groupId} members={seg.members} meta={groupMeta[seg.groupId]} optimisticStatusById={optimisticStatusById} skippedIds={skippedIds} onTap={handlePreviewTap} onSkip={handleSkipFromPreview}/>
                    :<ExerciseRow key={seg.sub.id} sub={seg.sub} optimisticStatusById={optimisticStatusById} skippedIds={skippedIds} onTap={handlePreviewTap} onSkip={handleSkipFromPreview} isLast={si===segments.length-1}/>
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

            {/* ── ACTIVE ── */}
            {mode==="active"&&sub[activeIdx]&&(()=>{
              const curSub = sub[activeIdx];
              const gid = curSub.groupId || curSub.item?.groupId || curSub.item?.GroupId;
              const groupMembers = gid ? sub.filter(s=>(s.groupId||s.item?.groupId||s.item?.GroupId)===gid) : null;
              const posInGroup   = groupMembers ? groupMembers.findIndex(s=>s.id===curSub.id) : -1;
              const isLastInGroup = groupMembers ? posInGroup===groupMembers.length-1 : true;
              const totalRounds   = groupMembers ? parseInt(parseMeta(groupMembers[0].meta||"").sets)||1 : parseInt(parseMeta(curSub.meta||"").sets)||1;
              const isLastRound   = currentSet >= totalRounds;
              const nextInGroup   = groupMembers && !isLastInGroup ? groupMembers[posInGroup+1] : null;
              const afterThisLabel = nextInGroup
                ? `${nextInGroup.title} · Same round, no rest`
                : !isLastRound ? `Rest · Then Round ${currentSet+1} of ${totalRounds}` : null;
              const btnLabel = nextInGroup
                ? `Next: ${nextInGroup.title} →`
                : !isLastRound ? `Round ${currentSet} Done · Rest`
                : gid ? `Complete Group` : `Complete`;
              const btnColor     = nextInGroup ? C.accent : C.green;
              const btnTextColor = nextInGroup ? "#fff" : "#040A05";

              return (
                <div style={{ flex:1,display:"flex",flexDirection:"column",overflowY:"auto" }}>
                  <ActiveCard key={curSub.id} sub={curSub} currentSet={currentSet} groupMeta={groupMeta}
                    setLog={setLog} onSetLogChange={setSetLog}
                    onViewHistory={() => { setHistoryEx(curSub); setHistoryOpen(true); }}
                    pendingVideo={pendingVideoFile} onPendingVideoChange={setPendingVideoFile}
                  />
                  {afterThisLabel && (
                    <div style={{ margin:"0 14px 10px",padding:"10px 14px",background:C.surface,border:`1px solid ${C.line2}`,borderRadius:10 }}>
                      <div style={{ fontSize:9,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:C.muted,marginBottom:4 }}>After this</div>
                      <div style={{ fontSize:13,fontWeight:600,color:C.dim }}>{afterThisLabel}</div>
                    </div>
                  )}
                  <div style={{ flex:1 }}/>
                  <div style={{ padding:"12px 14px 4px", flexShrink:0 }}>
                    <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                      <button onClick={()=>setMode("preview")} style={{ padding:"13px 16px",background:"transparent",border:`1px solid ${C.line2}`,borderRadius:11,fontSize:12,fontWeight:700,color:C.muted,cursor:"pointer",fontFamily:"inherit" }}>← List</button>
                      <button onClick={handleCompleteSet} style={{ flex:1,padding:"16px",background:btnColor,border:"none",borderRadius:11,fontSize:14,fontWeight:900,color:btnTextColor,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit",letterSpacing:"-0.01em" }}>
                        {nextInGroup ? null : <Check size={15} strokeWidth={3}/>}
                        {btnLabel}
                      </button>
                    </div>
                    <button onClick={handleSkipExercise} style={{ width:"100%",padding:"11px",background:"transparent",border:`1px solid rgba(255,107,43,0.18)`,borderRadius:10,fontSize:11,fontWeight:700,color:"rgba(255,107,43,0.45)",cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.02em",marginBottom:20 }}>
                      Skip exercise today
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ── REST ── */}
            {mode==="resting"&&<RestTimer seconds={restSecs} total={restTotal} nextLabel={restNext} onSkip={handleSkipRest}/>}

            {/* ── REJECTION MODE ── */}
            {mode==="rejection"&&rejectedItem&&(
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto" }}>
                <div style={{ padding:"20px 20px 0" }}>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 12px", borderRadius:20, background:"rgba(255,107,43,0.1)", border:"1px solid rgba(255,107,43,0.25)", marginBottom:16 }}>
                    <AlertTriangle size={10} color={C.orange}/>
                    <span style={{ fontSize:9, fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase", color:C.orange }}>Coach returned</span>
                  </div>
                  <div style={{ fontSize:28, fontWeight:900, color:C.white, letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:20 }}>
                    {rejectedItem.title}
                  </div>
                  <div style={{ padding:"16px", background:"rgba(255,107,43,0.06)", border:"1px solid rgba(255,107,43,0.18)", borderRadius:12, marginBottom:16 }}>
                    <div style={{ fontSize:8, fontWeight:900, letterSpacing:"0.14em", textTransform:"uppercase", color:C.orange, marginBottom:10 }}>Coach note</div>
                    <div style={{ fontSize:14, fontWeight:500, color:"rgba(255,255,255,0.72)", lineHeight:1.65 }}>
                      {rejectedItem.item?.ReviewNote || "No additional feedback provided."}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:C.muted, lineHeight:1.65 }}>
                    Review the coach&apos;s feedback above, then resubmit your completed work.
                  </div>
                </div>
                <div style={{ flex:1 }}/>
                <div style={{ padding:"16px 16px 32px", display:"flex", gap:10 }}>
                  <button onClick={() => setMode("preview")}
                    style={{ padding:"13px 16px", background:"transparent", border:`1px solid ${C.line2}`, borderRadius:11, fontSize:12, fontWeight:700, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
                    ← Back
                  </button>
                  <button
                    onClick={() => {
                      onAcknowledgeRejection?.({ workoutItemId: rejectedItem.id });
                      setMode("preview");
                      if (rejectedItem.evidenceRequired) onExerciseTap(rejectedItem);
                      else onQuickComplete(rejectedItem);
                    }}
                    style={{ flex:1, padding:"16px", background:C.orange, border:"none", borderRadius:11, fontSize:13, fontWeight:900, color:"#fff", cursor:"pointer", fontFamily:"inherit", letterSpacing:"-0.01em" }}>
                    {rejectedItem.evidenceRequired ? "Resubmit with photo" : "Resubmit"}
                  </button>
                </div>
              </div>
            )}

            {/* ── COMPLETE ── */}
            {mode==="complete"&&(
              <WorkoutComplete
                startTime={startTime}
                totalCount={totalCount}
                sessionLogs={sessionLogsRef.current}
                onDone={() => { setMode("preview"); onClose(); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ExerciseProgressSheet
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        exerciseTitle={historyEx?.title || ""}
        sessions={historyEx && getExerciseSessions ? getExerciseSessions(historyEx.title) : []}
      />
    </>
  );
}
