// components/org/workoutsCalendar/CoachDaySchedule.jsx
//
// Two-layer day view for coaches:
//   Layer 1 — Assigned workouts from Airtable (read-only, positioned by ScheduledTime)
//   Layer 2 — Personal blocks (lunch, meetings, etc.) stored in Firestore per coach
//
// Props:
//   selectedDate   — ISO string
//   workoutsByDate — { [iso]: workout[] } from calendar range fetch
//   memberId       — coach's Airtable member ID (Firestore namespace)
//   sports         — string[] available sports for the form

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  bg:      DS.pageBg   || "#F8FAFC",
  card:    DS.cardBg   || "#FFFFFF",
  border:  DS.border   || "#E2E8F0",
  brand:   DS.brand    || "#1A56DB",
  brandBg: DS.brandBg  || "#EFF6FF",
  safe:    DS.safe     || "#15803D",
  body:    DS.bodyText || "#0F172A",
  dim:     DS.dimText  || "#64748B",
  faint:               "#94A3B8",
  ghost:               "#CBD5E1",
  red:                 "#DC2626",
};

// ─── Sport colors ─────────────────────────────────────────────────────────────
const SPORT_PALETTE = {
  football:"#DC2626", volleyball:"#7C3AED", baseball:"#1A56DB",
  softball:"#DB2777", soccer:"#059669",     basketball:"#D97706",
  swim:"#0891B2",     track:"#EA580C",      hockey:"#4F46E5",
  tennis:"#65A30D",   wrestling:"#9333EA",  xc:"#0D9488",
  personal:"#6B7280",
};
function sportColor(s) {
  if (!s) return SPORT_PALETTE.personal;
  const k = s.toLowerCase().replace(/\s+/g,"");
  if (SPORT_PALETTE[k]) return SPORT_PALETTE[k];
  const vals = Object.values(SPORT_PALETTE).slice(0,-1);
  let h=0; for(let i=0;i<k.length;i++) h=k.charCodeAt(i)+((h<<5)-h);
  return vals[Math.abs(h)%vals.length];
}

// ─── Activity suggestions ─────────────────────────────────────────────────────
const SUGGESTIONS = {
  football:  ["Lifting","Practice","Film Session","Speed Work","Walk-Through","Team Meeting"],
  volleyball:["Practice","Film Session","Conditioning","Serve Work","Scrimmage"],
  baseball:  ["Batting Practice","Fielding","Pitching","Conditioning","Film"],
  softball:  ["Batting Practice","Fielding","Pitching","Conditioning"],
  soccer:    ["Practice","Film Session","Conditioning","Scrimmage","Set Pieces"],
  basketball:["Practice","Shootaround","Film Session","Conditioning","Scrimmage"],
  swim:      ["Morning Practice","Afternoon Practice","Dryland"],
  track:     ["Practice","Tempo Run","Film","Time Trials"],
  hockey:    ["Skate","Practice","Film Session","Off-Ice"],
  tennis:    ["Practice","Film","Match Play","Conditioning"],
  wrestling: ["Practice","Live Wrestling","Film","Conditioning"],
  xc:        ["Morning Run","Afternoon Run","Tempo Run","Film"],
  personal:  ["Lunch","Staff Meeting","Office Hours","Travel","Admin","Break","Post-Workout Snack Prep","Film Review"],
};
function getSuggestions(sport) {
  if (!sport) return SUGGESTIONS.personal;
  return SUGGESTIONS[sport.toLowerCase().replace(/\s+/g,"")] || ["Practice","Meeting","Film","Conditioning"];
}

// ─── Timeline math ────────────────────────────────────────────────────────────
const PX_PER_HOUR = 64;
const DAY_START_H = 5;
const DAY_END_H   = 23;
const DAY_START_M = DAY_START_H * 60;
const LABEL_W     = 44;
const TOTAL_H     = (DAY_END_H - DAY_START_H) * PX_PER_HOUR;
const HOURS       = Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_,i) => DAY_START_H + i);

function minToY(min) { return (min - DAY_START_M) / 60 * PX_PER_HOUR; }
function yToMin(y)   { return Math.round(DAY_START_M + (y / PX_PER_HOUR * 60)); }
function snapMin(m)  { return Math.round(m / 15) * 15; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMin(m) {
  if (m==null) return "";
  const h=Math.floor(m/60)%24, mn=m%60;
  const ap=h>=12?"pm":"am", dh=h===0?12:h>12?h-12:h;
  return mn===0?`${dh}${ap}`:`${dh}:${String(mn).padStart(2,"0")}${ap}`;
}
function fmtDur(d) {
  if (!d) return "";
  if (d<60) return `${d}m`;
  const h=Math.floor(d/60), m=d%60;
  return m===0?`${h}h`:`${h}h ${m}m`;
}
function makeId() { return Math.random().toString(36).slice(2,10); }

// ─── Firestore helpers ────────────────────────────────────────────────────────
function fsRef(memberId, date) {
  return doc(db, "coachBlocks", `${memberId}_${date}`);
}
async function loadBlocks(memberId, date) {
  try {
    const snap = await getDoc(fsRef(memberId, date));
    return snap.exists() ? (snap.data()?.blocks || []) : [];
  } catch { return []; }
}
async function persistBlocks(memberId, date, blocks) {
  try {
    await setDoc(fsRef(memberId, date), {
      memberId, date, blocks, updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.warn("[CoachDaySchedule] Firestore write failed:", e?.message); }
}

// ─── Deduplicate workouts by sport + title ────────────────────────────────────
// Multiple athletes get the same workout → group into one block showing total count
function dedupeWorkouts(list) {
  const map = new Map();
  (list || []).forEach(w => {
    const sport = String(w?.Sport || "").toLowerCase().trim();
    const title = String(w?.Title || "Workout");
    const key   = `${sport}__${title}`;
    if (!map.has(key)) {
      map.set(key, { ...w, _athleteTotal: w.athleteCount || 0 });
    } else {
      const ex = map.get(key);
      ex._athleteTotal += (w.athleteCount || 0);
      // Use the scheduled time if the existing entry doesn't have one
      if (!ex.ScheduledMinutes && w.ScheduledMinutes) {
        ex.ScheduledMinutes = w.ScheduledMinutes;
        ex.ScheduledTime    = w.ScheduledTime;
      }
    }
  });
  return Array.from(map.values());
}

// ─── Assigned workout block (read-only) ───────────────────────────────────────
function WorkoutBlock({ w, fallbackY }) {
  const sport  = String(w?.Sport || "").toLowerCase().trim();
  const color  = sportColor(sport);
  const top    = w.ScheduledMinutes != null ? minToY(w.ScheduledMinutes) : fallbackY;
  const height = Math.max(PX_PER_HOUR * 1.5, 48);
  const count  = w._athleteTotal || w.athleteCount || 0;
  const items  = w.itemCount || 0;

  return (
    <div style={{
      position:"absolute", top, left:LABEL_W+6, right:6, height,
      background:`${color}12`,
      border:`1px solid ${color}30`,
      borderLeft:`3px solid ${color}`,
      borderRadius:"0 7px 7px 0",
      padding:"6px 9px 6px 8px",
      overflow:"hidden",
      pointerEvents:"none",
      zIndex:1,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
        <span style={{
          fontSize:8, fontWeight:800, flexShrink:0,
          fontFamily:"'Arial Narrow',Arial,sans-serif",
          letterSpacing:"0.1em", textTransform:"uppercase",
          color, background:`${color}20`, padding:"1px 5px", borderRadius:2,
        }}>
          {titleSport(sport) || "Workout"}
        </span>
        {w.ScheduledMinutes != null && (
          <span style={{ fontSize:9, color:T.faint, fontFamily:"'Arial Narrow',Arial,sans-serif" }}>
            {fmtMin(w.ScheduledMinutes)}
          </span>
        )}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:T.body, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {w.Title || "Workout"}
      </div>
      <div style={{ fontSize:10, color:T.dim, marginTop:2 }}>
        {count > 0 && `${count} athlete${count!==1?"s":""}`}
        {count > 0 && items > 0 && " · "}
        {items > 0 && `${items} exercise${items!==1?"s":""}`}
      </div>
    </div>
  );
}

// ─── Personal block (editable) ────────────────────────────────────────────────
function PersonalBlock({ seg, isNow, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const color  = seg.color || sportColor(seg.sport);
  const top    = minToY(seg.startMinutes);
  const height = Math.max((seg.durationMinutes||60)/60*PX_PER_HOUR, 28);
  const short  = height < 44;
  const isPersonal = seg.sport === "personal";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onEdit(seg)}
      data-block="1"
      style={{
        position:"absolute", top, left:LABEL_W+6, right:6, height,
        background: isNow ? color : `${color}22`,
        borderLeft:`3px solid ${color}`,
        borderRadius:"0 7px 7px 0",
        cursor:"pointer", overflow:"hidden",
        display:"flex", flexDirection:"column", justifyContent:"center",
        padding: short ? "0 8px 0 7px" : "5px 8px 5px 7px",
        boxShadow: isNow ? `0 2px 14px ${color}50` : hov ? "0 1px 8px rgba(0,0,0,0.12)" : "none",
        transition:"box-shadow 0.15s, background 0.15s",
        zIndex: isNow ? 4 : hov ? 3 : 2,
      }}
    >
      <div style={{ display:"flex", alignItems:"center", gap:5, minWidth:0 }}>
        {!isPersonal && (
          <span style={{
            fontSize:8, fontWeight:800, flexShrink:0,
            fontFamily:"'Arial Narrow',Arial,sans-serif",
            letterSpacing:"0.1em", textTransform:"uppercase",
            color:isNow?"#fff":color,
            background:isNow?"rgba(255,255,255,0.2)":"transparent",
            padding:"1px 4px", borderRadius:2,
          }}>
            {titleSport(seg.sport)}
          </span>
        )}
        <span style={{
          fontSize:short?11:13, fontWeight:700,
          color:isNow?"#fff":T.body,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1,
        }}>
          {seg.title}
        </span>
        {hov && (
          <button
            onClick={e=>{e.stopPropagation();onDelete(seg.id);}}
            style={{
              width:16,height:16,borderRadius:"50%",flexShrink:0,
              background:isNow?"rgba(255,255,255,0.25)":"rgba(220,38,38,0.15)",
              border:"none",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              color:isNow?"#fff":T.red,fontSize:11,lineHeight:1,
            }}
          >×</button>
        )}
      </div>
      {!short && (
        <div style={{ fontSize:10, color:isNow?"rgba(255,255,255,0.75)":T.dim, marginTop:2 }}>
          {fmtMin(seg.startMinutes)} – {fmtMin(seg.startMinutes+(seg.durationMinutes||60))}
          {" · "}{fmtDur(seg.durationMinutes)}
          {seg.notes && ` · ${seg.notes}`}
        </div>
      )}
    </div>
  );
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────
const BLANK = { sport:"personal", title:"", startH:12, startM:0, durationMinutes:60, notes:"" };

function SegForm({ initial, availableSports, onSave, onCancel }) {
  const [f, setF] = useState(() => initial ? {
    sport:           initial.sport||"personal",
    title:           initial.title||"",
    startH:          Math.floor((initial.startMinutes||720)/60),
    startM:          (initial.startMinutes||720)%60,
    durationMinutes: initial.durationMinutes||60,
    notes:           initial.notes||"",
  } : BLANK);

  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const color = sportColor(f.sport);
  const suggestions = getSuggestions(f.sport);

  const allSports = useMemo(() => {
    const base = Array.isArray(availableSports)?availableSports:[];
    return [...new Set([...base,"personal"])].filter(Boolean);
  }, [availableSports]);

  const inp = {
    width:"100%", padding:"7px 10px",
    border:`1px solid ${T.border}`, borderRadius:6,
    fontSize:13, color:T.body, background:T.card,
    fontFamily:"inherit", outline:"none", boxSizing:"border-box",
  };

  const handle = () => {
    if (!f.title.trim()) return;
    onSave({
      sport:f.sport, title:f.title.trim(),
      startMinutes:f.startH*60+f.startM,
      durationMinutes:Number(f.durationMinutes)||60,
      notes:f.notes.trim(),
      color:sportColor(f.sport),
    });
  };

  return (
    <div style={{ background:T.card, borderTop:`3px solid ${color}`, borderBottom:`1px solid ${T.border}`, padding:"14px 16px" }}>

      {/* Sport / category */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:9, fontWeight:700, color:T.faint, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Arial Narrow',Arial,sans-serif" }}>
          Category
        </div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {/* Always show Personal first */}
          {["personal", ...allSports.filter(s=>s!=="personal")].map(s => {
            const c=sportColor(s), sel=f.sport===s;
            return (
              <button key={s} onClick={()=>{set("sport",s); set("title","");}} style={{
                padding:"3px 10px", borderRadius:20, cursor:"pointer",
                fontSize:10, fontWeight:800,
                fontFamily:"'Arial Narrow',Arial,sans-serif",
                letterSpacing:"0.05em", textTransform:"uppercase",
                background:sel?c:"transparent",
                border:`1px solid ${sel?c:T.border}`,
                color:sel?"#fff":T.dim, transition:"all 0.12s",
              }}>
                {s==="personal"?"Personal":titleSport(s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:9, fontWeight:700, color:T.faint, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Arial Narrow',Arial,sans-serif" }}>
          What
        </div>
        <input
          autoFocus list="seg-acts"
          value={f.title} onChange={e=>set("title",e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")handle();if(e.key==="Escape")onCancel();}}
          placeholder={`e.g. ${suggestions[0]}`}
          style={{...inp,fontWeight:600}}
        />
        <datalist id="seg-acts">
          {suggestions.map(s=><option key={s} value={s}/>)}
        </datalist>
      </div>

      {/* Time + duration */}
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T.faint, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Arial Narrow',Arial,sans-serif" }}>Start</div>
          <div style={{ display:"flex", gap:3 }}>
            <select value={f.startH} onChange={e=>set("startH",Number(e.target.value))} style={{...inp,flex:1,padding:"7px 5px"}}>
              {Array.from({length:18},(_,i)=>i+5).map(h=>(
                <option key={h} value={h}>{h===12?"12pm":h<12?`${h}am`:`${h-12}pm`}</option>
              ))}
            </select>
            <select value={f.startM} onChange={e=>set("startM",Number(e.target.value))} style={{...inp,width:58,padding:"7px 3px"}}>
              {[0,15,30,45].map(m=><option key={m} value={m}>{String(m).padStart(2,"0")}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T.faint, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Arial Narrow',Arial,sans-serif" }}>Duration</div>
          <select value={f.durationMinutes} onChange={e=>set("durationMinutes",Number(e.target.value))} style={inp}>
            {[15,30,45,60,75,90,120,150,180,240].map(d=>(
              <option key={d} value={d}>{d<60?`${d}m`:d%60===0?`${d/60}h`:`${Math.floor(d/60)}h${d%60}m`}</option>
            ))}
          </select>
        </div>
      </div>

      <input
        value={f.notes} onChange={e=>set("notes",e.target.value)}
        placeholder="Notes (optional)"
        style={{...inp,marginBottom:12,fontSize:12,color:T.dim}}
      />

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={handle} disabled={!f.title.trim()} style={{
          flex:1, padding:"9px", borderRadius:7, border:"none",
          background:!f.title.trim()?T.border:color,
          color:!f.title.trim()?T.faint:"#fff",
          fontSize:11, fontWeight:800, cursor:!f.title.trim()?"not-allowed":"pointer",
          fontFamily:"'Arial Narrow',Arial,sans-serif",
          letterSpacing:"0.08em", textTransform:"uppercase",
        }}>
          {initial?"Save Changes":"Add Block"}
        </button>
        <button onClick={onCancel} style={{
          padding:"9px 14px", borderRadius:7, cursor:"pointer",
          border:`1px solid ${T.border}`, background:"transparent",
          fontSize:12, fontWeight:600, color:T.dim,
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CoachDaySchedule({ selectedDate, workoutsByDate={}, memberId="default", sports=[] }) {
  const [blocks,   setBlocks]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [formMode, setFormMode] = useState(null);
  const [formStartM,setFormStartM] = useState(720);
  const [nowMin,   setNowMin]   = useState(()=>{ const n=new Date(); return n.getHours()*60+n.getMinutes(); });
  const timelineRef = useRef(null);

  const todayISO = new Date().toISOString().slice(0,10);
  const isToday  = selectedDate === todayISO;

  // Load personal blocks from Firestore on date change
  useEffect(() => {
    if (!memberId || memberId === "default" || !selectedDate || selectedDate === "2000-01-01") {
      setBlocks([]); setLoading(false); return;
    }
    setLoading(true);
    setFormMode(null);
    loadBlocks(memberId, selectedDate)
      .then(b => setBlocks(b))
      .finally(() => setLoading(false));
  }, [memberId, selectedDate]);

  // Clock tick
  useEffect(() => {
    const id = setInterval(()=>{ const n=new Date(); setNowMin(n.getHours()*60+n.getMinutes()); }, 30_000);
    return ()=>clearInterval(id);
  }, []);

  const workouts      = useMemo(()=>workoutsByDate?.[selectedDate]||[],[workoutsByDate,selectedDate]);
  const dedupedWorkouts = useMemo(()=>dedupeWorkouts(workouts),[workouts]);

  const availableSports = useMemo(()=>{
    const fromW = workouts.map(w=>String(w?.Sport||"").toLowerCase().trim()).filter(Boolean);
    const base  = Array.isArray(sports)?sports:[];
    return [...new Set([...base,...fromW])].filter(Boolean);
  },[sports,workouts]);

  const currentBlockId = useMemo(()=>{
    if(!isToday) return null;
    return blocks.find(b=>nowMin>=b.startMinutes&&nowMin<b.startMinutes+(b.durationMinutes||60))?.id??null;
  },[blocks,nowMin,isToday]);

  const persist = useCallback((next)=>{
    const sorted=[...next].sort((a,b)=>a.startMinutes-b.startMinutes);
    setBlocks(sorted);
    persistBlocks(memberId, selectedDate, sorted);
  },[memberId,selectedDate]);

  const handleSave = useCallback((data)=>{
    if(formMode&&typeof formMode==="object"){
      persist(blocks.map(b=>b.id===formMode.id?{...b,...data}:b));
    } else {
      persist([...blocks,{id:makeId(),...data}]);
    }
    setFormMode(null);
  },[formMode,blocks,persist]);

  const handleDelete = useCallback((id)=>{ persist(blocks.filter(b=>b.id!==id)); },[blocks,persist]);

  // Click empty timeline area → pre-fill form with that time
  const handleTimelineClick = useCallback((e)=>{
    if(formMode) return;
    if(e.target.closest("[data-block]")) return;
    const rect=timelineRef.current?.getBoundingClientRect();
    if(!rect) return;
    const m = snapMin(yToMin(e.clientY-rect.top));
    setFormStartM(Math.max(DAY_START_M, Math.min(DAY_END_H*60-30, m)));
    setFormMode("add");
  },[formMode]);

  // Summary stats
  const stats = useMemo(()=>{
    const totalMin=blocks.reduce((s,b)=>s+(b.durationMinutes||60),0);
    const sportSet=new Set(blocks.filter(b=>b.sport!=="personal").map(b=>b.sport));
    const sorted=[...blocks].sort((a,b)=>a.startMinutes-b.startMinutes);
    let gaps=0;
    for(let i=0;i<sorted.length-1;i++){
      const end=sorted[i].startMinutes+(sorted[i].durationMinutes||60);
      if(sorted[i+1].startMinutes>end) gaps++;
    }
    return { totalMin, sportCount:sportSet.size, gaps };
  },[blocks]);

  const dateObj  = selectedDate&&selectedDate!=="2000-01-01"?new Date(`${selectedDate}T12:00:00`):null;
  const dayName  = dateObj?.toLocaleDateString("en-US",{weekday:"long"})||"";
  const dateStr  = dateObj?.toLocaleDateString("en-US",{month:"short",day:"numeric"})||"—";

  return (
    <div style={{ width:"100%", height:"100%", background:T.bg, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding:"14px 16px 12px", borderBottom:`1px solid ${T.border}`, background:T.card, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase", color:T.faint, fontFamily:"'Arial Narrow',Arial,sans-serif", marginBottom:2 }}>
              {isToday?"Today · ":""}{dayName}
            </div>
            <div style={{ fontSize:22, fontWeight:900, lineHeight:1, letterSpacing:"-0.02em", color:isToday?T.safe:T.body }}>
              {dateStr}
            </div>
          </div>
          {formMode!=="add" && (
            <button onClick={()=>setFormMode("add")} style={{
              background:T.brand, border:"none", borderRadius:7,
              padding:"6px 14px", cursor:"pointer",
              fontSize:11, fontWeight:800, color:"#fff",
              fontFamily:"'Arial Narrow',Arial,sans-serif",
              letterSpacing:"0.08em", textTransform:"uppercase",
            }}>+ Add</button>
          )}
        </div>

        {/* Stats */}
        {blocks.length > 0 && (
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:8 }}>
            <span style={{ fontSize:11, color:T.dim }}>
              <strong style={{ color:T.body, fontWeight:700 }}>
                {stats.totalMin >= 60 ? `${Math.floor(stats.totalMin/60)}h${stats.totalMin%60>0?` ${stats.totalMin%60}m`:""}` : `${stats.totalMin}m`}
              </strong> personal blocks
            </span>
            {stats.gaps > 0 && (
              <span style={{ fontSize:11, color:T.dim }}>
                <strong style={{ color:T.body, fontWeight:700 }}>{stats.gaps}</strong> gap{stats.gaps!==1?"s":""}
              </span>
            )}
          </div>
        )}

        {/* Assigned workout chips */}
        {dedupedWorkouts.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, fontWeight:700, color:T.faint, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"'Arial Narrow',Arial,sans-serif" }}>
              Assigned:
            </span>
            {dedupedWorkouts.map((w,i) => {
              const sport=String(w?.Sport||"").toLowerCase().trim();
              const c=sportColor(sport);
              return (
                <span key={i} style={{
                  fontSize:9, fontWeight:800,
                  fontFamily:"'Arial Narrow',Arial,sans-serif",
                  letterSpacing:"0.07em", textTransform:"uppercase",
                  color:c, background:`${c}14`, border:`1px solid ${c}30`,
                  padding:"2px 8px", borderRadius:20,
                }}>
                  {titleSport(sport)||"Workout"}
                  {w._athleteTotal>0&&` · ${w._athleteTotal}`}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Form ── */}
      {formMode && (
        <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}`, overflowY:"auto", maxHeight:"55vh" }}>
          <SegForm
            initial={typeof formMode==="object"?formMode:{startMinutes:formStartM,durationMinutes:60}}
            availableSports={availableSports}
            onSave={handleSave}
            onCancel={()=>setFormMode(null)}
          />
        </div>
      )}

      {/* ── Timeline ── */}
      <div style={{ flex:1, overflowY:"auto" }}>
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          style={{ position:"relative", height:TOTAL_H, cursor:"crosshair" }}
        >
          {/* Hour lines + labels */}
          {HOURS.map(h=>{
            const y=minToY(h*60);
            const isCur=isToday&&Math.floor(nowMin/60)===h;
            return (
              <div key={h} style={{ position:"absolute", top:y, left:0, right:0, display:"flex", alignItems:"flex-start", pointerEvents:"none" }}>
                <div style={{
                  width:LABEL_W, paddingRight:8, paddingTop:1, flexShrink:0,
                  textAlign:"right",
                  fontSize:10, fontWeight:isCur?700:400,
                  fontFamily:"'Arial Narrow',Arial,sans-serif",
                  color:isCur?T.brand:T.ghost, userSelect:"none",
                }}>
                  {h===12?"12p":h<12?`${h}a`:`${h-12}p`}
                </div>
                <div style={{ flex:1, height:h%6===0?1:0.5, background:h%6===0?T.border:"#F1F5F9", marginTop:6 }} />
              </div>
            );
          })}

          {/* Now line */}
          {isToday&&nowMin>=DAY_START_M&&nowMin<=DAY_END_H*60&&(()=>{
            const p=minToY(nowMin);
            return (
              <div style={{ position:"absolute", top:p, left:0, right:0, zIndex:10, pointerEvents:"none", display:"flex", alignItems:"center" }}>
                <div style={{ width:LABEL_W, display:"flex", justifyContent:"flex-end", paddingRight:5, flexShrink:0 }}>
                  <div style={{ width:7,height:7,borderRadius:"50%",background:T.red,marginTop:-3 }}/>
                </div>
                <div style={{ flex:1, height:1.5, background:T.red, opacity:0.85 }}/>
              </div>
            );
          })()}

          {/* Layer 1: Assigned workout blocks (read-only) */}
          {dedupedWorkouts.map((w,i) => (
            <WorkoutBlock
              key={w.id||i}
              w={w}
              fallbackY={minToY(9*60 + i*96)} // fallback if no ScheduledTime
            />
          ))}

          {/* Layer 2: Coach's personal blocks (editable) */}
          {blocks.map(seg=>(
            <div key={seg.id} data-block="1" onClick={e=>e.stopPropagation()}>
              {formMode&&typeof formMode==="object"&&formMode.id===seg.id ? null : (
                <PersonalBlock
                  seg={seg}
                  isNow={currentBlockId===seg.id}
                  onEdit={s=>setFormMode(s)}
                  onDelete={handleDelete}
                />
              )}
            </div>
          ))}

          {/* Empty hint */}
          {blocks.length===0&&dedupedWorkouts.length===0&&!formMode&&(
            <div style={{
              position:"absolute", top:"45%", left:LABEL_W+12, right:12,
              transform:"translateY(-50%)", textAlign:"center", pointerEvents:"none",
            }}>
              <div style={{ fontSize:11, color:T.ghost, lineHeight:1.8 }}>
                Click the timeline to add a block<br/>
                <span style={{ fontSize:10 }}>Lunch · Meetings · Snack prep · Travel</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}