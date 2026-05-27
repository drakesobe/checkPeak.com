// pages/dashboard.js - CheckPeak Athlete Dashboard
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useAthleteDashboardData } from "@/hooks/dashboard/useAthleteDashboardData";
import { useTodaySummary } from "@/hooks/dashboard/useTodaySummary";
import ChatPanel from "@/components/dashboard/ChatPanel";

export const CP = {
  black:      "#060810",
  surface:    "#0C1525",
  raised:     "#111E30",
  border:       "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",
  accent:  "#4FABFF",
  white:   "#FFFFFF",
  ghost:  "rgba(255,255,255,0.55)",
  dim:    "rgba(255,255,255,0.30)",
  faint:  "rgba(255,255,255,0.18)",
  red:    "#D92B3A",
  amber:  "#D4900A",
  green:  "#0D9A55",
  fontBC: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  fontB:  "'Barlow', Arial, sans-serif",
};

const RESPONSIVE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');

  .cp-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
    align-items: start;
    row-gap: 20px;
  }
  .cp-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  .cp-two-a {
    display: grid;
    grid-template-columns: 1.7fr 1.3fr;
    gap: 12px;
  }
  .cp-two-b {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .cp-sidebar-wrap {
    display: block;
  }
  .cp-greeting-h1 {
    font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
    font-weight: 900;
    font-style: italic;
    font-size: clamp(36px, 6vw, 64px);
    line-height: 0.88;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    color: #fff;
    margin-bottom: 16px;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* ── Grid placement (explicit, overrideable on mobile) ── */
  .cp-header-row  { grid-column: 1 / -1; grid-row: 1; }
  .cp-sidebar-wrap { grid-column: 1; grid-row: 2; }
  .cp-main        { grid-column: 2; grid-row: 2; }

  /* ── Chat panel sizing ── */
  .cp-chat-panel {
    width: 300px;
    position: sticky;
    top: 24px;
    height: calc(100vh - 48px);
  }

  @media (max-width: 1023px) {
    .cp-layout {
      grid-template-columns: 1fr;
    }
    /* Reset explicit placement so single-column auto-flow works */
    .cp-header-row,
    .cp-sidebar-wrap,
    .cp-main {
      grid-column: auto;
      grid-row: auto;
    }
    .cp-sidebar-wrap {
      display: block;
    }
    .cp-chat-panel {
      width: 100%;
      position: static;
      height: 420px;
    }
  }

  @media (max-width: 639px) {
    .cp-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .cp-two-a,
    .cp-two-b {
      grid-template-columns: 1fr;
    }
    .cp-greeting-h1 {
      font-size: clamp(32px, 10vw, 52px);
    }
    .cp-today-row {
      flex-direction: column;
    }
    .cp-today-row > div {
      flex: 0 0 auto !important;
      width: 100%;
      box-sizing: border-box;
      border-left: none !important;
      border-right: none !important;
      border-top: 0.5px solid rgba(255,255,255,0.08);
    }
    .cp-today-row > div:first-child {
      border-top: none;
    }
  }
`;

const ROUTES = {
  dashboard:    "/dashboard",
  today:        "/athlete/today",
  scan:         "/nutrition-label-scanner",
  search:       "/search",
  scans:        "/scans",
  savedStacks:  "/saved-stacks",
  smartstack:   "/smartstack-compare",
  account:      "/account",
  login:        "/login",
  orgDashboard: "/org/workouts-calendar",
};

function Eyebrow({ children, style }) {
  return (
    <p style={{
      fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700,
      letterSpacing: "0.16em", textTransform: "uppercase", color: CP.dim,
      display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px",
      ...style,
    }}>
      <span style={{ display: "block", width: "20px", height: "0.5px", background: CP.faint, flexShrink: 0 }} />
      {children}
    </p>
  );
}

function Divider({ style }) {
  return <div style={{ height: "0.5px", background: CP.border, margin: "22px 0", ...style }} />;
}

function Badge({ status, children }) {
  const colors = {
    clear:   { color: "rgba(13,154,85,0.85)",  bg: "rgba(13,154,85,0.1)",   border: "rgba(13,154,85,0.22)"   },
    flagged: { color: "rgba(217,43,58,0.95)",  bg: "rgba(217,43,58,0.1)",   border: "rgba(217,43,58,0.28)"   },
    amber:   { color: "rgba(212,144,10,0.95)", bg: "rgba(212,144,10,0.1)",  border: "rgba(212,144,10,0.28)"  },
  };
  const c = colors[status] || colors.clear;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", fontFamily: CP.fontBC,
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      color: c.color, background: c.bg, border: `0.5px solid ${c.border}`, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function CardLink({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: "rgba(79,171,255,0.55)", background: "none", border: "none", cursor: "pointer", padding: 0,
    }}>
      {children}
    </button>
  );
}

function CtaButton({ children, onClick, ghost = false, size = "md", style }) {
  const sizes = {
    sm: { padding: "6px 14px", fontSize: "11px" },
    md: { padding: "9px 18px", fontSize: "12px" },
    lg: { padding: "12px 28px", fontSize: "13px" },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: "7px",
      fontFamily: CP.fontBC, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
      border: ghost ? `0.5px solid rgba(79,171,255,0.38)` : "none",
      background: ghost ? "transparent" : CP.accent,
      color: ghost ? CP.accent : CP.black,
      cursor: "pointer", ...sizes[size], ...style,
    }}>
      {children}
    </button>
  );
}

function Grain() {
  const svg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, backgroundImage: svg,
      backgroundRepeat: "repeat", backgroundSize: "256px 256px",
      opacity: 0.03, pointerEvents: "none", zIndex: 1,
    }} />
  );
}

function Header({ user, onNavigate }) {
  const firstName = user?.firstName || (user?.email || user?.Email || "Athlete").split("@")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div>
      <Eyebrow>{today}</Eyebrow>
      <h1 className="cp-greeting-h1">
        Welcome Back, <span style={{ color: CP.accent }}>{firstName}.</span>
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {user?.sport && (
          <span style={{ padding: "5px 12px", border: `0.5px solid ${CP.border}`, fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: CP.dim }}>
            {user.sport}
          </span>
        )}
        <CtaButton onClick={() => onNavigate(ROUTES.scan)} size="sm">
          Scan a Label
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </CtaButton>
      </div>
    </div>
  );
}

function TodayPanel({ loading, summary, onOpen }) {
  if (loading) return <PanelSkeleton height="130px" />;
  const { hasWorkout, hasClass, hasMeal } = summary || {};
  if (!hasWorkout && !hasClass && !hasMeal) return null;

  const pct = summary.itemsCount > 0 ? Math.round((summary.completedCount / summary.itemsCount) * 100) : 0;
  const workoutTitle = summary.title || "Workout Assigned";

  const Section = ({ accentColor, eyebrow, children }) => (
    <div style={{ flex: 1, minWidth: 0, padding: "16px 20px", borderLeft: `0.5px solid ${CP.border}` }}>
      <Eyebrow style={{ marginBottom: "8px", color: accentColor ? `${accentColor}99` : undefined }}>{eyebrow}</Eyebrow>
      {children}
    </div>
  );

  const MetaLine = ({ children }) => (
    <p style={{ fontFamily: CP.fontB, fontSize: "12px", color: CP.dim, lineHeight: 1.5, marginTop: "3px" }}>{children}</p>
  );

  return (
    <div style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, borderTop: `2px solid ${CP.accent}`, overflow: "hidden" }}>
      <div className="cp-today-row" style={{ display: "flex", flexWrap: "wrap" }}>
        {hasWorkout && (
          <div style={{ flex: "2 1 240px", minWidth: 0, padding: "18px 22px", borderRight: `0.5px solid ${CP.border}` }}>
            <Eyebrow style={{ marginBottom: "6px" }}>Today's Workout</Eyebrow>
            <p style={{ fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "clamp(22px, 3vw, 30px)", lineHeight: 0.95, letterSpacing: "-0.01em", textTransform: "uppercase", color: CP.white, marginBottom: "12px", wordBreak: "break-word" }}>
              {workoutTitle}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: CP.dim, flexShrink: 0, whiteSpace: "nowrap" }}>
                <span style={{ color: CP.accent }}>{summary.completedCount}</span>{" / "}{summary.itemsCount} done
              </span>
              <div style={{ flex: 1, height: "3px", background: CP.border, minWidth: "40px" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: CP.accent, transition: "width 0.6s ease" }} />
              </div>
              <CtaButton onClick={onOpen} size="sm" style={{ flexShrink: 0 }}>Open →</CtaButton>
            </div>
          </div>
        )}
        {hasClass && (
          <Section accentColor={CP.amber} eyebrow="Upcoming Class">
            <p style={{ fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "clamp(18px, 2.5vw, 24px)", lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: CP.white, marginBottom: "4px", wordBreak: "break-word" }}>
              {summary.className || "Class Scheduled"}
            </p>
            {summary.classTime     && <MetaLine>🕐 {summary.classTime}</MetaLine>}
            {summary.classLocation && <MetaLine>📍 {summary.classLocation}</MetaLine>}
            {summary.classCoach    && <MetaLine>👤 {summary.classCoach}</MetaLine>}
          </Section>
        )}
        {hasMeal && (
          <Section accentColor={CP.green} eyebrow="Upcoming Meal">
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <p style={{ fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "clamp(18px, 2.5vw, 24px)", lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: CP.white, wordBreak: "break-word" }}>
                {summary.mealName || "Meal Scheduled"}
              </p>
              {summary.mealTime && <span style={{ fontFamily: CP.fontB, fontSize: "12px", color: CP.dim, flexShrink: 0 }}>{summary.mealTime}</span>}
            </div>
            {(summary.mealCalories || summary.mealProtein || summary.mealCarbs || summary.mealFat || summary.mealHydration) && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                {summary.mealCalories  && <span style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CP.green,  background: "rgba(13,154,85,0.1)",  border: "0.5px solid rgba(13,154,85,0.25)",  padding: "3px 8px" }}>{summary.mealCalories} cal</span>}
                {summary.mealProtein   && <span style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CP.accent, background: "rgba(79,171,255,0.08)", border: "0.5px solid rgba(79,171,255,0.2)",  padding: "3px 8px" }}>{summary.mealProtein}g pro</span>}
                {summary.mealCarbs     && <span style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CP.amber,  background: "rgba(212,144,10,0.08)", border: "0.5px solid rgba(212,144,10,0.2)",  padding: "3px 8px" }}>{summary.mealCarbs}g carbs</span>}
                {summary.mealFat       && <span style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", border: `0.5px solid ${CP.border}`, padding: "3px 8px" }}>{summary.mealFat}g fat</span>}
                {summary.mealHydration && <span style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(96,165,250,0.85)", background: "rgba(96,165,250,0.08)", border: "0.5px solid rgba(96,165,250,0.2)", padding: "3px 8px" }}>💧 {summary.mealHydration} oz</span>}
              </div>
            )}
            {summary.mealNotes && <p style={{ fontFamily: CP.fontB, fontSize: "11px", color: CP.dim, marginTop: "6px", lineHeight: 1.5 }}>{summary.mealNotes}</p>}
          </Section>
        )}
      </div>
    </div>
  );
}

function StatsGrid({ stats }) {
  const cells = [
    { key: "totalScans",        label: "Total Scans",  accent: CP.accent },
    { key: "flaggedScans",      label: "Flagged",      accent: CP.red    },
    { key: "stacksSaved",       label: "Stacks Saved", accent: CP.amber  },
    { key: "accountCompletion", label: "Profile",      accent: CP.green, suffix: "%" },
  ];
  return (
    <div className="cp-stats">
      {cells.map(({ key, label, accent, suffix = "" }) => (
        <div key={key} style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, borderTop: `1.5px solid ${accent}`, padding: "16px 16px 14px", position: "relative", overflow: "hidden" }}>
          <span aria-hidden="true" style={{ position: "absolute", bottom: "-8px", right: "-4px", fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "76px", lineHeight: 1, color: "rgba(255,255,255,0.025)", userSelect: "none", pointerEvents: "none" }}>
            {stats[key] ?? 0}
          </span>
          <span style={{ display: "block", fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "clamp(36px, 4vw, 52px)", lineHeight: 0.85, letterSpacing: "-0.03em", color: accent }}>
            {stats[key] ?? 0}{suffix}
          </span>
          <p style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginTop: "8px" }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function ScanActivityCard({ data = [], max = 1, loading, lastScanDate, formatDate, onView }) {
  if (loading) return <PanelSkeleton height="160px" />;
  const hasData = data.length > 0 && data.some(d => (d.count || 0) > 0);
  return (
    <div style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, padding: "18px 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
        <Eyebrow style={{ margin: 0 }}>Scan Activity</Eyebrow>
        {hasData && <CardLink onClick={onView}>View All →</CardLink>}
      </div>
      {!hasData && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "88px", gap: "10px", borderTop: `0.5px solid ${CP.border}`, paddingTop: "18px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", opacity: 0.18 }}>
            {[40, 65, 30, 80, 50].map((h, i) => <div key={i} style={{ width: "8px", height: `${h}%`, maxHeight: "28px", background: CP.accent }} />)}
          </div>
          <p style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: CP.dim, textAlign: "center" }}>No scans this week</p>
          <CtaButton onClick={onView} size="sm">Scan Your First Label →</CtaButton>
        </div>
      )}
      {hasData && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "72px", marginBottom: "16px" }}>
          {data.map(({ week, count }, i) => {
            const pct = max > 0 ? (count / max) * 100 : 0;
            const isHi = count === max && max > 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%" }}>
                <div style={{ width: "100%", flex: 1, background: isHi ? "rgba(79,171,255,0.18)" : "rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct}%`, background: CP.accent, opacity: isHi ? 1 : 0.7, transition: "height 0.6s ease" }} />
                </div>
                {week && <span style={{ fontFamily: CP.fontBC, fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>{week}</span>}
              </div>
            );
          })}
        </div>
      )}
      {hasData && lastScanDate && (
        <p style={{ fontFamily: CP.fontB, fontSize: "11px", color: "rgba(255,255,255,0.32)", borderTop: `0.5px solid ${CP.border}`, paddingTop: "12px", lineHeight: 1.5 }}>
          Last scan <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{formatDate(lastScanDate)}</span>
        </p>
      )}
    </div>
  );
}

function RiskAlertsCard({ flaggedCount = 0, recentScans = [], onReview }) {
  const flagged = recentScans.filter(s => (s.flagCount || 0) > 0);
  return (
    <div style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, borderTop: flaggedCount > 0 ? `2px solid ${CP.red}` : `2px solid ${CP.green}`, padding: "18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
        <Eyebrow style={{ margin: 0, color: flaggedCount > 0 ? "rgba(217,43,58,0.65)" : "rgba(13,154,85,0.65)" }}>
          {flaggedCount > 0 ? "Risk Alerts" : "All Clear"}
        </Eyebrow>
        {flaggedCount > 0 && <CardLink onClick={onReview}>Review →</CardLink>}
      </div>
      <span style={{ display: "block", fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "72px", lineHeight: 0.85, letterSpacing: "-0.03em", color: flaggedCount > 0 ? CP.red : CP.green }}>
        {flaggedCount}
      </span>
      <p style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.32)", marginTop: "6px", marginBottom: flagged.length ? "16px" : 0 }}>
        Flagged Substance{flaggedCount !== 1 ? "s" : ""}
      </p>
      {flagged.slice(0, 3).map((scan, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "9px", padding: "9px 0", borderTop: `0.5px solid ${CP.border}` }}>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: CP.red, marginTop: "5px", flexShrink: 0 }} />
          <p style={{ fontFamily: CP.fontB, fontSize: "12px", color: CP.ghost, lineHeight: 1.45 }}>
            <span style={{ color: CP.white, fontWeight: 600 }}>{scan.product}</span>
            {" "}- {scan.flagCount} flagged compound{scan.flagCount !== 1 ? "s" : ""}
          </p>
        </div>
      ))}
      {flaggedCount === 0 && <p style={{ fontFamily: CP.fontB, fontSize: "12px", color: "rgba(13,154,85,0.65)", marginTop: "8px", lineHeight: 1.5 }}>No flagged substances detected in your recent scans.</p>}
    </div>
  );
}

function RecentScansCard({ scans = [], loading, formatDate, onOpen, onViewAll }) {
  if (loading) return <PanelSkeleton height="220px" />;
  return (
    <div style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, padding: "18px 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "14px" }}>
        <Eyebrow style={{ margin: 0 }}>Recent Scans</Eyebrow>
        <CardLink onClick={onViewAll}>View All →</CardLink>
      </div>
      {scans.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: CP.dim }}>No scans this week</p>
          <CtaButton onClick={() => {}} size="sm" style={{ marginTop: "12px" }}>Scan Your First Label →</CtaButton>
        </div>
      )}
      {scans.slice(0, 6).map((scan, i) => (
        <div key={scan.id || i} onClick={() => onOpen(scan)}
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: i < Math.min(scans.length, 6) - 1 ? `0.5px solid ${CP.border}` : "none", cursor: "pointer" }}>
          <div style={{ width: "32px", height: "32px", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: CP.fontBC, fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", color: "rgba(255,255,255,0.82)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{scan.product}</p>
            <p style={{ fontFamily: CP.fontB, fontSize: "10px", color: CP.dim, marginTop: "2px" }}>{scan.brand} · {formatDate ? formatDate(scan.parsedDate) : scan.date}</p>
          </div>
          <Badge status={(scan.flagCount || 0) > 0 ? "flagged" : "clear"}>
            {(scan.flagCount || 0) > 0 ? `${scan.flagCount} Flag${scan.flagCount > 1 ? "s" : ""}` : "Clear"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton({ height = "120px" }) {
  return (
    <div style={{ height, background: CP.surface, border: `0.5px solid ${CP.border}`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)`, animation: "shimmer 1.6s infinite" }} />
      <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").toLowerCase();
    if (raw.includes("org") || raw.includes("admin") || raw.includes("trainer")) return "org";
    if (raw.includes("ath")) return "athlete";
    return null;
  }, [user]);

  const userEmail = user?.Email || user?.email || null;

  const { recentActivity, loadingScans, loadingSaved, stats, lastScan, sparklineData, maxSparkCount } =
    useAthleteDashboardData({ user, userEmail });

  const { loadingToday, todaySummary } = useTodaySummary({ userEmail });

  useEffect(() => {
    if (!user)          { router.push(ROUTES.login);       return; }
    if (role === "org") router.push(ROUTES.orgDashboard);
  }, [user, role, router]);

  if (!user || role !== "athlete") return null;

  const loading      = loadingScans || loadingSaved;
  const lastScanDate = lastScan?.parsedDate || null;
  const formatDate   = (d) => d
    ? d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  const nav = (to) => router.push(to);
  const handleLogout = async () => {
    try { await logout(); } catch {}
    router.push(ROUTES.login);
  };

  const scansWithFlags = (recentActivity || []).map(s => ({
    ...s,
    flagCount: s.flagCount ?? s.flagged ?? 0,
  }));

  return (
    <>
      <style>{RESPONSIVE_CSS}</style>

      <div style={{ minHeight: "100vh", background: CP.black, fontFamily: CP.fontB, color: CP.white, position: "relative" }}>
        <Grain />

        <div aria-hidden="true" style={{ height: "1px", background: `linear-gradient(90deg, transparent, ${CP.accent} 30%, ${CP.accent} 70%, transparent)`, opacity: 0.25 }} />

        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px 56px", position: "relative", zIndex: 2 }}>
          <div className="cp-layout">

            {/* Row 1: Full-width header */}
            <div className="cp-header-row">
              <Header user={user} onNavigate={nav} />
              <Divider />
              <TodayPanel loading={loadingToday} summary={todaySummary} onOpen={() => nav(ROUTES.today)} />
            </div>

            {/* Row 2 col 1: Chat Panel */}
            <div className="cp-sidebar-wrap">
              <ChatPanel user={user} />
            </div>

            {/* Row 2 col 2: Main content */}
            <main className="cp-main" style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0, overflow: "hidden" }}>
              <StatsGrid stats={stats} />
              <div className="cp-two-a">
                <ScanActivityCard data={sparklineData} max={maxSparkCount} loading={loading} lastScanDate={lastScanDate} formatDate={formatDate} onView={() => nav(ROUTES.scans)} />
                <RiskAlertsCard flaggedCount={stats.flaggedScans} recentScans={scansWithFlags} onReview={() => nav(ROUTES.scans)} />
              </div>
              <RecentScansCard scans={scansWithFlags} loading={loading} formatDate={formatDate} onOpen={(scan) => nav(`${ROUTES.scans}/${scan.id}`)} onViewAll={() => nav(ROUTES.scans)} />
            </main>

          </div>
        </div>
      </div>
    </>
  );
}