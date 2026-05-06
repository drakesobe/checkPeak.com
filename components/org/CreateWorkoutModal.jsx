// components/org/CreateWorkoutDrawer.jsx
// Three-step workout creation drawer with template support.
// Step 1: WHO (athlete picker, sport detection)
// Step 2: WHEN + WHAT (date, title, recurrence)
// Step 3: THE WORK (template picker + exercise builder)
// VARA-gated footer: hard break periods replace the Create button entirely.
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  X, Plus, Dumbbell, AlertTriangle, Trash2,
  Repeat, Link as LinkIcon, Search, CheckCircle2,
  Info, Edit2, Users, Shield,
  Calendar, ArrowLeft, ArrowRight,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { loadPeriods, getActivePeriod, getVaraRequirement } from "@/lib/org/seasonCalendar";
import TemplatePicker from "@/components/org/workoutsCalendar/TemplatePicker";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function safeJson(r) { try { return await r.json(); } catch { return {}; } }
function normalizeEmail(e)  { return String(e || "").trim().toLowerCase(); }
function normalizeSport(v)  { return String(v || "").trim().toLowerCase(); }
function getAthleteSport(a) { return a?.sport || a?.Sport || a?.team || a?.Team || a?.primarySport || a?.PrimarySport || ""; }
function getAthleteToken(a) { return String(a?.AthleteToken || a?.athleteToken || a?.Token || "").trim(); }
function toNum(v)           { if (v === "" || v == null) return ""; const n = Number(v); return Number.isFinite(n) ? n : ""; }
function sanitizeUrl(u)     {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+\.[\w.-]+/.test(s)) return `https://${s}`;
  return s;
}
function initials(name) {
  const p = String(name || "?").trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : String(name||"?")[0].toUpperCase();
}
function newItem(order) {
  return { Order: order, ExerciseName: "", Sets: "", Reps: "", Weight: "", Rest: "", Instructions: "", VideoURL: "", EvidenceRequired: "none" };
}
function renumber(list) { return list.map((it,i) => ({ ...it, Order: i+1 })); }
function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso+"T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtShort(iso) {
  if (!iso) return "-";
  return new Date(iso+"T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MAX_DATES   = 60;
const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const SPORT_OPTIONS = ["soccer","basketball","xc","football","track","swim","tennis","hockey","baseball","softball","wrestling"];

const CATEGORIES = [
  { value: "strength",     label: "Strength"     },
  { value: "conditioning", label: "Conditioning" },
  { value: "speed",        label: "Speed"        },
  { value: "mobility",     label: "Mobility"     },
  { value: "recovery",     label: "Recovery"     },
];

const SPORT_HUE = {
  football:214, soccer:142, basketball:25, xc:270, track:0,
  swim:195, tennis:85, hockey:220, baseball:35, softball:340, wrestling:10,
};
function avatarStyle(sport) {
  const h = SPORT_HUE[sport] || 214;
  return { background: `hsl(${h},55%,32%)`, color: "#fff" };
}

const EVIDENCE_OPTIONS = [
  { value: "none",                    label: "None"                     },
  { value: "photo",                   label: "Photo"                    },
  { value: "video",                   label: "Video"                    },
  { value: "photo_or_video",          label: "Photo or Video"           },
  { value: "voluntary_activity_vara", label: "Voluntary Activity (VARA)"},
];
const VALID_EV = new Set(EVIDENCE_OPTIONS.map(o => o.value));

function buildDates({ mode, baseDate, daysOfWeek, endDate, everyNDays, occurrences }) {
  if (!baseDate) return [];
  const dates = new Set([baseDate]);
  if (mode === "daysOfWeek" && endDate && daysOfWeek.length) {
    const end = new Date(endDate+"T12:00:00"), cur = new Date(baseDate+"T12:00:00");
    let s = 0;
    while (cur <= end && dates.size < MAX_DATES && s++ < 500) {
      if (daysOfWeek.includes(cur.getDay())) dates.add(cur.toISOString().slice(0,10));
      cur.setDate(cur.getDate()+1);
    }
  }
  if (mode === "everyNDays" && everyNDays >= 1 && occurrences >= 1) {
    const cur = new Date(baseDate+"T12:00:00");
    for (let i=0; i<Math.min(occurrences,MAX_DATES) && dates.size<MAX_DATES; i++) {
      dates.add(cur.toISOString().slice(0,10));
      cur.setDate(cur.getDate()+everyNDays);
    }
  }
  return Array.from(dates).sort();
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const F  = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };
const inp = {
  width:"100%", padding:"10px 14px", fontSize:"13px",
  border:`1px solid ${DS.border}`, backgroundColor:DS.cardBg,
  color:DS.bodyText, outline:"none", fontFamily:F.body,
};
const lbl = {
  display:"block", fontFamily:F.cond, fontSize:"10px", fontWeight:900,
  textTransform:"uppercase", letterSpacing:"0.12em",
  color:DS.labelText, marginBottom:"5px",
};

const VARA_CFG = {
  hard: { bg:"rgba(217,43,58,0.05)", border:"rgba(217,43,58,0.25)", accent:"#D92B3A", barBg:"rgba(217,43,58,0.10)", icon:"🚫", label:"VARA Required - Break Period", sublabel:"Coach-directed workouts are NOT permitted.", btnLabel:"Create as Voluntary Activity (VARA)" },
  soft: { bg:"rgba(196,122,0,0.04)", border:"rgba(196,122,0,0.22)", accent:"#C47A00", barBg:"rgba(196,122,0,0.09)", icon:"⚠️", label:"Out of Season - VARA Preferred",    sublabel:"Consider marking items as Voluntary Activity.", btnLabel:"Create Workout" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ n, status }) {
  const done   = status === "done";
  const active = status === "active";
  return (
    <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F.cond, fontWeight:900, fontSize:12, background:done?DS.safe:active?DS.brand:"transparent", border:done?`2px solid ${DS.safe}`:active?`2px solid ${DS.brand}`:`2px solid ${DS.border}`, color:done||active?"#fff":DS.dimText, transition:"all 0.2s", flexShrink:0 }}>
      {done ? "✓" : n}
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, padding:"16px 20px 0" }}>
      {["WHO","WHEN","WORK"].map((label, i) => {
        const n = i+1;
        const status = step>n ? "done" : step===n ? "active" : "upcoming";
        return (
          <div key={n} style={{ display:"flex", alignItems:"center", flex:i<2?1:"none" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <StepDot n={n} status={status} />
              <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:status==="active"?DS.brand:status==="done"?DS.safe:DS.dimText, transition:"color 0.2s" }}>
                {label}
              </span>
            </div>
            {i<2 && <div style={{ flex:1, height:2, marginBottom:18, marginLeft:6, marginRight:6, background:step>n+1?DS.safe:step>n?`linear-gradient(to right, ${DS.safe}, ${DS.border})`:DS.border, transition:"background 0.3s" }} />}
          </div>
        );
      })}
    </div>
  );
}

function ComplianceBar({ varaLevel, periodName, date, derivedSport }) {
  if (!date) return (
    <div style={{ padding:"8px 20px", background:DS.pageBg, borderBottom:`1px solid ${DS.border}`, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:DS.border }} />
      <span style={{ fontFamily:F.body, fontSize:11, color:DS.dimText }}>Select athletes to check compliance</span>
    </div>
  );
  if (!varaLevel) return (
    <div style={{ padding:"8px 20px", background:"rgba(10,138,74,0.06)", borderBottom:`1px solid rgba(10,138,74,0.18)`, display:"flex", alignItems:"center", gap:8 }}>
      <Shield style={{ width:12, height:12, color:DS.safe, flexShrink:0 }} />
      <span style={{ fontFamily:F.body, fontSize:11, color:DS.safe, fontWeight:700 }}>
        Clear - {fmtDate(date)}{derivedSport ? ` · ${derivedSport}` : ""} is unrestricted.
      </span>
    </div>
  );
  const cfg = VARA_CFG[varaLevel];
  return (
    <div style={{ padding:"9px 20px", background:cfg.barBg, borderBottom:`1px solid ${cfg.border}`, display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ fontSize:13, flexShrink:0 }}>{cfg.icon}</span>
      <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:cfg.accent }}>
        {cfg.label}{periodName ? ` · ${periodName}` : ""}
      </span>
    </div>
  );
}

function AthleteRow({ athlete, checked, onToggle }) {
  const sport = normalizeSport(getAthleteSport(athlete));
  const name  = athlete?.name || athlete?.Name || "Athlete";
  const email = normalizeEmail(athlete?.email || athlete?.Email);
  return (
    <label style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 20px", background:checked?"rgba(0,112,204,0.06)":"transparent", borderBottom:`1px solid ${DS.border}`, cursor:"pointer", transition:"background 0.12s" }}
      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = DS.pageBg; }}
      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}>
      <div onClick={onToggle} style={{ width:18, height:18, borderRadius:3, flexShrink:0, border:`2px solid ${checked?DS.brand:DS.border}`, background:checked?DS.brand:"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s" }}>
        {checked && <span style={{ color:"#fff", fontSize:11, lineHeight:1 }}>✓</span>}
      </div>
      <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F.cond, fontWeight:900, fontSize:12, ...avatarStyle(sport) }}>
        {initials(name)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontFamily:F.body, fontWeight:700, fontSize:13, color:DS.bodyText, margin:"0 0 2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</p>
        <p style={{ fontFamily:F.body, fontSize:11, color:DS.dimText, margin:0 }}>{email||"-"}</p>
      </div>
      {sport && (
        <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 7px", background:`hsl(${SPORT_HUE[sport]||214},55%,92%)`, color:`hsl(${SPORT_HUE[sport]||214},55%,28%)`, borderRadius:2, flexShrink:0 }}>
          {sport}
        </span>
      )}
    </label>
  );
}

function ExerciseRow({ item, index, onChange, onRemove }) {
  return (
    <div style={{ border:`1px solid ${DS.border}`, background:DS.pageBg, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", background:DS.cardBg, borderBottom:`1px solid ${DS.border}` }}>
        <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:DS.labelText }}>Exercise {index+1}</span>
        <button type="button" onClick={onRemove}
          style={{ padding:"3px 6px", border:`1px solid transparent`, background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontFamily:F.cond, fontSize:9, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.dimText }}
          onMouseEnter={e => { e.currentTarget.style.background=DS.bannedBg; e.currentTarget.style.borderColor=DS.bannedBorder; e.currentTarget.style.color=DS.banned; }}
          onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color=DS.dimText; }}>
          <Trash2 style={{ width:10, height:10 }} /> Remove
        </button>
      </div>
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <span style={lbl}>Exercise</span>
          <input value={item.ExerciseName} onChange={e => onChange({ ExerciseName:e.target.value })}
            placeholder="e.g. Trap Bar Deadlift" style={inp}
            onFocus={e => { e.currentTarget.style.borderColor=DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor=DS.border; }} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[["Sets","Sets","3",true],["Reps","Reps","8–10",false],["Weight","Weight","225lb",false],["Rest","Rest","90s",false]].map(([label,key,ph,num]) => (
            <div key={key}>
              <span style={lbl}>{label}</span>
              <input value={num?toNum(item[key]):(item[key]||"")} onChange={e => onChange({ [key]:num?toNum(e.target.value):e.target.value })}
                placeholder={ph} style={{ ...inp, padding:"8px 10px" }}
                onFocus={e => { e.currentTarget.style.borderColor=DS.brand; }}
                onBlur={e  => { e.currentTarget.style.borderColor=DS.border; }} />
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div>
            <span style={lbl}>Evidence</span>
            <select value={item.EvidenceRequired} onChange={e => onChange({ EvidenceRequired:e.target.value })}
              style={{ ...inp, cursor:"pointer", appearance:"none" }}
              onFocus={e => { e.currentTarget.style.borderColor=DS.brand; }}
              onBlur={e  => { e.currentTarget.style.borderColor=DS.border; }}>
              {EVIDENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Video URL</span>
            <div style={{ position:"relative" }}>
              <LinkIcon style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", width:12, height:12, color:DS.dimText, pointerEvents:"none" }} />
              <input value={item.VideoURL} onChange={e => onChange({ VideoURL:e.target.value })}
                placeholder="https://..." style={{ ...inp, paddingLeft:30 }}
                onFocus={e => { e.currentTarget.style.borderColor=DS.brand; }}
                onBlur={e  => { e.currentTarget.style.borderColor=DS.border; }} />
            </div>
          </div>
        </div>
        {item.EvidenceRequired === "voluntary_activity_vara" && (
          <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"8px 12px", background:DS.cautionBg, border:`1px solid ${DS.cautionBorder}`, borderLeft:`3px solid ${DS.caution}` }}>
            <Info style={{ width:12, height:12, color:DS.caution, flexShrink:0, marginTop:2 }} />
            <p style={{ fontFamily:F.body, fontSize:11, color:DS.caution, margin:0, fontWeight:700, lineHeight:1.5 }}>VARA - athlete self-reports only. No coach tracking.</p>
          </div>
        )}
        <div>
          <span style={lbl}>Instructions</span>
          <textarea value={item.Instructions} onChange={e => onChange({ Instructions:e.target.value })}
            placeholder="Coaching cues, tempo, technique notes..."
            style={{ ...inp, minHeight:64, resize:"vertical" }}
            onFocus={e => { e.currentTarget.style.borderColor=DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor=DS.border; }} />
        </div>
      </div>
    </div>
  );
}

function ComplianceDateBanner({ varaCheck, activeDate, derivedSport }) {
  if (!activeDate || !derivedSport) return null;

  if (!varaCheck) {
    return (
      <div style={{
        padding: "9px 16px",
        background: "rgba(10,138,74,0.06)",
        border: "1px solid rgba(10,138,74,0.2)",
        borderLeft: "3px solid #0A8A4A",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>✓</span>
        <div>
          <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A8A4A", margin: "0 0 2px" }}>
            Active Season — CARA Permitted
          </p>
          <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: 0 }}>
            {fmtDate(activeDate)}{derivedSport ? ` · ${derivedSport}` : ""}. Coach-directed activities allowed. Set evidence per item.
          </p>
        </div>
      </div>
    );
  }

  if (varaCheck.level === "soft") {
    const period = varaCheck.period;
    return (
      <div style={{
        padding: "9px 16px",
        background: "rgba(196,122,0,0.06)",
        border: "1px solid rgba(196,122,0,0.22)",
        borderLeft: "3px solid #C47A00",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
        <div>
          <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C47A00", margin: "0 0 2px" }}>
            {period?.name || "Out of Season"} — VARA Strongly Preferred
          </p>
          <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: 0 }}>
            Out-of-season period. CARA is limited to 8 hrs/week. Consider setting evidence to{" "}
            <strong style={{ color: "#C47A00" }}>Voluntary Activity (VARA)</strong>{" "}
            — athlete-initiated, no coach presence, does not count toward CARA limits.
          </p>
        </div>
      </div>
    );
  }

  // Hard — break period
  const period = varaCheck.period;
  return (
    <div style={{
      padding: "9px 16px",
      background: "rgba(217,43,58,0.06)",
      border: "1px solid rgba(217,43,58,0.25)",
      borderLeft: "3px solid #D92B3A",
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>🚫</span>
      <div>
        <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#D92B3A", margin: "0 0 2px" }}>
          {period?.name || "Break Period"} — VARA Required
        </p>
        <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: 0 }}>
          No coach-directed activities permitted during this period. All evidence must be set to{" "}
          <strong style={{ color: "#D92B3A" }}>Voluntary Activity (VARA)</strong>{" "}
          — athlete-initiated only, no coach presence, no attendance recorded.
        </p>
      </div>
    </div>
  );
}

function SaveAsTemplateButton({ items, derivedSport, onSaved }) {
  const [mode,        setMode]     = useState("idle"); // idle | form | saving | saved
  const [name,        setName]     = useState("");
  const [category,    setCategory] = useState("strength");
  const [sport,       setSport]    = useState(derivedSport || "");
  const [err,         setErr]      = useState("");

  const meaningfulItems = items.filter(it => String(it?.ExerciseName || "").trim());

  const handleSave = async () => {
    if (!name.trim()) return setErr("Name required.");
    setMode("saving"); setErr("");
    try {
      const res  = await fetch("/api/org/templates/save", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: {
            name: name.trim(), category, sport,
            exercises: meaningfulItems,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      onSaved?.(data.template);
      setMode("saved");
      setTimeout(() => { setMode("idle"); setName(""); }, 2500);
    } catch (e) {
      setErr(e?.message || "Save failed.");
      setMode("form");
    }
  };

  if (mode === "saved") {
    return (
      <span style={{
        fontFamily: F.cond, fontWeight: 900, fontSize: 11,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: DS.safe, display: "flex", alignItems: "center", gap: 5,
      }}>
        ✓ Saved as template
      </span>
    );
  }

  if (mode === "idle") {
    return (
      <button type="button"
        onClick={() => { setMode("form"); setSport(derivedSport || ""); }}
        disabled={meaningfulItems.length === 0}
        style={{
          padding: "9px 16px",
          border: `1px solid ${DS.border}`,
          background: "transparent",
          fontFamily: F.cond, fontWeight: 900, fontSize: 11,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: meaningfulItems.length ? DS.brand : DS.dimText,
          cursor: meaningfulItems.length ? "pointer" : "not-allowed",
          opacity: meaningfulItems.length ? 1 : 0.4,
        }}
        onMouseEnter={e => { if (meaningfulItems.length) { e.currentTarget.style.background = DS.brandBg; e.currentTarget.style.borderColor = DS.brandBorder; }}}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = DS.border; }}>
        Save as template
      </button>
    );
  }

  // form mode (and saving mode)
  return (
    <div style={{
      position: "absolute", bottom: "100%", right: 20,
      width: 300,
      background: DS.cardBg,
      border: `1px solid ${DS.border}`,
      borderTop: `2px solid ${DS.brand}`,
      padding: "14px",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <p style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.brand, margin: 0 }}>
        Save as Template
      </p>
      {err && (
        <p style={{ fontFamily: F.body, fontSize: 11, color: DS.banned, margin: 0 }}>⚠ {err}</p>
      )}
      <div>
        <span style={lbl}>Name *</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Upper Body Strength A"
          autoFocus
          style={{ ...inp, padding: "8px 12px" }}
          onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
          onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setMode("idle"); }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <span style={lbl}>Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ ...inp, padding: "8px 10px", cursor: "pointer", appearance: "none" }}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Sport</span>
          <select value={sport} onChange={e => setSport(e.target.value)}
            style={{ ...inp, padding: "8px 10px", cursor: "pointer", appearance: "none" }}
            onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }}>
            <option value="">All sports</option>
            {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, margin: 0 }}>
        {meaningfulItems.length} exercise{meaningfulItems.length !== 1 ? "s" : ""} will be saved.
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={handleSave} disabled={mode === "saving"}
          style={{ flex: 1, padding: "8px", background: DS.brand, border: "none", fontFamily: F.cond, fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", cursor: mode === "saving" ? "not-allowed" : "pointer", opacity: mode === "saving" ? 0.6 : 1 }}>
          {mode === "saving" ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={() => setMode("idle")}
          style={{ padding: "8px 14px", border: `1px solid ${DS.border}`, background: "transparent", fontFamily: F.cond, fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.dimText, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CreateWorkoutDrawer({
  open, onClose, dateISO, sport,
  onCreated, onUpdated, editWorkout,
  periods: periodsProp,
}) {
  const isEdit = Boolean(editWorkout?.id);

  const [step,            setStep]            = useState(1);
  const [athletes,        setAthletes]        = useState([]);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [selected,        setSelected]        = useState({});
  const [search,          setSearch]          = useState("");
  const [sportFilter,     setSportFilter]     = useState("all");
  const [title,           setTitle]           = useState("");
  const [editDate,        setEditDate]        = useState("");
  const [createDate,      setCreateDate]      = useState("");
  const [editSport,       setEditSport]       = useState("");
  const [status,          setStatus]          = useState("assigned");
  const [items,           setItems]           = useState([newItem(1)]);
  const [saving,          setSaving]          = useState(false);
  const [err,             setErr]             = useState("");
  const [okMsg,           setOkMsg]           = useState("");
  const [showItems,       setShowItems]       = useState(false);
  const [repeatOn,        setRepeatOn]        = useState(false);
  const [repeatMode,      setRepeatMode]      = useState("daysOfWeek");
  const [repeatDays,      setRepeatDays]      = useState([]);
  const [repeatEnd,       setRepeatEnd]       = useState("");
  const [everyN,          setEveryN]          = useState(7);
  const [occurrences,     setOccurrences]     = useState(8);

  // Template state
  const [templates,        setTemplates]        = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [appliedTemplateId,setAppliedTemplateId]= useState(null);

  const activeDate  = isEdit ? editDate : createDate;
  const activeSport = isEdit ? editSport : sport;

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedTokens = useMemo(() =>
    Object.entries(selected).filter(([,v])=>!!v).map(([k])=>k), [selected]);
  const selectedCount = selectedTokens.length;

  const derivedSport = useMemo(() => {
    if (activeSport) return normalizeSport(activeSport);
    const sports = selectedTokens
      .map(t => { const a = athletes.find(a=>getAthleteToken(a)===t); return a?normalizeSport(getAthleteSport(a)):null; })
      .filter(Boolean);
    const u = [...new Set(sports)];
    return u.length===1 ? u[0] : "";
  }, [selectedTokens, athletes, activeSport]);

  const computedDates = useMemo(() => {
    if (isEdit||!activeDate) return activeDate?[activeDate]:[];
    if (!repeatOn) return [activeDate];
    return buildDates({ mode:repeatMode, baseDate:activeDate, daysOfWeek:repeatDays, endDate:repeatEnd, everyNDays:everyN, occurrences });
  }, [isEdit, repeatOn, activeDate, repeatMode, repeatDays, repeatEnd, everyN, occurrences]);

  const sportsAvailable = useMemo(() => {
    const set = new Set();
    athletes.forEach(a => { const s=normalizeSport(getAthleteSport(a)); if (s&&SPORT_OPTIONS.includes(s)) set.add(s); });
    return Array.from(set).sort();
  }, [athletes]);

  const sportCount = useMemo(() => {
    const m = {};
    athletes.forEach(a => { const s=normalizeSport(getAthleteSport(a)); if (s&&SPORT_OPTIONS.includes(s)) m[s]=(m[s]||0)+1; });
    return m;
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes.filter(a => {
      const token = getAthleteToken(a);
      if (!token) return false;
      if (sportFilter!=="all" && normalizeSport(getAthleteSport(a))!==sportFilter) return false;
      if (q) { const n=String(a?.name||a?.Name||"").toLowerCase(), e=normalizeEmail(a?.email||a?.Email); if (!n.includes(q)&&!e.includes(q)) return false; }
      return true;
    });
  }, [athletes, search, sportFilter]);

  const varaCheck = useMemo(() => {
    const date = isEdit ? editDate : activeDate;
    if (!date || !derivedSport) return null;
    const all = Array.isArray(periodsProp)&&periodsProp.length ? periodsProp : loadPeriods();
    const applicable = all.filter(p => !Array.isArray(p.sports)||p.sports.length===0||!derivedSport||p.sports.includes(derivedSport));
    const period = getActivePeriod(date, applicable);
    const level  = getVaraRequirement(period);
    return level ? { level, period } : null;
  }, [isEdit, editDate, dateISO, periodsProp, derivedSport]);

  const hasNonVara  = useMemo(() => items.some(it=>String(it?.EvidenceRequired||"none")!=="voluntary_activity_vara"), [items]);
  const isVaraHard  = varaCheck?.level === "hard";
  const isVaraSoft  = varaCheck?.level === "soft";
  const showVaraWarn= varaCheck !== null && hasNonVara;
  const varaDate    = isEdit ? editDate : dateISO;

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchAthletes = useCallback(async () => {
    setLoadingAthletes(true);
    try {
      const res  = await fetch("/api/org/getAthletes", { credentials:"include" });
      const data = await safeJson(res);
      setAthletes(Array.isArray(data?.athletes) ? data.athletes : []);
    } catch { setAthletes([]); }
    finally { setLoadingAthletes(false); }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res  = await fetch("/api/org/templates/list", { credentials:"include" });
      const data = await safeJson(res);
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch { setTemplates([]); }
    finally { setLoadingTemplates(false); }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1); setErr(""); setOkMsg(""); setAppliedTemplateId(null);
    if (isEdit) {
      setTitle(editWorkout.title||"");
      setEditDate(String(editWorkout.dateISO||"").slice(0,10));
      setEditSport(editWorkout.sport||"");
      setStatus(editWorkout.status||"assigned");
      const raw = Array.isArray(editWorkout.items)&&editWorkout.items.length ? editWorkout.items : [newItem(1)];
      setItems(raw.map((it,i) => ({ Order:Number(it?.Order??i+1), ExerciseName:String(it?.ExerciseName||""), Sets:toNum(it?.Sets), Reps:String(it?.Reps||""), Weight:String(it?.Weight||""), Rest:String(it?.Rest||""), Instructions:String(it?.Instructions||""), VideoURL:String(it?.VideoURL||""), EvidenceRequired:String(it?.EvidenceRequired||"none") })));
      setShowItems(true);
      const incoming = Array.isArray(editWorkout.athleteIds) ? editWorkout.athleteIds : [];
      if (incoming.length) { const sel={}; incoming.forEach(t=>{ if(t) sel[String(t)]=true; }); setSelected(sel); } else setSelected({});
    } else {
      setTitle(""); setStatus("assigned"); setSelected({});
      setSearch(""); setSportFilter("all");
      setItems([newItem(1)]); setShowItems(false);
      setEditDate(""); setEditSport("");
      setCreateDate(dateISO || "");
      setRepeatOn(false); setRepeatMode("daysOfWeek");
      setRepeatDays([]); setRepeatEnd(""); setEveryN(7); setOccurrences(8);
    }
  }, [open, isEdit]);

  useEffect(() => { if (open) { fetchAthletes(); fetchTemplates(); } }, [open, fetchAthletes, fetchTemplates]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key==="Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow=prev; window.removeEventListener("keydown",onKey); };
  }, [open, onClose]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectAllShown = () => {
    const next = {};
    filteredAthletes.forEach(a => { const t=getAthleteToken(a); if(t) next[t]=true; });
    setSelected(prev => ({ ...prev, ...next }));
  };

  const setAllVara = useCallback(() => {
    setItems(prev => prev.map(it => ({ ...it, EvidenceRequired:"voluntary_activity_vara" })));
    setShowItems(true);
  }, []);

  // Apply template - fills exercise builder
  const applyTemplate = useCallback((template) => {
    const converted = Array.isArray(template.exercises)
      ? template.exercises.map((ex,i) => ({
          Order:           Number(ex?.Order ?? i+1),
          ExerciseName:    String(ex?.ExerciseName || ""),
          Sets:            toNum(ex?.Sets),
          Reps:            String(ex?.Reps    || ""),
          Weight:          String(ex?.Weight  || ""),
          Rest:            String(ex?.Rest    || ""),
          Instructions:    String(ex?.Instructions || ""),
          VideoURL:        String(ex?.VideoURL || ""),
          EvidenceRequired:String(ex?.EvidenceRequired || "none"),
        }))
      : [newItem(1)];
    setItems(converted.length ? converted : [newItem(1)]);
    setAppliedTemplateId(template.id);
    setShowItems(true);
  }, []);

  const handleTemplateDeleted = useCallback((id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (appliedTemplateId === id) setAppliedTemplateId(null);
  }, [appliedTemplateId]);

  const handleTemplateSaved = useCallback((tmpl) => {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === tmpl.id);
      return idx >= 0 ? prev.map((t,i) => i===idx ? tmpl : t) : [...prev, tmpl];
    });
  }, []);

  const validateItems = () => {
    const meaningful = items.filter(it => String(it?.ExerciseName||"").trim());
    if (!meaningful.length) return { ok:true, items:[] };
    for (let i=0; i<meaningful.length; i++) {
      if (!VALID_EV.has(String(meaningful[i].EvidenceRequired||"none"))) return { ok:false, error:`Item ${i+1}: invalid evidence type.` };
    }
    return { ok:true, items:meaningful.map((it,i) => ({ Order:i+1, ExerciseName:String(it.ExerciseName).trim(), Sets:toNum(it.Sets)===""?null:Number(it.Sets), Reps:String(it.Reps||"").trim()||null, Weight:String(it.Weight||"").trim()||null, Rest:String(it.Rest||"").trim()||null, Instructions:String(it.Instructions||"").trim()||null, VideoURL:sanitizeUrl(it.VideoURL)||null, EvidenceRequired:String(it.EvidenceRequired||"none") })) };
  };

  const submit = async (forceVara=false) => {
    setErr(""); setOkMsg("");
    if (!String(title||"").trim()) return setErr("Title is required.");
    const iv = validateItems();
    if (!iv.ok) return setErr(iv.error);
    let finalItems = iv.items;
    if (forceVara) finalItems = finalItems.map(it => ({ ...it, EvidenceRequired:"voluntary_activity_vara" }));
    setSaving(true);
    try {
      if (isEdit) {
        const body = { id:editWorkout.id, title:String(title).trim(), status, athleteIds:selectedTokens, ...(editDate?{date:String(editDate).slice(0,10)}:{}), ...(editSport?{sport:String(editSport).toLowerCase()}:{}), items:finalItems };
        const res  = await fetch("/api/org/workouts/update-full", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error||"Update failed");
        setOkMsg("Workout updated!"); onUpdated?.(data);
        setTimeout(() => onClose?.(), 350);
      } else {
        if (!computedDates.length) return setErr("Missing date.");
        if (!selectedTokens.length) return setErr("Select at least one athlete.");
        const body = { dates:computedDates, date:computedDates[0], title:String(title).trim(), status, athleteIds:selectedTokens, items:finalItems, ...(activeSport?{sport:String(activeSport)}:{}) };
        const res  = await fetch("/api/org/workouts/create", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error||"Create failed");
        const count = computedDates.length;
        setOkMsg(count>1?`${count} workouts created!`:"Workout created!");
        onCreated?.(data);
        setTimeout(() => onClose?.(), 400);
      }
    } catch(e) { setErr(e?.message||"Something went wrong"); }
    finally { setSaving(false); }
  };

  const canNext1  = selectedCount > 0;
  const canNext2  = String(title||"").trim().length > 0;
  const canSubmit = isEdit ? canNext2 : (computedDates.length>0 && canNext2 && selectedCount>0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes fadeIn { from{opacity:0} to{opacity:1} }`}</style>

      {open && (
        <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9990, background:"rgba(13,27,42,0.38)", backdropFilter:"blur(3px)", animation:"fadeIn 0.2s ease" }} />
      )}

      <div style={{
        position:"fixed", top:0, right:0, bottom:0,
        width:"clamp(480px, 44vw, 580px)", zIndex:9991,
        background:DS.cardBg,
        borderLeft:`1px solid ${DS.border}`,
        borderTop:`3px solid ${isVaraHard?"#D92B3A":isVaraSoft?"#C47A00":DS.brand}`,
        display:"flex", flexDirection:"column",
        transform:open?"translateX(0)":"translateX(100%)",
        transition:"transform 0.28s cubic-bezier(0.16,1,0.3,1), border-color 0.3s",
        boxShadow:open?"-12px 0 60px rgba(0,0,0,0.18)":"none",
        pointerEvents:open?"auto":"none",
        overflow:"hidden",
      }}>

        {/* Header */}
        <div style={{ padding:"14px 20px 10px", background:DS.pageBg, borderBottom:`1px solid ${DS.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <p style={{ fontFamily:F.cond, fontWeight:900, fontSize:15, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.bodyText, margin:0 }}>
                {isEdit ? "Edit Workout" : "Create Workout"}
              </p>
              <p style={{ fontFamily:F.body, fontSize:11, color:DS.dimText, margin:"3px 0 0" }}>
                {isEdit ? `Editing: ${editWorkout?.title||"workout"}` : varaDate ? fmtDate(varaDate) : "Assign athletes - VARA fires automatically."}
              </p>
            </div>
            <button type="button" onClick={onClose}
              style={{ padding:7, border:`1px solid ${DS.border}`, background:DS.cardBg, cursor:"pointer", display:"flex", flexShrink:0 }}
              onMouseEnter={e=>{e.currentTarget.style.background=DS.pageBg;}}
              onMouseLeave={e=>{e.currentTarget.style.background=DS.cardBg;}}>
              <X style={{ width:15, height:15, color:DS.dimText }} />
            </button>
          </div>
          {!isEdit && <StepIndicator step={step} />}
        </div>

        {/* Compliance bar */}
        <ComplianceBar varaLevel={varaCheck?.level} periodName={varaCheck?.period?.name} date={varaDate} derivedSport={derivedSport} />

        {/* Messages */}
        {err && (
          <div style={{ padding:"8px 20px", background:DS.bannedBg, borderBottom:`1px solid ${DS.bannedBorder}`, display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
            <AlertTriangle style={{ width:13, height:13, color:DS.banned, flexShrink:0 }} />
            <p style={{ fontFamily:F.body, fontSize:12, fontWeight:700, color:DS.banned, margin:0 }}>{err}</p>
          </div>
        )}
        {okMsg && (
          <div style={{ padding:"8px 20px", background:DS.safeBg, borderBottom:`1px solid ${DS.safeBorder}`, display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
            <CheckCircle2 style={{ width:13, height:13, color:DS.safe, flexShrink:0 }} />
            <p style={{ fontFamily:F.body, fontSize:12, fontWeight:700, color:DS.safe, margin:0 }}>{okMsg}</p>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:"auto" }}>

          {/* ── STEP 1: WHO ── */}
          {(step===1 || isEdit) && (
            <div style={{ display:step===1||isEdit?"flex":"none", flexDirection:"column", minHeight:0 }}>
              {/* Sport filter pills */}
              <div style={{ padding:"12px 20px", background:DS.cardBg, borderBottom:`1px solid ${DS.border}`, display:"flex", gap:6, flexWrap:"wrap", flexShrink:0 }}>
                <button type="button" onClick={() => setSportFilter("all")}
                  style={{ padding:"4px 12px", fontFamily:F.cond, fontWeight:900, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", border:`1px solid ${sportFilter==="all"?DS.brand:DS.border}`, background:sportFilter==="all"?DS.brand:"transparent", color:sportFilter==="all"?"#fff":DS.dimText, cursor:"pointer" }}>
                  All ({athletes.length})
                </button>
                {sportsAvailable.map(s => {
                  const active = sportFilter===s;
                  const h = SPORT_HUE[s]||214;
                  return (
                    <button key={s} type="button" onClick={() => setSportFilter(s)}
                      style={{ padding:"4px 12px", fontFamily:F.cond, fontWeight:900, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", border:`1px solid ${active?`hsl(${h},55%,32%)`:DS.border}`, background:active?`hsl(${h},55%,32%)`:"transparent", color:active?"#fff":DS.dimText, cursor:"pointer" }}>
                      {s} ({sportCount[s]||0})
                    </button>
                  );
                })}
              </div>

              {/* Search + quick-select */}
              <div style={{ padding:"10px 20px", borderBottom:`1px solid ${DS.border}`, display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                <div style={{ position:"relative", flex:1 }}>
                  <Search style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", width:13, height:13, color:DS.dimText, pointerEvents:"none" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
                    style={{ ...inp, paddingLeft:32, padding:"8px 12px 8px 32px" }}
                    onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}}
                    onBlur={e =>{e.currentTarget.style.borderColor=DS.border;}} />
                </div>
                {filteredAthletes.length>0 && (
                  <button type="button" onClick={selectAllShown}
                    style={{ padding:"7px 12px", border:`1px solid ${DS.border}`, background:"transparent", fontFamily:F.cond, fontWeight:900, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.brand, cursor:"pointer", whiteSpace:"nowrap" }}
                    onMouseEnter={e=>{e.currentTarget.style.background=DS.brandBg;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                    Select all shown
                  </button>
                )}
                {selectedCount>0 && (
                  <button type="button" onClick={() => setSelected({})}
                    style={{ padding:"7px 12px", border:`1px solid ${DS.border}`, background:"transparent", fontFamily:F.cond, fontWeight:900, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.dimText, cursor:"pointer" }}
                    onMouseEnter={e=>{e.currentTarget.style.background=DS.pageBg;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                    Clear
                  </button>
                )}
              </div>

              {/* Athlete list */}
              <div style={{ overflowY:"auto" }}>
                {loadingAthletes ? (
                  <div style={{ padding:"40px 20px", textAlign:"center" }}>
                    <p style={{ fontFamily:F.body, fontSize:12, color:DS.dimText }}>Loading athletes...</p>
                  </div>
                ) : filteredAthletes.length===0 ? (
                  <div style={{ padding:"40px 20px", textAlign:"center" }}>
                    <Users style={{ width:24, height:24, color:DS.dimText, margin:"0 auto 10px" }} />
                    <p style={{ fontFamily:F.body, fontSize:12, color:DS.dimText }}>No athletes match.</p>
                  </div>
                ) : filteredAthletes.map(a => {
                  const token = getAthleteToken(a);
                  return (
                    <AthleteRow key={token} athlete={a} checked={!!selected[token]}
                      onToggle={() => { if(token) setSelected(prev=>({...prev,[token]:!prev[token]})); }} />
                  );
                })}
              </div>

              {selectedCount>0 && (
                <div style={{ padding:"10px 20px", background:DS.brandBg, borderTop:`1px solid ${DS.brandBorder}`, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                  <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.brand }}>
                    {selectedCount} athlete{selectedCount!==1?"s":""} selected{derivedSport?` · ${derivedSport}`:""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: WHEN + WHAT ── */}
          {step===2 && !isEdit && (
            <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>

              <ComplianceDateBanner
                varaCheck={varaCheck}
                activeDate={activeDate}
                derivedSport={derivedSport}
              />
              {/* Date */}
              <div>
                <span style={lbl}>Workout date *</span>
                <input
                  type="date"
                  value={createDate}
                  onChange={e => setCreateDate(e.target.value)}
                  style={inp}
                  onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = DS.border; }} />
                {createDate && (
                  <p style={{ fontFamily: F.body, fontSize: 11, color: DS.dimText, marginTop: 5 }}>
                    {fmtDate(createDate)}
                  </p>
                )}
              </div>

              {/* Title */}
              <div>
                <span style={lbl}>Workout title *</span>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Upper Body - Strength Block Week 3" autoFocus style={inp}
                  onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}}
                  onBlur={e =>{e.currentTarget.style.borderColor=DS.border;}} />
                <p style={{ fontFamily:F.body, fontSize:11, color:DS.dimText, marginTop:5 }}>Include the goal - strength, speed, mobility.</p>
              </div>

              {/* Status */}
              <div>
                <span style={lbl}>Status</span>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  style={{ ...inp, cursor:"pointer", appearance:"none" }}
                  onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}}
                  onBlur={e =>{e.currentTarget.style.borderColor=DS.border;}}>
                  <option value="assigned">Assigned</option>
                  <option value="draft">Draft</option>
                  <option value="complete">Complete</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Repeat */}
              <div style={{ border:`1px solid ${DS.border}` }}>
                <button type="button" onClick={() => setRepeatOn(v => !v)}
                  style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:repeatOn?DS.brandBg:DS.pageBg, border:"none", cursor:"pointer", borderBottom:repeatOn?`1px solid ${DS.border}`:"none" }}
                  onMouseEnter={e=>{if(!repeatOn) e.currentTarget.style.background=DS.brandBg;}}
                  onMouseLeave={e=>{if(!repeatOn) e.currentTarget.style.background=DS.pageBg;}}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Repeat style={{ width:14, height:14, color:repeatOn?DS.brand:DS.dimText }} />
                    <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:repeatOn?DS.brand:DS.bodyText }}>Repeat schedule</span>
                    {repeatOn && computedDates.length>1 && <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:10, padding:"2px 7px", background:DS.brand, color:"#fff" }}>{computedDates.length} dates</span>}
                  </div>
                  <div style={{ width:32, height:18, borderRadius:9, background:repeatOn?DS.brand:DS.border, position:"relative" }}>
                    <div style={{ position:"absolute", top:2, left:repeatOn?14:2, width:14, height:14, borderRadius:"50%", background:"#fff", transition:"left 0.15s" }} />
                  </div>
                </button>
                {repeatOn && (
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
                    <div style={{ display:"flex", gap:6 }}>
                      {[{k:"daysOfWeek",l:"Days of week"},{k:"everyNDays",l:"Every N days"}].map(({k,l}) => (
                        <button key={k} type="button" onClick={() => setRepeatMode(k)}
                          style={{ padding:"7px 14px", fontFamily:F.cond, fontWeight:900, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", border:`1px solid ${repeatMode===k?DS.brand:DS.border}`, background:repeatMode===k?DS.brand:"transparent", color:repeatMode===k?"#fff":DS.labelText, cursor:"pointer" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {repeatMode==="daysOfWeek" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        <div>
                          <span style={lbl}>Repeat on</span>
                          <div style={{ display:"flex", gap:5 }}>
                            {DAY_LABELS.map((d,i) => {
                              const on=repeatDays.includes(i);
                              return <button key={i} type="button" onClick={() => setRepeatDays(on?repeatDays.filter(x=>x!==i):[...repeatDays,i])} style={{ width:40, height:40, borderRadius:"50%", border:`2px solid ${on?DS.brand:DS.border}`, background:on?DS.brand:"transparent", color:on?"#fff":DS.labelText, fontFamily:F.cond, fontWeight:900, fontSize:10, cursor:"pointer" }}>{d}</button>;
                            })}
                          </div>
                        </div>
                        <div>
                          <span style={lbl}>End date</span>
                          <input type="date" value={repeatEnd} onChange={e => setRepeatEnd(e.target.value)} style={{ ...inp, maxWidth:200 }} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}} />
                        </div>
                      </div>
                    )}
                    {repeatMode==="everyNDays" && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        <div>
                          <span style={lbl}>Every</span>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <input type="number" min="1" max="90" value={everyN} onChange={e=>setEveryN(Math.max(1,Math.min(90,Number(e.target.value)||1)))} style={{ ...inp, width:70 }} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}} />
                            <span style={{ fontFamily:F.body, fontSize:13, color:DS.labelText }}>days</span>
                          </div>
                        </div>
                        <div>
                          <span style={lbl}>Times</span>
                          <input type="number" min="1" max="60" value={occurrences} onChange={e=>setOccurrences(Math.max(1,Math.min(60,Number(e.target.value)||1)))} style={inp} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}} />
                        </div>
                      </div>
                    )}
                    {computedDates.length>1 && (
                      <div style={{ padding:"10px 12px", background:DS.pageBg, border:`1px solid ${DS.border}` }}>
                        <p style={{ ...lbl, marginBottom:8 }}>{computedDates.length} workouts will be created</p>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                          {computedDates.slice(0,10).map(d => <span key={d} style={{ fontFamily:F.body, fontSize:11, padding:"2px 8px", background:DS.brandBg, border:`1px solid ${DS.brandBorder}`, color:DS.brand }}>{fmtShort(d)}</span>)}
                          {computedDates.length>10 && <span style={{ fontFamily:F.body, fontSize:11, padding:"2px 8px", background:DS.pageBg, border:`1px solid ${DS.border}`, color:DS.dimText }}>+{computedDates.length-10} more</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: THE WORK ── */}
          {(step===3 || isEdit) && (
            <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>

              <ComplianceDateBanner
                varaCheck={varaCheck}
                activeDate={activeDate}
                derivedSport={derivedSport}
              />

              {/* Edit mode: title/status/date/sport */}
              {isEdit && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 160px", gap:12 }}>
                    <div>
                      <span style={lbl}>Workout title *</span>
                      <input value={title} onChange={e=>setTitle(e.target.value)} autoFocus style={inp} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}} />
                    </div>
                    <div>
                      <span style={lbl}>Status</span>
                      <select value={status} onChange={e=>setStatus(e.target.value)} style={{ ...inp, cursor:"pointer", appearance:"none" }} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}}>
                        <option value="assigned">Assigned</option>
                        <option value="draft">Draft</option>
                        <option value="complete">Complete</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <span style={lbl}>Date</span>
                      <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={inp} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}} />
                    </div>
                    <div>
                      <span style={lbl}>Sport</span>
                      <select value={editSport} onChange={e=>setEditSport(e.target.value)} style={{ ...inp, cursor:"pointer", appearance:"none" }} onFocus={e=>{e.currentTarget.style.borderColor=DS.brand;}} onBlur={e=>{e.currentTarget.style.borderColor=DS.border;}}>
                        <option value="">- no sport -</option>
                        {SPORT_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ height:1, background:DS.border }} />
                </div>
              )}

              {/* VARA warning */}
              {showVaraWarn && (
                <div style={{ padding:"14px 16px", background:VARA_CFG[varaCheck.level].bg, border:`1px solid ${VARA_CFG[varaCheck.level].border}`, borderLeft:`4px solid ${VARA_CFG[varaCheck.level].accent}` }}>
                  <p style={{ fontFamily:F.cond, fontWeight:900, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", color:VARA_CFG[varaCheck.level].accent, margin:"0 0 6px" }}>{VARA_CFG[varaCheck.level].label}</p>
                  <p style={{ fontFamily:F.body, fontSize:12, color:VARA_CFG[varaCheck.level].accent, margin:"0 0 10px", lineHeight:1.6 }}>
                    {varaCheck.period?.name && <strong>{varaCheck.period.name}: </strong>}{VARA_CFG[varaCheck.level].sublabel}
                  </p>
                  <button type="button" onClick={setAllVara}
                    style={{ padding:"6px 14px", background:VARA_CFG[varaCheck.level].accent, color:"#fff", fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", border:"none", cursor:"pointer" }}>
                    Set all items to VARA
                  </button>
                </div>
              )}

              {/* ── TEMPLATE PICKER ── */}
              <TemplatePicker
                templates={templates}
                loading={loadingTemplates}
                appliedId={appliedTemplateId}
                derivedSport={derivedSport}
                currentExercises={items}
                onApply={applyTemplate}
                onDelete={handleTemplateDeleted}
                onTemplateSaved={handleTemplateSaved}
              />

              {/* ── EXERCISE BUILDER ── */}
              <div style={{ border:`1px solid ${DS.border}` }}>
                <button type="button" onClick={() => setShowItems(v=>!v)}
                  style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", background:showItems?DS.pageBg:DS.cardBg, border:"none", cursor:"pointer", borderBottom:showItems?`1px solid ${DS.border}`:"none" }}
                  onMouseEnter={e=>{e.currentTarget.style.background=DS.brandBg;}}
                  onMouseLeave={e=>{e.currentTarget.style.background=showItems?DS.pageBg:DS.cardBg;}}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Dumbbell style={{ width:14, height:14, color:DS.dimText }} />
                    <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:DS.bodyText }}>Exercises</span>
                    <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:10, padding:"2px 7px", background:DS.pageBg, border:`1px solid ${DS.border}`, color:DS.dimText }}>
                      {items.filter(it=>String(it?.ExerciseName||"").trim()).length || "optional"}
                    </span>
                    {appliedTemplateId && (
                      <span style={{ fontFamily:F.cond, fontWeight:900, fontSize:9, padding:"2px 7px", background:DS.safeBg, border:`1px solid ${DS.safeBorder}`, color:DS.safe, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                        ✓ From template
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:DS.brand }}>
                    {showItems ? "Collapse" : "Edit exercises"}
                  </span>
                </button>
                {showItems && (
                  <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                    {items.map((it,i) => (
                      <ExerciseRow key={i} item={it} index={i}
                        onChange={patch => setItems(prev => { const n=[...prev]; n[i]={...n[i],...patch}; return n; })}
                        onRemove={() => setItems(prev => { const n=renumber(prev.filter((_,j)=>j!==i)); return n.length?n:[newItem(1)]; })} />
                    ))}
                    <button type="button" onClick={() => setItems(prev => renumber([...prev, newItem(prev.length+1)]))}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:12, border:`2px dashed ${DS.border}`, background:"transparent", fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:DS.brand, cursor:"pointer" }}
                      onMouseEnter={e=>{e.currentTarget.style.background=DS.brandBg;e.currentTarget.style.borderColor=DS.brandBorder;}}
                      onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=DS.border;}}>
                      <Plus style={{ width:13, height:13 }} /> Add exercise
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          flexShrink:0,
          position:"relative",
          borderTop:`1px solid ${isVaraHard&&(step===3||isEdit)?"rgba(217,43,58,0.3)":DS.border}`,
          background:isVaraHard&&(step===3||isEdit)?"rgba(217,43,58,0.04)":DS.pageBg,
          transition:"background 0.3s",
        }}>
          {isVaraHard&&(step===3||isEdit) && (
            <div style={{ padding:"12px 20px 0" }}>
              <p style={{ fontFamily:F.body, fontSize:11, color:"#D92B3A", lineHeight:1.6, margin:0 }}>
                <strong>Break period.</strong> Only voluntary activities are permitted. All exercises will be marked VARA.
              </p>
            </div>
          )}
          <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            {/* Back / Cancel */}
            {step>1&&!isEdit ? (
              <button type="button" onClick={() => setStep(s=>s-1)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", border:`1px solid ${DS.border}`, background:DS.cardBg, fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.labelText, cursor:"pointer" }}
                onMouseEnter={e=>{e.currentTarget.style.background=DS.pageBg;}}
                onMouseLeave={e=>{e.currentTarget.style.background=DS.cardBg;}}>
                <ArrowLeft style={{ width:13, height:13 }} /> Back
              </button>
            ) : (
              <button type="button" onClick={onClose}
                style={{ padding:"9px 16px", border:`1px solid ${DS.border}`, background:DS.cardBg, fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:DS.labelText, cursor:"pointer" }}
                onMouseEnter={e=>{e.currentTarget.style.background=DS.pageBg;}}
                onMouseLeave={e=>{e.currentTarget.style.background=DS.cardBg;}}>
                Cancel
              </button>
            )}

            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {step===1&&selectedCount>0 && <span style={{ fontFamily:F.body, fontSize:11, color:DS.dimText }}>{selectedCount} selected{derivedSport?` · ${derivedSport}`:""}</span>}
              {step===2 && <span style={{ fontFamily:F.body, fontSize:11, color:DS.dimText }}>{computedDates.length>1?`${computedDates.length} dates`:fmtShort(activeDate)}</span>}

              {step===1&&!isEdit && (
                <button type="button" onClick={() => canNext1&&setStep(2)} disabled={!canNext1}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", background:canNext1?DS.brand:DS.border, border:"none", fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", cursor:canNext1?"pointer":"not-allowed", opacity:canNext1?1:0.5 }}>
                  Next - When <ArrowRight style={{ width:13, height:13 }} />
                </button>
              )}
              {step===2&&!isEdit && (
                <button type="button" onClick={() => canNext2&&setStep(3)} disabled={!canNext2}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", background:canNext2?DS.brand:DS.border, border:"none", fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", cursor:canNext2?"pointer":"not-allowed", opacity:canNext2?1:0.5 }}>
                  Next - Exercises <ArrowRight style={{ width:13, height:13 }} />
                </button>
              )}
              {(step===3||isEdit) && (
                <>
                  {!isVaraHard && (
                    <SaveAsTemplateButton
                      items={items}
                      derivedSport={derivedSport}
                      onSaved={handleTemplateSaved}
                    />
                  )}
                  {isVaraHard ? (
                    <button type="button" onClick={() => submit(true)} disabled={saving||!canSubmit}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", background:canSubmit&&!saving?"#D92B3A":DS.border, border:"none", fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", cursor:canSubmit&&!saving?"pointer":"not-allowed", opacity:canSubmit&&!saving?1:0.5 }}>
                      {saving?"Creating...":"Create as VARA"}
                    </button>
                  ) : (
                    <button type="button" onClick={() => submit(false)} disabled={saving||!canSubmit}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", background:canSubmit&&!saving?DS.brand:DS.border, border:"none", fontFamily:F.cond, fontWeight:900, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", cursor:canSubmit&&!saving?"pointer":"not-allowed", opacity:canSubmit&&!saving?1:0.5 }}>
                      {saving?(isEdit?"Saving...":"Creating..."):isEdit?"Save changes":computedDates.length>1?`Create ${computedDates.length} workouts`:"Create workout"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}