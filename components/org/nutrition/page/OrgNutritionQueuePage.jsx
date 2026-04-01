import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/router";

// ─── Real imports — uncomment when integrating ────────────────────────────────
// import { useAuthContext } from "@/hooks/useAuth";
// import { useNutritionQueue } from "@/hooks/org/useNutritionQueue";
// import { safeJson } from "@/lib/org/dashboard-utils";
// import { normalizeRole, isOrgSideRole } from "@/lib/org/nutrition/pageUtils";
// Then delete everything between the "STUB START" and "STUB END" comments below.

// ─── STUB START — remove when using real hooks ────────────────────────────────
function useAuthContext() {
  return { user: { role: "org_admin" }, authReady: true };
}

// Normalise a todaySummary response into queue rows — kept outside hook so it's stable
function normaliseSummaryResponse(json) {
  const needsList = Array.isArray(json?.needsList) ? json.needsList : [];
  const summary   = json?.summary ?? {};

  const noPlanRows = needsList.map(a => ({
    athleteToken:   a.token  || a.athleteToken || "",
    athleteName:    a.name   || a.athleteName  || "Athlete",
    position:       a.position || "",
    team:           a.team     || "",
    sport:          a.sport    || "",
    hasPlan:        false,
    missingCheckin: false,
    adherenceAvg:   null,
    lastSeen:       a.lastSeen ?? null,
  }));

  const withPlan     = Number(summary.withPlan    || 0);
  const totalCount   = Number(summary.totalAthletes || 0);
  // onTrackCount = athletes who have a plan (they may still be missing check-ins,
  // but that's unknown from this endpoint — the /queue endpoint gives full detail)
  const onTrackCount = withPlan;

  return {
    rows: noPlanRows,
    meta: {
      weekStartISO: new Date().toISOString().slice(0, 10),
      sports:       [],
      teams:        [],
      totalAthletes: totalCount,
      onTrackCount,
    },
  };
}

/**
 * Inline data hook — mirrors the shape of the real useNutritionQueue hook.
 *
 * Data strategy (tried in order):
 *   1. /api/org/nutrition/queue          — dedicated queue endpoint (preferred)
 *   2. /api/org/nutrition/todaySummary   — same endpoint as TodayNutritionPanel
 *   3. MOCK_ATHLETES                     — local fallback, always works in dev.
 */
function useNutritionQueue({ enabled } = {}) {
  const [loading,          setLoading]          = useState(true);
  const [rows,             setRows]             = useState([]);
  const [error,            setError]            = useState(null);
  const [meta,             setMeta]             = useState(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);

    // ── 1. Try dedicated queue endpoint ──────────────────────────────────────
    try {
      const res  = await fetch("/api/org/nutrition/queue", { credentials: "include" });
      const json = await res.json().catch(() => null);

      if (res.ok && Array.isArray(json?.rows)) {
        setRows(json.rows);
        setMeta(json.meta ?? null);
        setLastUpdatedLabel("just now");
        setLoading(false);
        return;
      }
    } catch (_) { /* fall through */ }

    // ── 2. Try todaySummary (same endpoint as TodayNutritionPanel) ────────────
    try {
      const res  = await fetch("/api/org/nutrition/todaySummary", { credentials: "include" });
      const json = await res.json().catch(() => null);

      if (res.ok && (json?.summary || json?.needsList)) {
        const { rows: normRows, meta: normMeta } = normaliseSummaryResponse(json);
        setRows(normRows);
        setMeta(normMeta);
        setLastUpdatedLabel("via summary");
        setLoading(false);
        return;
      }
    } catch (_) { /* fall through */ }

    // ── 3. Fallback to mock data (dev / offline) ──────────────────────────────
    console.warn("[useNutritionQueue] Both API endpoints unavailable — using mock data.");
    setRows(MOCK_ATHLETES);
    setMeta({
      weekStartISO: new Date().toISOString().slice(0, 10),
      sports: ["Football"],
      teams:  ["Offense", "Defense"],
    });
    setLastUpdatedLabel("demo data");
    setLoading(false);
  }, [enabled]);

  useEffect(() => { load(); }, [load]);

  return { loading, error, rows, meta, lastUpdatedLabel, refresh: load };
}
// ─── STUB END ─────────────────────────────────────────────────────────────────

// ─── Mock data for demonstration ──────────────────────────────────────────────
const MOCK_ATHLETES = [
  { athleteToken: "t1",  athleteName: "Marcus Williams",  position: "OT",  team: "Offense", sport: "Football", hasPlan: false, missingCheckin: false, adherenceAvg: null,  lastSeen: 6 },
  { athleteToken: "t2",  athleteName: "Devon Carter",     position: "DE",  team: "Defense", sport: "Football", hasPlan: false, missingCheckin: false, adherenceAvg: null,  lastSeen: 3 },
  { athleteToken: "t3",  athleteName: "Jaylen Brooks",    position: "QB",  team: "Offense", sport: "Football", hasPlan: true,  missingCheckin: true,  adherenceAvg: null,  lastSeen: 5, lastReminderSentAt: new Date(Date.now() - 6*60*60*1000).toISOString(),  reminderCount: 1 },
  { athleteToken: "t4",  athleteName: "Trevon Mills",     position: "LB",  team: "Defense", sport: "Football", hasPlan: true,  missingCheckin: true,  adherenceAvg: null,  lastSeen: 4, lastReminderSentAt: new Date(Date.now() - 14*60*60*1000).toISOString(), reminderCount: 2 },
  { athleteToken: "t5",  athleteName: "Caleb Rhodes",     position: "WR",  team: "Offense", sport: "Football", hasPlan: true,  missingCheckin: false, adherenceAvg: 52,    lastSeen: 1 },
  { athleteToken: "t6",  athleteName: "Isaiah Grant",     position: "CB",  team: "Defense", sport: "Football", hasPlan: true,  missingCheckin: false, adherenceAvg: 61,    lastSeen: 1 },
  { athleteToken: "t7",  athleteName: "Darius Thompson",  position: "RB",  team: "Offense", sport: "Football", hasPlan: true,  missingCheckin: false, adherenceAvg: 88,    lastSeen: 0 },
  { athleteToken: "t8",  athleteName: "Malik Johnson",    position: "S",   team: "Defense", sport: "Football", hasPlan: true,  missingCheckin: false, adherenceAvg: 94,    lastSeen: 0 },
  { athleteToken: "t9",  athleteName: "Jordan Pierce",    position: "TE",  team: "Offense", sport: "Football", hasPlan: true,  missingCheckin: false, adherenceAvg: 79,    lastSeen: 1 },
  { athleteToken: "t10", athleteName: "Elijah Foster",    position: "DT",  team: "Defense", sport: "Football", hasPlan: true,  missingCheckin: false, adherenceAvg: 91,    lastSeen: 0 },
  { athleteToken: "t11", athleteName: "Noah Washington",  position: "OG",  team: "Offense", sport: "Football", hasPlan: false, missingCheckin: false, adherenceAvg: null,  lastSeen: 8 },
  { athleteToken: "t12", athleteName: "Cameron Davis",    position: "MLB", team: "Defense", sport: "Football", hasPlan: true,  missingCheckin: true,  adherenceAvg: null,  lastSeen: 7 },
];

const PLAN_PRESETS = [
  { label: "Bulk",     calories: 4200, protein: 225, carbs: 480, fat: 110, phase: "Surplus",  desc: "Linemen / heavy skill" },
  { label: "Maintain", calories: 3200, protein: 185, carbs: 360, fat: 95,  phase: "Maintain", desc: "Standard in-season"    },
  { label: "Cut",      calories: 2700, protein: 210, carbs: 270, fat: 75,  phase: "Cut",      desc: "Weight management"     },
  { label: "Skill",    calories: 3600, protein: 195, carbs: 420, fat: 90,  phase: "Maintain", desc: "Speed / skill spots"   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSubGroup(row) {
  if (!row?.hasPlan)       return "noPlan";
  if (row?.missingCheckin) return "noCheckin";
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

// ─── Reminder tally helpers ──────────────────────────────────────────────────
const REMINDER_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

function getReminderState(row) {
  const sentAt = row?.lastReminderSentAt ? new Date(row.lastReminderSentAt) : null;
  const count  = Number(row?.reminderCount || 0);
  if (!sentAt || isNaN(sentAt.getTime())) return { sent: false, canResend: false, hoursAgo: null, count };
  const msAgo    = Date.now() - sentAt.getTime();
  const hoursAgo = Math.floor(msAgo / (1000 * 60 * 60));
  const canResend = msAgo >= REMINDER_WINDOW_MS;
  return { sent: true, canResend, hoursAgo, count };
}

function formatHoursAgo(h) {
  if (h == null) return "";
  if (h < 1)    return "less than 1 hour ago";
  if (h === 1)  return "1 hour ago";
  if (h < 24)   return `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

function getDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "MORNING BRIEF";
  if (h < 17) return "AFTERNOON CHECK";
  return "END OF DAY";
}

function getWeekLabel() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// ─── Global styles injected once ─────────────────────────────────────────────
// NOTE: Move font @import, CSS vars, and @keyframes to _app.js / globals.css
// to avoid re-injecting on every mount. The body/reset rules below are scoped
// to .onq-root to prevent bleeding into other pages.
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Barlow:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

  :root {
    --void: #F7F9FC;
    --deep: #FFFFFF;
    --surface: #FFFFFF;
    --raised: #F2F5F9;
    --panel: #EBF0F7;
    --rim: #DDE4EE;
    --wire: #C8D3E3;
    --muted: #9AAABF;
    --ghost: #6B7E99;
    --fog:   #4E6080;
    --chalk: #2D3E56;
    --ice:   #1A2B40;
    --ink:   #0D1B2A;

    --red:    #D92B3A;
    --red-bg: rgba(217,43,58,0.06);
    --red-rim: rgba(217,43,58,0.2);

    --amber:    #C47A00;
    --amber-bg: rgba(196,122,0,0.06);
    --amber-rim: rgba(196,122,0,0.2);

    --green:    #0A8A4A;
    --green-bg: rgba(10,138,74,0.06);
    --green-rim: rgba(10,138,74,0.2);

    --brand:    #0070CC;
    --brand-bg: rgba(0,112,204,0.06);
    --brand-rim: rgba(0,112,204,0.18);

    --font-display: 'Barlow Condensed', sans-serif;
    --font-body:    'Barlow', sans-serif;
    --font-mono:    'JetBrains Mono', monospace;

    --ease-snap: cubic-bezier(0.16, 1, 0.3, 1);
    --ease-out:  cubic-bezier(0.0, 0.0, 0.2, 1);
  }

  /* Scoped reset — only affects this page's tree */
  .onq-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .onq-root {
    background: var(--void);
    color: var(--ink);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar */
  .onq-root ::-webkit-scrollbar { width: 4px; height: 4px; }
  .onq-root ::-webkit-scrollbar-track { background: var(--panel); }
  .onq-root ::-webkit-scrollbar-thumb { background: var(--wire); border-radius: 2px; }

  /* Animations */
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes cardFlip {
    0%   { opacity: 1; transform: translateY(0) scale(1); }
    40%  { opacity: 0; transform: translateY(-20px) scale(0.97); }
    60%  { opacity: 0; transform: translateY(20px) scale(0.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  @keyframes scanline {
    from { background-position: 0 0; }
    to   { background-position: 0 100%; }
  }
  @keyframes progressFill {
    from { width: 0; }
    to   { width: var(--target-w); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    from { background-position: -200% 0; }
    to   { background-position:  200% 0; }
  }

  .anim-slide-up    { animation: slideUp 0.45s var(--ease-snap) both; }
  .anim-fade-in     { animation: fadeIn 0.3s ease both; }
  .anim-slide-right { animation: slideInRight 0.4s var(--ease-snap) both; }
  .anim-slide-left  { animation: slideInLeft 0.35s var(--ease-snap) both; }

  .delay-1 { animation-delay: 0.05s; }
  .delay-2 { animation-delay: 0.10s; }
  .delay-3 { animation-delay: 0.15s; }
  .delay-4 { animation-delay: 0.20s; }
  .delay-5 { animation-delay: 0.25s; }

  /* Scan line overlay on dark panels */
  .scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.04) 2px,
      rgba(0,0,0,0.04) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  /* Noise texture */
  .noise::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
`;

// ─── Tiny primitives ──────────────────────────────────────────────────────────
function Tag({ children, color = "brand" }) {
  const map = {
    brand: { bg: "var(--brand-bg)",   border: "var(--brand-rim)",  color: "var(--brand)"  },
    red:   { bg: "var(--red-bg)",     border: "var(--red-rim)",    color: "var(--red)"    },
    amber: { bg: "var(--amber-bg)",   border: "var(--amber-rim)",  color: "var(--amber)"  },
    green: { bg: "var(--green-bg)",   border: "var(--green-rim)",  color: "var(--green)"  },
    ghost: { bg: "transparent",       border: "var(--wire)",       color: "var(--ghost)"  },
  };
  const t = map[color] || map.brand;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px",
      borderRadius: 2,
      border: `1px solid ${t.border}`,
      background: t.bg,
      color: t.color,
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      lineHeight: 1.6,
    }}>
      {children}
    </span>
  );
}

function Divider({ my = 16 }) {
  return <div style={{ height: 1, background: "var(--rim)", margin: `${my}px 0` }} />;
}

function StatusDot({ color = "green", pulse = false }) {
  const colors = { green: "var(--green)", red: "var(--red)", amber: "var(--amber)", ghost: "var(--ghost)" };
  return (
    <span style={{
      display: "inline-block",
      width: 7, height: 7,
      borderRadius: "50%",
      background: colors[color] || colors.green,
      flexShrink: 0,
      animation: pulse ? "pulse 1.8s ease-in-out infinite" : "none",
    }} />
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = "var(--brand)", height = 3, animate = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height, background: "var(--rim)", borderRadius: height, overflow: "hidden", position: "relative" }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        background: color,
        borderRadius: height,
        transition: animate ? "width 0.8s var(--ease-snap)" : "none",
      }} />
    </div>
  );
}

// ─── Nav bar ──────────────────────────────────────────────────────────────────
function NavBar({ mode, onMode, actCount, onDashboard, onPlans }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", height: 48,
      background: "var(--deep)",
      borderBottom: "1px solid var(--rim)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Logo mark */}
        <div style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: "0.12em",
          color: "var(--brand)",
          textTransform: "uppercase",
        }}>
          PEAK
        </div>
        <div style={{ width: 1, height: 20, background: "var(--rim)" }} />
        <span style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.08em",
          color: "var(--ghost)",
          textTransform: "uppercase",
        }}>
          Nutrition Queue
        </span>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--rim)",
        borderRadius: 4,
        padding: 3,
        gap: 2,
      }}>
        {[
          { key: "queue",  label: "Queue"  },
          { key: "list",   label: "Actions" },
          { key: "roster", label: "Roster"  },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => onMode(key)} style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "5px 12px",
            borderRadius: 3,
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: mode === key ? "var(--brand)" : "transparent",
            color: mode === key ? "var(--void)" : "var(--ghost)",
          }}>
            {label}
            {key === "queue" && actCount > 0 && (
              <span style={{
                marginLeft: 6,
                background: mode === key ? "rgba(0,0,0,0.25)" : "var(--red)",
                color: mode === key ? "rgba(0,0,0,0.7)" : "#fff",
                borderRadius: 10,
                padding: "0 5px",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}>
                {actCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[
          { label: "Dashboard", fn: onDashboard },
          { label: "Plans",     fn: onPlans     },
        ].map(({ label, fn }) => (
          <button key={label} onClick={fn} style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: 3,
            color: "var(--ghost)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--chalk)"; e.currentTarget.style.borderColor = "var(--wire)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--ghost)"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Program Readiness Strip ──────────────────────────────────────────────────
function ReadinessStrip({ rows, actionCount }) {
  const total = rows.length;
  const ready = rows.filter(r => getSubGroup(r) === "onTrack").length;
  const pct = total ? Math.round((ready / total) * 100) : 0;
  const adh = avgAdh(rows.filter(r => r.hasPlan && !r.missingCheckin));

  const color = pct >= 85 ? "var(--green)" : pct >= 65 ? "var(--amber)" : "var(--red)";

  return (
    <div className="anim-slide-up" style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 24,
      alignItems: "center",
      padding: "16px 20px",
      background: "var(--surface)",
      border: "1px solid var(--rim)",
      borderLeft: `3px solid ${color}`,
      borderRadius: 4,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: 42,
            lineHeight: 1,
            color,
            letterSpacing: "-0.02em",
          }}>
            {pct}%
          </span>
          <div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--chalk)",
            }}>
              Program Readiness
            </div>
            <div style={{ fontSize: 12, color: "var(--ghost)", fontFamily: "var(--font-body)" }}>
              {ready} of {total} athletes on track this week
            </div>
          </div>
        </div>
        <ProgressBar value={ready} max={total} color={color} height={4} />
      </div>

      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        {[
          { label: "Need Action",  value: actionCount,       color: actionCount > 0 ? "var(--red)" : "var(--green)" },
          { label: "Avg Adherence", value: adh != null ? `${adh}%` : "—", color: adh == null ? "var(--ghost)" : adh >= 80 ? "var(--green)" : adh >= 65 ? "var(--amber)" : "var(--red)" },
          { label: "Week",          value: getWeekLabel(),   color: "var(--ghost)" },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{ textAlign: "right" }}>
            <div style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 18,
              color: c,
              lineHeight: 1.1,
            }}>
              {value}
            </div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginTop: 2,
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Plan assign slide-over ───────────────────────────────────────────────────
function AssignSlideOver({ row, onClose, onSaved }) {
  const [values, setValues] = useState({ calories: "", protein: "", carbs: "", fat: "", phase: "Maintain", notes: "" });
  const [preset, setPreset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function applyPreset(p) {
    setPreset(p.label);
    setValues(v => ({ ...v, calories: String(p.calories), protein: String(p.protein), carbs: String(p.carbs), fat: String(p.fat), phase: p.phase }));
  }

  function set(key) { return e => { setValues(v => ({ ...v, [key]: e.target.value })); setPreset(null); }; }

  async function save() {
    if (!values.calories || !values.protein) { setErr("Calories and protein required."); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/org/nutrition/assign-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          athleteToken: row?.athleteToken,
          plan: {
            calories: Number(values.calories),
            protein:  Number(values.protein),
            carbs:    Number(values.carbs)  || 0,
            fat:      Number(values.fat)    || 0,
            phase:    values.phase,
            notes:    values.notes,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onSaved?.();
    } catch (e) {
      setErr(e?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    background: "var(--raised)",
    border: "1px solid var(--rim)",
    borderRadius: 3,
    padding: "9px 12px",
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.15s ease",
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(15,30,50,0.4)",
        backdropFilter: "blur(2px)", zIndex: 200, animation: "fadeIn 0.2s ease",
      }} />

      {/* Panel */}
      <div className="anim-slide-right" style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(480px, 100vw)",
        background: "var(--deep)",
        borderLeft: "1px solid var(--rim)",
        zIndex: 201,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--rim)",
          background: "var(--surface)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700, fontSize: 11, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--brand)", marginBottom: 4,
              }}>
                Assign Nutrition Plan
              </div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontWeight: 900, fontSize: 24, color: "var(--ink)", lineHeight: 1.1,
              }}>
                {row?.athleteName || "Athlete"}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {row?.position && <Tag color="ghost">{row.position}</Tag>}
                {row?.team && <Tag color="ghost">{row.team}</Tag>}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{
              background: "var(--raised)", border: "1px solid var(--rim)",
              borderRadius: 3, padding: "6px 8px", cursor: "pointer",
              color: "var(--ghost)", fontSize: 16, lineHeight: 1,
            }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Quick fill presets */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--ghost)", marginBottom: 10,
            }}>
              Quick Fill
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PLAN_PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{
                  padding: "10px 12px",
                  background: preset === p.label ? "var(--brand)" : "var(--raised)",
                  border: `1px solid ${preset === p.label ? "var(--brand)" : "var(--rim)"}`,
                  borderRadius: 3, cursor: "pointer", textAlign: "left",
                  transition: "all 0.15s ease",
                }}>
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14,
                    color: preset === p.label ? "var(--void)" : "var(--ink)",
                    marginBottom: 2,
                  }}>{p.label}</div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    color: preset === p.label ? "rgba(0,0,0,0.55)" : "var(--ghost)",
                  }}>
                    {p.calories} cal · {p.protein}g protein
                  </div>
                  <div style={{
                    fontSize: 10, fontFamily: "var(--font-body)",
                    color: preset === p.label ? "rgba(0,0,0,0.45)" : "var(--muted)",
                    marginTop: 2,
                  }}>
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Divider />

          {/* Macro inputs */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--ghost)", marginBottom: 10,
            }}>
              Targets
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { key: "calories", label: "Calories / day *", placeholder: "3200" },
                { key: "protein",  label: "Protein (g) *",    placeholder: "185"  },
                { key: "carbs",    label: "Carbs (g)",        placeholder: "360"  },
                { key: "fat",      label: "Fat (g)",          placeholder: "95"   },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{
                    display: "block",
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "var(--ghost)", marginBottom: 6,
                  }}>{label}</label>
                  <input
                    type="number" value={values[key]}
                    onChange={set(key)} placeholder={placeholder} min="0"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = "var(--brand)"; e.target.style.boxShadow = "0 0 0 2px var(--brand-bg)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--rim)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Phase */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--ghost)", marginBottom: 6,
            }}>Phase</label>
            <select
              value={values.phase} onChange={set("phase")}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={e => { e.target.style.borderColor = "var(--brand)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--rim)"; }}
            >
              {["Surplus", "Maintain", "Cut", "Game Week", "Bye Week"].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 8 }}>
            <label style={{
              display: "block",
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--ghost)", marginBottom: 6,
            }}>Notes</label>
            <input
              type="text" value={values.notes} onChange={set("notes")}
              placeholder="Optional coaching note…"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = "var(--brand)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--rim)"; }}
            />
          </div>

          {err && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: "var(--red-bg)", border: "1px solid var(--red-rim)",
              borderRadius: 3, color: "var(--red)", fontSize: 13,
              fontFamily: "var(--font-body)",
            }}>{err}</div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--rim)",
          display: "flex", gap: 10,
          background: "var(--surface)",
        }}>
          <button onClick={save} disabled={saving} style={{
            flex: 1, padding: "12px 20px",
            background: saving ? "var(--muted)" : "var(--brand)",
            border: "none", borderRadius: 3, cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase",
            color: saving ? "var(--chalk)" : "var(--void)",
            transition: "all 0.15s ease",
          }}>
            {saving ? "Saving…" : "Save Plan"}
          </button>
          <button onClick={onClose} style={{
            padding: "12px 16px",
            background: "transparent",
            border: "1px solid var(--rim)", borderRadius: 3, cursor: "pointer",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--ghost)",
          }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Reminder control — extracted from ListRow to avoid React remount bug ─────
function ReminderControl({ rs, sending, onRemind }) {
  const hoursLeft = Math.max(1, 12 - (rs.hoursAgo || 0));

  const btnStyle = {
    padding: "7px 14px",
    background: sending ? "transparent" : "var(--amber-bg)",
    border: "1px solid var(--amber-rim)",
    borderRadius: 3, cursor: sending ? "not-allowed" : "pointer",
    fontFamily: "var(--font-display)", fontWeight: 700,
    fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
    color: "var(--amber)", transition: "all 0.15s ease",
  };

  if (!rs.sent) {
    return (
      <button onClick={onRemind} disabled={sending} style={btnStyle}
        onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = "var(--amber)"; e.currentTarget.style.color = "#fff"; }}}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--amber-bg)"; e.currentTarget.style.color = "var(--amber)"; }}
      >
        {sending ? "Sending…" : "Remind"}
      </button>
    );
  }

  if (!rs.canResend) {
    return (
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>
          {rs.count}× sent · {formatHoursAgo(rs.hoursAgo)}
        </div>
        <div style={{
          padding: "6px 10px",
          background: "transparent", border: "1px solid var(--rim)",
          borderRadius: 3,
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "var(--muted)", whiteSpace: "nowrap",
        }}>
          Send Again in {hoursLeft}h
        </div>
      </div>
    );
  }

  // Unlocked resend
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", marginBottom: 3 }}>
        {rs.count}× sent · {formatHoursAgo(rs.hoursAgo)}
      </div>
      <button onClick={onRemind} disabled={sending} style={btnStyle}
        onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = "var(--amber)"; e.currentTarget.style.color = "#fff"; }}}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--amber-bg)"; e.currentTarget.style.color = "var(--amber)"; }}
      >
        {sending ? "Sending…" : "Send Again ↑"}
      </button>
    </div>
  );
}

// ─── Queue mode card ──────────────────────────────────────────────────────────
function QueueCard({ row, index, total, onAction, onAssign, onOpenProfile }) {
  const [animating, setAnimating] = useState(false);
  const sg = getSubGroup(row);

  const statusMap = {
    noPlan:       { label: "No Plan Assigned",        color: "var(--red)",   tag: "red",   icon: "⊗", action: "Assign Plan",   desc: "This athlete has no nutrition targets. Assign a plan to enable check-ins." },
    noCheckin:    { label: "Missed Weekly Check-In",  color: "var(--amber)", tag: "amber", icon: "◎", action: "Send Reminder", desc: "Has a plan but hasn't logged this week. Opens a pre-filled email reminder for you to send directly." },
    lowAdherence: { label: "Low Adherence",           color: "var(--amber)", tag: "amber", icon: "▽", action: "Review Plan",   desc: `Logging consistently but hitting ${Math.round(row.adherenceAvg || 0)}% of targets. Review their plan or coaching notes.` },
  };

  const s = statusMap[sg];

  function handleAction() {
    if (sg === "noPlan") { onAssign(row); return; }
    setAnimating(true);
    setTimeout(() => { onAction(row, sg); setAnimating(false); }, 420);
  }

  function handleSkip() {
    setAnimating(true);
    setTimeout(() => { onAction(row, "skip"); setAnimating(false); }, 380);
  }

  return (
    <div style={{
      position: "relative",
      animation: animating ? "cardFlip 0.42s var(--ease-snap)" : "slideUp 0.4s var(--ease-snap) both",
    }}>
      {/* Progress counter */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
            {index + 1} / {total}
          </span>
          <div style={{ width: 80, height: 2, background: "var(--rim)", borderRadius: 1, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${((index + 1) / total) * 100}%`,
              background: "var(--brand)",
              transition: "width 0.4s var(--ease-snap)",
            }} />
          </div>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
          {total - index - 1} remaining
        </span>
      </div>

      {/* Main card */}
      <div style={{
        background: "var(--surface)",
        border: `1px solid var(--rim)`,
        borderTop: `3px solid ${s.color}`,
        borderRadius: 4,
        overflow: "hidden",
      }}>
        {/* Card header */}
        <div style={{ padding: "24px 28px 20px", position: "relative" }}>
          {/* Big status icon */}
          <div style={{
            position: "absolute", top: 20, right: 24,
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: 48, color: s.color, opacity: 0.12, lineHeight: 1,
            userSelect: "none",
          }}>
            {s.icon}
          </div>

          <div style={{ marginBottom: 8 }}>
            <Tag color={s.tag}>{s.label}</Tag>
          </div>

          <div style={{
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: 32, color: "var(--ink)", lineHeight: 1.05,
            marginBottom: 8,
          }}>
            {row.athleteName}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {row.position && <Tag color="ghost">{row.position}</Tag>}
            {row.team && <Tag color="ghost">{row.team}</Tag>}
            {row.lastSeen > 0 && (
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-body)" }}>
                · Last active {row.lastSeen}d ago
              </span>
            )}
          </div>
        </div>

        <Divider my={0} />

        {/* Status description */}
        <div style={{ padding: "16px 28px" }}>
          <p style={{ fontSize: 14, color: "var(--chalk)", lineHeight: 1.6, fontFamily: "var(--font-body)" }}>
            {s.desc}
          </p>
        </div>

        {/* Adherence bar if relevant */}
        {sg === "lowAdherence" && row.adherenceAvg != null && (
          <div style={{ padding: "0 28px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ghost)" }}>
                Weekly Adherence
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--amber)" }}>
                {Math.round(row.adherenceAvg)}%
              </span>
            </div>
            <ProgressBar value={row.adherenceAvg} max={100} color="var(--amber)" height={4} />
          </div>
        )}

        <Divider my={0} />

        {/* Actions */}
        <div style={{ padding: "16px 28px", display: "flex", gap: 10 }}>
          <button onClick={handleAction} style={{
            flex: 1,
            padding: "13px 20px",
            background: s.color,
            border: "none", borderRadius: 3,
            cursor: "pointer",
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--void)",
            transition: "all 0.15s ease",
            filter: "none",
          }}
          onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
          onMouseLeave={e => e.currentTarget.style.filter = "none"}
          >
            {s.action}
          </button>

          {sg !== "lowAdherence" && (
            <button onClick={() => onOpenProfile(row)} style={{
              padding: "13px 16px",
              background: "transparent",
              border: "1px solid var(--rim)",
              borderRadius: 3, cursor: "pointer",
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--ghost)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--wire)"; e.currentTarget.style.color = "var(--chalk)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--ghost)"; }}
            >
              Profile
            </button>
          )}

          <button onClick={handleSkip} style={{
            padding: "13px 16px",
            background: "transparent",
            border: "1px solid var(--rim)",
            borderRadius: 3, cursor: "pointer",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--muted)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--ghost)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; }}
          >
            Skip →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Queue done state ─────────────────────────────────────────────────────────
function QueueClear({ onViewAll }) {
  return (
    <div className="anim-slide-up" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--green-bg)", border: "1px solid var(--green-rim)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 20,
      }}>
        ✓
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontWeight: 900,
        fontSize: 28, color: "var(--ink)", marginBottom: 8,
      }}>
        Queue Clear
      </div>
      <div style={{
        fontSize: 14, color: "var(--ghost)", fontFamily: "var(--font-body)",
        maxWidth: 280, lineHeight: 1.6, marginBottom: 28,
      }}>
        Everyone is accounted for this week. Come back Thursday to check in on adherence.
      </div>
      <button onClick={onViewAll} style={{
        padding: "11px 24px",
        background: "var(--raised)", border: "1px solid var(--rim)",
        borderRadius: 3, cursor: "pointer",
        fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--chalk)",
      }}>
        View All Athletes
      </button>
    </div>
  );
}

// ─── Queue mode wrapper ───────────────────────────────────────────────────────
function QueueMode({ rows, onRefresh, onViewAll }) {
  const queue = useMemo(
    () => [...rows].filter(r => getUrgency(r) < 3).sort((a, b) => getUrgency(a) - getUrgency(b)),
    [rows]
  );

  const [done,         setDone]         = useState([]);
  const [assignRow,    setAssignRow]    = useState(null);
  const [reminderSent, setReminderSent] = useState([]);
  const [actionError,  setActionError]  = useState("");

  const remaining = queue.filter(r => !done.includes(r.athleteToken));
  const current   = remaining[0];

  async function handleAction(row, type) {
    setActionError("");
    if (type === "skip") {
      setDone(d => [...d, row.athleteToken]);
      return;
    }
    if (type === "noCheckin") {
      try {
        await sendReminderAPI(row.athleteToken);
      } catch (e) {
        setActionError(`Reminder not sent: ${e.message}`);
        return; // Leave in queue so coach can retry
      }
      setReminderSent(r => [...r, row.athleteToken]);
      setDone(d => [...d, row.athleteToken]);
      return;
    }
    if (type === "lowAdherence") {
      setDone(d => [...d, row.athleteToken]);
    }
  }

  function handlePlanSaved() {
    setAssignRow(null);
    if (current) setDone(d => [...d, current.athleteToken]);
    onRefresh?.();
  }

  if (!current && remaining.length === 0 && queue.length > 0) {
    return (
      <>
        <QueueClear onViewAll={onViewAll} />
        {done.length > 0 && (
          <div className="anim-fade-in delay-2" style={{
            marginTop: 24,
            padding: "14px 20px",
            background: "var(--surface)", border: "1px solid var(--rim)", borderRadius: 4,
          }}>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--ghost)", marginBottom: 10,
            }}>
              Completed this session
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {queue.filter(r => done.includes(r.athleteToken)).map(r => (
                <div key={r.athleteToken} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: 13, fontFamily: "var(--font-body)",
                }}>
                  <StatusDot color="green" />
                  <span style={{ color: "var(--chalk)" }}>{r.athleteName}</span>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {reminderSent.includes(r.athleteToken) ? "reminder sent" : getSubGroup(r) === "noPlan" ? "plan assigned" : "reviewed"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  if (queue.length === 0) {
    return <QueueClear onViewAll={onViewAll} />;
  }

  return (
    <div>
      {actionError && (
        <div style={{
          marginBottom: 12, padding: "10px 14px",
          background: "var(--red-bg)", border: "1px solid var(--red-rim)",
          borderRadius: 3, color: "var(--red)", fontSize: 13,
          fontFamily: "var(--font-body)",
        }}>
          ⚠ {actionError}
        </div>
      )}

      {current && (
        <QueueCard
          key={current.athleteToken}
          row={current}
          index={queue.length - remaining.length}
          total={queue.length}
          onAction={handleAction}
          onAssign={setAssignRow}
          onOpenProfile={() => setDone(d => [...d, current.athleteToken])}
        />
      )}

      {/* Skipped pile preview */}
      {done.filter(t => !reminderSent.includes(t) && queue.find(r => r.athleteToken === t && getSubGroup(r) !== "noPlan")).length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-body)", textAlign: "center" }}>
          {done.length} handled so far
        </div>
      )}

      {assignRow && (
        <AssignSlideOver
          row={assignRow}
          onClose={() => setAssignRow(null)}
          onSaved={handlePlanSaved}
        />
      )}
    </div>
  );
}

// ─── Shared send-reminder API call ───────────────────────────────────────────
async function sendReminderAPI(athleteToken) {
  const res  = await fetch("/api/org/nutrition/send-reminder", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ athleteToken }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not build reminder.");
  if (json?.mailto) window.open(json.mailto, "_blank");
  return json;
}

// ─── List view row ────────────────────────────────────────────────────────────
function ListRow({ row, onAssign, onRemind, index }) {
  const sg = getSubGroup(row);

  // Local optimistic reminder state — merges with server data from row props
  const [localSentAt, setLocalSentAt] = useState(null);
  const [localCount,  setLocalCount]  = useState(null);
  const [sending,     setSending]     = useState(false);
  const [sendErr,     setSendErr]     = useState("");

  // Derive reminder state — prefer local optimistic value over stale server data
  const rs = useMemo(() => {
    const mergedRow = {
      ...row,
      lastReminderSentAt: localSentAt || row?.lastReminderSentAt,
      reminderCount:      localCount  ?? row?.reminderCount,
    };
    return getReminderState(mergedRow);
  }, [row, localSentAt, localCount]);

  const statusConfig = {
    noPlan:       { dot: "red",   label: "No Plan",       color: "var(--red)"   },
    noCheckin:    { dot: "amber", label: "No Check-In",   color: "var(--amber)" },
    lowAdherence: { dot: "amber", label: "Low Adherence", color: "var(--amber)" },
    onTrack:      { dot: "green", label: "On Track",      color: "var(--green)" },
  };
  const sc = statusConfig[sg] || statusConfig.onTrack;

  async function handleRemind() {
    if (sending) return;
    setSending(true);
    setSendErr("");
    try {
      await sendReminderAPI(row.athleteToken);
      const now = new Date().toISOString();
      setLocalSentAt(now);
      setLocalCount(c => (c ?? Number(row?.reminderCount || 0)) + 1);
      onRemind?.(row);
    } catch (e) {
      setSendErr(e?.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="anim-slide-up" style={{
      display: "grid",
      gridTemplateColumns: "4px 1fr auto auto",
      alignItems: "center",
      gap: 16,
      padding: "12px 0",
      borderBottom: "1px solid var(--rim)",
      animationDelay: `${index * 0.03}s`,
    }}>
      <div style={{ width: 4, height: 40, background: sc.color, borderRadius: 2, alignSelf: "center" }} />

      <div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 3 }}>
          {row.athleteName}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {row.position && <Tag color="ghost">{row.position}</Tag>}
          {row.team && <Tag color="ghost">{row.team}</Tag>}
          <span style={{ fontSize: 11, color: sc.color, fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {sc.label}
          </span>
          {row.adherenceAvg != null && sg !== "onTrack" && (
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {Math.round(row.adherenceAvg)}%
            </span>
          )}
        </div>
        {sendErr && (
          <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3, fontFamily: "var(--font-body)" }}>
            ⚠ {sendErr}
          </div>
        )}
      </div>

      <div style={{ width: 80, display: "flex", flexDirection: "column", gap: 4 }}>
        {row.adherenceAvg != null && (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ghost)", textAlign: "right" }}>
              {Math.round(row.adherenceAvg)}%
            </div>
            <ProgressBar
              value={row.adherenceAvg} max={100}
              color={row.adherenceAvg >= 80 ? "var(--green)" : row.adherenceAvg >= 65 ? "var(--amber)" : "var(--red)"}
              height={3}
            />
          </>
        )}
      </div>

      <div>
        {sg === "noPlan" && (
          <button onClick={() => onAssign(row)} style={{
            padding: "7px 14px",
            background: "var(--red-bg)", border: "1px solid var(--red-rim)",
            borderRadius: 3, cursor: "pointer",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--red)", transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--red-bg)"; e.currentTarget.style.color = "var(--red)"; }}
          >
            Assign Plan
          </button>
        )}
        {sg === "noCheckin" && (
          <ReminderControl rs={rs} sending={sending} onRemind={handleRemind} />
        )}
        {(sg === "lowAdherence" || sg === "onTrack") && (
          <button style={{
            padding: "7px 14px",
            background: "transparent", border: "1px solid var(--rim)",
            borderRadius: 3, cursor: "pointer",
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--ghost)",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--wire)"; e.currentTarget.style.color = "var(--chalk)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--ghost)"; }}
          >
            Profile ↗
          </button>
        )}
      </div>
    </div>
  );
}

// ─── List mode ────────────────────────────────────────────────────────────────
function ListMode({ rows }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [assignRow, setAssignRow] = useState(null);

  const filtered = useMemo(() => {
    let out = [...rows];
    const q = search.trim().toLowerCase();
    if (q) out = out.filter(r =>
      (r.athleteName || "").toLowerCase().includes(q) ||
      (r.position || "").toLowerCase().includes(q) ||
      (r.team || "").toLowerCase().includes(q)
    );
    if (filter !== "all") out = out.filter(r => getSubGroup(r) === filter);
    return out.sort((a, b) => getUrgency(a) - getUrgency(b));
  }, [rows, search, filter]);

  const counts = useMemo(() => ({
    all:          rows.length,
    noPlan:       rows.filter(r => getSubGroup(r) === "noPlan").length,
    noCheckin:    rows.filter(r => getSubGroup(r) === "noCheckin").length,
    lowAdherence: rows.filter(r => getSubGroup(r) === "lowAdherence").length,
    onTrack:      rows.filter(r => getSubGroup(r) === "onTrack").length,
  }), [rows]);

  const filters = [
    { key: "all",          label: "All",          count: counts.all          },
    { key: "noPlan",       label: "No Plan",       count: counts.noPlan       },
    { key: "noCheckin",    label: "No Check-In",   count: counts.noCheckin    },
    { key: "lowAdherence", label: "Low Adherence", count: counts.lowAdherence },
    { key: "onTrack",      label: "On Track",      count: counts.onTrack      },
  ];

  return (
    <div>
      {/* Search + filters */}
      <div className="anim-slide-up" style={{
        padding: "16px 20px",
        background: "var(--surface)",
        border: "1px solid var(--rim)",
        borderRadius: 4,
        marginBottom: 12,
      }}>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--muted)", fontSize: 14, pointerEvents: "none",
          }}>⌕</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search athletes, position, team…"
            style={{
              width: "100%", padding: "9px 12px 9px 34px",
              background: "var(--raised)", border: "1px solid var(--rim)",
              borderRadius: 3, color: "var(--ink)",
              fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
              transition: "border-color 0.15s ease",
            }}
            onFocus={e => e.target.style.borderColor = "var(--brand)"}
            onBlur={e => e.target.style.borderColor = "var(--rim)"}
          />
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: "5px 12px",
              background: filter === key ? "var(--brand)" : "var(--raised)",
              border: `1px solid ${filter === key ? "var(--brand)" : "var(--rim)"}`,
              borderRadius: 20, cursor: "pointer",
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 12, letterSpacing: "0.04em",
              color: filter === key ? "var(--void)" : "var(--ghost)",
              transition: "all 0.15s ease",
            }}>
              {label}
              <span style={{
                marginLeft: 5,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                opacity: filter === key ? 0.6 : 0.5,
              }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="anim-slide-up delay-1" style={{
        background: "var(--surface)",
        border: "1px solid var(--rim)",
        borderRadius: 4,
        padding: "0 20px",
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "40px 0", textAlign: "center",
            fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ghost)",
          }}>
            No athletes match your filters.
          </div>
        ) : (
          filtered.map((row, i) => (
            <ListRow
              key={row.athleteToken}
              row={row}
              index={i}
              onAssign={setAssignRow}
              onRemind={() => {}}
            />
          ))
        )}
      </div>

      {assignRow && (
        <AssignSlideOver
          row={assignRow}
          onClose={() => setAssignRow(null)}
          onSaved={() => setAssignRow(null)}
        />
      )}
    </div>
  );
}

// ─── Summary hero ─────────────────────────────────────────────────────────────
function SummaryHero({ rows, onEnterQueue }) {
  const actionCount = rows.filter(r => getUrgency(r) < 3).length;
  const urgent    = rows.filter(r => getSubGroup(r) === "noPlan").length;
  const noCheckin = rows.filter(r => getSubGroup(r) === "noCheckin").length;

  return (
    <div className="anim-slide-up" style={{
      padding: "28px 28px 24px",
      background: "var(--surface)",
      border: "1px solid var(--rim)",
      borderTop: actionCount > 0 ? "3px solid var(--red)" : "3px solid var(--green)",
      borderRadius: 4,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        fontFamily: "var(--font-display)", fontWeight: 900,
        fontSize: 160, lineHeight: 1,
        color: actionCount > 0 ? "var(--red)" : "var(--green)",
        opacity: 0.04,
        userSelect: "none",
        pointerEvents: "none",
      }}>
        {actionCount}
      </div>

      <div style={{ position: "relative" }}>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--ghost)", marginBottom: 6,
        }}>
          {getDayGreeting()} · {getWeekLabel()}
        </div>

        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 900,
          fontSize: 38, lineHeight: 1.05, color: "var(--ink)",
          marginBottom: 6,
        }}>
          {actionCount > 0
            ? <><span style={{ color: "var(--red)" }}>{actionCount} athletes</span> need your attention.</>
            : <>Program is <span style={{ color: "var(--green)" }}>locked in</span> this week.</>
          }
        </div>

        {actionCount > 0 && (
          <div style={{
            fontSize: 14, color: "var(--ghost)", fontFamily: "var(--font-body)",
            marginBottom: 24, lineHeight: 1.5,
          }}>
            {urgent > 0 && `${urgent} without a plan`}
            {urgent > 0 && noCheckin > 0 && " · "}
            {noCheckin > 0 && `${noCheckin} missed their check-in`}
          </div>
        )}

        {actionCount === 0 && (
          <div style={{
            fontSize: 14, color: "var(--ghost)", fontFamily: "var(--font-body)",
            marginBottom: 24,
          }}>
            All athletes have plans and have checked in. Average adherence is looking good.
          </div>
        )}

        {actionCount > 0 && (
          <button onClick={onEnterQueue} style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "13px 28px",
            background: "var(--brand)",
            border: "none", borderRadius: 3,
            cursor: "pointer",
            fontFamily: "var(--font-display)", fontWeight: 800,
            fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--void)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
          onMouseLeave={e => e.currentTarget.style.filter = "none"}
          >
            Work the Queue
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.6 }}>→</span>
          </button>
        )}
      </div>
    </div>
  );
}


// ─── Roster Mode ──────────────────────────────────────────────────────────────
function RosterMode({ rows, onAssign }) {
  const [search,       setSearch]       = useState("");
  const [sortKey,      setSortKey]      = useState("status");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sendingToken, setSendingToken] = useState(null);
  const [sentTokens,   setSentTokens]   = useState(new Set());

  const filtered = useMemo(() => {
    let out = [...rows];
    const q = search.trim().toLowerCase();
    if (q) out = out.filter(r =>
      (r.athleteName || "").toLowerCase().includes(q) ||
      (r.position || "").toLowerCase().includes(q) ||
      (r.team || "").toLowerCase().includes(q)
    );
    if (filterStatus !== "all") out = out.filter(r => getSubGroup(r) === filterStatus);
    out.sort((a, b) => {
      if (sortKey === "name")      return (a.athleteName || "").localeCompare(b.athleteName || "");
      if (sortKey === "adherence") return (b.adherenceAvg ?? -1) - (a.adherenceAvg ?? -1);
      return getUrgency(a) - getUrgency(b);
    });
    return out;
  }, [rows, search, sortKey, filterStatus]);

  const counts = useMemo(() => ({
    all:          rows.length,
    noPlan:       rows.filter(r => getSubGroup(r) === "noPlan").length,
    noCheckin:    rows.filter(r => getSubGroup(r) === "noCheckin").length,
    lowAdherence: rows.filter(r => getSubGroup(r) === "lowAdherence").length,
    onTrack:      rows.filter(r => getSubGroup(r) === "onTrack").length,
  }), [rows]);

  const statusConfig = {
    noPlan:       { label: "No Plan",       dot: "red",   color: "var(--red)"   },
    noCheckin:    { label: "No Check-In",   dot: "amber", color: "var(--amber)" },
    lowAdherence: { label: "Low Adherence", dot: "amber", color: "var(--amber)" },
    onTrack:      { label: "On Track",      dot: "green", color: "var(--green)" },
  };

  const filterTabs = [
    { key: "all",          label: "All",          count: counts.all          },
    { key: "noPlan",       label: "No Plan",       count: counts.noPlan,       color: "var(--red)"   },
    { key: "noCheckin",    label: "No Check-In",   count: counts.noCheckin,    color: "var(--amber)" },
    { key: "lowAdherence", label: "Low Adherence", count: counts.lowAdherence, color: "var(--amber)" },
    { key: "onTrack",      label: "On Track",      count: counts.onTrack,      color: "var(--green)" },
  ];

  async function handleRosterRemind(row) {
    if (sendingToken) return;
    setSendingToken(row.athleteToken);
    try {
      await sendReminderAPI(row.athleteToken);
      setSentTokens(s => new Set([...s, row.athleteToken]));
    } catch (_) {
      // Failure is silent in the compact roster view — user can switch to
      // Actions tab for full reminder state and error details.
    } finally {
      setSendingToken(null);
    }
  }

  return (
    <div className="anim-slide-up">
      {/* Toolbar */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 10,
        padding: "14px 16px",
        background: "var(--surface)",
        border: "1px solid var(--rim)",
        borderRadius: 4,
        marginBottom: 10,
      }}>
        {/* Search + sort */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "var(--muted)", fontSize: 13, pointerEvents: "none",
            }}>⌕</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, position, team…"
              style={{
                width: "100%", padding: "8px 10px 8px 30px",
                background: "var(--raised)", border: "1px solid var(--rim)",
                borderRadius: 3, color: "var(--ink)",
                fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = "var(--brand)"}
              onBlur={e => e.target.style.borderColor = "var(--rim)"}
            />
          </div>
          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            style={{
              padding: "8px 10px",
              background: "var(--raised)", border: "1px solid var(--rim)",
              borderRadius: 3, color: "var(--ghost)",
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 12, letterSpacing: "0.04em", outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="status">Sort: Status</option>
            <option value="name">Sort: Name</option>
            <option value="adherence">Sort: Adherence</option>
          </select>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filterTabs.map(({ key, label, count, color }) => (
            <button key={key} onClick={() => setFilterStatus(key)} style={{
              padding: "4px 10px",
              background: filterStatus === key ? (color || "var(--brand)") : "var(--raised)",
              border: `1px solid ${filterStatus === key ? (color || "var(--brand)") : "var(--rim)"}`,
              borderRadius: 20, cursor: "pointer",
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 11, letterSpacing: "0.04em",
              color: filterStatus === key ? (key === "all" ? "var(--void)" : "#fff") : "var(--ghost)",
              transition: "all 0.15s ease",
            }}>
              {label}
              <span style={{
                marginLeft: 5, fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7,
              }}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary stat bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1,
        background: "var(--rim)",
        border: "1px solid var(--rim)",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 10,
      }}>
        {[
          { label: "Total",       value: counts.all,       color: "var(--brand)" },
          { label: "No Plan",     value: counts.noPlan,    color: counts.noPlan > 0    ? "var(--red)"   : "var(--ghost)" },
          { label: "No Check-In", value: counts.noCheckin, color: counts.noCheckin > 0 ? "var(--amber)" : "var(--ghost)" },
          { label: "On Track",    value: counts.onTrack,   color: counts.onTrack > 0   ? "var(--green)" : "var(--ghost)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "10px 14px", background: "var(--surface)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 600,
              fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--muted)", marginTop: 3,
            }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Roster table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--rim)", borderRadius: 4, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 100px 90px 120px",
          gap: 0,
          padding: "8px 16px",
          background: "var(--raised)",
          borderBottom: "1px solid var(--rim)",
        }}>
          {["Athlete", "Pos", "Status", "Adherence", "Action"].map((h, i) => (
            <div key={h} style={{
              fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "var(--muted)",
              textAlign: i >= 3 ? "center" : "left",
            }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ghost)",
          }}>
            No athletes match your filters.
          </div>
        ) : (
          filtered.map((row, i) => {
            const sg  = getSubGroup(row);
            const sc  = statusConfig[sg];
            const adh = row.adherenceAvg != null ? Math.round(row.adherenceAvg) : null;
            const adhColor = adh == null ? "var(--muted)"
              : adh >= 80 ? "var(--green)"
              : adh >= 65 ? "var(--amber)"
              : "var(--red)";
            const isSending = sendingToken === row.athleteToken;
            const wasSent   = sentTokens.has(row.athleteToken);

            return (
              <div key={row.athleteToken} className="anim-slide-up" style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 100px 90px 120px",
                alignItems: "center",
                gap: 0,
                padding: "10px 16px",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--rim)" : "none",
                background: i % 2 === 0 ? "var(--surface)" : "var(--raised)",
                animationDelay: `${Math.min(i * 0.02, 0.3)}s`,
                transition: "background 0.1s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--panel)"}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--raised)"}
              >
                {/* Name + team */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 3, height: 32, borderRadius: 2, background: sc.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-display)", fontWeight: 700,
                      fontSize: 14, color: "var(--ink)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {row.athleteName}
                    </div>
                    {row.team && (
                      <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ghost)", marginTop: 1 }}>
                        {row.team}
                      </div>
                    )}
                  </div>
                </div>

                {/* Position */}
                <div>
                  {row.position
                    ? <Tag color="ghost">{row.position}</Tag>
                    : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                  }
                </div>

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <StatusDot color={sc.dot} pulse={sg === "noPlan"} />
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>

                {/* Adherence */}
                <div style={{ textAlign: "center" }}>
                  {adh != null ? (
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, color: adhColor, marginBottom: 3 }}>
                        {adh}%
                      </div>
                      <ProgressBar value={adh} max={100} color={adhColor} height={3} animate={false} />
                    </div>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                      {sg === "noPlan" ? "—" : "Pending"}
                    </span>
                  )}
                </div>

                {/* Action */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {sg === "noPlan" && (
                    <button onClick={() => onAssign(row)} style={{
                      padding: "5px 10px",
                      background: "var(--red-bg)", border: "1px solid var(--red-rim)",
                      borderRadius: 3, cursor: "pointer",
                      fontFamily: "var(--font-display)", fontWeight: 700,
                      fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase",
                      color: "var(--red)", whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--red-bg)"; e.currentTarget.style.color = "var(--red)"; }}
                    >
                      Assign Plan
                    </button>
                  )}
                  {sg === "noCheckin" && (
                    wasSent ? (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)" }}>Sent ✓</span>
                    ) : (
                      <button
                        onClick={() => handleRosterRemind(row)}
                        disabled={!!sendingToken}
                        style={{
                          padding: "5px 10px",
                          background: "var(--amber-bg)", border: "1px solid var(--amber-rim)",
                          borderRadius: 3, cursor: sendingToken ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-display)", fontWeight: 700,
                          fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase",
                          color: "var(--amber)", whiteSpace: "nowrap",
                          transition: "all 0.15s ease",
                          opacity: sendingToken && !isSending ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { if (!sendingToken) { e.currentTarget.style.background = "var(--amber)"; e.currentTarget.style.color = "#fff"; }}}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--amber-bg)"; e.currentTarget.style.color = "var(--amber)"; }}
                      >
                        {isSending ? "Sending…" : "Remind"}
                      </button>
                    )
                  )}
                  {sg === "lowAdherence" && (
                    <button style={{
                      padding: "5px 10px",
                      background: "transparent", border: "1px solid var(--rim)",
                      borderRadius: 3, cursor: "pointer",
                      fontFamily: "var(--font-display)", fontWeight: 700,
                      fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase",
                      color: "var(--ghost)", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--wire)"; e.currentTarget.style.color = "var(--chalk)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--rim)"; e.currentTarget.style.color = "var(--ghost)"; }}
                    >
                      Review
                    </button>
                  )}
                  {sg === "onTrack" && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)" }}>✓</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{
          marginTop: 8, textAlign: "right",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)",
        }}>
          {filtered.length} of {rows.length} athletes
        </div>
      )}
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function OrgNutritionQueuePage() {
  const [mode, setMode] = useState("summary"); // summary | queue | list | roster
  const [key,  setKey]  = useState(0); // force re-mount queue on refresh

  // ── Auth & role guard ──────────────────────────────────────────────────────
  const router = useRouter();
  const { user, authReady } = useAuthContext();
  // Uncomment when real auth is wired:
  // const role = user?.role ?? "";
  // const isOrgSide = ["org_admin","coach","staff"].includes(normalizeRole(user));
  // useEffect(() => { if (authReady && user && !isOrgSide) router.push("/dashboard"); }, [authReady, user, isOrgSide]);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { loading, error, rows, lastUpdatedLabel, refresh: reloadRows } = useNutritionQueue({
    enabled: Boolean(authReady && user),
  });

  const actionCount = useMemo(() => rows.filter(r => getUrgency(r) < 3).length, [rows]);
  const [rosterAssignRow, setRosterAssignRow] = useState(null);

  function refresh() {
    setKey(k => k + 1);
    reloadRows();
  }

  const backBtn = (
    <button onClick={() => setMode("summary")} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      marginBottom: 20,
      background: "transparent", border: "none", cursor: "pointer",
      fontFamily: "var(--font-display)", fontWeight: 600,
      fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
      color: "var(--ghost)",
      transition: "color 0.15s ease",
    }}
    onMouseEnter={e => e.currentTarget.style.color = "var(--chalk)"}
    onMouseLeave={e => e.currentTarget.style.color = "var(--ghost)"}
    >
      ← Overview
    </button>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />

      <div className="onq-root" style={{ minHeight: "100vh" }}>
        <NavBar
          mode={mode === "summary" ? "queue" : mode}
          onMode={m => setMode(m)}
          actCount={actionCount}
          onDashboard={() => router.push("/org/dashboard")}
          onPlans={() => router.push("/org/prescriptions")}
        />

        <main style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 60px" }}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2].map(i => (
                <div key={i} style={{
                  height: i === 1 ? 160 : 90,
                  borderRadius: 4,
                  background: "linear-gradient(90deg, var(--raised) 25%, var(--panel) 50%, var(--raised) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.4s infinite",
                  border: "1px solid var(--rim)",
                }} />
              ))}
            </div>
          )}

          {/* Hard error — only shown when no fallback data available */}
          {!loading && error && rows.length === 0 && (
            <div style={{
              padding: "16px 20px",
              background: "var(--red-bg)", border: "1px solid var(--red-rim)",
              borderLeft: "3px solid var(--red)", borderRadius: 4,
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--red)", marginBottom: 4 }}>
                  Failed to load queue
                </div>
                <div style={{ fontSize: 13, color: "var(--ghost)", fontFamily: "var(--font-body)" }}>
                  {error}
                </div>
              </div>
              <button onClick={refresh} style={{
                padding: "7px 14px", background: "var(--red)", border: "none",
                borderRadius: 3, cursor: "pointer",
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
                color: "#fff", flexShrink: 0,
              }}>
                Retry
              </button>
            </div>
          )}

          {/* Summary / entry */}
          {!loading && mode === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SummaryHero rows={rows} onEnterQueue={() => setMode("queue")} />
              <ReadinessStrip rows={rows} actionCount={actionCount} />
            </div>
          )}

          {/* Queue mode */}
          {!loading && mode === "queue" && (
            <div>
              {backBtn}
              <QueueMode key={key} rows={rows} onRefresh={refresh} onViewAll={() => setMode("roster")} />
            </div>
          )}

          {/* List / Actions mode */}
          {!loading && mode === "list" && (
            <div>
              {backBtn}
              <ListMode rows={rows} />
            </div>
          )}

          {/* Roster mode */}
          {!loading && mode === "roster" && (
            <div>
              {backBtn}
              <RosterMode rows={rows} onAssign={row => setRosterAssignRow(row)} />
            </div>
          )}

          {/* Last updated label */}
          {!loading && lastUpdatedLabel && (
            <p style={{
              textAlign: "center", marginTop: 24,
              fontSize: 11, color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}>
              Updated {lastUpdatedLabel}
            </p>
          )}

        </main>

        {/* Roster plan assignment slide-over — rendered outside main so it overlays correctly */}
        {rosterAssignRow && (
          <AssignSlideOver
            row={rosterAssignRow}
            onClose={() => setRosterAssignRow(null)}
            onSaved={() => { setRosterAssignRow(null); refresh(); }}
          />
        )}
      </div>
    </>
  );
}
