// components/org/workoutsCalendar/CoachDaySchedule.jsx
//
// Premium light-theme agenda view for coaches.
//
// Layout:
//   Header          — date, day navigation, planned-time stat, + Add button
//   NOW card        — pinned when today; shows active or upcoming event
//   Agenda list     — merged assigned + personal blocks, sorted by time
//                     gaps between events shown explicitly as clickable rows
//   Unscheduled     — assigned workouts with no ScheduledTime; tap to set time
//   Add / Edit form — inline block form
//   ScheduleModal   — time-picker for assigned workouts (new + already scheduled)

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       "#FFFFFF",
  pageBg:   "#F4F7FC",
  card:     "#FFFFFF",
  border:   "#E3EAF4",
  borderMid:"#C9D5E8",
  body:     "#0C1A2E",
  dim:      "#5A6B85",
  faint:    "#95A6BC",
  ghost:    "#D5E0EF",
  brand:    DS.brand       || "#1A56DB",
  brandBg:  DS.brandBg     || "#EFF6FF",
  brandBdr: DS.brandBorder || "#BFDBFE",
  safe:     "#16A34A",
  safeBg:   "#F0FDF4",
  now:      "#DC2626",
  nowBg:    "#FFF5F5",
  amber:    "#B45309",
  amberBg:  "#FFFBEB",
  amberBdr: "#FDE68A",
  amberText:"#92400E",
};

// ─── Sport colors ─────────────────────────────────────────────────────────────
const PALETTE = {
  football:  "#DC2626", volleyball:"#7C3AED", baseball:  "#1D4ED8",
  softball:  "#BE185D", soccer:    "#047857", basketball:"#B45309",
  swim:      "#0369A1", track:     "#C2410C", hockey:    "#3730A3",
  tennis:    "#4D7C0F", wrestling: "#7E22CE", xc:        "#0F766E",
  personal:  "#475569",
};
function sportColor(s) {
  if (!s) return PALETTE.personal;
  const k = s.toLowerCase().replace(/\s+/g, "");
  if (PALETTE[k]) return PALETTE[k];
  const vals = Object.values(PALETTE).slice(0, -1);
  let h = 0; for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  return vals[Math.abs(h) % vals.length];
}

// ─── Suggestions ──────────────────────────────────────────────────────────────
const SUGGESTIONS = {
  football:  ["Film Session","Walk-Through","Team Meeting","Lifting","Speed Work"],
  volleyball:["Film Session","Practice","Conditioning","Serve Work"],
  baseball:  ["Film","Batting Practice","Fielding","Pitching"],
  softball:  ["Film","Batting Practice","Fielding","Pitching"],
  soccer:    ["Film Session","Set Pieces","Conditioning","Scrimmage"],
  basketball:["Film Session","Shootaround","Conditioning","Scrimmage"],
  swim:      ["Morning Practice","Afternoon Practice","Dryland"],
  track:     ["Film","Tempo Run","Time Trials"],
  hockey:    ["Film Session","Skate","Off-Ice"],
  tennis:    ["Film","Match Play","Conditioning"],
  wrestling: ["Film","Live Wrestling","Conditioning"],
  xc:        ["Morning Run","Tempo Run","Film"],
  personal:  ["Lunch","Staff Meeting","Office Hours","Recruiting Call","Travel","Admin","Break","Film Review"],
};
function getSuggestions(sport) {
  const k = (sport || "personal").toLowerCase().replace(/\s+/g, "");
  return SUGGESTIONS[k] || ["Practice","Film","Meeting","Conditioning"];
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
const SNAP = 15;
function snapMin(m) { return Math.round(m / SNAP) * SNAP; }

// Handles both 24-hour ("13:00") and 12-hour ("1pm") formats
function parseTimeToMinutes(str) {
  if (!str) return null;
  const s = String(str).trim();
  const isPM = /pm/i.test(s);
  const isAM = /am/i.test(s);
  const parts = s.replace(/[^0-9:]/g, "").split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return null;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  // 24-hour strings ("12:00" = noon, "13:00" = 1pm) used as-is
  return h * 60 + m;
}

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
function fmtCountdown(m) {
  if (m <= 0) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
function makeId() { return `b${Date.now()}${Math.random().toString(36).slice(2, 5)}`; }

// ─── Firestore ────────────────────────────────────────────────────────────────
const fsRef = (mid, date) => doc(db, "coachBlocks", `${mid}_${date}`);
async function loadBlocks(mid, date) {
  try {
    const s = await getDoc(fsRef(mid, date));
    return s.exists() ? s.data()?.blocks || [] : [];
  } catch { return []; }
}
async function persistBlocks(mid, date, blocks) {
  try {
    await setDoc(fsRef(mid, date), { mid, date, blocks, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn("CoachDaySchedule:", e?.message); }
}

// ─── Dedupe assigned workouts — keeps _allIds for bulk updates ────────────────
function dedupeWorkouts(list) {
  const map = new Map();
  (list || []).forEach(w => {
    const key = `${String(w?.Sport||"").toLowerCase()}__${String(w?.Title||"")}`;
    if (!map.has(key)) {
      map.set(key, { ...w, _total: w.athleteCount || 0, _allIds: [w.id].filter(Boolean) });
    } else {
      const ex = map.get(key);
      ex._total += (w.athleteCount || 0);
      if (w.id && !ex._allIds.includes(w.id)) ex._allIds.push(w.id);
      if (!ex.ScheduledMinutes && w.ScheduledMinutes) {
        ex.ScheduledMinutes = w.ScheduledMinutes;
        ex.ScheduledTime    = w.ScheduledTime;
      }
    }
  });
  return Array.from(map.values());
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes cds-in    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes now-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  @keyframes cds-modal { from{opacity:0;transform:scale(.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
  .cds-row { animation: cds-in .2s cubic-bezier(.16,1,.3,1) both; }
  .cds-row:hover .cds-del { opacity:1!important; }
  .cds-inp:focus { border-color:${T.brand}!important; box-shadow:0 0 0 3px ${T.brand}18!important; outline:none; }
  .cds-assigned { transition:box-shadow .15s,background .15s; }
  .cds-assigned:hover { background:${T.brandBg}!important; box-shadow:0 2px 12px rgba(26,86,219,.1)!important; }
  .cds-unscheduled { transition:background .15s,border-color .15s; }
  .cds-unscheduled:hover { background:${T.brandBg}!important; border-color:${T.brandBdr}!important; }
  .cds-nav-btn:hover { background:${T.pageBg}!important; }
`;

// ─── Sport badge ──────────────────────────────────────────────────────────────
// Only renders if there's a real sport name — avoids "SPORT" fallback showing
function SportBadge({ sport, color }) {
  const label = titleSport(sport);
  if (!label) return null;
  return (
    <span style={{
      fontSize: 8, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase",
      color, background: `${color}14`, padding: "2px 6px", borderRadius: 4,
    }}>
      {label}
    </span>
  );
}

// ─── NOW card ─────────────────────────────────────────────────────────────────
function NowCard({ items, nowMin }) {
  const active = items.find(it =>
    nowMin >= it.startMinutes && nowMin < it.startMinutes + it.durationMinutes
  );
  const next = items.find(it => it.startMinutes > nowMin);

  if (!active && !next) return null;

  if (active) {
    const color   = active.type === "assigned" ? sportColor(active.sport) : (active.color || sportColor(active.sport));
    const elapsed = nowMin - active.startMinutes;
    const pct     = Math.min(elapsed / active.durationMinutes, 1);
    return (
      <div className="cds-row" style={{
        margin: "8px 12px 0",
        background: `${color}09`,
        border: `1.5px solid ${color}28`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: "11px 13px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: "now-pulse 1.8s ease-in-out infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color }}>
              Right now
            </span>
          </div>
          <span style={{ fontSize: 10, color: T.dim, fontVariantNumeric: "tabular-nums" }}>
            {fmtCountdown(active.durationMinutes - elapsed)} left
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.body, marginBottom: 7, letterSpacing: "-.01em" }}>
          {active.title}
        </div>
        <div style={{ height: 3, background: `${color}1C`, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct * 100}%`, background: color, borderRadius: 2, transition: "width 60s linear" }} />
        </div>
      </div>
    );
  }

  const minsOut = next.startMinutes - nowMin;
  if (minsOut > 120) return null;
  const color = next.type === "assigned" ? sportColor(next.sport) : (next.color || sportColor(next.sport));
  return (
    <div className="cds-row" style={{
      margin: "8px 12px 0",
      background: T.amberBg,
      border: `1.5px solid ${T.amberBdr}`,
      borderLeft: `4px solid ${T.amber}`,
      borderRadius: 10,
      padding: "11px 13px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color: T.amber }}>
          Up next
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.amberText, fontVariantNumeric: "tabular-nums" }}>
          in {fmtCountdown(minsOut)}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.body, letterSpacing: "-.01em" }}>
        {next.title}
      </div>
      <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
        {fmtTime(next.startMinutes)} · {fmtDur(next.durationMinutes)}
      </div>
    </div>
  );
}

// ─── Assigned row (clickable — opens ScheduleTimeModal) ───────────────────────
function AssignedRow({ item, onClick }) {
  const color = sportColor(item.sport);
  return (
    <div
      className="cds-row cds-assigned"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "stretch",
        background: T.card,
        border: `1px solid ${T.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      }}
    >
      {/* Time column */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-start",
        padding: "11px 10px 11px 0", minWidth: 56, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em" }}>
          {fmtTime(item.startMinutes)}
        </span>
        <span style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>
          {fmtDur(item.durationMinutes)}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "11px 12px", borderLeft: `1px solid ${color}1C` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <SportBadge sport={item.sport} color={color} />
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
            color: T.faint, background: T.pageBg, padding: "2px 6px", borderRadius: 4,
          }}>
            Assigned
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.body, letterSpacing: "-.01em", marginBottom: item.athleteCount ? 3 : 0 }}>
          {item.title}
        </div>
        {item.athleteCount > 0 && (
          <div style={{ fontSize: 10, color: T.dim }}>
            {item.athleteCount} athlete{item.athleteCount !== 1 ? "s" : ""}
            {item.itemCount > 0 && ` · ${item.itemCount} exercise${item.itemCount !== 1 ? "s" : ""}`}
          </div>
        )}
      </div>

      {/* Edit time indicator */}
      <div style={{
        display: "flex", alignItems: "center", paddingRight: 12,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: T.brand, fontWeight: 600, opacity: .6 }}>
          Edit ›
        </span>
      </div>
    </div>
  );
}

// ─── Personal row ─────────────────────────────────────────────────────────────
function PersonalRow({ item, isNow, onEdit, onDelete }) {
  const color = item.color || sportColor(item.sport);
  return (
    <div
      className="cds-row"
      onClick={() => onEdit(item.data)}
      style={{
        display: "flex", alignItems: "stretch",
        background: isNow ? `${color}08` : T.card,
        border: `1px solid ${isNow ? `${color}28` : T.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: isNow ? `0 2px 12px ${color}1C` : "0 1px 3px rgba(0,0,0,.04)",
        transition: "box-shadow .15s, background .15s",
      }}
    >
      {/* Time column */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-start",
        padding: "11px 10px 11px 0", minWidth: 56, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: isNow ? color : T.dim, fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em" }}>
          {fmtTime(item.startMinutes)}
        </span>
        <span style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>
          {fmtDur(item.durationMinutes)}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "11px 10px", borderLeft: `1px solid ${color}1C`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          {item.sport && item.sport !== "personal" && (
            <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color, marginBottom: 3 }}>
              {titleSport(item.sport)}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: T.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-.01em" }}>
            {item.title}
          </div>
          {item.notes && (
            <div style={{ fontSize: 10, color: T.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.notes}
            </div>
          )}
        </div>
        <button
          className="cds-del"
          onClick={e => { e.stopPropagation(); onDelete(item.id); }}
          style={{
            width: 22, height: 22, borderRadius: "50%", border: "none", flexShrink: 0,
            background: "rgba(220,38,38,.07)", color: "#DC2626",
            cursor: "pointer", fontSize: 15, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0, transition: "opacity .15s",
          }}
        >×</button>
      </div>
    </div>
  );
}

// ─── Gap row ──────────────────────────────────────────────────────────────────
function GapRow({ startMin, endMin, onAdd }) {
  const dur = endMin - startMin;
  if (dur < 20) return null;
  return (
    <button
      onClick={() => onAdd(startMin, dur)}
      style={{
        width: "100%", background: "none", border: "none", cursor: "pointer",
        padding: "3px 0", display: "flex", alignItems: "center", gap: 8,
      }}
    >
      <div style={{ flex: 1, height: 1, borderTop: `1px dashed ${T.border}` }} />
      <span style={{ fontSize: 9, fontWeight: 700, color: T.ghost, whiteSpace: "nowrap", letterSpacing: ".04em" }}>
        {fmtDur(dur)} free
      </span>
      <div style={{ flex: 1, height: 1, borderTop: `1px dashed ${T.border}` }} />
    </button>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ padding: "0 2px", marginBottom: 8, marginTop: 12 }}>
      <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase", color: T.faint }}>
        {children}
      </span>
    </div>
  );
}

// ─── Block form ───────────────────────────────────────────────────────────────
function BlockForm({ initial, allSports, onSave, onCancel }) {
  const [f, setF] = useState(() => initial ? {
    sport:           initial.sport || "personal",
    title:           initial.title || "",
    startH:          Math.floor((initial.startMinutes ?? 720) / 60),
    startM:          (initial.startMinutes ?? 720) % 60,
    durationMinutes: initial.durationMinutes || 60,
    notes:           initial.notes || "",
  } : { sport: "personal", title: "", startH: 12, startM: 0, durationMinutes: 60, notes: "" });

  const set   = (k, v) => setF(p => ({ ...p, [k]: v }));
  const color = sportColor(f.sport);

  const sports = useMemo(() => {
    const base = Array.isArray(allSports) ? allSports : [];
    return ["personal", ...base.filter(s => s !== "personal")].filter(Boolean);
  }, [allSports]);

  const inp = {
    width: "100%", padding: "8px 10px",
    border: `1.5px solid ${T.border}`, borderRadius: 7,
    fontSize: 13, color: T.body, background: T.bg,
    fontFamily: "inherit", boxSizing: "border-box",
  };

  const handleSave = () => {
    if (!f.title.trim()) return;
    onSave({
      sport: f.sport, title: f.title.trim(),
      startMinutes: f.startH * 60 + f.startM,
      durationMinutes: Number(f.durationMinutes) || 60,
      notes: f.notes.trim(), color: sportColor(f.sport),
    });
  };

  return (
    <div style={{ background: T.card, borderTop: `3px solid ${color}`, borderBottom: `1px solid ${T.border}`, padding: "14px" }}>
      {/* Sport pills */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {sports.map(s => {
          const c = sportColor(s), sel = f.sport === s;
          return (
            <button key={s} onClick={() => { set("sport", s); set("title", ""); }} style={{
              padding: "3px 10px", borderRadius: 20, cursor: "pointer",
              fontSize: 9, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase",
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

      {/* Suggestion chips */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {getSuggestions(f.sport).slice(0, 5).map(s => (
          <button key={s} onClick={() => set("title", s)} style={{
            padding: "3px 9px", borderRadius: 20, cursor: "pointer",
            fontSize: 10, fontWeight: 600, fontFamily: "inherit",
            background: f.title === s ? `${color}12` : T.pageBg,
            border: `1px solid ${f.title === s ? color : T.border}`,
            color: f.title === s ? color : T.dim,
            transition: "all .1s",
          }}>
            {s}
          </button>
        ))}
      </div>

      <input
        className="cds-inp"
        autoFocus
        value={f.title}
        onChange={e => set("title", e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="Activity name…"
        style={{ ...inp, fontWeight: 600, fontSize: 14, marginBottom: 10 }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.faint, marginBottom: 4 }}>Start</div>
          <div style={{ display: "flex", gap: 4 }}>
            <select value={f.startH} onChange={e => set("startH", Number(e.target.value))} style={{ ...inp, flex: 1, padding: "7px 4px" }}>
              {Array.from({ length: 19 }, (_, i) => i + 5).map(h => (
                <option key={h} value={h}>{h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h-12}pm`}</option>
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
              <option key={d} value={d}>{d<60?`${d}m`:d%60===0?`${d/60}h`:`${Math.floor(d/60)}h${d%60}m`}</option>
            ))}
          </select>
        </div>
      </div>

      <input
        className="cds-inp"
        value={f.notes}
        onChange={e => set("notes", e.target.value)}
        placeholder="Notes (optional)"
        style={{ ...inp, fontSize: 12, color: T.dim, marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 7 }}>
        <button onClick={handleSave} disabled={!f.title.trim()} style={{
          flex: 1, padding: "9px", borderRadius: 8, border: "none",
          background: f.title.trim() ? color : T.ghost,
          color: f.title.trim() ? "#fff" : T.faint,
          fontSize: 12, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase",
          cursor: f.title.trim() ? "pointer" : "not-allowed",
          fontFamily: "inherit", transition: "background .15s",
        }}>
          {initial?.id ? "Save" : "Add block"}
        </button>
        {initial?.id && (
          <button onClick={() => onCancel("delete")} style={{
            padding: "9px 12px", borderRadius: 8, cursor: "pointer",
            border: `1.5px solid rgba(220,38,38,.2)`, background: "transparent",
            color: "#DC2626", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          }}>
            Delete
          </button>
        )}
        <button onClick={() => onCancel()} style={{
          padding: "9px 12px", borderRadius: 8, cursor: "pointer",
          border: `1.5px solid ${T.border}`, background: "transparent",
          color: T.dim, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Schedule time modal ──────────────────────────────────────────────────────
// Used for BOTH unscheduled workouts and already-scheduled ones (edit mode)
function ScheduleTimeModal({ workout, onSave, onClose }) {
  const sport    = String(workout?.Sport || "").toLowerCase().trim();
  const color    = sportColor(sport);
  const isEdit   = workout.ScheduledMinutes != null;

  // Pre-fill with existing time if editing
  const [startH, setStartH] = useState(() =>
    isEdit ? Math.floor(workout.ScheduledMinutes / 60) : 9
  );
  const [startM, setStartM] = useState(() =>
    isEdit ? workout.ScheduledMinutes % 60 : 0
  );
  const [dur, setDur] = useState(workout.ScheduleDuration || workout._scheduledDur || 90);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const previewStart = startH * 60 + startM;

  const inp = {
    width: "100%", padding: "8px 10px",
    border: `1.5px solid ${T.border}`, borderRadius: 7,
    fontSize: 13, color: T.body, background: T.bg,
    fontFamily: "inherit", boxSizing: "border-box",
  };

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    const timeStr  = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    // Update ALL athlete records sharing this workout
    const allIds   = (workout._allIds?.length ? workout._allIds : [workout.id]).filter(Boolean);
    try {
      const results = await Promise.all(
        allIds.map(id =>
          fetch("/api/org/workouts/update-full", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, scheduledTime: timeStr, scheduledDuration: dur }),
          })
          .then(r => r.json().catch(() => ({})).then(data => ({ ok: r.ok, data, id })))
        )
      );
      const failed = results.find(r => !r.ok);
      if (failed) throw new Error(failed.data?.error || `Failed to save record ${failed.id}`);
      onSave({
        ...workout,
        ScheduledMinutes: previewStart,
        ScheduledTime:    timeStr,
        _scheduledDur:    dur,
      });
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setSaving(false);
    }
  };

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(12,26,46,.4)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: T.card, borderRadius: 14, width: "100%", maxWidth: 340,
        boxShadow: "0 24px 64px rgba(0,0,0,.16)",
        overflow: "hidden",
        borderTop: `4px solid ${color}`,
        animation: "cds-modal .22s cubic-bezier(.16,1,.3,1) both",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 18px 13px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SportBadge sport={sport} color={color} />
              <span style={{
                fontSize: 8, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
                color: T.faint, background: T.pageBg, padding: "2px 6px", borderRadius: 4,
              }}>
                Assigned
              </span>
            </div>
            <button onClick={onClose} style={{
              width: 24, height: 24, borderRadius: "50%", border: "none",
              background: T.pageBg, color: T.dim, cursor: "pointer", fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.body, letterSpacing: "-.02em", marginBottom: 3 }}>
            {workout.Title || "Workout"}
          </div>
          <div style={{ fontSize: 11, color: T.dim }}>
            {isEdit ? "Adjust the scheduled time" : "When does this workout take place?"}
          </div>
          {workout._total > 0 && (
            <div style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>
              {workout._total} athlete{workout._total !== 1 ? "s" : ""} assigned
            </div>
          )}
        </div>

        {/* Pickers */}
        <div style={{ padding: "16px 18px 18px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.faint, marginBottom: 5 }}>
                Start time
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <select
                  className="cds-inp"
                  value={startH}
                  onChange={e => setStartH(Number(e.target.value))}
                  style={{ ...inp, flex: 1, padding: "8px 4px" }}
                >
                  {Array.from({ length: 19 }, (_, i) => i + 5).map(h => (
                    <option key={h} value={h}>
                      {h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h-12}pm`}
                    </option>
                  ))}
                </select>
                <select
                  className="cds-inp"
                  value={startM}
                  onChange={e => setStartM(Number(e.target.value))}
                  style={{ ...inp, width: 60, padding: "8px 4px" }}
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.faint, marginBottom: 5 }}>
                Duration
              </div>
              <select
                className="cds-inp"
                value={dur}
                onChange={e => setDur(Number(e.target.value))}
                style={inp}
              >
                {[30,45,60,75,90,120,150,180].map(d => (
                  <option key={d} value={d}>
                    {d<60?`${d}m`:d%60===0?`${d/60}h`:`${Math.floor(d/60)}h${d%60}m`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live preview */}
          <div style={{
            background: `${color}09`,
            border: `1px solid ${color}20`,
            borderLeft: `3px solid ${color}`,
            borderRadius: 8,
            padding: "9px 12px",
            marginBottom: 14,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.body, fontVariantNumeric: "tabular-nums" }}>
                {fmtTime(previewStart)} – {fmtTime(previewStart + dur)}
              </div>
              <div style={{ fontSize: 10, color: T.dim, marginTop: 1 }}>
                {fmtDur(dur)} · {workout.Title}
              </div>
            </div>
            {isEdit && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: T.amber, flexShrink: 0 }}>
                Editing
              </span>
            )}
          </div>

          {err && (
            <div style={{ fontSize: 11, color: T.now, marginBottom: 10, padding: "7px 10px", background: T.nowBg, borderRadius: 6 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 1, padding: "10px", borderRadius: 8, border: "none",
              background: saving ? T.ghost : color,
              color: saving ? T.faint : "#fff",
              fontSize: 12, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "background .15s",
            }}>
              {saving ? "Saving…" : isEdit ? "Update time" : "Set time"}
            </button>
            <button onClick={onClose} style={{
              padding: "10px 14px", borderRadius: 8, cursor: "pointer",
              border: `1.5px solid ${T.border}`, background: "transparent",
              color: T.dim, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CoachDaySchedule({
  selectedDate, workoutsByDate = {}, memberId = "default", sports = [],
}) {
  const [blocks,         setBlocks]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [formSeg,        setFormSeg]        = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [localOverrides, setLocalOverrides] = useState({});
  const [nowMin,         setNowMin]         = useState(() => {
    const n = new Date(); return n.getHours() * 60 + n.getMinutes();
  });

  // Internal date — allows day navigation independently of prop
  const [currentDate, setCurrentDate] = useState(selectedDate);
  useEffect(() => { setCurrentDate(selectedDate); }, [selectedDate]);

  const dateStr  = currentDate || selectedDate;
  const todayISO = new Date().toISOString().slice(0, 10);
  const isToday  = dateStr === todayISO;

  // ── Load blocks ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!memberId || memberId === "default" || !dateStr || dateStr === "2000-01-01") {
      setBlocks([]); setLoading(false); return;
    }
    setLoading(true);
    setFormSeg(null);
    setScheduleTarget(null);
    loadBlocks(memberId, dateStr).then(setBlocks).finally(() => setLoading(false));
  }, [memberId, dateStr]);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Workouts ─────────────────────────────────────────────────────────────────
  const workouts        = useMemo(() => workoutsByDate?.[dateStr] || [], [workoutsByDate, dateStr]);
  const dedupedWorkouts = useMemo(() => dedupeWorkouts(workouts), [workouts]);

  const allSports = useMemo(() => {
    const fromW = workouts.map(w => String(w?.Sport || "").toLowerCase().trim()).filter(Boolean);
    const base  = Array.isArray(sports) ? sports : [];
    return [...new Set([...base, ...fromW])].filter(Boolean);
  }, [sports, workouts]);

  // ── Persist ──────────────────────────────────────────────────────────────────
  const persist = useCallback((next) => {
    const sorted = [...next].sort((a, b) => a.startMinutes - b.startMinutes);
    setBlocks(sorted);
    persistBlocks(memberId, dateStr, sorted);
  }, [memberId, dateStr]);

  // ── Agenda items ─────────────────────────────────────────────────────────────
  const scheduledWorkouts   = useMemo(() =>
    dedupedWorkouts.filter(w => w.ScheduledMinutes != null),
  [dedupedWorkouts]);

  const unscheduledWorkouts = useMemo(() =>
    dedupedWorkouts.filter(w => w.ScheduledMinutes == null),
  [dedupedWorkouts]);

  const agendaItems = useMemo(() => {
    const items = [];
    scheduledWorkouts.forEach(w => {
      const key      = w._allIds?.join(",") || w.id;
      const override = localOverrides[key];
      const scheduledMin = override?.ScheduledMinutes
        ?? w.ScheduledMinutes
        ?? parseTimeToMinutes(w.ScheduledTime);
      items.push({
        id:              w.id || `a_${w.Title}`,
        type:            "assigned",
        startMinutes:    scheduledMin,
        durationMinutes: override?._scheduledDur || w.ScheduleDuration || w._scheduledDur || 90,
        title:           w.Title || "Workout",
        sport:           String(w.Sport || "").toLowerCase().trim(),
        athleteCount:    w._total || 0,
        itemCount:       w.itemCount || 0,
        data:            w,
      });
    });
    blocks.forEach(b => items.push({
      id:              b.id,
      type:            "personal",
      startMinutes:    b.startMinutes,
      durationMinutes: b.durationMinutes || 60,
      title:           b.title,
      sport:           b.sport || "personal",
      notes:           b.notes,
      color:           b.color,
      data:            b,
    }));
    return items.sort((a, b) => a.startMinutes - b.startMinutes);
  }, [scheduledWorkouts, blocks, localOverrides]);

  const activeId = useMemo(() => {
    if (!isToday) return null;
    return agendaItems.find(it =>
      nowMin >= it.startMinutes && nowMin < it.startMinutes + it.durationMinutes
    )?.id ?? null;
  }, [agendaItems, nowMin, isToday]);

  const plannedMin = useMemo(() =>
    blocks.reduce((s, b) => s + (b.durationMinutes || 60), 0),
  [blocks]);

  // ── Form actions ─────────────────────────────────────────────────────────────
  const handleFormSave = useCallback((data) => {
    if (formSeg?.id) {
      persist(blocks.map(b => b.id === formSeg.id ? { ...b, ...data } : b));
    } else {
      persist([...blocks, { id: makeId(), ...data }]);
    }
    setFormSeg(null);
  }, [formSeg, blocks, persist]);

  const handleFormCancel = useCallback((action) => {
    if (action === "delete" && formSeg?.id) persist(blocks.filter(b => b.id !== formSeg.id));
    setFormSeg(null);
  }, [formSeg, blocks, persist]);

  const handleGapAdd = useCallback((startMin, dur) => {
    setFormSeg({ startMinutes: startMin, durationMinutes: Math.min(dur, 60) });
  }, []);

  const handleScheduleSave = useCallback((updated) => {
  const key = updated._allIds?.join(",") || updated.id;
  setLocalOverrides(prev => ({
    ...prev,
    [key]: {
      ScheduledMinutes: updated.ScheduledMinutes,
      ScheduledTime:    updated.ScheduledTime,
      _scheduledDur:    updated._scheduledDur,
    },
  }));
  setScheduleTarget(null);
}, []);

  // ── Day navigation ────────────────────────────────────────────────────────────
  const goDay = useCallback((offset) => {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + offset);
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setCurrentDate(`${y}-${m}-${day}`);
  }, [dateStr]);

  // ── Header labels ─────────────────────────────────────────────────────────────
  const dateObj   = dateStr && dateStr !== "2000-01-01" ? new Date(`${dateStr}T12:00:00`) : null;
  const dayName   = dateObj?.toLocaleDateString("en-US", { weekday: "long" }) || "";
  const dateLabel = dateObj?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) || "—";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100%", height: "100%",
      background: T.pageBg,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      borderLeft: `1px solid ${T.border}`,
    }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div style={{
        background: T.card,
        borderBottom: `1px solid ${T.border}`,
        padding: "12px 14px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="cds-nav-btn" onClick={() => goDay(-1)} style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.border}`,
            background: "transparent", cursor: "pointer", color: T.dim, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background .12s",
          }}>←</button>

          <button className="cds-nav-btn" onClick={() => goDay(1)} style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.border}`,
            background: "transparent", cursor: "pointer", color: T.dim, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background .12s",
          }}>→</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: T.faint, lineHeight: 1, marginBottom: 2 }}>
              {isToday ? "Today · " : ""}{dayName}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1.1, color: isToday ? T.safe : T.body }}>
              {dateLabel}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {plannedMin > 0 && (
              <div style={{
                fontSize: 10, fontWeight: 700, color: T.dim,
                background: T.pageBg, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "3px 8px",
                fontVariantNumeric: "tabular-nums",
              }}>
                {plannedMin >= 60
                  ? `${Math.floor(plannedMin/60)}h${plannedMin%60>0?` ${plannedMin%60}m`:""}`
                  : `${plannedMin}m`}
              </div>
            )}
            {!isToday && (
              <button onClick={() => setCurrentDate(todayISO)} style={{
                padding: "5px 9px", borderRadius: 7,
                border: `1px solid ${T.brandBdr}`, background: T.brandBg,
                color: T.brand, fontSize: 10, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                Today
              </button>
            )}
            {!formSeg && (
              <button onClick={() => setFormSeg({ startMinutes: isToday ? snapMin(nowMin) : 9*60, durationMinutes: 60 })} style={{
                background: T.brand, border: "none", borderRadius: 7,
                padding: "6px 12px", cursor: "pointer",
                fontSize: 11, fontWeight: 800, color: "#fff",
                letterSpacing: ".05em", textTransform: "uppercase",
                fontFamily: "inherit",
              }}>
                + Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Form ── */}
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

      {/* ── NOW card ── */}
      {isToday && agendaItems.length > 0 && !formSeg && (
        <NowCard items={agendaItems} nowMin={nowMin} />
      )}

      {/* ── Agenda ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 12px 28px" }}>

        {loading && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.faint }}>Loading…</div>
          </div>
        )}

        {!loading && agendaItems.length === 0 && unscheduledWorkouts.length === 0 && (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: .15 }}>◷</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ghost, marginBottom: 4 }}>
              Day is open
            </div>
            <div style={{ fontSize: 11, color: T.ghost }}>
              Tap + Add to block out time
            </div>
          </div>
        )}

        {/* Scheduled agenda */}
        {!loading && agendaItems.length > 0 && (
          <>
            <SectionLabel>Schedule</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {agendaItems.map((item, idx) => {
                const prev      = agendaItems[idx - 1];
                const gapStart  = prev ? prev.startMinutes + prev.durationMinutes : null;
                const gapEnd    = item.startMinutes;
                const showGap   = gapStart != null && gapEnd - gapStart > 20;

                return (
                  <div key={item.id}>
                    {showGap && (
                      <GapRow startMin={gapStart} endMin={gapEnd} onAdd={handleGapAdd} />
                    )}
                    {item.type === "assigned" ? (
                      <AssignedRow
                        item={item}
                        onClick={() => setScheduleTarget(item.data)}
                      />
                    ) : (
                      <PersonalRow
                        item={item}
                        isNow={activeId === item.id}
                        onEdit={seg => setFormSeg(seg)}
                        onDelete={id => persist(blocks.filter(b => b.id !== id))}
                      />
                    )}
                  </div>
                );
              })}

              {/* Trailing gap */}
              {(() => {
                const last = agendaItems[agendaItems.length - 1];
                const endM = last.startMinutes + last.durationMinutes;
                if (endM < 22 * 60) {
                  return <GapRow startMin={endM} endMin={22 * 60} onAdd={handleGapAdd} />;
                }
                return null;
              })()}
            </div>
          </>
        )}

        {/* Unscheduled assigned workouts */}
        {!loading && unscheduledWorkouts.length > 0 && (
          <>
            <SectionLabel>Unscheduled</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {unscheduledWorkouts.map((w, i) => {
                const sport = String(w?.Sport || "").toLowerCase().trim();
                const color = sportColor(sport);
                return (
                  <div
                    key={w.id || i}
                    className="cds-row cds-unscheduled"
                    onClick={() => setScheduleTarget(w)}
                    style={{
                      background: T.card,
                      border: `1px solid ${T.border}`,
                      borderLeft: `4px solid ${color}`,
                      borderRadius: 10,
                      padding: "11px 13px",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <SportBadge sport={sport} color={color} />
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
                        color: T.brand, background: T.brandBg, padding: "2px 6px", borderRadius: 4,
                        border: `1px solid ${T.brandBdr}`,
                      }}>
                        Tap to schedule
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.body, letterSpacing: "-.01em" }}>
                          {w.Title || "Workout"}
                        </div>
                        {w._total > 0 && (
                          <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
                            {w._total} athlete{w._total !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 18, color: T.brand, opacity: .4, flexShrink: 0, fontWeight: 300 }}>+</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Schedule time modal ── */}
      {scheduleTarget && (
        <ScheduleTimeModal
          workout={scheduleTarget}
          onSave={handleScheduleSave}
          onClose={() => setScheduleTarget(null)}
        />
      )}
    </div>
  );
}