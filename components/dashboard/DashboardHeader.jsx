// /components/dashboard/DashboardHeader.jsx
"use client";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* Pure helpers - no hooks, safe at module level                              */
/* -------------------------------------------------------------------------- */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(user) {
  return (user?.Name || user?.name || "Athlete").split(" ")[0];
}

/** "flagged" | "new" | "clear" */
function getDashboardState(stats) {
  if ((stats?.flaggedScans ?? 0) > 0)   return "flagged";
  if ((stats?.totalScans   ?? 0) === 0) return "new";
  return "clear";
}

/* -------------------------------------------------------------------------- */
/* QuickActionPill                                                             */
/* -------------------------------------------------------------------------- */

function QuickActionPill({ label, icon, onClick, variant = "ghost" }) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all shrink-0"
      style={{
        background:    isPrimary ? BRAND : "transparent",
        border:        isPrimary ? `1px solid ${BRAND}` : "1px solid #e2e8f0",
        color:         isPrimary ? "#fff" : "#475569",
        fontFamily:    FONT_COND,
        letterSpacing: "0.05em",
        boxShadow:     isPrimary ? "0 2px 10px rgba(91,158,201,0.28)" : "none",
        cursor:        "pointer",
      }}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = "#4a8ab5";
          e.currentTarget.style.boxShadow  = "0 4px 14px rgba(91,158,201,0.38)";
        } else {
          e.currentTarget.style.background = "#f1f5f9";
          e.currentTarget.style.color      = "#1e293b";
          e.currentTarget.style.borderColor = "#cbd5e1";
        }
      }}
      onMouseLeave={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = BRAND;
          e.currentTarget.style.boxShadow  = "0 2px 10px rgba(91,158,201,0.28)";
        } else {
          e.currentTarget.style.background  = "transparent";
          e.currentTarget.style.color       = "#475569";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* ScanIcon + StackIcon - inline SVGs, no dependency                         */
/* -------------------------------------------------------------------------- */

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* State config                                                                */
/* -------------------------------------------------------------------------- */

function getStateConfig(state, stats, routes) {
  const n = stats?.flaggedScans ?? 0;
  const t = stats?.totalScans   ?? 0;

  switch (state) {

    case "flagged":
      return {
        accentColor:  "#f59e0b",
        headline:     `${n} flagged supplement${n !== 1 ? "s" : ""} need${n === 1 ? "s" : ""} your attention.`,
        headlineColor: "#78350f",
        subline:      "Check your scans before your next training session.",
        sublineColor:  "#92400e",
        alert: {
          bg:      "rgba(245,158,11,0.07)",
          border:  "1px solid rgba(245,158,11,0.22)",
          message: `${n} supplement${n !== 1 ? "s" : ""} flagged for banned or risky ingredients.`,
          cta:     "Review now →",
          href:    routes?.scans || "/scans",
          color:   "#b45309",
        },
        primaryAction:   { label: "Review Flags",   icon: <AlertIcon />, href: routes?.scans       || "/scans"       },
        secondaryAction: { label: "Scan a Label",   icon: <ScanIcon />,  href: routes?.scan        || "/nutrition-label-scanner" },
      };

    case "new":
      return {
        accentColor:  BRAND,
        headline:     "Start by scanning your first supplement.",
        headlineColor: "#0f172a",
        subline:      "Upload a label and we'll check every ingredient in seconds.",
        sublineColor:  "#64748b",
        alert: null,
        primaryAction:   { label: "Scan a Label",      icon: <ScanIcon />,  href: routes?.scan        || "/nutrition-label-scanner" },
        secondaryAction: { label: "Browse SmartStack", icon: <StackIcon />, href: routes?.smartstack  || "/smartstack"  },
      };

    default: // "clear"
      return {
        accentColor:  BRAND,
        headline:     `Your stack is clear. Keep it that way.`,
        headlineColor: "#0f172a",
        subline:      `${t} scan${t !== 1 ? "s" : ""} completed - no banned substances detected.`,
        sublineColor:  "#64748b",
        alert: null,
        primaryAction:   { label: "Scan a Label", icon: <ScanIcon />,  href: routes?.scan        || "/nutrition-label-scanner" },
        secondaryAction: { label: "My Stacks",    icon: <StackIcon />, href: routes?.savedStacks || "/saved-stacks"  },
      };
  }
}

/* -------------------------------------------------------------------------- */
/* ProfileRing - circular progress, replaces the passive progress bar        */
/* -------------------------------------------------------------------------- */

function ProfileRing({ pct, onClick }) {
  const r          = 11;
  const circumference = 2 * Math.PI * r;
  const offset        = circumference * (1 - pct / 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 group transition-all"
      style={{ color: "#94a3b8", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = BRAND; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; }}
      aria-label={`Profile ${pct}% complete. Tap to finish setup.`}
    >
      {/* SVG ring */}
      <span className="relative flex items-center justify-center w-8 h-8 shrink-0">
        <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
          <circle cx="14" cy="14" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
          <circle
            cx="14" cy="14" r={r}
            fill="none"
            stroke={BRAND}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 14 14)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span
          className="absolute text-[8px] font-black tabular-nums"
          style={{ color: BRAND, fontFamily: FONT_COND, lineHeight: 1 }}
          aria-hidden="true"
        >
          {pct}
        </span>
      </span>

      {/* Text */}
      <div className="text-left leading-tight">
        <p
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ fontFamily: FONT_COND, color: "inherit" }}
        >
          Complete profile
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "#cbd5e1" }}>
          Tap to finish setup →
        </p>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* DashboardHeader                                                             */
/* -------------------------------------------------------------------------- */

export default function DashboardHeader({ user, stats, routes, onNavigate }) {
  const accountCompletion = Math.min(100, Math.max(0, stats?.accountCompletion ?? 0));
  const firstName         = getFirstName(user);
  const greeting          = getGreeting();
  const state             = getDashboardState(stats);
  const cfg               = getStateConfig(state, stats, routes);

  const nav = (href) => {
    if (typeof onNavigate === "function") onNavigate(href);
  };

  return (
    <header
      className="rounded-2xl overflow-hidden"
      style={{
        background:  "#fff",
        border:      "1px solid #e2e8f0",
        borderLeft:  `4px solid ${cfg.accentColor}`,
        boxShadow:   "0 1px 4px rgba(0,0,0,0.06)",
        fontFamily:  FONT_BODY,
      }}
    >
      {/* ── Main content row ─────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">

          {/* Left: greeting eyebrow + status headline */}
          <div className="min-w-0 flex-1">

            {/* Eyebrow: time-aware greeting */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: BRAND, boxShadow: "0 0 5px rgba(91,158,201,0.5)" }}
                aria-hidden="true"
              />
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: BRAND, fontFamily: FONT_COND }}
              >
                {greeting}, {firstName}
              </p>
            </div>

            {/* Status headline - primary message */}
            <h1
              className="text-2xl sm:text-[28px] font-black leading-tight"
              style={{
                color:         cfg.headlineColor,
                fontFamily:    FONT_COND,
                letterSpacing: "0.01em",
                maxWidth:      "36ch",
              }}
            >
              {cfg.headline}
            </h1>

            {/* Supporting line */}
            <p
              className="mt-1.5 text-sm leading-relaxed"
              style={{ color: cfg.sublineColor, maxWidth: "50ch" }}
            >
              {cfg.subline}
            </p>

            {/* Org context */}
            {user?.Organization && (
              <p className="mt-1.5 text-[11px]" style={{ color: "#94a3b8" }}>
                Organization:{" "}
                <span className="font-semibold" style={{ color: "#64748b" }}>
                  {user.Organization}
                </span>
              </p>
            )}
          </div>

          {/* Right: quick actions + optional profile ring */}
          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">

            {/* Quick action pills */}
            <div className="flex flex-wrap gap-2">
              <QuickActionPill
                label={cfg.primaryAction.label}
                icon={cfg.primaryAction.icon}
                onClick={() => nav(cfg.primaryAction.href)}
                variant="primary"
              />
              <QuickActionPill
                label={cfg.secondaryAction.label}
                icon={cfg.secondaryAction.icon}
                onClick={() => nav(cfg.secondaryAction.href)}
                variant="ghost"
              />
            </div>

            {/* Profile ring - only when incomplete */}
            {accountCompletion < 100 && (
              <ProfileRing
                pct={accountCompletion}
                onClick={() => nav(routes?.account || "/account")}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Flagged alert strip - only in "flagged" state ─────────────── */}
      {cfg.alert && (
        <div
          className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
          style={{
            background: cfg.alert.bg,
            border:     cfg.alert.border,
          }}
          role="alert"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0"
              style={{ color: "#d97706" }}
              aria-hidden="true"
            >
              <AlertIcon />
            </span>
            <p
              className="text-xs font-medium leading-snug"
              style={{ color: cfg.alert.color }}
            >
              {cfg.alert.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav(cfg.alert.href)}
            className="text-[11px] font-bold shrink-0 transition-colors"
            style={{ color: "#d97706", fontFamily: FONT_COND, letterSpacing: "0.04em", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#92400e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#d97706"; }}
          >
            {cfg.alert.cta}
          </button>
        </div>
      )}
    </header>
  );
}