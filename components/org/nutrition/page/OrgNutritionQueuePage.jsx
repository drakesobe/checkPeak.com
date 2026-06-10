import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/router";

// ─── Auth stub (real import commented out until hook is extracted) ─────────────
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
  if (!sentAt || isNaN(sentAt.getTime())) return { sent: false, canResend: false, hoursAgo: null, minutesAgo: null, count };
  const msAgo      = Date.now() - sentAt.getTime();
  const minutesAgo = Math.floor(msAgo / 60000);
  const hoursAgo   = Math.floor(msAgo / 3600000);
  return { sent: true, canResend: msAgo >= REMINDER_WINDOW_MS, hoursAgo, minutesAgo, count };
}
function formatTimeAgo(mins) {
  if (mins == null) return "";
  if (mins < 1)     return "just now";
  if (mins < 60)    return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Barlow:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
  :root {
    --void: #F7F9FC; --deep: #FFFFFF; --surface: #FFFFFF;
    --raised: #F2F5F9; --panel: #EBF0F7; --rim: #DDE4EE;
    --wire: #C8D3E3; --muted: #9AAABF; --ghost: #6B7E99;
    --fog: #4E6080; --chalk: #2D3E56; --ice: #1A2B40; --ink: #0D1B2A;
    --red: #D92B3A;   --red-bg: rgba(217,43,58,0.06);   --red-rim: rgba(217,43,58,0.2);
    --amber: #C47A00; --amber-bg: rgba(196,122,0,0.06); --amber-rim: rgba(196,122,0,0.2);
    --green: #0A8A4A; --green-bg: rgba(10,138,74,0.06); --green-rim: rgba(10,138,74,0.2);
    --brand: #0070CC; --brand-bg: rgba(0,112,204,0.06); --brand-rim: rgba(0,112,204,0.18);
    --font-display: 'Barlow Condensed', sans-serif;
    --font-body:    'Barlow', sans-serif;
    --font-mono:    'JetBrains Mono', monospace;
    --ease-snap: cubic-bezier(0.16, 1, 0.3, 1);
  }
  .onq * { box-sizing: border-box; margin: 0; padding: 0; }
  .onq { background: var(--void); color: var(--ink); font-family: var(--font-body); -webkit-font-smoothing: antialiased; }
  .onq ::-webkit-scrollbar { width: 4px; height: 4px; }
  .onq ::-webkit-scrollbar-track { background: var(--panel); }
  .onq ::-webkit-scrollbar-thumb { background: var(--wire); border-radius: 2px; }
  @keyframes slideUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideRight{ from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes cardFlip  { 0%{opacity:1;transform:translateY(0)scale(1);} 40%{opacity:0;transform:translateY(-18px)scale(.97);} 60%{opacity:0;transform:translateY(18px)scale(.97);} 100%{opacity:1;transform:translateY(0)scale(1);} }
  @keyframes shimmer   { from{background-position:-200% 0;} to{background-position:200% 0;} }
  @keyframes pulse     { 0%,100%{opacity:1;} 50%{opacity:.45;} }
  .anim-up    { animation: slideUp    0.4s var(--ease-snap) both; }
  .anim-fade  { animation: fadeIn     0.25s ease both; }
  .anim-right { animation: slideRight 0.38s var(--ease-snap) both; }
  .d1{animation-delay:.04s;} .d2{animation-delay:.08s;} .d3{animation-delay:.12s;}
  .onq-row { transition: background 0.1s ease; }
  .onq-row:hover { background: var(--panel) !important; }
  @media(max-width:699px){ .hide-mobile{display:none!important;} }
  @media(min-width:700px){ .hide-desktop{display:none!important;} }
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

// ─── CARA chip (replaces the full banner — only shows when calendar is configured) ──
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
    <div title={status.note || ""} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px 3px 7px", background:c.bg, border:`1px solid ${c.border}`, borderRadius:20, cursor:"help", animation: isRisk ? "pulse 2.5s ease-in-out infinite" : "none" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:c.color, flexShrink:0 }} />
      <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", color:c.color }}>
        CARA · {c.label}
      </span>
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ rows }) {
  const isMobile = useIsMobile();
  const total    = rows.length;
  const noPlan   = rows.filter(r => getSubGroup(r) === "noPlan").length;
  const noCI     = rows.filter(r => getSubGroup(r) === "noCheckin").length;
  const lowAdh   = rows.filter(r => getSubGroup(r) === "lowAdherence").length;
  const onTrack  = rows.filter(r => getSubGroup(r) === "onTrack").length;
  const action   = noPlan + noCI + lowAdh;
  const adh      = avgAdh(rows.filter(r => r.hasPlan && r.adherenceAvg != null));

  const tiles = isMobile
    ? [
        { label:"Need Action", value:action,  color:action>0?"var(--red)":"var(--green)" },
        { label:"No Check-In", value:noCI,    color:noCI>0?"var(--amber)":"var(--muted)" },
        { label:"Avg WTD",     value:adh!=null?`${adh}%`:"—", color:adh==null?"var(--muted)":adh>=80?"var(--green)":adh>=65?"var(--amber)":"var(--red)" },
        { label:"On Track",    value:onTrack, color:onTrack>0?"var(--green)":"var(--muted)" },
      ]
    : [
        { label:"Total",       value:total,   color:"var(--brand)" },
        { label:"Need Action", value:action,  color:action>0?"var(--red)":"var(--green)" },
        { label:"No Plan",     value:noPlan,  color:noPlan>0?"var(--red)":"var(--muted)" },
        { label:"No Check-In", value:noCI,    color:noCI>0?"var(--amber)":"var(--muted)" },
        { label:"Avg WTD",     value:adh!=null?`${adh}%`:"—", color:adh==null?"var(--muted)":adh>=80?"var(--green)":adh>=65?"var(--amber)":"var(--red)" },
        { label:"On Track",    value:onTrack, color:onTrack>0?"var(--green)":"var(--muted)" },
      ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${tiles.length},1fr)`, gap:1, background:"var(--rim)", border:"1px solid var(--rim)", borderRadius:6, overflow:"hidden", marginBottom:12 }} className="anim-up">
      {tiles.map(({ label, value, color }) => (
        <div key={label} style={{ padding:isMobile?"10px 8px":"14px 16px", background:"var(--surface)", textAlign:"center" }}>
          <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?20:28, color, lineHeight:1, letterSpacing:"-0.01em" }}>{value}</div>
          <div style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:isMobile?9:10, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--muted)", marginTop:3 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly adherence display ─────────────────────────────────────────────────
function AdherenceCell({ row }) {
  const adh      = row?.adherenceAvg;
  const logged   = row?.weeklyChecksLogged;
  const expected = row?.weeklyChecksExpected;
  const sg       = getSubGroup(row);

  if (sg === "noPlan") return <span style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:12 }}>—</span>;
  if (sg === "noCheckin") return (
    <div>
      <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.05em" }}>Pending</span>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)", marginTop:1 }}>No log this week</div>
    </div>
  );
  if (adh == null) return <span style={{ color:"var(--muted)", fontFamily:"var(--font-mono)", fontSize:12 }}>—</span>;

  const color = adh >= 80 ? "var(--green)" : adh >= 65 ? "var(--amber)" : "var(--red)";
  return (
    <div>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
        <span style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, color }}>{adh}%</span>
        {logged != null && expected != null && (
          <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>{logged}/{expected} ✓</span>
        )}
      </div>
      <ProgressBar value={adh} color={color} height={3} />
    </div>
  );
}

// ─── Reminder cell (self-contained state) ────────────────────────────────────
function ReminderCell({ row, onReminderSent }) {
  const [sending,   setSending]   = useState(false);
  const [flashErr,  setFlashErr]  = useState("");

  // Seed from DB first, then localStorage cache — so state survives refresh even if DB columns don't exist yet
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
      const result = await sendReminderAPI(row.athleteToken);
      const sentAt = result?.sentAt || new Date().toISOString();
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

  if (rs.sent && !rs.canResend) return (
    <div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:10, color:"var(--muted)" }}>{rs.count}× · {formatTimeAgo(rs.minutesAgo)}</div>
      <div style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:10, color:"var(--muted)", textTransform:"uppercase" }}>Resend in {Math.max(1, 4 - (rs.hoursAgo||0))}h</div>
    </div>
  );

  const btnStyle = {
    padding:"5px 12px", background:"var(--amber-bg)", border:"1px solid var(--amber-rim)",
    borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700,
    fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--amber)",
    whiteSpace:"nowrap", transition:"all 0.15s ease",
  };
  return (
    <button onClick={handleRemind} style={btnStyle}
      onMouseEnter={e => { e.currentTarget.style.background="var(--amber)"; e.currentTarget.style.color="#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.background="var(--amber-bg)"; e.currentTarget.style.color="var(--amber)"; }}>
      {rs.sent ? "Resend ↑" : "Remind"}
    </button>
  );
}

// ─── Assign plan slide-over ───────────────────────────────────────────────────
function AssignSlideOver({ row, onClose, onSaved }) {
  const isMobile = useIsMobile();
  const [values,  setValues]  = useState({ calories:"", protein:"", carbs:"", fat:"", phase:"Maintain", notes:"" });
  const [preset,  setPreset]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const inp = { width:"100%", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, padding:"9px 12px", color:"var(--ink)", fontFamily:"var(--font-mono)", fontSize:13, outline:"none", transition:"border-color 0.15s" };

  function applyPreset(p) { setPreset(p.label); setValues(v => ({ ...v, calories:String(p.calories), protein:String(p.protein), carbs:String(p.carbs), fat:String(p.fat), phase:p.phase })); }
  function set(key) { return e => { setValues(v => ({ ...v, [key]:e.target.value })); setPreset(null); }; }

  async function save() {
    if (!values.calories || !values.protein) { setErr("Calories and protein are required."); return; }
    setSaving(true); setErr("");
    try {
      const res  = await fetch("/api/org/nutrition/assign-plan", {
        method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include",
        body: JSON.stringify({ athleteToken:row?.athleteToken, plan:{ calories:Number(values.calories), protein:Number(values.protein), carbs:Number(values.carbs)||0, fat:Number(values.fat)||0, phase:values.phase, notes:values.notes } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onSaved?.();
    } catch (e) { setErr(e?.message || "Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(13,27,42,0.45)", backdropFilter:"blur(2px)", zIndex:200 }} />
      <div className="anim-right" style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(460px,100vw)", background:"var(--deep)", borderLeft:"1px solid var(--rim)", zIndex:201, display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ padding:isMobile?"16px":"20px 24px", borderBottom:"1px solid var(--rim)", background:"var(--surface)" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--brand)", marginBottom:4 }}>Assign Nutrition Plan</div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:22, color:"var(--ink)", lineHeight:1.1 }}>{row?.athleteName || "Athlete"}</div>
              {row?.sport && <div style={{ marginTop:6 }}><Tag color="ghost">{row.sport}</Tag></div>}
            </div>
            <button onClick={onClose} style={{ background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, padding:"6px 9px", cursor:"pointer", color:"var(--ghost)", fontSize:16, lineHeight:1 }}>✕</button>
          </div>
        </div>
        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:isMobile?"16px":"20px 24px" }}>
          {/* Presets */}
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
          {/* Targets */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:10 }}>Targets</div>
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
        {/* Footer */}
        <div style={{ padding:isMobile?"12px 16px":"16px 24px", borderTop:"1px solid var(--rim)", display:"flex", gap:10, background:"var(--surface)" }}>
          <button onClick={save} disabled={saving} style={{ flex:1, padding:"12px 20px", background:saving?"var(--muted)":"var(--brand)", border:"none", borderRadius:3, cursor:saving?"not-allowed":"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff" }}>
            {saving ? "Saving…" : "Save Plan"}
          </button>
          <button onClick={onClose} style={{ padding:"12px 16px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ghost)" }}>Cancel</button>
        </div>
      </div>
    </>
  );
}

// ─── Main roster table ────────────────────────────────────────────────────────
const STATUS_CFG = {
  noPlan:       { label:"No Plan",       dot:"red",   color:"var(--red)",   tag:"red"   },
  noCheckin:    { label:"No Check-In",   dot:"amber", color:"var(--amber)", tag:"amber" },
  lowAdherence: { label:"Low Adherence", dot:"amber", color:"var(--amber)", tag:"amber" },
  onTrack:      { label:"On Track",      dot:"green", color:"var(--green)", tag:"green" },
};

function AthleteTable({ rows, onAssign, onReminderSent, onNavigate }) {
  const isMobile   = useIsMobile();
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [sortKey,  setSortKey]  = useState("status");

  const counts = useMemo(() => ({
    all:          rows.length,
    noPlan:       rows.filter(r => getSubGroup(r) === "noPlan").length,
    noCheckin:    rows.filter(r => getSubGroup(r) === "noCheckin").length,
    lowAdherence: rows.filter(r => getSubGroup(r) === "lowAdherence").length,
    onTrack:      rows.filter(r => getSubGroup(r) === "onTrack").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = [...rows];
    if (q)            out = out.filter(r => (r.athleteName||"").toLowerCase().includes(q) || (r.sport||"").toLowerCase().includes(q));
    if (filter !== "all") out = out.filter(r => getSubGroup(r) === filter);
    out.sort((a, b) => {
      if (sortKey === "name")      return (a.athleteName||"").localeCompare(b.athleteName||"");
      if (sortKey === "adherence") return (b.adherenceAvg ?? -1) - (a.adherenceAvg ?? -1);
      return getUrgency(a) - getUrgency(b);
    });
    return out;
  }, [rows, search, filter, sortKey]);

  const filterTabs = [
    { key:"all",          label:"All",      count:counts.all                           },
    { key:"noPlan",       label:"No Plan",  count:counts.noPlan,  color:"var(--red)"   },
    { key:"noCheckin",    label:"No CI",    count:counts.noCheckin,  color:"var(--amber)"},
    { key:"lowAdherence", label:"Low",      count:counts.lowAdherence, color:"var(--amber)"},
    { key:"onTrack",      label:isMobile?"✓":"On Track", count:counts.onTrack, color:"var(--green)" },
  ];

  function ActionCell({ row }) {
    const sg = getSubGroup(row);
    if (sg === "noPlan") return (
      <button onClick={() => onAssign?.(row)} style={{ padding:"5px 12px", background:"var(--red-bg)", border:"1px solid var(--red-rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"var(--red)", whiteSpace:"nowrap", transition:"all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.background="var(--red)"; e.currentTarget.style.color="#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.background="var(--red-bg)"; e.currentTarget.style.color="var(--red)"; }}>
        Assign Plan ↗
      </button>
    );
    if (sg === "noCheckin") return <ReminderCell row={row} onReminderSent={onReminderSent} />;
    if (sg === "lowAdherence") return (
      <button onClick={() => onNavigate?.(row)} style={{ padding:"5px 12px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"var(--ghost)", whiteSpace:"nowrap", transition:"all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor="var(--wire)"; e.currentTarget.style.color="var(--chalk)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor="var(--rim)"; e.currentTarget.style.color="var(--ghost)"; }}>
        Review ↗
      </button>
    );
    return <span style={{ fontFamily:"var(--font-mono)", fontSize:16, color:"var(--green)" }}>✓</span>;
  }

  return (
    <div className="anim-up">
      {/* Toolbar */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"12px 14px", background:"var(--surface)", border:"1px solid var(--rim)", borderRadius:6, marginBottom:8 }}>
        <div style={{ display:"flex", gap:8 }}>
          {/* Search */}
          <div style={{ position:"relative", flex:1 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", fontSize:13, pointerEvents:"none" }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes…"
              style={{ width:"100%", padding:"8px 10px 8px 30px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, color:"var(--ink)", fontFamily:"var(--font-body)", fontSize:13, outline:"none" }}
              onFocus={e => e.target.style.borderColor="var(--brand)"}
              onBlur={e => e.target.style.borderColor="var(--rim)"} />
          </div>
          {/* Sort */}
          <select value={sortKey} onChange={e => setSortKey(e.target.value)}
            style={{ padding:"8px 10px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, color:"var(--ghost)", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, outline:"none", cursor:"pointer", flexShrink:0 }}>
            <option value="status">By Status</option>
            <option value="name">By Name</option>
            <option value="adherence">By Adherence</option>
          </select>
        </div>
        {/* Filter tabs */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", WebkitOverflowScrolling:"touch", paddingBottom:1 }}>
          {filterTabs.map(({ key, label, count, color }) => {
            const active = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{ padding:"4px 10px", flexShrink:0, background:active?(color||"var(--brand)"):"var(--raised)", border:`1px solid ${active?(color||"var(--brand)"):"var(--rim)"}`, borderRadius:20, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, letterSpacing:"0.04em", color:active?"#fff":"var(--ghost)", transition:"all 0.15s" }}>
                {label}
                <span style={{ marginLeft:5, fontFamily:"var(--font-mono)", fontSize:10, opacity:0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--rim)", borderRadius:6, overflow:"hidden" }}>
        {/* Desktop header */}
        {!isMobile && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 140px 160px 150px", padding:"8px 16px", background:"var(--raised)", borderBottom:"1px solid var(--rim)" }}>
            {["Athlete", "Status", "Adherence WTD", "Action"].map((h, i) => (
              <div key={h} style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--muted)", textAlign:i >= 2 ? "center" : "left" }}>{h}</div>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ padding:"40px 16px", textAlign:"center" }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, color:"var(--ghost)", marginBottom:6 }}>
              {search ? "No athletes match your search." : "No athletes in this category."}
            </div>
            {(search || filter !== "all") && (
              <button onClick={() => { setSearch(""); setFilter("all"); }} style={{ padding:"6px 14px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"var(--ghost)", marginTop:8 }}>Clear filters</button>
            )}
          </div>
        ) : filtered.map((row, i) => {
          const sg = getSubGroup(row);
          const sc = STATUS_CFG[sg];
          const isLast = i === filtered.length - 1;

          if (isMobile) {
            return (
              <div key={row.athleteToken} className="onq-row" style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", borderBottom:isLast?"none":"1px solid var(--rim)", background:i%2===0?"var(--surface)":"var(--raised)" }}>
                <div style={{ width:3, height:38, borderRadius:2, background:sc.color, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.athleteName}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                    <StatusDot color={sc.dot} />
                    <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, color:sc.color }}>{sc.label}</span>
                    {row.sport && <span style={{ fontFamily:"var(--font-body)", fontSize:11, color:"var(--muted)" }}>· {row.sport}</span>}
                  </div>
                  {row.adherenceAvg != null && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                      <span style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:13, color:row.adherenceAvg>=80?"var(--green)":row.adherenceAvg>=65?"var(--amber)":"var(--red)" }}>{row.adherenceAvg}%</span>
                      {row.weeklyChecksLogged != null && <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--muted)" }}>{row.weeklyChecksLogged}/{row.weeklyChecksExpected} ✓</span>}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink:0 }}><ActionCell row={row} /></div>
              </div>
            );
          }

          return (
            <div key={row.athleteToken} className="onq-row" style={{ display:"grid", gridTemplateColumns:"1fr 140px 160px 150px", alignItems:"center", padding:"10px 16px", borderBottom:isLast?"none":"1px solid var(--rim)", background:i%2===0?"var(--surface)":"var(--raised)", animationDelay:`${Math.min(i*0.025,0.3)}s` }}>
              {/* Athlete */}
              <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                <div style={{ width:3, height:34, borderRadius:2, background:sc.color, flexShrink:0 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.athleteName}</div>
                  {row.sport && <div style={{ fontFamily:"var(--font-body)", fontSize:11, color:"var(--ghost)", marginTop:1 }}>{row.sport}</div>}
                </div>
              </div>
              {/* Status */}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <StatusDot color={sc.dot} pulse={sg==="noPlan"} />
                <div>
                  <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:11, color:sc.color, textTransform:"uppercase", letterSpacing:"0.05em" }}>{sc.label}</div>
                  {row.plan?.phase && sg !== "noPlan" && (
                    <div style={{ fontFamily:"var(--font-body)", fontSize:10, color:"var(--muted)", marginTop:1 }}>{row.plan.phase} plan</div>
                  )}
                </div>
              </div>
              {/* Adherence */}
              <div style={{ padding:"0 8px" }}><AdherenceCell row={row} /></div>
              {/* Action */}
              <div style={{ display:"flex", justifyContent:"center" }}><ActionCell row={row} /></div>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <div style={{ marginTop:6, textAlign:"right", fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>
          {filtered.length} of {rows.length} athletes
        </div>
      )}
    </div>
  );
}

// ─── Focus mode (optional card-by-card queue UX) ──────────────────────────────
function QueueCard({ row, index, total, onAction, onNavigate: _onNavigate }) {
  const isMobile  = useIsMobile();
  const [anim, setAnim] = useState(false);
  const sg = getSubGroup(row);
  const s  = {
    noPlan:       { label:"No Plan Assigned",      color:"var(--red)",   icon:"⊗", action:"Assign Plan",   desc:"This athlete has no nutrition targets. Assign a plan to enable check-ins." },
    noCheckin:    { label:"Missed Check-In",        color:"var(--amber)", icon:"◎", action:"Send Reminder", desc:"Has a plan but hasn't logged anything this week. Send a reminder email." },
    lowAdherence: { label:`Low Adherence · ${Math.round(row.adherenceAvg||0)}%`, color:"var(--amber)", icon:"▽", action:"Review Plan",   desc:"Logging but only hitting a fraction of their targets week-to-date." },
  }[sg];

  if (!s) return null;

  function handleAction() {
    setAnim(true);
    setTimeout(() => { onAction(row, sg); setAnim(false); }, 400);
  }
  function handleSkip() {
    setAnim(true);
    setTimeout(() => { onAction(row, "skip"); setAnim(false); }, 340);
  }

  return (
    <div style={{ animation:anim?"cardFlip 0.42s var(--ease-snap)":"slideUp 0.4s var(--ease-snap) both" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:12, color:"var(--muted)" }}>{index+1}/{total}</span>
          <div style={{ width:60, height:2, background:"var(--rim)", borderRadius:1, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${((index+1)/total)*100}%`, background:"var(--brand)", transition:"width 0.4s var(--ease-snap)" }} />
          </div>
        </div>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>{total-index-1} left</span>
      </div>
      <div style={{ background:"var(--surface)", border:"1px solid var(--rim)", borderTop:`3px solid ${s.color}`, borderRadius:6, overflow:"hidden" }}>
        <div style={{ padding:isMobile?"18px 16px":"24px 28px 20px", position:"relative" }}>
          <div style={{ position:"absolute", top:14, right:isMobile?14:24, fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?40:52, color:s.color, opacity:0.1, lineHeight:1, userSelect:"none" }}>{s.icon}</div>
          <div style={{ marginBottom:8 }}><Tag color={sg==="noPlan"?"red":"amber"}>{s.label}</Tag></div>
          <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?24:30, color:"var(--ink)", lineHeight:1.05, marginBottom:8 }}>{row.athleteName}</div>
          {row.sport && <div style={{ fontFamily:"var(--font-body)", fontSize:12, color:"var(--ghost)", marginBottom:4 }}>{row.sport}</div>}
        </div>
        <div style={{ height:1, background:"var(--rim)" }} />
        <div style={{ padding:isMobile?"12px 16px":"16px 28px" }}>
          <p style={{ fontSize:14, color:"var(--chalk)", lineHeight:1.6, fontFamily:"var(--font-body)" }}>{s.desc}</p>
        </div>
        <div style={{ height:1, background:"var(--rim)" }} />
        <div style={{ padding:isMobile?"12px 16px":"16px 28px", display:"flex", gap:8 }}>
          {sg === "noCheckin" ? (
            <ReminderCell row={row} onReminderSent={(_tok, data) => { onAction(row, sg, data); }} />
          ) : (
            <button onClick={handleAction} style={{ flex:1, padding:"12px 20px", background:s.color, border:"none", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", transition:"filter 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.filter="brightness(1.1)"}
              onMouseLeave={e => e.currentTarget.style.filter="none"}>
              {s.action}
            </button>
          )}
          <button onClick={handleSkip} style={{ padding:"12px 16px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--muted)", transition:"color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color="var(--ghost)"}
            onMouseLeave={e => e.currentTarget.style.color="var(--muted)"}>
            Skip →
          </button>
        </div>
      </div>
    </div>
  );
}

function FocusModeOverlay({ rows, onClose, onReminderSent, onNavigate, onAssign }) {
  const isMobile = useIsMobile();
  const queue    = useMemo(() => [...rows].filter(r => getUrgency(r) < 3).sort((a,b) => getUrgency(a)-getUrgency(b)), [rows]);
  const [done,   setDone]   = useState([]);
  const [errMsg, setErrMsg] = useState("");

  const remaining = queue.filter(r => !done.includes(r.athleteToken));
  const current   = remaining[0];

  function handleAction(row, type, reminderData) {
    setErrMsg("");
    if (type === "skip")          { setDone(d => [...d, row.athleteToken]); return; }
    if (type === "noCheckin")     {
      if (reminderData) onReminderSent?.(row.athleteToken, reminderData);
      setDone(d => [...d, row.athleteToken]);
      return;
    }
    if (type === "noPlan")        { onAssign?.(row); return; }
    if (type === "lowAdherence")  { onNavigate?.(row); setDone(d => [...d, row.athleteToken]); return; }
  }

  const allDone = remaining.length === 0;

  return (
    <div style={{ position:"fixed", inset:0, background:"var(--void)", zIndex:100, overflowY:"auto" }}>
      <div style={{ maxWidth:560, margin:"0 auto", padding:isMobile?"16px 12px 80px":"28px 20px 60px" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:10, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--ghost)", marginBottom:4 }}>Focus Mode</div>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?18:22, color:"var(--ink)" }}>Work Through the Queue</div>
          </div>
          <button onClick={onClose} style={{ padding:"8px 16px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--ghost)" }}>
            ← Exit
          </button>
        </div>

        {errMsg && (
          <div style={{ marginBottom:12, padding:"10px 14px", background:"var(--red-bg)", border:"1px solid var(--red-rim)", borderRadius:4, color:"var(--red)", fontSize:13 }}>⚠ {errMsg}</div>
        )}

        {allDone ? (
          <div className="anim-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"60px 24px", textAlign:"center" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:"var(--green-bg)", border:"1px solid var(--green-rim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, marginBottom:18 }}>✓</div>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:28, color:"var(--ink)", marginBottom:8 }}>Queue Clear</div>
            <div style={{ fontSize:14, color:"var(--ghost)", fontFamily:"var(--font-body)", maxWidth:260, lineHeight:1.6, marginBottom:28 }}>
              You've worked through everyone. Come back Thursday to check adherence.
            </div>
            <button onClick={onClose} style={{ padding:"11px 24px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:13, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--chalk)" }}>Back to Roster</button>
          </div>
        ) : queue.length === 0 ? (
          <div className="anim-up" style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:24, color:"var(--green)", marginBottom:8 }}>All clear</div>
            <div style={{ fontSize:14, color:"var(--ghost)", fontFamily:"var(--font-body)" }}>No athletes need attention right now.</div>
            <button onClick={onClose} style={{ marginTop:20, padding:"10px 22px", background:"var(--raised)", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"var(--chalk)" }}>Back to Roster</button>
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

  const { loading, error, rows, updatedLabel, refresh, patchRow } = useNutritionQueue({ enabled: Boolean(authReady && user) });
  const { status: seasonStatus } = useSeasonStatus({ enabled: Boolean(authReady && user) });

  const [assignRow,   setAssignRow]   = useState(null);
  const [focusMode,   setFocusMode]   = useState(false);

  const actionCount = useMemo(() => rows.filter(r => getUrgency(r) < 3).length, [rows]);

  const handleReminderSent = useCallback((athleteToken, data) => {
    patchRow(athleteToken, { lastReminderSentAt: data.lastReminderSentAt, reminderCount: data.reminderCount });
  }, [patchRow]);

  const navigateToAthlete = useCallback((row) => {
    if (row?.athleteToken) router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(row.athleteToken)}`);
  }, [router]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />
      <div className="onq" style={{ minHeight:"100vh" }}>

        {/* ── Sticky page header ── */}
        <div style={{ position:"sticky", top:0, zIndex:90, background:"var(--deep)", borderBottom:"1px solid var(--rim)" }}>
          <div style={{ maxWidth:860, margin:"0 auto", padding:isMobile?"0 12px":"0 20px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            {/* Left */}
            <div style={{ display:"flex", alignItems:"center", gap:isMobile?8:14, minWidth:0 }}>
              <span style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:isMobile?13:15, letterSpacing:"0.12em", color:"var(--brand)", textTransform:"uppercase", flexShrink:0 }}>PEAK</span>
              <span style={{ width:1, height:18, background:"var(--rim)", flexShrink:0 }} />
              <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:isMobile?12:13, letterSpacing:"0.08em", color:"var(--chalk)", textTransform:"uppercase" }}>Nutrition</span>
              {!isMobile && (
                <>
                  <span style={{ width:1, height:18, background:"var(--rim)", flexShrink:0 }} />
                  <span style={{ fontFamily:"var(--font-body)", fontSize:12, color:"var(--muted)" }}>{getWeekLabel()}</span>
                </>
              )}
            </div>
            {/* Right */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              <CaraChip status={seasonStatus} />
              {actionCount > 0 && (
                <button onClick={() => setFocusMode(true)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px", background:"var(--brand)", border:"none", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:isMobile?11:12, letterSpacing:"0.08em", textTransform:"uppercase", color:"#fff", transition:"filter 0.15s", whiteSpace:"nowrap" }}
                  onMouseEnter={e => e.currentTarget.style.filter="brightness(1.1)"}
                  onMouseLeave={e => e.currentTarget.style.filter="none"}>
                  {isMobile ? `Focus (${actionCount})` : <>Focus Mode <span style={{ fontFamily:"var(--font-mono)", opacity:0.6, fontSize:11 }}>→</span></>}
                </button>
              )}
              <button onClick={() => router.push("/org/workouts-calendar")} style={{ padding:"6px 12px", background:"transparent", border:"1px solid var(--rim)", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:600, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ghost)", transition:"all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color="var(--chalk)"; e.currentTarget.style.borderColor="var(--wire)"; }}
                onMouseLeave={e => { e.currentTarget.style.color="var(--ghost)"; e.currentTarget.style.borderColor="var(--rim)"; }}>
                {isMobile ? "◀" : "← Workouts"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <main style={{ maxWidth:860, margin:"0 auto", padding:isMobile?"16px 12px 80px":"24px 20px 60px" }}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[60,200,44,300].map(h => (
                <div key={h} style={{ height:h, borderRadius:6, background:"linear-gradient(90deg,var(--raised)25%,var(--panel)50%,var(--raised)75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite", border:"1px solid var(--rim)" }} />
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && rows.length === 0 && (
            <div style={{ padding:"16px", background:"var(--red-bg)", border:"1px solid var(--red-rim)", borderLeft:"3px solid var(--red)", borderRadius:6, display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:14, color:"var(--red)", marginBottom:4 }}>Failed to load</div>
                <div style={{ fontSize:13, color:"var(--ghost)", fontFamily:"var(--font-body)" }}>{error}</div>
              </div>
              <button onClick={refresh} style={{ padding:"7px 14px", background:"var(--red)", border:"none", borderRadius:3, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:700, fontSize:12, textTransform:"uppercase", color:"#fff", flexShrink:0 }}>Retry</button>
            </div>
          )}

          {/* Loaded state */}
          {!loading && rows.length === 0 && !error && (
            <div className="anim-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"80px 24px", textAlign:"center" }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--green-bg)", border:"1px solid var(--green-rim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:16 }}>✓</div>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:900, fontSize:24, color:"var(--ink)", marginBottom:8 }}>No athletes yet</div>
              <div style={{ fontSize:14, color:"var(--ghost)", fontFamily:"var(--font-body)", maxWidth:260, lineHeight:1.6 }}>Add athletes to your roster to start tracking nutrition compliance.</div>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <>
              {/* Mobile week label */}
              {isMobile && (
                <div style={{ fontFamily:"var(--font-body)", fontSize:12, color:"var(--muted)", marginBottom:10 }}>{getWeekLabel()}</div>
              )}

              {/* Stats bar */}
              <StatsBar rows={rows} />

              {/* Focus mode button (mobile) */}
              {isMobile && actionCount > 0 && (
                <button onClick={() => setFocusMode(true)} style={{ width:"100%", padding:"11px", background:"var(--brand)", border:"none", borderRadius:4, cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:800, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", color:"#fff", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  Focus Mode — {actionCount} to review →
                </button>
              )}

              {/* Roster table */}
              <AthleteTable
                rows={rows}
                onAssign={row => setAssignRow(row)}
                onReminderSent={handleReminderSent}
                onNavigate={navigateToAthlete}
              />
            </>
          )}

          {/* Last updated */}
          {!loading && updatedLabel && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16 }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--muted)" }}>Updated {updatedLabel}</span>
              <button onClick={refresh} style={{ background:"transparent", border:"none", cursor:"pointer", fontFamily:"var(--font-display)", fontWeight:600, fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--ghost)", padding:"2px 0" }}
                onMouseEnter={e => e.currentTarget.style.color="var(--chalk)"}
                onMouseLeave={e => e.currentTarget.style.color="var(--ghost)"}>
                Refresh ↺
              </button>
            </div>
          )}
        </main>

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
      </div>
    </>
  );
}
