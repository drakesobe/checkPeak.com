import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";

// ─── Auth stub ────────────────────────────────────────────────────────────────
function useAuthContext() {
  return { user: { role: "org_admin" }, authReady: true };
}

// ─── Normalise fallback response from todaySummary endpoint ───────────────────
function normaliseSummaryResponse(json) {
  const needsList = Array.isArray(json?.needsList) ? json.needsList : [];
  const summary   = json?.summary ?? {};
  const rows = needsList.map(a => ({
    athleteToken:         a.token  || a.athleteToken || "",
    athleteEmail:         String(a.email || ""),
    athleteName:          a.name   || a.athleteName  || "Athlete",
    sport:                a.sport  || "",
    hasPlan:              false,
    missingCheckin:       false,
    adherenceAvg:         null,
    weeklyChecksLogged:   null,
    weeklyChecksExpected: null,
    lastReminderSentAt:   null,
    reminderCount:        0,
    lastSeen:             a.lastSeen ?? null,
    plan:                 null,
  }));
  return {
    rows,
    meta: {
      weekStartISO:  new Date().toISOString().slice(0, 10),
      sports: [],
      teams:  [],
      totalAthletes:  Number(summary.totalAthletes || 0),
      onTrackCount:   Number(summary.withPlan || 0),
    },
  };
}

// ─── Nutrition queue hook ─────────────────────────────────────────────────────
function useNutritionQueue({ enabled } = {}) {
  const [loading,  setLoading]  = useState(true);
  const [rows,     setRows]     = useState([]);
  const [error,    setError]    = useState(null);
  const [meta,     setMeta]     = useState(null);
  const [updatedLabel, setUpdatedLabel] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/org/nutrition/queue", { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.rows)) {
        setRows(json.rows); setMeta(json.meta ?? null);
        setUpdatedLabel("just now"); setLoading(false); return;
      }
    } catch (_) {}
    try {
      const res  = await fetch("/api/org/nutrition/todaySummary", { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.needsList) && json.needsList.length > 0) {
        const { rows: r, meta: m } = normaliseSummaryResponse(json);
        setRows(r); setMeta(m); setUpdatedLabel("via summary"); setLoading(false); return;
      }
    } catch (_) {}
    setError("Could not load roster. Check your session or try refreshing.");
    setLoading(false);
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  const patchRow = useCallback((athleteToken, patch) => {
    setRows(prev => prev.map(r => r.athleteToken === athleteToken ? { ...r, ...patch } : r));
  }, []);

  return { loading, error, rows, meta, updatedLabel, refresh: load, patchRow };
}

// ─── Season status hook ───────────────────────────────────────────────────────
function useSeasonStatus({ enabled } = {}) {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/org/season-status", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);
  return { status, loading };
}

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useIsMobile(bp = 700) {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return mobile;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAN_PRESETS = [
  { label: "Bulk",     calories: 4200, protein: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen / heavy skill" },
  { label: "Maintain", calories: 3200, protein: 185, carbs: 360, fat: 95,  phase: "Maintain", desc: "Standard in-season"    },
  { label: "Cut",      calories: 2700, protein: 210, carbs: 270, fat: 75,  phase: "Cut",      desc: "Weight management"     },
  { label: "Skill",    calories: 3600, protein: 195, carbs: 420, fat: 90,  phase: "Maintain", desc: "Speed / skill spots"   },
];

const REMINDER_WINDOW_MS = 4 * 60 * 60 * 1000;
const LS_REMINDER_PREFIX = "peak_rem_";

function readReminderCache(athleteToken) {
  try {
    const raw = localStorage.getItem(LS_REMINDER_PREFIX + athleteToken);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeReminderCache(athleteToken, sentAt, count) {
  try { localStorage.setItem(LS_REMINDER_PREFIX + athleteToken, JSON.stringify({ sentAt, count })); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSubGroup(row) {
  if (!row?.hasPlan)                    return "noPlan";
  if (row?.missingCheckin)              return "noCheckin";
  if ((row?.adherenceAvg ?? 100) < 65) return "lowAdherence";
  return "onTrack";
}
function getUrgency(row) {
  const sg = getSubGroup(row);
  if (sg === "noPlan")       return 0;
  if (sg === "noCheckin")    return 1;
  if (sg === "lowAdherence") return 2;
  return 3;
}
function avgAdh(rows) {
  const v = rows.map(r => Number(r.adherenceAvg)).filter(n => isFinite(n) && n > 0);
  if (!v.length) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}
function getReminderState(row) {
  const sentAt = row?.lastReminderSentAt ? new Date(row.lastReminderSentAt) : null;
  const count  = Number(row?.reminderCount || 0);
  if (!sentAt) return { sent: false, canResend: true, minutesAgo: 0, hoursAgo: 0, count };
  const ms  = Date.now() - sentAt.getTime();
  const mins = Math.round(ms / 60000);
  const hrs  = ms / 3600000;
  return { sent: true, canResend: ms >= REMINDER_WINDOW_MS, minutesAgo: mins, hoursAgo: hrs, count };
}
function formatTimeAgo(mins) {
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function daysSinceLabel(dateStr) {
  if (!dateStr) return null;
  const mins = Math.round((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 60)   return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? "1 day" : `${days} days`;
}
function getWeekLabel() {
  const now   = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay());
  const end   = new Date(start); end.setDate(start.getDate() + 6);
  const fmt   = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}
async function sendReminderAPI(athleteToken) {
  const res  = await fetch("/api/org/nutrition/send-reminder", {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "include", body: JSON.stringify({ athleteToken }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not send reminder.");
  if (json?.mailto) window.open(json.mailto, "_blank");
  return json;
}

// Avatar color hash
const AVATAR_PALETTE = ["#3B82F6","#10B981","#F59E0B","#8B5CF6","#EF4444","#06B6D4","#F97316","#EC4899","#14B8A6","#6366F1"];
function getAvatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function getInitials(name) {
  const parts = (name || "Athlete").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || "A").slice(0, 2).toUpperCase();
}

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Barlow:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
  :root {
    --void: #F4F7FB; --deep: #FFFFFF; --surface: #FFFFFF;
    --raised: #F0F4FA; --panel: #E8EEF7; --rim: #D9E2EE;
    --wire: #C2CFDF; --muted: #8FA3BD; --ghost: #607A96;
    --fog: #4A6080; --chalk: #2C3E52; --ice: #1A2B3C; --ink: #0D1B2A;
    --red: #D92B3A;   --red-bg: rgba(217,43,58,0.07);   --red-rim: rgba(217,43,58,0.22);
    --amber: #B86D00; --amber-bg: rgba(184,109,0,0.07); --amber-rim: rgba(184,109,0,0.22);
    --green: #0A7A42; --green-bg: rgba(10,122,66,0.07); --green-rim: rgba(10,122,66,0.22);
    --brand: #0063BB; --brand-bg: rgba(0,99,187,0.07);  --brand-rim: rgba(0,99,187,0.20);
    --font-display: 'Barlow Condensed', sans-serif;
    --font-body:    'Barlow', sans-serif;
    --font-mono:    'JetBrains Mono', monospace;
    --ease-snap: cubic-bezier(0.16, 1, 0.3, 1);
    --header-h: 56px;
  }
  .onq * { box-sizing: border-box; margin: 0; padding: 0; }
  .onq { background: var(--void); color: var(--ink); font-family: var(--font-body); -webkit-font-smoothing: antialiased; }
  .onq ::-webkit-scrollbar { width: 4px; height: 4px; }
  .onq ::-webkit-scrollbar-track { background: var(--panel); }
  .onq ::-webkit-scrollbar-thumb { background: var(--wire); border-radius: 2px; }

  @keyframes slideUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideRight { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideUpBar { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
  @keyframes cardFlip   { 0%{opacity:1;transform:translateY(0)scale(1)} 40%{opacity:0;transform:translateY(-18px)scale(.97)} 60%{opacity:0;transform:translateY(18px)scale(.97)} 100%{opacity:1;transform:translateY(0)scale(1)} }
  @keyframes shimmer    { from{background-position:-200% 0} to{background-position:200% 0} }
  @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes popIn      { 0%{opacity:0;transform:scale(.85)} 70%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)} }
  @keyframes confettiDrop { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }

  .anim-up    { animation: slideUp    0.38s var(--ease-snap) both; }
  .anim-fade  { animation: fadeIn     0.22s ease both; }
  .anim-right { animation: slideRight 0.38s var(--ease-snap) both; }
  .anim-pop   { animation: popIn      0.4s var(--ease-snap) both; }
  .d1{animation-delay:.05s} .d2{animation-delay:.1s} .d3{animation-delay:.15s} .d4{animation-delay:.2s} .d5{animation-delay:.25s}

  .onq-row { transition: background 0.08s ease; cursor:default; }
  .onq-row:hover { background: var(--panel) !important; }

  .stat-tile { transition: all 0.12s ease; cursor:pointer; user-select:none; }
  .stat-tile:hover { background: var(--panel) !important; }
  .stat-tile.active { background: var(--ink) !important; }
  .stat-tile.active .st-val,
  .stat-tile.active .st-lbl { color: #fff !important; }

  .onq-cb { appearance:none; width:16px; height:16px; border:1.5px solid var(--wire); border-radius:3px; cursor:pointer; flex-shrink:0; transition: all 0.1s ease; background:var(--deep); }
  .onq-cb:checked { background:var(--brand); border-color:var(--brand); background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4l3 3 5-6' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-size:10px 8px; background-repeat:no-repeat; background-position:center; }
  .onq-cb:hover:not(:checked) { border-color:var(--brand); }

  .batch-bar { animation: slideUpBar 0.28s var(--ease-snap) both; }

  @media(max-width:699px){ .hide-mobile{display:none!important} }
  @media(min-width:700px){ .hide-desktop{display:none!important} }
`;

// ─── Primitives ───────────────────────────────────────────────────────────────
function Tag({ children, color = "brand" }) {
  const t = {
    brand: { bg:"var(--brand-bg)", border:"var(--brand-rim)", color:"var(--brand)" },
    red:   { bg:"var(--red-bg)",   border:"var(--red-rim)",   color:"var(--red)"   },
    amber: { bg:"var(--amber-bg)", border:"var(--amber-rim)", color:"var(--amber)" },
    green: { bg:"var(--green-bg)", border:"var(--green-rim)", color:"var(--green)" },
    ghost: { bg:"transparent",     border:"var(--wire)",      color:"var(--ghost)" },
  }[color] || { bg:"var(--brand-bg)", border:"var(--brand-rim)", color:"var(--brand)" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"1px 6px", borderRadius:2, border:`1px solid ${t.border}`, background:t.bg, color:t.color, fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.07em", textTransform:"uppercase", lineHeight:1.7, flexShrink:0 }}>
      {children}
    </span>
  );
}
function ProgressBar({ value, max = 100, color = "var(--brand)", height = 3 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height, background:"var(--rim)", borderRadius:height, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:height, transition:"width 0.7s var(--ease-snap)" }} />
    </div>
  );
}
function StatusDot({ color = "green", pulse: doPulse = false }) {
  const colors = { green:"var(--green)", red:"var(--red)", amber:"var(--amber)", ghost:"var(--muted)" };
  return (
    <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:colors[color]||colors.green, flexShrink:0, animation:doPulse?"pulse 1.8s ease-in-out infinite":"none" }} />
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  const bg   = getAvatarColor(name || "");
  const text = getInitials(name || "");
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:"var(--font-display)", fontWeight:800, fontSize:Math.round(size*0.38), color:"#fff", letterSpacing:"0.02em", userSelect:"none" }}>
      {text}
    </div>
  );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────
function PlanBadge({ plan }) {
  if (!plan) return (
    <span style={{ fontFamily:"var(--font-display)", fontSize:11, color:"var(--muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em" }}>-</span>
  );
  const phase = plan.phase || "Maintain";
  const cal   = plan.calories ? `${Number(plan.calories).toLocaleString()} cal` : null;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", color:"var(--chalk)" }}>{phase}</span>
      {cal && <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--ghost)" }}>{cal}</span>}
    </div>
  );
}

// ─── CARA chip ────────────────────────────────────────────────────────────────
function CaraChip({ status }) {
  if (!status || !status.phase || status.phase === "unconfigured") return null;
  const map = {
    "in-season":    { label:"In Season",    color:"var(--green)", bg:"var(--green-bg)", border:"var(--green-rim)" },
    "dead-period":  { label:"Dead Period",  color:"var(--red)",   bg:"var(--red-bg)",   border:"var(--red-rim)"   },
    "out-of-season":{ label:"Out of Season",color:"var(--amber)", bg:"var(--amber-bg)", border:"var(--amber-rim)" },
    "bowl-prep":    { label:"Bowl Prep",    color:"var(--brand)", bg:"var(--brand-bg)", border:"var(--brand-rim)" },
  };
  const c = map[status.phase];
  if (!c) return null;
  const isRisk = status.phase === "dead-period" || status.phase === "out-of-season";
  return (
    <div title={status.note || ""} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px 3px 7px", background:c.bg, border:`1px solid ${c.border}`, borderRadius:20, cursor:"help", animation:isRisk?"pulse 2.5s ease-in-out infinite":"none" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c.color, flexShrink:0 }} />
      <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:c.color }}>CARA · {c.label}</span>
    </div>
  );
}

// ─── Stats bar (clickable - sets active filter) ───────────────────────────────
function StatsBar({ rows, activeFilter, onFilter }) {
  const isMobile = useIsMobile();
  const total    = rows.length;
  const noPlan   = rows.filter(r => getSubGroup(r) === "noPlan").length;
  const noCI     = rows.filter(r => getSubGroup(r) === "noCheckin").length;
  const lowAdh   = rows.filter(r => getSubGroup(r) === "lowAdherence").length;
  const onTrack  = rows.filter(r => getSubGroup(r) === "onTrack").length;
  const action   = noPlan + noCI + lowAdh;
  const adh      = avgAdh(rows.filter(r => r.hasPlan && r.adherenceAvg != null));
  const adhColor = adh == null ? "var(--muted)" : adh >= 80 ? "var(--green)" : adh >= 65 ? "var(--amber)" : "var(--red)";

  const tiles = isMobile ? [
    { key:"action",      label:"Need Action", value:action,                          valueColor:action>0?"var(--red)":"var(--green)",  clickable:true  },
    { key:"noCheckin",   label:"No Check-In", value:noCI,                            valueColor:noCI>0?"var(--amber)":"var(--muted)", clickable:true  },
    { key:null,          label:"Avg WTD",     value:adh!=null?`${adh}%`:"-",         valueColor:adhColor,                             clickable:false },
    { key:"onTrack",     label:"On Track",    value:onTrack,                         valueColor:onTrack>0?"var(--green)":"var(--muted)",clickable:true },
  ] : [
    { key:"all",         label:"Total",       value:total,                           valueColor:"var(--brand)",                        clickable:true  },
    { key:"action",      label:"Need Action", value:action,                          valueColor:action>0?"var(--red)":"var(--green)",  clickable:true  },
    { key:"noPlan",      label:"No Plan",     value:noPlan,                          valueColor:noPlan>0?"var(--red)":"var(--muted)", clickable:true  },
    { key:"noCheckin",   label:"No Check-In", value:noCI,                            valueColor:noCI>0?"var(--amber)":"var(--muted)",clickable:true  },
    { key:null,          label:"Avg WTD",     value:adh!=null?`${adh}%`:"-",         valueColor:adhColor,                             clickable:false },
    { key:"onTrack",     label:"On Track",    value:onTrack,                         valueColor:onTrack>0?"var(--green)":"var(--muted)",clickable:true },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${tiles.length},1fr)`, background:"var(--deep)", borderBottom:"1px solid var(--rim)", marginBottom:0 }} className="anim-up">
      {tiles.map(({ key, label, value, valueColor, clickable }, i) => {
        const isActive = key && activeFilter === key;
        const isLast   = i === tiles.length - 1;
        return (
          <div
            key={label}
            className={`stat-tile${isActive?" active":""}`}
            onClick={clickable && key ? () => onFilter(activeFilter === key ? "all" : key) : undefined}
            style={{
              padding:isMobile?"12px 8px":"16px 20px",
              textAlign:"center",
              borderRight:isLast?"none":"1px solid var(--rim)",
              position:"relative",
              background:isActive?"var(--ink)":"var(--deep)",
            }}
          >
            <div className="st-val" style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?22:30, color:isActive?"#fff":valueColor, lineHeight:1, letterSpacing:"-0.01em", transition:"color 0.12s" }}>{value}</div>
            <div className="st-lbl" style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:isMobile?9:10, letterSpacing:"0.08em", textTransform:"uppercase", color:isActive?"rgba(255,255,255,0.6)":"var(--muted)", marginTop:4, transition:"color 0.12s" }}>{label}</div>
            {clickable && key && !isActive && (
              <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:24, height:2, borderRadius:1, background:"var(--rim)" }} />
            )}
            {isActive && (
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:"var(--brand)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Adherence cell ───────────────────────────────────────────────────────────
function AdherenceCell({ row }) {
  const adh      = row?.adherenceAvg;
  const logged   = row?.weeklyChecksLogged;
  const expected = row?.weeklyChecksExpected;
  const sg       = getSubGroup(row);
  const since    = daysSinceLabel(row?.lastSeen);

  if (sg === "noPlan") return <span style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:12 }}>-</span>;

  if (sg === "noCheckin") {
    const urgency = since ? (since.includes("d") ? "var(--red)" : "var(--amber)") : "var(--amber)";
    return (
      <div>
        <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Pending</span>
        {since && (
          <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:urgency, marginTop:2, fontWeight:500 }}>
            {since} without log
          </div>
        )}
        {!since && <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", marginTop:2 }}>No log this week</div>}
      </div>
    );
  }

  if (adh == null) return <span style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:12 }}>-</span>;

  const color = adh >= 80 ? "var(--green)" : adh >= 65 ? "var(--amber)" : "var(--red)";
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
        <span style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, color }}>{adh}%</span>
        {logged != null && expected != null && (
          <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>{logged}/{expected}</span>
        )}
      </div>
      <ProgressBar value={adh} color={color} height={3} />
    </div>
  );
}

// ─── Reminder cell ────────────────────────────────────────────────────────────
function ReminderCell({ row, onReminderSent, compact = false }) {
  const [sending,  setSending]  = useState(false);
  const [flashErr, setFlashErr] = useState("");

  const [localSent, setLocalSent] = useState(() => {
    if (row?.lastReminderSentAt) return row.lastReminderSentAt;
    return readReminderCache(row?.athleteToken)?.sentAt || null;
  });
  const [localCnt, setLocalCnt] = useState(() => {
    if (row?.reminderCount) return row.reminderCount;
    return readReminderCache(row?.athleteToken)?.count || null;
  });

  const effectiveSentAt = localSent || row?.lastReminderSentAt;
  const effectiveCount  = localCnt != null ? localCnt : (row?.reminderCount || 0);
  const rs = getReminderState({ lastReminderSentAt: effectiveSentAt, reminderCount: effectiveCount });

  async function handleRemind() {
    if (sending) return;
    setSending(true); setFlashErr("");
    try {
      const result   = await sendReminderAPI(row.athleteToken);
      const sentAt   = result?.sentAt || new Date().toISOString();
      const newCount = effectiveCount + 1;
      setLocalSent(sentAt);
      setLocalCnt(newCount);
      writeReminderCache(row.athleteToken, sentAt, newCount);
      onReminderSent?.(row.athleteToken, { lastReminderSentAt: sentAt, reminderCount: newCount });
    } catch (e) {
      setFlashErr(String(e?.message || "Failed").slice(0, 28));
      setTimeout(() => setFlashErr(""), 3500);
    } finally { setSending(false); }
  }

  if (flashErr) return <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--red)" }} title={flashErr}>✗ {flashErr.slice(0, 18)}</span>;
  if (sending)  return <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)", letterSpacing:"0.05em" }}>sending…</span>;

  if (rs.sent && !rs.canResend) {
    const hoursLeft = Math.max(1, Math.ceil(4 - rs.hoursAgo));
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"var(--green)", display:"inline-block", flexShrink:0 }} />
          <span style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--ghost)" }}>{formatTimeAgo(rs.minutesAgo)}</span>
          {rs.count > 1 && <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>×{rs.count}</span>}
        </div>
        <div style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:9, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Resend in {hoursLeft}h</div>
      </div>
    );
  }

  return (
    <button onClick={handleRemind}
      style={{ padding:compact?"4px 10px":"5px 12px", background:"var(--amber-bg)", border:"1px solid var(--amber-rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--amber)", whiteSpace:"nowrap", transition:"all 0.12s ease" }}
      onMouseEnter={e => { e.currentTarget.style.background="var(--amber)"; e.currentTarget.style.color="#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.background="var(--amber-bg)"; e.currentTarget.style.color="var(--amber)"; }}>
      {rs.sent ? "Resend ↑" : "Remind"}
    </button>
  );
}

// ─── Meal distribution helpers ────────────────────────────────────────────────
const MEAL_DEFS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch"     },
  { key: "afternoon", label: "Afternoon" },
  { key: "dinner",    label: "Dinner"    },
];
const DEFAULT_PCTS = { breakfast: 25, lunch: 30, afternoon: 15, dinner: 30 };

function derivePctsFromPlanJson(planJson, dailyCalories) {
  const mb = planJson?.mealBlocks;
  const cal = Number(dailyCalories) || 0;
  if (!mb || !cal) return { ...DEFAULT_PCTS };
  const pcts = {};
  let remaining = 100;
  MEAL_DEFS.forEach(({ key }, i) => {
    const mealCal = Number(mb[key]?.targets?.calories) || 0;
    if (i < MEAL_DEFS.length - 1) {
      const p = cal > 0 ? Math.round((mealCal / cal) * 100) : DEFAULT_PCTS[key];
      pcts[key] = p;
      remaining -= p;
    } else {
      pcts[key] = remaining; // last slot absorbs rounding
    }
  });
  return pcts;
}

function buildPlanJson(values) {
  const cal  = Number(values.calories) || 0;
  const pro  = Number(values.protein)  || 0;
  const carb = Number(values.carbs)    || 0;
  const fat  = Number(values.fat)      || 0;
  const pcts = values.mealPcts;
  const mealBlocks = {};
  MEAL_DEFS.forEach(({ key, label }) => {
    const pct = (Number(pcts[key]) || 0) / 100;
    mealBlocks[key] = {
      name: label,
      targets: {
        calories: cal  > 0 ? Math.round(cal  * pct) : null,
        protein:  pro  > 0 ? Math.round(pro  * pct) : null,
        carbs:    carb > 0 ? Math.round(carb * pct) : null,
        fat:      fat  > 0 ? Math.round(fat  * pct) : null,
      },
    };
  });
  return { mealBlocks, daily: { calories: String(cal), protein: String(pro), carbs: String(carb), fat: String(fat) } };
}

// ─── Assign plan slide-over ───────────────────────────────────────────────────
function AssignSlideOver({ row, onClose, onSaved }) {
  const isMobile  = useIsMobile();
  const isEditing = Boolean(row?.plan);

  const [values, setValues] = useState(() => {
    const p = row?.plan;
    if (!p) return { calories:"", protein:"", carbs:"", fat:"", phase:"Maintain", notes:"", mealPcts:{ ...DEFAULT_PCTS } };
    const mealPcts = derivePctsFromPlanJson(p.planJson, p.calories);
    return {
      calories: p.calories ? String(p.calories) : "",
      protein:  p.protein  ? String(p.protein)  : "",
      carbs:    p.carbs    ? String(p.carbs)     : "",
      fat:      p.fat      ? String(p.fat)       : "",
      phase:    p.phase    || "Maintain",
      notes:    p.notes    || "",
      mealPcts,
    };
  });
  const [preset,  setPreset]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const inp = { width:"100%", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, padding:"9px 12px", color:"var(--ink)", fontFamily:"var(--font-mono)", fontSize:13, outline:"none", transition:"border-color 0.15s" };

  function applyPreset(p) {
    setPreset(p.label);
    setValues(v => ({ ...v, calories:String(p.calories), protein:String(p.protein), carbs:String(p.carbs), fat:String(p.fat), phase:p.phase, mealPcts:{ ...DEFAULT_PCTS } }));
  }
  function set(key) { return e => { setValues(v => ({ ...v, [key]:e.target.value })); setPreset(null); }; }
  function setPct(mealKey, raw) {
    const val = Math.max(0, Math.min(100, Number(raw) || 0));
    setValues(v => ({ ...v, mealPcts: { ...v.mealPcts, [mealKey]: val } }));
  }

  const pctTotal = MEAL_DEFS.reduce((s, { key }) => s + (Number(values.mealPcts[key]) || 0), 0);
  const pctOk    = pctTotal === 100;

  async function save() {
    if (!values.calories || !values.protein) { setErr("Calories and protein are required."); return; }
    setSaving(true); setErr("");
    try {
      const planJson = buildPlanJson(values);
      const res = await fetch("/api/org/nutrition/assign-plan", {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include",
        body: JSON.stringify({
          athleteToken: row?.athleteToken,
          plan: {
            calories: Number(values.calories), protein: Number(values.protein),
            carbs: Number(values.carbs)||0, fat: Number(values.fat)||0,
            phase: values.phase, notes: values.notes,
            planJson,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onSaved?.();
    } catch (e) { setErr(e?.message || "Failed to save."); }
    finally { setSaving(false); }
  }

  const cal = Number(values.calories) || 0;

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(13,27,42,0.5)", backdropFilter:"blur(3px)", zIndex:200 }} />
      <div className="anim-right" style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(460px,100vw)", background:"var(--deep)", borderLeft:"1px solid var(--rim)", zIndex:201, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:isMobile?"16px":"20px 24px", borderBottom:"1px solid var(--rim)", background:"var(--surface)" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--brand)", marginBottom:4 }}>{isEditing ? "Edit Nutrition Plan" : "Assign Nutrition Plan"}</div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Avatar name={row?.athleteName} size={32} />
                <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:20, color:"var(--ink)", lineHeight:1.1 }}>{row?.athleteName || "Athlete"}</div>
              </div>
              {row?.sport && <div style={{ marginTop:6 }}><Tag color="ghost">{row.sport}</Tag></div>}
            </div>
            <button onClick={onClose} style={{ background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, padding:"6px 9px", cursor:"pointer", color:"var(--ghost)", fontSize:16, lineHeight:1 }}>✕</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:isMobile?"16px":"20px 24px" }}>
          {/* Quick Fill */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:10 }}>Quick Fill</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {PLAN_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{ padding:"10px 12px", background:preset===p.label?"var(--brand)":"var(--raised)", border:`1px solid ${preset===p.label?"var(--brand)":"var(--rim)"}`, borderRadius:3, cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}>
                  <div style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, color:preset===p.label?"#fff":"var(--ink)", marginBottom:2 }}>{p.label}</div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:preset===p.label?"rgba(255,255,255,0.6)":"var(--ghost)" }}>{p.calories} cal · {p.protein}g protein</div>
                  <div style={{ fontSize:10, color:preset===p.label?"rgba(255,255,255,0.5)":"var(--muted)", marginTop:1 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ height:1, background:"var(--rim)", margin:"0 0 18px" }} />

          {/* Daily Targets */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:10 }}>Daily Targets</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[["calories","Calories / day *","3200"],["protein","Protein (g) *","185"],["carbs","Carbs (g)","360"],["fat","Fat (g)","95"]].map(([key,label,ph]) => (
                <div key={key}>
                  <label style={{ display:"block", fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:5 }}>{label}</label>
                  <input type="number" value={values[key]} onChange={set(key)} placeholder={ph} min="0" style={inp}
                    onFocus={e => e.target.style.borderColor="var(--brand)"}
                    onBlur={e => e.target.style.borderColor="var(--rim)"} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ height:1, background:"var(--rim)", margin:"0 0 18px" }} />

          {/* Meal Distribution */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ghost)" }}>Meal Distribution</div>
              <div style={{ fontSize:11, fontWeight:700, color: pctOk ? "var(--green)" : pctTotal > 100 ? "var(--red)" : "var(--amber)" }}>
                {pctTotal}% {pctOk ? "✓" : `of 100%`}
              </div>
            </div>

            {/* Visual bar showing the split */}
            <div style={{ display:"flex", height:6, borderRadius:4, overflow:"hidden", marginBottom:14, gap:1 }}>
              {MEAL_DEFS.map(({ key }, i) => {
                const pct = Number(values.mealPcts[key]) || 0;
                const colors = ["#3B82F6","#10B981","#F59E0B","#8B5CF6"];
                return <div key={key} style={{ flex: pct, background: colors[i], transition:"flex 0.2s ease", minWidth: pct > 0 ? 2 : 0 }} />;
              })}
            </div>

            {MEAL_DEFS.map(({ key, label }, i) => {
              const pct    = Number(values.mealPcts[key]) || 0;
              const mealCal = cal > 0 ? Math.round(cal * pct / 100) : null;
              const colors  = ["#3B82F6","#10B981","#F59E0B","#8B5CF6"];
              return (
                <div key={key} style={{ display:"flex", alignItems:"center", gap:10, marginBottom: i < MEAL_DEFS.length - 1 ? 10 : 0 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:colors[i], flexShrink:0 }} />
                  <div style={{ width:76, fontSize:12, fontWeight:600, color:"var(--ink)", flexShrink:0 }}>{label}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:4, flex:1 }}>
                    <input type="number" value={pct} min="0" max="100"
                      onChange={e => setPct(key, e.target.value)}
                      style={{ ...inp, width:58, padding:"6px 8px", textAlign:"center", fontWeight:700 }}
                      onFocus={e => e.target.style.borderColor=colors[i]}
                      onBlur={e => e.target.style.borderColor="var(--rim)"}
                    />
                    <span style={{ fontSize:11, color:"var(--ghost)", flexShrink:0 }}>%</span>
                  </div>
                  <div style={{ minWidth:64, textAlign:"right", fontSize:12, fontWeight:700, color:"var(--ghost)", fontFamily:"var(--font-mono)" }}>
                    {mealCal != null ? `${mealCal} cal` : "-"}
                  </div>
                </div>
              );
            })}

            {!pctOk && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:4, fontSize:11, color:"var(--amber)" }}>
                Percentages total {pctTotal}% - adjust to reach 100% for accurate per-meal targets.
              </div>
            )}
          </div>

          <div style={{ height:1, background:"var(--rim)", margin:"0 0 18px" }} />

          {/* Phase + Notes */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:5 }}>Phase</label>
            <select value={values.phase} onChange={set("phase")} style={{ ...inp, cursor:"pointer" }}
              onFocus={e => e.target.style.borderColor="var(--brand)"}
              onBlur={e => e.target.style.borderColor="var(--rim)"}>
              {["Surplus","Maintain","Cut","Game Week","Bye Week"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={{ display:"block", fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:5 }}>Notes</label>
            <input type="text" value={values.notes} onChange={set("notes")} placeholder="Optional coaching note…" style={inp}
              onFocus={e => e.target.style.borderColor="var(--brand)"}
              onBlur={e => e.target.style.borderColor="var(--rim)"} />
          </div>
          {err && <div style={{ marginTop:10, padding:"10px 14px", background:"var(--red-bg)", border:"1px solid var(--red-rim)", borderRadius:3, color:"var(--red)", fontSize:13 }}>{err}</div>}
        </div>

        <div style={{ padding:isMobile?"12px 16px":"16px 24px", borderTop:"1px solid var(--rim)", display:"flex", gap:10, background:"var(--surface)" }}>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:"12px 20px", background:saving?"var(--muted)":"var(--brand)", border:"none", borderRadius:3, cursor:saving?"not-allowed":"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff" }}>
            {saving ? "Saving…" : isEditing ? "Update Plan" : "Save Plan"}
          </button>
          <button onClick={onClose} style={{ padding:"12px 16px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ghost)" }}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  noPlan:       { label:"No Plan",       dot:"red",   color:"var(--red)",   tag:"red",   border:"#D92B3A" },
  noCheckin:    { label:"No Check-In",   dot:"amber", color:"var(--amber)", tag:"amber", border:"#B86D00" },
  lowAdherence: { label:"Low Adherence", dot:"amber", color:"var(--amber)", tag:"amber", border:"#B86D00" },
  onTrack:      { label:"On Track",      dot:"green", color:"var(--green)", tag:"green", border:"#0A7A42" },
};

// ─── Batch action bar ─────────────────────────────────────────────────────────
function BatchActionBar({ selected, rows, onClear, onReminderSent }) {
  const count   = selected.size;
  const [busy,   setBusy]   = useState(false);
  const [done,   setDone]   = useState(0);
  const [errors, setErrors] = useState(0);

  async function handleBatchRemind() {
    if (busy || count === 0) return;
    setBusy(true); setDone(0); setErrors(0);
    const tokens = [...selected];
    for (const tok of tokens) {
      try {
        const result = await sendReminderAPI(tok);
        const sentAt   = result?.sentAt || new Date().toISOString();
        const row      = rows.find(r => r.athleteToken === tok);
        const newCount = Number(row?.reminderCount || 0) + 1;
        writeReminderCache(tok, sentAt, newCount);
        onReminderSent?.(tok, { lastReminderSentAt: sentAt, reminderCount: newCount });
        setDone(d => d + 1);
      } catch { setErrors(e => e + 1); }
    }
    setBusy(false);
    setTimeout(() => onClear(), 1800);
  }

  return (
    <div className="batch-bar" style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--ink)", borderTop:"1px solid rgba(255,255,255,0.08)", padding:"12px 20px", display:"flex", alignItems:"center", gap:12, zIndex:80 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
        <div style={{ width:24, height:24, borderRadius:"50%", background:"var(--brand)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-display)", fontWeight:800, fontSize:12, color:"#fff", flexShrink:0 }}>{count}</div>
        <span style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:14, color:"rgba(255,255,255,0.85)" }}>
          {busy ? `Sending… ${done}/${count}${errors > 0 ? ` · ${errors} failed` : ""}` : `${count} athlete${count !== 1 ? "s" : ""} selected`}
        </span>
      </div>
      <button onClick={handleBatchRemind} disabled={busy}
        style={{ padding:"8px 18px", background:busy?"rgba(255,255,255,0.1)":"var(--amber)", border:"none", borderRadius:3, cursor:busy?"not-allowed":"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase", color:busy?"rgba(255,255,255,0.4)":"#fff", transition:"all 0.12s", whiteSpace:"nowrap" }}>
        {busy ? "Sending…" : `Send Reminder to ${count}`}
      </button>
      <button onClick={onClear} disabled={busy}
        style={{ padding:"8px 14px", background:"transparent", border:"1px solid rgba(255,255,255,0.15)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(255,255,255,0.45)", transition:"all 0.12s" }}
        onMouseEnter={e => e.currentTarget.style.color="rgba(255,255,255,0.75)"}
        onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,0.45)"}>
        Clear
      </button>
    </div>
  );
}

// ─── Athlete table ────────────────────────────────────────────────────────────
function AthleteTable({ rows, filter, onFilterChange, selected, onSelectChange, onAssign, onEdit, onReminderSent, onNavigate }) {
  const isMobile  = useIsMobile();
  const [search,  setSearch]  = useState("");
  const [sortKey, setSortKey] = useState("status");

  const allNoCI = rows.filter(r => getSubGroup(r) === "noCheckin").map(r => r.athleteToken);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = [...rows];
    if (q) out = out.filter(r => (r.athleteName||"").toLowerCase().includes(q) || (r.sport||"").toLowerCase().includes(q));
    if (filter === "action")       out = out.filter(r => getUrgency(r) < 3);
    else if (filter !== "all")     out = out.filter(r => getSubGroup(r) === filter);
    out.sort((a, b) => {
      if (sortKey === "name")      return (a.athleteName||"").localeCompare(b.athleteName||"");
      if (sortKey === "adherence") return (b.adherenceAvg ?? -1) - (a.adherenceAvg ?? -1);
      return getUrgency(a) - getUrgency(b);
    });
    return out;
  }, [rows, search, filter, sortKey]);

  const filterTabs = [
    { key:"all",      label:"All",     count:rows.length },
    { key:"action",   label:"Action",  count:rows.filter(r=>getUrgency(r)<3).length, color:"var(--red)"   },
    { key:"noPlan",   label:"No Plan", count:rows.filter(r=>getSubGroup(r)==="noPlan").length, color:"var(--red)" },
    { key:"noCheckin",label:"No CI",   count:rows.filter(r=>getSubGroup(r)==="noCheckin").length, color:"var(--amber)" },
    { key:"onTrack",  label:isMobile?"✓":"On Track", count:rows.filter(r=>getSubGroup(r)==="onTrack").length, color:"var(--green)" },
  ];

  const allChecked = filtered.length > 0 && filtered.every(r => selected.has(r.athleteToken));

  function toggleAll() {
    if (allChecked) {
      const next = new Set(selected);
      filtered.forEach(r => next.delete(r.athleteToken));
      onSelectChange(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(r => { if (getSubGroup(r) === "noCheckin") next.add(r.athleteToken); });
      onSelectChange(next);
    }
  }

  function toggleOne(tok) {
    const next = new Set(selected);
    if (next.has(tok)) next.delete(tok); else next.add(tok);
    onSelectChange(next);
  }

  // Small secondary icon button - used alongside a primary action
  function EditIconBtn({ row }) {
    return (
      <button onClick={() => onEdit?.(row)} title="Edit nutrition plan"
        style={{ padding:"5px 8px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", color:"var(--muted)", fontSize:13, lineHeight:1, transition:"all 0.12s", flexShrink:0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor="var(--wire)"; e.currentTarget.style.color="var(--chalk)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor="var(--rim)"; e.currentTarget.style.color="var(--muted)"; }}>
        ✎
      </button>
    );
  }

  function ActionCell({ row }) {
    const sg = getSubGroup(row);
    if (sg === "noPlan") return (
      <button onClick={() => onAssign?.(row)}
        style={{ padding:"5px 12px", background:"var(--red-bg)", border:"1px solid var(--red-rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, textTransform:"uppercase", color:"var(--red)", whiteSpace:"nowrap", transition:"all 0.12s" }}
        onMouseEnter={e => { e.currentTarget.style.background="var(--red)"; e.currentTarget.style.color="#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.background="var(--red-bg)"; e.currentTarget.style.color="var(--red)"; }}>
        Assign Plan ↗
      </button>
    );
    if (sg === "noCheckin") return (
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <ReminderCell row={row} onReminderSent={onReminderSent} />
        <EditIconBtn row={row} />
      </div>
    );
    if (sg === "lowAdherence") return (
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        <button onClick={() => onNavigate?.(row)}
          style={{ padding:"5px 12px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, textTransform:"uppercase", color:"var(--ghost)", whiteSpace:"nowrap", transition:"all 0.12s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor="var(--wire)"; e.currentTarget.style.color="var(--chalk)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor="var(--rim)"; e.currentTarget.style.color="var(--ghost)"; }}>
          Review ↗
        </button>
        <EditIconBtn row={row} />
      </div>
    );
    // onTrack - plan exists, edit is the only relevant action
    return (
      <button onClick={() => onEdit?.(row)}
        style={{ padding:"5px 12px", background:"var(--green-bg)", border:"1px solid var(--green-rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, textTransform:"uppercase", color:"var(--green)", whiteSpace:"nowrap", transition:"all 0.12s" }}
        onMouseEnter={e => { e.currentTarget.style.background="var(--green)"; e.currentTarget.style.color="#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.background="var(--green-bg)"; e.currentTarget.style.color="var(--green)"; }}>
        ✎ Edit Plan
      </button>
    );
  }

  // ── All Clear state ─────────────────────────────────────────────────────────
  const allOnTrack = rows.length > 0 && rows.every(r => getSubGroup(r) === "onTrack");

  return (
    <div className="anim-up">
      {/* Toolbar */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"10px 14px", background:"var(--surface)", border:"1px solid var(--rim)", borderRadius:"6px 6px 0 0", borderBottom:"none" }}>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ position:"relative", flex:1 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:13, pointerEvents:"none" }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes…"
              style={{ width:"100%", padding:"8px 10px 8px 30px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, color:"var(--ink)", fontFamily:"var(--font-body)", fontSize:13, outline:"none" }}
              onFocus={e => e.target.style.borderColor="var(--brand)"}
              onBlur={e => e.target.style.borderColor="var(--rim)"} />
          </div>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)}
            style={{ padding:"8px 10px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, color:"var(--ghost)", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, outline:"none", cursor:"pointer", flexShrink:0 }}>
            <option value="status">By Status</option>
            <option value="name">By Name</option>
            <option value="adherence">By Adherence</option>
          </select>
        </div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:1 }}>
          {filterTabs.map(({ key, label, count, color }) => {
            const active = filter === key;
            return (
              <button key={key} onClick={() => onFilterChange(key)}
                style={{ padding:"4px 10px", flexShrink:0, background:active?(color||"var(--brand)"):"var(--raised)", border:`1px solid ${active?(color||"var(--brand)"):"var(--rim)"}`, borderRadius:20, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, letterSpacing:"0.04em", color:active?"#fff":"var(--ghost)", transition:"all 0.12s" }}>
                {label}
                <span style={{ marginLeft:5, fontFamily:"var(--font-mono)", fontSize:10, opacity:0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--rim)", borderTop:"none", borderRadius:"0 0 6px 6px", overflow:"hidden" }}>

        {/* Desktop column headers */}
        {!isMobile && (
          <div style={{ display:"grid", gridTemplateColumns:"36px 44px 1fr 160px 140px 160px", padding:"8px 16px", background:"var(--raised)", borderBottom:"1px solid var(--rim)", gap:12, alignItems:"center" }}>
            <input type="checkbox" className="onq-cb" checked={allChecked} onChange={toggleAll} title="Select all check-in athletes" />
            <div />
            {["Athlete","Plan","Adherence WTD","Action"].map((h, i) => (
              <div key={h} style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--muted)", textAlign:i >= 2 ? "center" : "left" }}>{h}</div>
            ))}
          </div>
        )}

        {/* All-clear celebration */}
        {allOnTrack && filter === "all" && !search ? (
          <div className="anim-pop" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"56px 24px", textAlign:"center" }}>
            <div style={{ width:64, height:64, borderRadius:"50%", background:"var(--green-bg)", border:"2px solid var(--green-rim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:16, animation:"popIn 0.5s var(--ease-snap) both" }}>✓</div>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:26, color:"var(--ink)", marginBottom:6 }}>Everyone's on track</div>
            <div style={{ fontSize:13, color:"var(--ghost)", fontFamily:"var(--font-body)", maxWidth:300, lineHeight:1.6 }}>
              All {rows.length} athletes are logging and hitting their targets. Check back later in the week.
            </div>
            <div style={{ marginTop:20, display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              <div style={{ padding:"8px 16px", background:"var(--green-bg)", border:"1px solid var(--green-rim)", borderRadius:3, fontFamily:"var(--font-mono)", fontSize:11, color:"var(--green)" }}>
                {rows.filter(r=>r.adherenceAvg!=null).length > 0 ? `Avg ${avgAdh(rows.filter(r=>r.hasPlan&&r.adherenceAvg!=null))}% WTD` : "All logged"}
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:"40px 16px", textAlign:"center" }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, color:"var(--ghost)", marginBottom:6 }}>
              {search ? "No athletes match your search." : "No athletes in this category."}
            </div>
            {(search || filter !== "all") && (
              <button onClick={() => { setSearch(""); onFilterChange("all"); }}
                style={{ padding:"6px 14px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"var(--ghost)", marginTop:8 }}>
                Clear filters
              </button>
            )}
          </div>
        ) : filtered.map((row, i) => {
          const sg     = getSubGroup(row);
          const sc     = STATUS_CFG[sg];
          const isLast = i === filtered.length - 1;
          const isSel  = selected.has(row.athleteToken);
          const canSel = sg === "noCheckin";

          if (isMobile) {
            return (
              <div key={row.athleteToken} className="onq-row"
                style={{ borderLeft:`3px solid ${sc.border}`, borderBottom:isLast?"none":"1px solid var(--rim)", background:isSel?"rgba(0,99,187,0.04)":"var(--surface)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px 8px" }}>
                  {canSel && (
                    <input type="checkbox" className="onq-cb" checked={isSel} onChange={() => toggleOne(row.athleteToken)} />
                  )}
                  <Avatar name={row.athleteName} size={34} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:15, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.athleteName}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                      <StatusDot color={sc.dot} />
                      <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, color:sc.color }}>{sc.label}</span>
                      {row.sport && <span style={{ fontFamily:"var(--font-body)", fontSize:11, color:"var(--muted)" }}>· {row.sport}</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink:0 }}><ActionCell row={row} /></div>
                </div>
                {row.plan && (
                  <div style={{ padding:"0 14px 10px", paddingLeft:canSel ? 76 : 58 }}>
                    <PlanBadge plan={row.plan} />
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={row.athleteToken} className="onq-row"
              style={{ display:"grid", gridTemplateColumns:"36px 44px 1fr 160px 140px 160px", alignItems:"center", padding:"10px 16px", gap:12, borderLeft:`3px solid ${sc.border}`, borderBottom:isLast?"none":"1px solid var(--rim)", background:isSel?"rgba(0,99,187,0.04)":"var(--surface)" }}>
              {/* Checkbox */}
              {canSel
                ? <input type="checkbox" className="onq-cb" checked={isSel} onChange={() => toggleOne(row.athleteToken)} />
                : <div />
              }
              {/* Avatar */}
              <Avatar name={row.athleteName} size={36} />
              {/* Name + sport */}
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.athleteName}</div>
                {row.sport && <div style={{ fontFamily:"var(--font-body)", fontSize:11, color:"var(--ghost)", marginTop:1 }}>{row.sport}</div>}
              </div>
              {/* Plan */}
              <div style={{ paddingLeft:4 }}><PlanBadge plan={row.plan} /></div>
              {/* Adherence */}
              <div style={{ textAlign:"center" }}><AdherenceCell row={row} /></div>
              {/* Action */}
              <div style={{ display:"flex", justifyContent:"center" }}><ActionCell row={row} /></div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && !allOnTrack && (
        <div style={{ marginTop:6, textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>
          {filtered.length} of {rows.length} athletes
        </div>
      )}
    </div>
  );
}

// ─── Focus mode queue card ────────────────────────────────────────────────────
function QueueCard({ row, index, total, onAction }) {
  const isMobile = useIsMobile();
  const [anim, setAnim] = useState(false);
  const sg = getSubGroup(row);
  const since = daysSinceLabel(row?.lastSeen);
  const s  = {
    noPlan:       { label:"No Plan Assigned",      color:"var(--red)",   action:"Assign Plan",   desc:"This athlete has no nutrition targets set. Assign a plan to unlock check-in tracking." },
    noCheckin:    { label:"Missed Check-In",        color:"var(--amber)", action:"Send Reminder", desc:`Has a plan but hasn't logged this week.${since ? ` Last seen ${since} ago.` : ""}` },
    lowAdherence: { label:`Low Adherence · ${Math.round(row.adherenceAvg||0)}%`, color:"var(--amber)", action:"Review Plan", desc:"Logging inconsistently - only hitting a fraction of their weekly targets." },
  }[sg];

  if (!s) return null;

  function handleAction() { setAnim(true); setTimeout(() => { onAction(row, sg); setAnim(false); }, 400); }
  function handleSkip()   { setAnim(true); setTimeout(() => { onAction(row, "skip"); setAnim(false); }, 340); }

  return (
    <div style={{ animation:anim?"cardFlip 0.42s var(--ease-snap)":"slideUp 0.38s var(--ease-snap) both" }}>
      {/* Progress */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--muted)" }}>{index+1}/{total}</span>
          <div style={{ width:80, height:2, background:"var(--rim)", borderRadius:1, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${((index+1)/total)*100}%`, background:"var(--brand)", transition:"width 0.4s var(--ease-snap)" }} />
          </div>
        </div>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>{total-index-1} left</span>
      </div>

      <div style={{ background:"var(--surface)", border:"1px solid var(--rim)", borderTop:`3px solid ${s.color}`, borderRadius:8, overflow:"hidden" }}>
        {/* Athlete header */}
        <div style={{ padding:isMobile?"18px 16px 16px":"22px 28px 18px" }}>
          <div style={{ marginBottom:12 }}><Tag color={sg==="noPlan"?"red":"amber"}>{s.label}</Tag></div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
            <Avatar name={row.athleteName} size={isMobile?40:48} />
            <div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?22:28, color:"var(--ink)", lineHeight:1.05 }}>{row.athleteName}</div>
              {row.sport && <div style={{ fontFamily:"var(--font-body)", fontSize:12, color:"var(--ghost)", marginTop:2 }}>{row.sport}</div>}
            </div>
          </div>
          <p style={{ fontSize:13, color:"var(--chalk)", lineHeight:1.6, fontFamily:"var(--font-body)" }}>{s.desc}</p>
        </div>

        {/* Plan context (if available) */}
        {row.plan && (
          <div style={{ padding:isMobile?"10px 16px":"12px 28px", background:"var(--raised)", borderTop:"1px solid var(--rim)", borderBottom:"1px solid var(--rim)", display:"flex", gap:isMobile?16:24, flexWrap:"wrap" }}>
            {[["Cal", row.plan.calories?.toLocaleString()], ["Protein", `${row.plan.protein}g`], ["Carbs", `${row.plan.carbs}g`], ["Fat", `${row.plan.fat}g`]].map(([label, value]) => value ? (
              <div key={label}>
                <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--muted)", marginBottom:2 }}>{label}</div>
                <div style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:15, color:"var(--ink)" }}>{value}</div>
              </div>
            ) : null)}
            <div style={{ marginLeft:"auto" }}>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--muted)", marginBottom:2 }}>Phase</div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:13, color:"var(--chalk)" }}>{row.plan.phase || "-"}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding:isMobile?"12px 16px":"16px 28px", display:"flex", gap:8 }}>
          {sg === "noCheckin" ? (
            <ReminderCell row={row} onReminderSent={(_tok, data) => { onAction(row, sg, data); }} />
          ) : (
            <button onClick={handleAction}
              style={{ flex:1, padding:"12px 20px", background:s.color, border:"none", borderRadius:4, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", transition:"filter 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.filter="brightness(1.1)"}
              onMouseLeave={e => e.currentTarget.style.filter="none"}>
              {s.action}
            </button>
          )}
          <button onClick={handleSkip}
            style={{ padding:"12px 16px", background:"transparent", border:"1px solid var(--rim)", borderRadius:4, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--muted)", transition:"color 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.color="var(--ghost)"}
            onMouseLeave={e => e.currentTarget.style.color="var(--muted)"}>
            Skip →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Focus mode overlay ───────────────────────────────────────────────────────
function FocusModeOverlay({ rows, onClose, onReminderSent, onNavigate, onAssign }) {
  const isMobile = useIsMobile();
  const queue    = useMemo(() => [...rows].filter(r => getUrgency(r) < 3).sort((a,b) => getUrgency(a)-getUrgency(b)), [rows]);
  const [done,   setDone]   = useState([]);

  const remaining = queue.filter(r => !done.includes(r.athleteToken));
  const current   = remaining[0];
  const allDone   = remaining.length === 0;

  function handleAction(row, type, reminderData) {
    if (type === "skip")         { setDone(d => [...d, row.athleteToken]); return; }
    if (type === "noCheckin")    { if (reminderData) onReminderSent?.(row.athleteToken, reminderData); setDone(d => [...d, row.athleteToken]); return; }
    if (type === "noPlan")       { onAssign?.(row); return; }
    if (type === "lowAdherence") { onNavigate?.(row); setDone(d => [...d, row.athleteToken]); return; }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"var(--void)", zIndex:100, overflowY:"auto" }}>
      {/* Focus header (light - matches org DS) */}
      <div style={{ position:"sticky", top:0, zIndex:101, background:"#fff", borderBottom:"1px solid #E8ECF0" }}>
        <div style={{ maxWidth:600, margin:"0 auto", padding:isMobile?"0 12px":"0 20px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:13, letterSpacing:"0.12em", textTransform:"uppercase", color:"#1E3A5F" }}>Focus Mode</span>
            {queue.length > 0 && (
              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"#9BA8B4" }}>{done.length}/{queue.length}</span>
            )}
          </div>
          <button onClick={onClose}
            style={{ padding:"7px 14px", background:"#EEF3F9", border:"1px solid #C0D0E0", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", color:"#5A6A7D", transition:"all 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background="#E2EAF4"; e.currentTarget.style.color="#1E3A5F"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#EEF3F9"; e.currentTarget.style.color="#5A6A7D"; }}>
            ← Roster
          </button>
        </div>
      </div>

      <div style={{ maxWidth:560, margin:"0 auto", padding:isMobile?"24px 12px 80px":"36px 20px 60px" }}>
        {allDone ? (
          <div className="anim-pop" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 24px", textAlign:"center" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"var(--green-bg)", border:"2px solid var(--green-rim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, marginBottom:20 }}>✓</div>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:30, color:"var(--ink)", marginBottom:8 }}>Queue Clear</div>
            <div style={{ fontSize:14, color:"var(--ghost)", fontFamily:"var(--font-body)", maxWidth:280, lineHeight:1.7, marginBottom:32 }}>
              You've worked through {queue.length} athlete{queue.length !== 1 ? "s" : ""}. Come back later this week to check adherence.
            </div>
            <button onClick={onClose}
              style={{ padding:"12px 28px", background:"#1E3A5F", border:"none", borderRadius:4, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:13, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", transition:"filter 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.filter="brightness(1.2)"}
              onMouseLeave={e => e.currentTarget.style.filter="none"}>
              ← Back to Roster
            </button>
          </div>
        ) : queue.length === 0 ? (
          <div className="anim-up" style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:26, color:"var(--green)", marginBottom:8 }}>All clear</div>
            <div style={{ fontSize:14, color:"var(--ghost)", fontFamily:"var(--font-body)" }}>No athletes need attention right now.</div>
            <button onClick={onClose} style={{ marginTop:20, padding:"10px 22px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"var(--chalk)" }}>← Roster</button>
          </div>
        ) : current ? (
          <QueueCard
            key={current.athleteToken}
            row={current}
            index={queue.length - remaining.length}
            total={queue.length}
            onAction={handleAction}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function OrgNutritionQueuePage() {
  const isMobile  = useIsMobile();
  const router    = useRouter();
  const { user, authReady } = useAuthContext();

  const { loading, error, rows, refresh, patchRow } = useNutritionQueue({ enabled: Boolean(authReady && user) });
  const { status: seasonStatus } = useSeasonStatus({ enabled: Boolean(authReady && user) });

  const [filter,     setFilter]     = useState("all");
  const [selected,   setSelected]   = useState(new Set());
  const [assignRow,  setAssignRow]  = useState(null);
  const [editRow,    setEditRow]    = useState(null);
  const [focusMode,  setFocusMode]  = useState(false);

  const actionCount = useMemo(() => rows.filter(r => getUrgency(r) < 3).length, [rows]);

  const handleReminderSent = useCallback((athleteToken, data) => {
    patchRow(athleteToken, { lastReminderSentAt: data.lastReminderSentAt, reminderCount: data.reminderCount });
  }, [patchRow]);

  const navigateToAthlete = useCallback((row) => {
    if (row?.athleteToken) router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(row.athleteToken)}`);
  }, [router]);

  // Clear selection when rows change (e.g. after refresh)
  useEffect(() => { setSelected(new Set()); }, [rows]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />
      <div className="onq" style={{ minHeight:"100vh" }}>

        {/* ── Sticky header (light - matches org DS) ── */}
        <div style={{ position:"sticky", top:0, zIndex:90, background:"#fff", borderBottom:"1px solid #E8ECF0" }}>
          <div style={{ maxWidth:900, margin:"0 auto", padding:isMobile?"0 12px":"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            {/* Left */}
            <div style={{ display:"flex", alignItems:"center", gap:isMobile?8:14, minWidth:0 }}>
              <span style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?14:16, letterSpacing:"0.14em", color:"#1E3A5F", textTransform:"uppercase", flexShrink:0 }}>PEAK</span>
              <span style={{ width:1, height:18, background:"#E8ECF0", flexShrink:0 }} />
              <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:isMobile?12:13, letterSpacing:"0.08em", color:"#5A6A7D", textTransform:"uppercase" }}>Nutrition</span>
              {!isMobile && (
                <>
                  <span style={{ width:1, height:18, background:"#E8ECF0", flexShrink:0 }} />
                  <span style={{ fontFamily:"var(--font-body)", fontSize:12, color:"#9BA8B4" }}>{getWeekLabel()}</span>
                </>
              )}
            </div>
            {/* Right */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <CaraChip status={seasonStatus} />
              {actionCount > 0 && (
                <button onClick={() => setFocusMode(true)}
                  style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", background:"#1E3A5F", border:"none", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:isMobile?11:12, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", transition:"filter 0.12s", whiteSpace:"nowrap" }}
                  onMouseEnter={e => e.currentTarget.style.filter="brightness(1.15)"}
                  onMouseLeave={e => e.currentTarget.style.filter="none"}>
                  {isMobile ? `Focus (${actionCount})` : <>Focus Mode <span style={{ opacity:0.6, fontSize:11 }}>→</span></>}
                </button>
              )}
              <button onClick={() => router.push("/org/workouts-calendar")}
                style={{ padding:isMobile?"6px 10px":"6px 12px", background:"transparent", border:"1px solid #C0D0E0", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:600, fontSize:isMobile?11:12, letterSpacing:"0.06em", textTransform:"uppercase", color:"#5A6A7D", transition:"all 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.color="#1E3A5F"; e.currentTarget.style.borderColor="#1E3A5F"; }}
                onMouseLeave={e => { e.currentTarget.style.color="#5A6A7D"; e.currentTarget.style.borderColor="#C0D0E0"; }}>
                {isMobile ? "◀" : "← Workouts"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats bar (wired to filter) ── */}
        {!loading && rows.length > 0 && (
          <StatsBar rows={rows} activeFilter={filter} onFilter={setFilter} />
        )}

        {/* ── Main content ── */}
        <main style={{ maxWidth:900, margin:"0 auto", padding:isMobile?"16px 12px 100px":"20px 24px 80px" }}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[56, 220, 44, 320].map(h => (
                <div key={h} style={{ height:h, borderRadius:6, background:`linear-gradient(90deg, var(--panel) 0%, var(--raised) 50%, var(--panel) 100%)`, backgroundSize:"200% 100%", animation:"shimmer 1.6s ease-in-out infinite" }} />
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && rows.length === 0 && (
            <div style={{ padding:"16px", background:"var(--red-bg)", border:"1px solid var(--red-rim)", borderLeft:"3px solid var(--red)", borderRadius:6, display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--red)", marginBottom:4 }}>Failed to load</div>
                <div style={{ fontSize:13, color:"var(--ghost)", fontFamily:"var(--font-body)" }}>{error}</div>
              </div>
              <button onClick={refresh} style={{ padding:"7px 14px", background:"var(--red)", border:"none", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"#fff", flexShrink:0 }}>Retry</button>
            </div>
          )}

          {/* Empty */}
          {!loading && rows.length === 0 && !error && (
            <div className="anim-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"80px 24px", textAlign:"center" }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--panel)", border:"1px solid var(--rim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:16 }}>◎</div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:22, color:"var(--ink)", marginBottom:8 }}>No athletes yet</div>
              <div style={{ fontSize:13, color:"var(--ghost)", fontFamily:"var(--font-body)", maxWidth:260, lineHeight:1.6 }}>Add athletes to your roster to start tracking nutrition compliance.</div>
            </div>
          )}

          {/* Roster */}
          {!loading && rows.length > 0 && (
            <div className="anim-up">
              <AthleteTable
                rows={rows}
                filter={filter}
                onFilterChange={setFilter}
                selected={selected}
                onSelectChange={setSelected}
                onAssign={row => setAssignRow(row)}
                onEdit={row => setEditRow(row)}
                onReminderSent={handleReminderSent}
                onNavigate={navigateToAthlete}
              />
              {/* Refresh label */}
              <div style={{ marginTop:10, display:"flex", justifyContent:"flex-end" }}>
                <button onClick={refresh}
                  style={{ background:"transparent", border:"none", cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:600, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--muted)", padding:"2px 0", transition:"color 0.12s" }}
                  onMouseEnter={e => e.currentTarget.style.color="var(--ghost)"}
                  onMouseLeave={e => e.currentTarget.style.color="var(--muted)"}>
                  Refresh ↺
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ── Batch action bar ── */}
        {selected.size > 0 && (
          <BatchActionBar
            selected={selected}
            rows={rows}
            onClear={() => setSelected(new Set())}
            onReminderSent={(tok, data) => {
              handleReminderSent(tok, data);
            }}
          />
        )}

        {/* ── Overlays ── */}
        {focusMode && (
          <FocusModeOverlay
            rows={rows}
            onClose={() => { setFocusMode(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            onReminderSent={handleReminderSent}
            onNavigate={navigateToAthlete}
            onAssign={row => { setFocusMode(false); setAssignRow(row); }}
          />
        )}
        {assignRow && (
          <AssignSlideOver
            row={assignRow}
            onClose={() => setAssignRow(null)}
            onSaved={() => { setAssignRow(null); refresh(); }}
          />
        )}
        {editRow && (
          <AssignSlideOver
            row={editRow}
            onClose={() => setEditRow(null)}
            onSaved={() => { setEditRow(null); refresh(); }}
          />
        )}
      </div>
    </>
  );
}
