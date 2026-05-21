// components/org/workoutsCalendar/CoachDaySchedule.jsx
//
// Premium two-layer day planner for coaches.
//
// Interactions:
//   - Click + drag on empty timeline  → create a new block
//   - Drag a block body               → move it
//   - Drag the resize handle (bottom) → resize it
//   - Click a block                   → edit form
//   - Quick-add pills                 → instant block at current time
//
// Layers:
//   1. Assigned workouts from Airtable  (read-only)
//   2. Coach personal blocks in Firestore (editable)

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  // Header — dark, editorial
  hdrBg:    "#08101E",
  hdrText:  "#F0F4FF",
  hdrDim:   "#6B7A99",
  hdrBorder:"#1C2740",
  // Timeline — crisp white
  bg:       "#FFFFFF",
  pageBg:   "#F7F9FC",
  border:   "#E8EDF5",
  gridMaj:  "#E8EDF5",
  gridMin:  "#F3F6FA",
  body:     "#0A1628",
  dim:      "#5A6A85",
  faint:    "#98A8C0",
  ghost:    "#D8E2F0",
  // Accents
  brand:    DS.brand    || "#1A56DB",
  brandBg:  DS.brandBg  || "#EFF6FF",
  safe:     "#16A34A",
  red:      "#E53E3E",
  // Now line
  now:      "#E53E3E",
};

// ─── Sport palette ────────────────────────────────────────────────────────────
const PALETTE = {
  football:   "#DC2626", volleyball: "#7C3AED", baseball:   "#1A56DB",
  softball:   "#DB2777", soccer:     "#059669", basketball: "#D97706",
  swim:       "#0891B2", track:      "#EA580C", hockey:     "#4338CA",
  tennis:     "#65A30D", wrestling:  "#9333EA", xc:         "#0D9488",
  personal:   "#475569",
};
function sportColor(s) {
  if (!s) return PALETTE.personal;
  const k = s.toLowerCase().replace(/\s+/g, "");
  if (PALETTE[k]) return PALETTE[k];
  const vals = Object.values(PALETTE).slice(0, -1);
  let h = 0; for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  return vals[Math.abs(h) % vals.length];
}

// ─── Quick-add suggestions ────────────────────────────────────────────────────
const QUICK = {
  football:   ["Film","Walk-Through","Team Mtg","Speed Work"],
  volleyball: ["Film","Serve Work","Conditioning"],
  baseball:   ["Film","BP","Fielding","Pitching"],
  softball:   ["Film","BP","Fielding","Pitching"],
  soccer:     ["Film","Set Pieces","Conditioning"],
  basketball: ["Film","Shootaround","Conditioning"],
  swim:       ["AM Practice","PM Practice","Dryland"],
  track:      ["Film","Tempo","Time Trials"],
  hockey:     ["Film","Skate","Off-Ice"],
  tennis:     ["Film","Match Play"],
  wrestling:  ["Film","Live Wrestling"],
  xc:         ["AM Run","PM Run","Tempo"],
  personal:   ["Lunch","Staff Mtg","Office Hours","Recruiting","Travel","Break"],
};
function quickSuggestions(sport) {
  const k = (sport || "personal").toLowerCase().replace(/\s+/g, "");
  return QUICK[k] || ["Practice","Film","Meeting"];
}

// ─── Timeline math ────────────────────────────────────────────────────────────
const PH        = 72;           // px per hour
const START_H   = 5;
const END_H     = 23;
const START_M   = START_H * 60;
const LABEL_W   = 52;
const TOTAL_H   = (END_H - START_H) * PH;
const SNAP      = 15;
const MIN_DUR   = 15;
const HOURS     = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);

const minToY = m  => ((m - START_M) / 60) * PH;
const yToMin = y  => START_M + (y / PH) * 60;
const snap   = m  => Math.round(m / SNAP) * SNAP;
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtTime(m) {
  if (m == null) return "";
  const h = Math.floor(m / 60) % 24, mn = m % 60;
  const ap = h >= 12 ? "pm" : "am", dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mn === 0 ? `${dh}${ap}` : `${dh}:${String(mn).padStart(2, "0")}${ap}`;
}
function fmtDur(d) {
  if (!d) return "";
  if (d < 60) return `${d}m`;
  const h = Math.floor(d / 60), m = d % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function makeId() { return `b${Date.now()}${Math.random().toString(36).slice(2, 6)}`; }

// ─── Firestore ────────────────────────────────────────────────────────────────
const fsRef = (mid, date) => doc(db, "coachBlocks", `${mid}_${date}`);
async function loadBlocks(mid, date) {
  try { const s = await getDoc(fsRef(mid, date)); return s.exists() ? s.data()?.blocks || [] : []; }
  catch { return []; }
}
async function saveBlocks(mid, date, blocks) {
  try { await setDoc(fsRef(mid, date), { mid, date, blocks, updatedAt: serverTimestamp() }, { merge: true }); }
  catch (e) { console.warn("CoachDaySchedule persist:", e?.message); }
}

// ─── Dedupe assigned workouts ─────────────────────────────────────────────────
function dedupeWorkouts(list) {
  const map = new Map();
  (list || []).forEach(w => {
    const key = `${String(w?.Sport||"").toLowerCase()}__${String(w?.Title||"")}`;
    if (!map.has(key)) { map.set(key, { ...w, _total: w.athleteCount || 0 }); }
    else {
      const ex = map.get(key);
      ex._total += (w.athleteCount || 0);
      if (!ex.ScheduledMinutes && w.ScheduledMinutes) { ex.ScheduledMinutes = w.ScheduledMinutes; ex.ScheduledTime = w.ScheduledTime; }
    }
  });
  return Array.from(map.values());
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes nowPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
  @keyframes blockIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  @keyframes formIn   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  .cds-block { animation: blockIn .18s cubic-bezier(.16,1,.3,1) both; }
  .cds-form  { animation: formIn .22s cubic-bezier(.16,1,.3,1) both; }
  .cds-qa-pill:hover { opacity:1!important; transform:translateY(-1px); }
  .cds-block-personal:hover { box-shadow:0 4px 20px rgba(0,0,0,.13)!important; }
  .cds-del:hover { background:rgba(229,62,62,.18)!important; }
  ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:2px; }
`;

// ─── Assigned workout block (read-only) ───────────────────────────────────────
function AssignedBlock({ w, idx }) {
  const sport = String(w?.Sport || "").toLowerCase().trim();
  const color = sportColor(sport);
  const top   = w.ScheduledMinutes != null ? minToY(w.ScheduledMinutes) : minToY(START_M + 240 + idx * 110);
  const h     = Math.max(PH * 1.5, 52);

  return (
    <div className="cds-block" style={{
      position: "absolute", top, left: LABEL_W + 5, right: 5, height: h,
      background: `linear-gradient(135deg, ${color}0D 0%, ${color}18 100%)`,
      border: `1px solid ${color}28`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "0 8px 8px 0",
      padding: "7px 10px",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <span style={{
          fontSize: 8, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase",
          color, background: `${color}18`, padding: "1px 6px", borderRadius: 3,
          fontVariantNumeric: "tabular-nums",
        }}>
          {titleSport(sport) || "Assigned"}
        </span>
        {w.ScheduledMinutes != null && (
          <span style={{ fontSize: 9, color: T.faint, fontVariantNumeric: "tabular-nums" }}>
            {fmtTime(w.ScheduledMinutes)}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {w.Title || "Workout"}
      </div>
      {w._total > 0 && (
        <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
          {w._total} athlete{w._total !== 1 ? "s" : ""}
          {w.itemCount > 0 && ` · ${w.itemCount} exercise${w.itemCount !== 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  );
}

// ─── Resize handle ────────────────────────────────────────────────────────────
function ResizeHandle({ color, onPointerDown }) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 14,
        cursor: "s-resize",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(to top, ${color}22, transparent)`,
        borderRadius: "0 0 8px 8px",
        zIndex: 2,
      }}
    >
      <div style={{ width: 22, height: 2, borderRadius: 1, background: color, opacity: .45 }} />
    </div>
  );
}

// ─── Personal block ───────────────────────────────────────────────────────────
function PersonalBlock({ seg, isActive, isNow, onPointerDown, onResizePointerDown, onClick, onDelete, isBeingDragged }) {
  const color  = seg.color || sportColor(seg.sport);
  const top    = minToY(seg.startMinutes);
  const height = Math.max((seg.durationMinutes || 60) / 60 * PH, 28);
  const short  = height < 46;

  return (
    <div
      className="cds-block cds-block-personal"
      onPointerDown={e => { if (e.target.dataset.resize) return; onPointerDown(e); }}
      onClick={() => onClick(seg)}
      style={{
        position: "absolute", top, left: LABEL_W + 5, right: 5, height,
        background: isNow
          ? `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`
          : `linear-gradient(135deg, ${color}16 0%, ${color}0C 100%)`,
        border: `1px solid ${color}${isNow ? "88" : "30"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "0 8px 8px 0",
        padding: short ? "0 10px 0 8px" : "6px 10px 14px 8px",
        cursor: isBeingDragged ? "grabbing" : "grab",
        userSelect: "none",
        touchAction: "none",
        overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "center",
        boxShadow: isBeingDragged
          ? "0 12px 40px rgba(0,0,0,.18)"
          : isNow
            ? `0 4px 24px ${color}40`
            : "0 1px 4px rgba(0,0,0,.06)",
        transform: isBeingDragged ? "scale(1.02)" : "scale(1)",
        transition: isBeingDragged ? "none" : "box-shadow .15s, transform .15s",
        zIndex: isBeingDragged ? 20 : isNow ? 4 : 2,
        opacity: isBeingDragged ? .92 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        {seg.sport && seg.sport !== "personal" && (
          <span style={{
            fontSize: 7, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase",
            color: isNow ? "rgba(255,255,255,.7)" : color,
            flexShrink: 0,
          }}>
            {titleSport(seg.sport)}
          </span>
        )}
        <span style={{
          fontSize: short ? 11 : 12, fontWeight: 700, lineHeight: 1.2,
          color: isNow ? "#fff" : T.body,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {seg.title}
        </span>
        <button
          className="cds-del"
          onClick={e => { e.stopPropagation(); onDelete(seg.id); }}
          style={{
            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
            background: isNow ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.06)",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: isNow ? "rgba(255,255,255,.8)" : T.dim, fontSize: 13, lineHeight: 1,
            transition: "background .12s",
          }}
        >×</button>
      </div>
      {!short && (
        <div style={{
          fontSize: 10, color: isNow ? "rgba(255,255,255,.65)" : T.dim,
          marginTop: 3, fontVariantNumeric: "tabular-nums",
        }}>
          {fmtTime(seg.startMinutes)} – {fmtTime(seg.startMinutes + (seg.durationMinutes || 60))}
          {" · "}{fmtDur(seg.durationMinutes)}
          {seg.notes && <span style={{ opacity: .75 }}> · {seg.notes}</span>}
        </div>
      )}
      {height >= 28 && (
        <ResizeHandle
          color={isNow ? "#fff" : color}
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onResizePointerDown(e, seg.id); }}
        />
      )}
    </div>
  );
}

// ─── Ghost block (drag-to-create preview) ────────────────────────────────────
function GhostBlock({ startMinutes, durationMinutes }) {
  const top    = minToY(startMinutes);
  const height = Math.max((durationMinutes / 60) * PH, 14);
  return (
    <div style={{
      position: "absolute", top, left: LABEL_W + 5, right: 5, height,
      background: `${T.brand}18`,
      border: `1.5px dashed ${T.brand}60`,
      borderRadius: "0 8px 8px 0",
      pointerEvents: "none", zIndex: 3,
      display: "flex", alignItems: "center", paddingLeft: 8,
    }}>
      <span style={{ fontSize: 10, color: T.brand, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {fmtTime(startMinutes)} · {fmtDur(durationMinutes)}
      </span>
    </div>
  );
}

// ─── Block form ───────────────────────────────────────────────────────────────
const BLANK_FORM = { sport: "personal", title: "", startH: 12, startM: 0, durationMinutes: 60, notes: "" };

function BlockForm({ initial, allSports, onSave, onCancel }) {
  const [f, setF] = useState(() => initial ? {
    sport:           initial.sport || "personal",
    title:           initial.title || "",
    startH:          Math.floor((initial.startMinutes || 720) / 60),
    startM:          (initial.startMinutes || 720) % 60,
    durationMinutes: initial.durationMinutes || 60,
    notes:           initial.notes || "",
  } : { ...BLANK_FORM });

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const color  = sportColor(f.sport);
  const sports = useMemo(() => {
    const base = Array.isArray(allSports) ? allSports : [];
    return ["personal", ...base.filter(s => s !== "personal")].filter(Boolean);
  }, [allSports]);

  const inp = {
    width: "100%", padding: "8px 10px",
    border: `1.5px solid ${T.border}`, borderRadius: 7,
    fontSize: 13, color: T.body, background: T.bg,
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  const handleSave = () => {
    if (!f.title.trim()) return;
    onSave({
      sport: f.sport,
      title: f.title.trim(),
      startMinutes: f.startH * 60 + f.startM,
      durationMinutes: Number(f.durationMinutes) || 60,
      notes: f.notes.trim(),
      color: sportColor(f.sport),
    });
  };

  const suggestions = quickSuggestions(f.sport);

  return (
    <div className="cds-form" style={{
      background: T.bg,
      borderTop: `3px solid ${color}`,
      borderBottom: `1px solid ${T.border}`,
      padding: "14px 16px",
    }}>
      {/* Sport pills */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
        {sports.map(s => {
          const c = sportColor(s), sel = f.sport === s;
          return (
            <button key={s} onClick={() => { set("sport", s); set("title", ""); }} style={{
              padding: "3px 10px", borderRadius: 20, cursor: "pointer",
              fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              fontFamily: "inherit",
              background: sel ? c : "transparent",
              border: `1.5px solid ${sel ? c : T.border}`,
              color: sel ? "#fff" : T.dim,
              transition: "all .12s",
            }}>
              {s === "personal" ? "Personal" : titleSport(s)}
            </button>
          );
        })}
      </div>

      {/* Quick suggestion chips */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => set("title", s)} style={{
            padding: "3px 9px", borderRadius: 20, cursor: "pointer",
            fontSize: 10, fontWeight: 600, fontFamily: "inherit",
            background: f.title === s ? `${color}18` : T.pageBg,
            border: `1px solid ${f.title === s ? color : T.border}`,
            color: f.title === s ? color : T.dim,
            transition: "all .1s",
          }}>
            {s}
          </button>
        ))}
      </div>

      {/* Title input */}
      <input
        autoFocus
        value={f.title}
        onChange={e => set("title", e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="Activity name…"
        style={{ ...inp, fontWeight: 600, marginBottom: 10, fontSize: 14 }}
      />

      {/* Time + duration row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.faint, marginBottom: 4 }}>Start</div>
          <div style={{ display: "flex", gap: 4 }}>
            <select value={f.startH} onChange={e => set("startH", Number(e.target.value))} style={{ ...inp, flex: 1, padding: "7px 4px" }}>
              {Array.from({ length: 18 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`}</option>
              ))}
            </select>
            <select value={f.startM} onChange={e => set("startM", Number(e.target.value))} style={{ ...inp, width: 54, padding: "7px 3px" }}>
              {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.faint, marginBottom: 4 }}>Duration</div>
          <select value={f.durationMinutes} onChange={e => set("durationMinutes", Number(e.target.value))} style={inp}>
            {[15,30,45,60,75,90,120,150,180,240].map(d => (
              <option key={d} value={d}>{d < 60 ? `${d}m` : d % 60 === 0 ? `${d/60}h` : `${Math.floor(d/60)}h${d%60}m`}</option>
            ))}
          </select>
        </div>
      </div>

      <input
        value={f.notes}
        onChange={e => set("notes", e.target.value)}
        placeholder="Notes (optional)"
        style={{ ...inp, marginBottom: 12, fontSize: 12, color: T.dim }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={!f.title.trim()} style={{
          flex: 1, padding: "10px", borderRadius: 8, border: "none",
          background: f.title.trim() ? color : T.ghost,
          color: f.title.trim() ? "#fff" : T.faint,
          fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
          cursor: f.title.trim() ? "pointer" : "not-allowed",
          fontFamily: "inherit", transition: "background .15s",
        }}>
          {initial?.id ? "Save changes" : "Add block"}
        </button>
        {initial?.id && (
          <button onClick={() => onCancel("delete")} style={{
            padding: "10px 14px", borderRadius: 8, cursor: "pointer",
            border: `1.5px solid ${T.red}28`, background: "transparent",
            color: T.red, fontSize: 12, fontWeight: 700, fontFamily: "inherit",
            transition: "background .12s",
          }}>
            Delete
          </button>
        )}
        <button onClick={() => onCancel()} style={{
          padding: "10px 14px", borderRadius: 8, cursor: "pointer",
          border: `1.5px solid ${T.border}`, background: "transparent",
          color: T.dim, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CoachDaySchedule({
  selectedDate, workoutsByDate = {}, memberId = "default", sports = [],
}) {
  const [blocks,    setBlocks]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [formSeg,   setFormSeg]   = useState(null);  // null=closed | {}=new | {id,...}=edit
  const [nowMin,    setNowMin]    = useState(() => { const n = new Date(); return n.getHours()*60+n.getMinutes(); });

  // Drag state
  const [dragMode, setDragMode]   = useState(null);  // "move" | "resize" | "create" | null
  const [dragId,   setDragId]     = useState(null);
  const [dragOffY, setDragOffY]   = useState(0);     // px offset within block for move
  const [dragOffM, setDragOffM]   = useState(0);     // minute offset for move
  const [dragStartM, setDragStartM] = useState(0);   // for create: anchor minute
  const [dragCurM,  setDragCurM]  = useState(0);     // current minute (live)

  const timelineRef = useRef(null);

  // ── Load blocks on date change ──────────────────────────────────────────────
  useEffect(() => {
    if (!memberId || memberId === "default" || !selectedDate || selectedDate === "2000-01-01") {
      setBlocks([]); setLoading(false); return;
    }
    setLoading(true);
    setFormSeg(null);
    setDragMode(null);
    loadBlocks(memberId, selectedDate)
      .then(setBlocks)
      .finally(() => setLoading(false));
  }, [memberId, selectedDate]);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setNowMin(n.getHours()*60+n.getMinutes()); }, 30_000);
    return () => clearInterval(id);
  }, []);

  const todayISO = new Date().toISOString().slice(0, 10);
  const isToday  = selectedDate === todayISO;

  // ── Workouts ────────────────────────────────────────────────────────────────
  const workouts        = useMemo(() => workoutsByDate?.[selectedDate] || [], [workoutsByDate, selectedDate]);
  const dedupedWorkouts = useMemo(() => dedupeWorkouts(workouts), [workouts]);

  const allSports = useMemo(() => {
    const fromW = workouts.map(w => String(w?.Sport || "").toLowerCase().trim()).filter(Boolean);
    const base  = Array.isArray(sports) ? sports : [];
    return [...new Set([...base, ...fromW])].filter(Boolean);
  }, [sports, workouts]);

  const currentBlockId = useMemo(() => {
    if (!isToday) return null;
    return blocks.find(b => nowMin >= b.startMinutes && nowMin < b.startMinutes + (b.durationMinutes || 60))?.id ?? null;
  }, [blocks, nowMin, isToday]);

  // ── Persist ─────────────────────────────────────────────────────────────────
  const persist = useCallback((next) => {
    const sorted = [...next].sort((a, b) => a.startMinutes - b.startMinutes);
    setBlocks(sorted);
    saveBlocks(memberId, selectedDate, sorted);
  }, [memberId, selectedDate]);

  // ── Live dragged blocks ─────────────────────────────────────────────────────
  const liveBlocks = useMemo(() => {
    if (!dragMode || dragMode === "create") return blocks;
    return blocks.map(b => {
      if (b.id !== dragId) return b;
      if (dragMode === "move") {
        return { ...b, startMinutes: clamp(snap(dragCurM - dragOffM), START_M, END_H * 60 - (b.durationMinutes || 60)) };
      }
      if (dragMode === "resize") {
        const endM = clamp(snap(dragCurM), b.startMinutes + MIN_DUR, END_H * 60);
        return { ...b, durationMinutes: endM - b.startMinutes };
      }
      return b;
    });
  }, [blocks, dragMode, dragId, dragCurM, dragOffM]);

  // Create preview
  const createPreview = useMemo(() => {
    if (dragMode !== "create") return null;
    const lo = Math.min(dragStartM, dragCurM);
    const hi = Math.max(dragStartM, dragCurM);
    const dur = Math.max(snap(hi - lo), SNAP);
    return { startMinutes: snap(lo), durationMinutes: dur };
  }, [dragMode, dragStartM, dragCurM]);

  // ── Pointer helpers ─────────────────────────────────────────────────────────
  const getTimelineY = useCallback((clientY) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    return rect ? clientY - rect.top + (timelineRef.current.scrollTop || 0) : 0;
  }, []);

  // Start MOVE
  const handleBlockPointerDown = useCallback((e, seg) => {
    if (formSeg) return;
    e.preventDefault();
    const y      = getTimelineY(e.clientY);
    const curMin = yToMin(y);
    setDragMode("move");
    setDragId(seg.id);
    setDragOffM(curMin - seg.startMinutes);
    setDragCurM(curMin);
  }, [formSeg, getTimelineY]);

  // Start RESIZE
  const handleResizePointerDown = useCallback((e, id) => {
    e.preventDefault();
    const y = getTimelineY(e.clientY);
    setDragMode("resize");
    setDragId(id);
    setDragCurM(yToMin(y));
  }, [getTimelineY]);

  // Start CREATE (on empty area)
  const handleTimelinePointerDown = useCallback((e) => {
    if (formSeg) return;
    if (e.target.closest("[data-block]")) return;
    e.preventDefault();
    const y   = getTimelineY(e.clientY);
    const min = snap(yToMin(y));
    setDragMode("create");
    setDragStartM(min);
    setDragCurM(min + SNAP);
  }, [formSeg, getTimelineY]);

  // Global pointer move
  useEffect(() => {
    if (!dragMode) return;
    const move = (e) => {
      const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const y = getTimelineY(clientY);
      setDragCurM(yToMin(y));
    };
    const up = () => {
      if (dragMode === "create" && createPreview) {
        if (createPreview.durationMinutes >= SNAP) {
          setFormSeg({ startMinutes: createPreview.startMinutes, durationMinutes: createPreview.durationMinutes });
        }
      } else if (dragMode === "move" || dragMode === "resize") {
        // Save the dragged position
        const updated = liveBlocks;
        persist(updated);
      }
      setDragMode(null);
      setDragId(null);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup",   up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup",   up);
    };
  }, [dragMode, dragId, dragCurM, dragOffM, createPreview, liveBlocks, getTimelineY, persist]);

  // ── Block form actions ──────────────────────────────────────────────────────
  const handleFormSave = useCallback((data) => {
    if (formSeg?.id) {
      persist(blocks.map(b => b.id === formSeg.id ? { ...b, ...data } : b));
    } else {
      persist([...blocks, { id: makeId(), ...data }]);
    }
    setFormSeg(null);
  }, [formSeg, blocks, persist]);

  const handleFormCancel = useCallback((action) => {
    if (action === "delete" && formSeg?.id) {
      persist(blocks.filter(b => b.id !== formSeg.id));
    }
    setFormSeg(null);
  }, [formSeg, blocks, persist]);

  const handleQuickAdd = useCallback((title, sport) => {
    const now   = new Date();
    const start = snap(now.getHours() * 60 + now.getMinutes());
    persist([...blocks, { id: makeId(), sport, title, startMinutes: start, durationMinutes: 60, color: sportColor(sport), notes: "" }]);
  }, [blocks, persist]);

  // ── Date header ─────────────────────────────────────────────────────────────
  const dateObj  = selectedDate && selectedDate !== "2000-01-01" ? new Date(`${selectedDate}T12:00:00`) : null;
  const dayName  = dateObj?.toLocaleDateString("en-US", { weekday: "long" }) || "";
  const dateStr  = dateObj?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) || "—";

  // Total planned time
  const plannedMin = useMemo(() => blocks.reduce((s, b) => s + (b.durationMinutes || 60), 0), [blocks]);

  // Quick-add suggestions (unique sport or personal)
  const quickItems = useMemo(() => {
    const sport = allSports[0] || "personal";
    return quickSuggestions(sport).slice(0, 4).map(title => ({ title, sport }));
  }, [allSports]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", background: T.pageBg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{CSS}</style>

      {/* ── Dark header ── */}
      <div style={{
        background: T.hdrBg,
        padding: "16px 18px 14px",
        flexShrink: 0,
        borderBottom: `1px solid ${T.hdrBorder}`,
      }}>
        {/* Date row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase",
              color: T.hdrDim, marginBottom: 3,
            }}>
              {isToday ? "Today · " : ""}{dayName}
            </div>
            <div style={{
              fontSize: 26, fontWeight: 900, lineHeight: 1, letterSpacing: "-.03em",
              color: isToday ? "#4ADE80" : T.hdrText,
            }}>
              {dateStr}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {plannedMin > 0 && (
              <div style={{
                fontSize: 10, fontWeight: 700, color: T.hdrDim,
                background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 6, padding: "4px 9px",
                fontVariantNumeric: "tabular-nums",
              }}>
                {plannedMin >= 60 ? `${Math.floor(plannedMin/60)}h${plannedMin%60>0?` ${plannedMin%60}m`:""}` : `${plannedMin}m`} planned
              </div>
            )}
            {!formSeg && (
              <button onClick={() => setFormSeg({ startMinutes: isToday ? snap(nowMin) : 9*60, durationMinutes: 60 })} style={{
                background: T.brand, border: "none", borderRadius: 7,
                padding: "6px 13px", cursor: "pointer",
                fontSize: 11, fontWeight: 800, color: "#fff",
                letterSpacing: ".06em", textTransform: "uppercase",
                fontFamily: "inherit",
              }}>
                + Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Form (inline, below header) ── */}
      {formSeg && (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.border}`, overflowY: "auto", maxHeight: "52vh" }}>
          <BlockForm
            initial={formSeg?.id ? formSeg : (formSeg?.startMinutes != null ? formSeg : null)}
            allSports={allSports}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* ── Timeline ── */}
      <div
        ref={timelineRef}
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: T.bg }}
      >
        <div
          onPointerDown={handleTimelinePointerDown}
          style={{
            position: "relative",
            height: TOTAL_H,
            cursor: dragMode === "create" ? "crosshair" : "crosshair",
            userSelect: "none",
          }}
        >
          {/* Hour grid */}
          {HOURS.map(h => {
            const y      = minToY(h * 60);
            const isNowH = isToday && Math.floor(nowMin / 60) === h;
            const major  = h % 3 === 0;
            return (
              <div key={h} style={{
                position: "absolute", top: y, left: 0, right: 0,
                display: "flex", alignItems: "flex-start", pointerEvents: "none",
              }}>
                <div style={{
                  width: LABEL_W, paddingRight: 10, paddingTop: 1, flexShrink: 0,
                  textAlign: "right",
                  fontSize: 10, fontWeight: isNowH ? 800 : 500,
                  fontVariantNumeric: "tabular-nums",
                  color: isNowH ? T.brand : T.ghost,
                  letterSpacing: ".02em",
                  userSelect: "none",
                }}>
                  {h === 12 ? "12p" : h < 12 ? `${h}a` : `${h-12}p`}
                </div>
                <div style={{
                  flex: 1, height: major ? 1 : 0.5,
                  background: major ? T.gridMaj : T.gridMin,
                  marginTop: 6,
                }} />
              </div>
            );
          })}

          {/* Half-hour tick marks */}
          {HOURS.slice(0, -1).map(h => (
            <div key={`h${h}`} style={{
              position: "absolute", top: minToY(h * 60 + 30), left: LABEL_W, right: 0,
              height: 0.5, background: T.gridMin, pointerEvents: "none",
            }} />
          ))}

          {/* Now line */}
          {isToday && nowMin >= START_M && nowMin <= END_H * 60 && (() => {
            const y = minToY(nowMin);
            return (
              <div style={{
                position: "absolute", top: y, left: 0, right: 0, zIndex: 10,
                pointerEvents: "none", display: "flex", alignItems: "center",
              }}>
                <div style={{ width: LABEL_W, display: "flex", justifyContent: "flex-end", paddingRight: 7, flexShrink: 0 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: T.now, marginTop: -3.5,
                    animation: "nowPulse 2s ease-in-out infinite",
                    boxShadow: `0 0 0 3px ${T.now}30`,
                  }} />
                </div>
                <div style={{ flex: 1, height: 1.5, background: T.now, opacity: .8 }} />
                <div style={{
                  fontSize: 9, fontWeight: 800, color: T.now,
                  background: "#FFF5F5", border: `1px solid ${T.now}28`,
                  padding: "1px 6px", marginLeft: 6, borderRadius: 4,
                  fontVariantNumeric: "tabular-nums", marginTop: -1, marginRight: 6,
                }}>
                  {fmtTime(nowMin)}
                </div>
              </div>
            );
          })()}

          {/* Assigned workout blocks */}
          {dedupedWorkouts.map((w, i) => (
            <AssignedBlock key={w.id || i} w={w} idx={i} />
          ))}

          {/* Ghost block (drag-to-create) */}
          {createPreview && createPreview.durationMinutes >= SNAP && (
            <GhostBlock
              startMinutes={createPreview.startMinutes}
              durationMinutes={createPreview.durationMinutes}
            />
          )}

          {/* Personal blocks */}
          {liveBlocks.map(seg => (
            <div key={seg.id} data-block="1" onClick={e => e.stopPropagation()}>
              {formSeg?.id === seg.id ? null : (
                <PersonalBlock
                  seg={seg}
                  isActive={false}
                  isNow={currentBlockId === seg.id}
                  isBeingDragged={dragMode !== "create" && dragId === seg.id}
                  onPointerDown={e => handleBlockPointerDown(e, seg)}
                  onResizePointerDown={(e, id) => handleResizePointerDown(e, id)}
                  onClick={s => setFormSeg(s)}
                  onDelete={id => persist(blocks.filter(b => b.id !== id))}
                />
              )}
            </div>
          ))}

          {/* Empty state */}
          {blocks.length === 0 && dedupedWorkouts.length === 0 && !formSeg && !dragMode && (
            <div style={{
              position: "absolute", top: "40%", left: LABEL_W + 16, right: 16,
              transform: "translateY(-50%)", textAlign: "center", pointerEvents: "none",
            }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: .25 }}>⊕</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ghost, lineHeight: 1.8 }}>
                Drag to block time
              </div>
              <div style={{ fontSize: 10, color: T.ghost, marginTop: 2 }}>
                or tap + Add above
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}