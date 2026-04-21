// pages/dashboard.js — CheckPeak Athlete Dashboard (redesigned)
// Design: dark editorial, Barlow Condensed, #060810 + #4FABFF
//
// This file is a self-contained visual reference.
// All sub-component styles are inlined here so you can see the full
// design system, then distribute the tokens/styles to your actual
// sub-component files (AthleteSidebar, StatsGrid, etc.)
//
"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useAthleteDashboardData } from "@/hooks/dashboard/useAthleteDashboardData";
import { useTodaySummary } from "@/hooks/dashboard/useTodaySummary";

// ---------------------------------------------------------------------------
// Design Tokens — import/share these across all sub-components
// ---------------------------------------------------------------------------
export const CP = {
  // Backgrounds
  black:      "#060810",
  surface:    "#0C1525",
  raised:     "#111E30",

  // Borders
  border:       "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",

  // Brand
  accent:  "#4FABFF",
  white:   "#FFFFFF",

  // Text
  ghost:  "rgba(255,255,255,0.55)",
  dim:    "rgba(255,255,255,0.30)",
  faint:  "rgba(255,255,255,0.18)",

  // Semantic
  red:    "#D92B3A",
  amber:  "#D4900A",
  green:  "#0D9A55",

  // Typography
  fontBC: "'Barlow Condensed', 'Arial Narrow', sans-serif",
  fontB:  "'Barlow', Arial, sans-serif",
};

// ---------------------------------------------------------------------------
// Responsive CSS — injected via <style> tag since inline styles can't do @media
// ---------------------------------------------------------------------------
const RESPONSIVE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');

  /* Layout grid: sidebar + main */
  .cp-layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 24px;
    align-items: start;
  }
  /* Stats: 4 across on desktop */
  .cp-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }
  /* Two-col A: wide left (scan activity + risk) */
  .cp-two-a {
    display: grid;
    grid-template-columns: 1.7fr 1.3fr;
    gap: 12px;
  }
  /* Two-col B: equal (recent scans + stacks) */
  .cp-two-b {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  /* Sidebar: visible on desktop */
  .cp-sidebar-wrap {
    display: block;
  }
  /* Mobile header bar: hidden on desktop */
  .cp-mobile-bar {
    display: none;
  }
  /* Greeting h1 overflow fix */
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

  /* ── Tablet: hide sidebar, go single-column ── */
  @media (max-width: 1023px) {
    .cp-layout {
      grid-template-columns: 1fr;
    }
    .cp-sidebar-wrap {
      display: none;
    }
    .cp-mobile-bar {
      display: flex;
    }
  }

  /* ── Mobile: stack everything ── */
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
  }
`;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
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
  orgDashboard: "/org/dashboard",
};

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Eyebrow label — used above every section heading */
function Eyebrow({ children, style }) {
  return (
    <p style={{
      fontFamily:    CP.fontBC,
      fontSize:      "10px",
      fontWeight:    700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color:         CP.dim,
      display:       "flex",
      alignItems:    "center",
      gap:           "10px",
      marginBottom:  "8px",
      ...style,
    }}>
      <span style={{ display: "block", width: "20px", height: "0.5px", background: CP.faint, flexShrink: 0 }} />
      {children}
    </p>
  );
}

/** Horizontal rule used between major sections */
function Divider({ style }) {
  return <div style={{ height: "0.5px", background: CP.border, margin: "22px 0", ...style }} />;
}

/** Pill / status badge */
function Badge({ status, children }) {
  const colors = {
    clear:   { color: "rgba(13,154,85,0.85)",  bg: "rgba(13,154,85,0.1)",   border: "rgba(13,154,85,0.22)"   },
    flagged: { color: "rgba(217,43,58,0.95)",  bg: "rgba(217,43,58,0.1)",   border: "rgba(217,43,58,0.28)"   },
    amber:   { color: "rgba(212,144,10,0.95)", bg: "rgba(212,144,10,0.1)",  border: "rgba(212,144,10,0.28)"  },
  };
  const c = colors[status] || colors.clear;
  return (
    <span style={{
      display:       "inline-block",
      padding:       "2px 8px",
      fontFamily:    CP.fontBC,
      fontSize:      "10px",
      fontWeight:    700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color:         c.color,
      background:    c.bg,
      border:        `0.5px solid ${c.border}`,
      whiteSpace:    "nowrap",
    }}>
      {children}
    </span>
  );
}

/** Card link / secondary CTA */
function CardLink({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily:    CP.fontBC,
      fontSize:      "10px",
      fontWeight:    700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color:         "rgba(79,171,255,0.55)",
      background:    "none",
      border:        "none",
      cursor:        "pointer",
      padding:       0,
    }}>
      {children}
    </button>
  );
}

/** Primary CTA button */
function CtaButton({ children, onClick, ghost = false, size = "md", style }) {
  const sizes = {
    sm: { padding: "6px 14px", fontSize: "11px" },
    md: { padding: "9px 18px", fontSize: "12px" },
    lg: { padding: "12px 28px", fontSize: "13px" },
  };
  return (
    <button onClick={onClick} style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "7px",
      fontFamily:    CP.fontBC,
      fontWeight:    900,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      border:        ghost ? `0.5px solid rgba(79,171,255,0.38)` : "none",
      background:    ghost ? "transparent" : CP.accent,
      color:         ghost ? CP.accent : CP.black,
      cursor:        "pointer",
      ...sizes[size],
      ...style,
    }}>
      {children}
    </button>
  );
}

/** Ghost film-grain overlay — place as first child of any section */
function Grain() {
  const svg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
  return (
    <div aria-hidden="true" style={{
      position:            "absolute",
      inset:               0,
      backgroundImage:     svg,
      backgroundRepeat:    "repeat",
      backgroundSize:      "256px 256px",
      opacity:             0.03,
      pointerEvents:       "none",
      zIndex:              1,
    }} />
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// Replace your AthleteSidebar component with this (or adapt the styles).
// ---------------------------------------------------------------------------
const SIDEBAR_NAV = [
  { label: "Dashboard",     route: "dashboard"   },
  { label: "Today",         route: "today"       },
  { label: "Scan Label",    route: "scan"        },
  { label: "Scans",         route: "scans"       },
  { label: "Saved Stacks",  route: "savedStacks" },
  { label: "SmartStack",    route: "smartstack"  },
];

function Sidebar({ user, activeRoute, onNavigate, onLogout, todayHasWork }) {
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") ||
    (user?.email || user?.Email || "?")[0].toUpperCase();
  const displayName = user?.firstName || (user?.email || user?.Email || "Athlete").split("@")[0];
  const sport = user?.sport || user?.Sport || "";

  return (
    <aside style={{
      width:          "260px",
      background:     CP.surface,
      border:         `0.5px solid ${CP.border}`,
      display:        "flex",
      flexDirection:  "column",
      position:       "sticky",
      top:            "24px",
      height:         "calc(100vh - 48px)",
      overflow:       "hidden",
    }}>
      {/* Wordmark */}
      <div style={{ padding: "22px 22px 18px", borderBottom: `0.5px solid ${CP.border}` }}>
        <p style={{
          fontFamily:    CP.fontBC,
          fontWeight:    900,
          fontSize:      "15px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color:         CP.white,
        }}>
          Check<span style={{ color: CP.accent }}>Peak</span>
        </p>
      </div>

      {/* User identity */}
      <div style={{ padding: "18px 22px", borderBottom: `0.5px solid ${CP.border}`, display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width:          "36px",
          height:         "36px",
          borderRadius:   "50%",
          background:     "rgba(79,171,255,0.12)",
          border:         `0.5px solid rgba(79,171,255,0.28)`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
          fontFamily:     CP.fontBC,
          fontSize:       "13px",
          fontWeight:     700,
          color:          CP.accent,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: CP.fontBC, fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CP.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayName}
          </p>
          {sport && (
            <p style={{ fontFamily: CP.fontB, fontSize: "11px", color: CP.dim, marginTop: "2px" }}>{sport}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
        {SIDEBAR_NAV.map(({ label, route }) => {
          const isActive = activeRoute === ROUTES[route];
          return (
            <button
              key={route}
              onClick={() => onNavigate(ROUTES[route])}
              style={{
                display:       "flex",
                alignItems:    "center",
                gap:           "10px",
                padding:       "10px 12px",
                background:    isActive ? "rgba(79,171,255,0.08)" : "transparent",
                border:        "none",
                borderLeft:    isActive ? `2px solid ${CP.accent}` : "2px solid transparent",
                cursor:        "pointer",
                textAlign:     "left",
                fontFamily:    CP.fontBC,
                fontSize:      "12px",
                fontWeight:    700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color:         isActive ? CP.accent : CP.ghost,
                transition:    "color 0.18s, background 0.18s",
              }}
            >
              {label}
              {label === "Today" && todayHasWork && (
                <span style={{
                  marginLeft:  "auto",
                  width:       "6px",
                  height:      "6px",
                  borderRadius:"50%",
                  background:  CP.accent,
                  flexShrink:  0,
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: "12px 12px", borderTop: `0.5px solid ${CP.border}`, display: "flex", flexDirection: "column", gap: "2px" }}>
        <button onClick={() => onNavigate(ROUTES.account)} style={{
          display: "flex", alignItems: "center", padding: "9px 12px",
          background: "none", border: "none", borderLeft: "2px solid transparent",
          cursor: "pointer", fontFamily: CP.fontBC, fontSize: "12px", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", color: CP.dim,
        }}>Account</button>
        <button onClick={onLogout} style={{
          display: "flex", alignItems: "center", padding: "9px 12px",
          background: "none", border: "none", borderLeft: "2px solid transparent",
          cursor: "pointer", fontFamily: CP.fontBC, fontSize: "12px", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(217,43,58,0.55)",
        }}>Log Out</button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Header
// Replace your DashboardHeader component with this.
// ---------------------------------------------------------------------------
function Header({ user, stats, onNavigate }) {
  const firstName = user?.firstName || (user?.email || user?.Email || "Athlete").split("@")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div>
      <Eyebrow>{today}</Eyebrow>
      <h1 className="cp-greeting-h1">
        Welcome Back,<br />
        <span style={{ color: CP.accent }}>{firstName}.</span>
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {user?.sport && (
          <span style={{
            padding:       "5px 12px",
            border:        `0.5px solid ${CP.border}`,
            fontFamily:    CP.fontBC,
            fontSize:      "11px",
            fontWeight:    700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         CP.dim,
          }}>
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

// ---------------------------------------------------------------------------
// Today Panel
// Replace your TodayPanel component with this.
// ---------------------------------------------------------------------------
function TodayPanel({ loading, summary, onOpen }) {
  if (loading) return <PanelSkeleton height="110px" />;
  if (!summary?.hasWorkout) return null;

  const pct = summary.completedSets && summary.totalSets
    ? Math.round((summary.completedSets / summary.totalSets) * 100)
    : 0;

  return (
    <div style={{
      background:  CP.surface,
      border:      `0.5px solid ${CP.border}`,
      borderTop:   `2px solid ${CP.accent}`,
      padding:     "18px 22px",
    }}>
      <Eyebrow style={{ marginBottom: "6px" }}>Today's Workout</Eyebrow>
      <p style={{
        fontFamily:    CP.fontBC,
        fontWeight:    900,
        fontStyle:     "italic",
        fontSize:      "30px",
        lineHeight:    0.92,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        color:         CP.white,
        marginBottom:  "14px",
      }}>
        {summary.workoutName || "Workout Assigned"}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {summary.completedSets != null && (
          <span style={{
            fontFamily:    CP.fontBC,
            fontSize:      "11px",
            fontWeight:    700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         CP.dim,
            flexShrink:    0,
          }}>
            <span style={{ color: CP.accent, marginRight: "4px" }}>{summary.completedSets}</span>
            of {summary.totalSets} sets
          </span>
        )}
        <div style={{ flex: 1, height: "3px", background: CP.border }}>
          <div style={{ height: "100%", width: `${pct}%`, background: CP.accent, transition: "width 0.6s ease" }} />
        </div>
        <CtaButton onClick={onOpen} size="sm">Open Today →</CtaButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Grid
// Replace your StatsGrid component with this.
// ---------------------------------------------------------------------------
function StatsGrid({ stats }) {
  const cells = [
    { key: "totalScans",       label: "Total Scans",    accent: CP.accent },
    { key: "flaggedScans",     label: "Flagged",        accent: CP.red    },
    { key: "stacksSaved",      label: "Stacks Saved",   accent: CP.amber  },
    { key: "accountCompletion",label: "Profile",        accent: CP.green, suffix: "%" },
  ];

  return (
    <div className="cp-stats">
      {cells.map(({ key, label, accent, suffix = "" }) => (
        <div key={key} style={{
          background:  CP.surface,
          border:      `0.5px solid ${CP.border}`,
          borderTop:   `1.5px solid ${accent}`,
          padding:     "16px 16px 14px",
          position:    "relative",
          overflow:    "hidden",
        }}>
          {/* Ghost watermark number */}
          <span aria-hidden="true" style={{
            position:      "absolute",
            bottom:        "-8px",
            right:         "-4px",
            fontFamily:    CP.fontBC,
            fontWeight:    900,
            fontStyle:     "italic",
            fontSize:      "76px",
            lineHeight:    1,
            color:         "rgba(255,255,255,0.025)",
            userSelect:    "none",
            pointerEvents: "none",
          }}>
            {stats[key] ?? 0}
          </span>

          <span style={{
            display:       "block",
            fontFamily:    CP.fontBC,
            fontWeight:    900,
            fontStyle:     "italic",
            fontSize:      "clamp(36px, 4vw, 52px)",
            lineHeight:    0.85,
            letterSpacing: "-0.03em",
            color:         accent,
          }}>
            {stats[key] ?? 0}{suffix}
          </span>

          <p style={{
            fontFamily:    CP.fontBC,
            fontSize:      "10px",
            fontWeight:    700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color:         "rgba(255,255,255,0.32)",
            marginTop:     "8px",
          }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Activity Card (sparkline bars)
// Replace your ScanActivityCard component with this.
// ---------------------------------------------------------------------------
function ScanActivityCard({ data = [], max = 1, loading, lastScanDate, formatDate, onView }) {
  if (loading) return <PanelSkeleton height="160px" />;

  // True empty: no data at all, or every week has 0 scans
  const hasData = data.length > 0 && data.some(d => (d.count || 0) > 0);

  return (
    <div style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, padding: "18px 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "16px" }}>
        <Eyebrow style={{ margin: 0 }}>Scan Activity</Eyebrow>
        {hasData && <CardLink onClick={onView}>View All →</CardLink>}
      </div>

      {/* ── Empty state ── */}
      {!hasData && (
        <div style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          height:         "88px",
          gap:            "10px",
          borderTop:      `0.5px solid ${CP.border}`,
          paddingTop:     "18px",
        }}>
          {/* Tiny bar-chart icon */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", opacity: 0.18 }}>
            {[40, 65, 30, 80, 50].map((h, i) => (
              <div key={i} style={{ width: "8px", height: `${h}%`, maxHeight: "28px", background: CP.accent }} />
            ))}
          </div>
          <p style={{
            fontFamily:    CP.fontBC,
            fontSize:      "11px",
            fontWeight:    700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color:         CP.dim,
            textAlign:     "center",
          }}>
            No scans yet
          </p>
          <CtaButton onClick={onView} size="sm">Scan Your First Label →</CtaButton>
        </div>
      )}

      {/* ── Bar chart (only when there's data) ── */}
      {hasData && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "72px", marginBottom: "16px" }}>
        {data.map(({ week, count }, i) => {
          const pct = max > 0 ? (count / max) * 100 : 0;
          const isHi = count === max && max > 0;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%" }}>
              <div style={{
                width:       "100%",
                flex:        1,
                background:  isHi ? `rgba(79,171,255,0.18)` : "rgba(255,255,255,0.05)",
                position:    "relative",
                overflow:    "hidden",
              }}>
                <div style={{
                  position:   "absolute",
                  bottom:     0,
                  left:       0,
                  right:      0,
                  height:     `${pct}%`,
                  background: CP.accent,
                  opacity:    isHi ? 1 : 0.7,
                  transition: "height 0.6s ease",
                }} />
              </div>
              {week && (
                <span style={{
                  fontFamily:    CP.fontBC,
                  fontSize:      "9px",
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color:         "rgba(255,255,255,0.22)",
                  whiteSpace:    "nowrap",
                }}>
                  {week}
                </span>
              )}
            </div>
          );
        })}
        </div>
      )}

      {hasData && lastScanDate && (
        <p style={{
          fontFamily:  CP.fontB,
          fontSize:    "11px",
          color:       "rgba(255,255,255,0.32)",
          borderTop:   `0.5px solid ${CP.border}`,
          paddingTop:  "12px",
          lineHeight:  1.5,
        }}>
          Last scan <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{formatDate(lastScanDate)}</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk Alerts Card
// Replace your RiskAlertsCard component with this.
// ---------------------------------------------------------------------------
function RiskAlertsCard({ flaggedCount = 0, recentScans = [], onReview }) {
  const flagged = recentScans.filter(s => (s.flagCount || 0) > 0);

  return (
    <div style={{
      background:  CP.surface,
      border:      `0.5px solid ${CP.border}`,
      borderTop:   flaggedCount > 0 ? `2px solid ${CP.red}` : `2px solid ${CP.green}`,
      padding:     "18px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "10px" }}>
        <Eyebrow style={{ margin: 0, color: flaggedCount > 0 ? "rgba(217,43,58,0.65)" : "rgba(13,154,85,0.65)" }}>
          {flaggedCount > 0 ? "Risk Alerts" : "All Clear"}
        </Eyebrow>
        {flaggedCount > 0 && <CardLink onClick={onReview} style={{ color: "rgba(217,43,58,0.55)" }}>Review →</CardLink>}
      </div>

      <span style={{
        display:       "block",
        fontFamily:    CP.fontBC,
        fontWeight:    900,
        fontStyle:     "italic",
        fontSize:      "72px",
        lineHeight:    0.85,
        letterSpacing: "-0.03em",
        color:         flaggedCount > 0 ? CP.red : CP.green,
      }}>
        {flaggedCount}
      </span>
      <p style={{
        fontFamily:    CP.fontBC,
        fontSize:      "10px",
        fontWeight:    700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color:         "rgba(255,255,255,0.32)",
        marginTop:     "6px",
        marginBottom:  flagged.length ? "16px" : 0,
      }}>
        Flagged Substance{flaggedCount !== 1 ? "s" : ""}
      </p>

      {flagged.slice(0, 3).map((scan, i) => (
        <div key={i} style={{
          display:    "flex",
          alignItems: "flex-start",
          gap:        "9px",
          padding:    "9px 0",
          borderTop:  `0.5px solid ${CP.border}`,
        }}>
          <div style={{
            width:        "5px",
            height:       "5px",
            borderRadius: "50%",
            background:   CP.red,
            marginTop:    "5px",
            flexShrink:   0,
          }} />
          <p style={{ fontFamily: CP.fontB, fontSize: "12px", color: CP.ghost, lineHeight: 1.45 }}>
            <span style={{ color: CP.white, fontWeight: 600 }}>{scan.product}</span>
            {" "}— {scan.flagCount} flagged compound{scan.flagCount !== 1 ? "s" : ""}
          </p>
        </div>
      ))}

      {flaggedCount === 0 && (
        <p style={{ fontFamily: CP.fontB, fontSize: "12px", color: "rgba(13,154,85,0.65)", marginTop: "8px", lineHeight: 1.5 }}>
          No flagged substances detected in your recent scans.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Scans Card
// Replace your RecentScansCard component with this.
// ---------------------------------------------------------------------------
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
          <p style={{ fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: CP.dim }}>
            No scans yet
          </p>
          <CtaButton onClick={() => {}} size="sm" style={{ marginTop: "12px" }}>
            Scan Your First Label →
          </CtaButton>
        </div>
      )}

      {scans.slice(0, 6).map((scan, i) => (
        <div
          key={scan.id || i}
          onClick={() => onOpen(scan)}
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           "10px",
            padding:       "10px 0",
            borderBottom:  i < Math.min(scans.length, 6) - 1 ? `0.5px solid ${CP.border}` : "none",
            cursor:        "pointer",
          }}
        >
          <div style={{
            width:          "32px",
            height:         "32px",
            background:     "rgba(255,255,255,0.04)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily:    CP.fontBC,
              fontSize:      "13px",
              fontWeight:    700,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color:         "rgba(255,255,255,0.82)",
              whiteSpace:    "nowrap",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
            }}>
              {scan.product}
            </p>
            <p style={{ fontFamily: CP.fontB, fontSize: "10px", color: CP.dim, marginTop: "2px" }}>
              {scan.brand} · {formatDate ? formatDate(scan.parsedDate) : scan.date}
            </p>
          </div>

          <Badge status={(scan.flagCount || 0) > 0 ? "flagged" : "clear"}>
            {(scan.flagCount || 0) > 0 ? `${scan.flagCount} Flag${scan.flagCount > 1 ? "s" : ""}` : "Clear"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// [SuggestedSupplementsCard removed — no credentials to back recommendations]
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function PanelSkeleton({ height = "120px" }) {
  return (
    <div style={{
      height,
      background:    CP.surface,
      border:        `0.5px solid ${CP.border}`,
      position:      "relative",
      overflow:      "hidden",
    }}>
      <div style={{
        position:   "absolute",
        inset:      0,
        background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)`,
        animation:  "shimmer 1.6s infinite",
      }} />
      <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const router   = useRouter();
  const { user, logout } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").toLowerCase();
    if (raw.includes("org") || raw.includes("admin") || raw.includes("trainer")) return "org";
    if (raw.includes("ath")) return "athlete";
    return null;
  }, [user]);

  const userEmail = user?.Email || user?.email || null;

  const {
    recentActivity, loadingScans, loadingSaved,
    stats, lastScan, sparklineData, maxSparkCount,
  } = useAthleteDashboardData({ user, userEmail });

  const { loadingToday, todaySummary } = useTodaySummary({ userEmail });

  useEffect(() => {
    if (!user)           { router.push(ROUTES.login);        return; }
    if (role === "org")  router.push(ROUTES.orgDashboard);
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

  // Enrich recentActivity with flagCount if not already present
  const scansWithFlags = (recentActivity || []).map(s => ({
    ...s,
    flagCount: s.flagCount ?? s.flagged ?? 0,
  }));

  return (
    <>
      <style>{RESPONSIVE_CSS}</style>

      <div style={{ minHeight: "100vh", background: CP.black, fontFamily: CP.fontB, color: CP.white, position: "relative" }}>

        <Grain />

        {/* Top accent line */}
        <div aria-hidden="true" style={{
          height:     "1px",
          background: `linear-gradient(90deg, transparent, ${CP.accent} 30%, ${CP.accent} 70%, transparent)`,
          opacity:    0.25,
        }} />

        {/* ── Mobile top bar (hidden on desktop via CSS) ── */}
        <div className="cp-mobile-bar" style={{
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 16px",
          height:         "52px",
          borderBottom:   `0.5px solid ${CP.border}`,
          position:       "sticky",
          top:            0,
          background:     CP.black,
          zIndex:         20,
        }}>
          <p style={{ fontFamily: CP.fontBC, fontWeight: 900, fontSize: "14px", letterSpacing: "0.16em", textTransform: "uppercase", color: CP.white }}>
            Check<span style={{ color: CP.accent }}>Peak</span>
          </p>
          {/* Hamburger — wire up to your existing mobile nav/modal */}
          <button
            onClick={() => {}}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", display: "flex", flexDirection: "column", gap: "5px" }}
          >
            {[0,1,2].map(i => (
              <span key={i} style={{ display: "block", width: "20px", height: "1.5px", background: CP.ghost }} />
            ))}
          </button>
        </div>

        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px 56px", position: "relative", zIndex: 2 }}>
          <div className="cp-layout">

            {/* ── Sidebar (hidden on mobile via CSS) ── */}
            <div className="cp-sidebar-wrap">
              <Sidebar
                user={user}
                routes={ROUTES}
                activeRoute={ROUTES.dashboard}
                onNavigate={nav}
                onLogout={handleLogout}
                todayHasWork={!!todaySummary?.hasWorkout}
              />
            </div>

            {/* ── Main content ── */}
            <main style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0, overflow: "hidden" }}>

              <Header user={user} stats={stats} onNavigate={nav} />

              <Divider />

              <TodayPanel
                loading={loadingToday}
                summary={todaySummary}
                onOpen={() => nav(ROUTES.today)}
              />

              <StatsGrid stats={stats} />

              {/* Scan Activity + Risk Alerts */}
              <div className="cp-two-a">
                <ScanActivityCard
                  data={sparklineData}
                  max={maxSparkCount}
                  loading={loading}
                  lastScanDate={lastScanDate}
                  formatDate={formatDate}
                  onView={() => nav(ROUTES.scans)}
                />
                <RiskAlertsCard
                  flaggedCount={stats.flaggedScans}
                  recentScans={scansWithFlags}
                  onReview={() => nav(ROUTES.scans)}
                />
              </div>

              {/* Recent Scans — full width */}
              <RecentScansCard
                scans={scansWithFlags}
                loading={loading}
                formatDate={formatDate}
                onOpen={(scan) => nav(`${ROUTES.scans}/${scan.id}`)}
                onViewAll={() => nav(ROUTES.scans)}
              />

            </main>
          </div>
        </div>
      </div>
    </>
  );
}