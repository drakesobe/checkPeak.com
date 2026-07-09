// components/NavBar.js
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";
import Logo from "@/components/Logo";
import NavBarLoginModal from "@/components/NavBarLoginModal";

function cx(...xs) { return xs.filter(Boolean).join(" "); }

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(str) {
  const colors = ["#4FABFF", "#7C6EF5", "#46769B", "#D4900A", "#FF7B35"];
  let hash = 0;
  for (let i = 0; i < String(str || "").length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Public mobile links (logged-out state)
const MOBILE_PUBLIC = [
  { name: "The Arena", href: "/trainers" },
  { name: "Pricing",   href: "/pricing"  },
];

// ─── Inline SVG icon set ──────────────────────────────────────────────────────
// All 16×16 display, 24×24 viewBox, Lucide-compatible stroke style.

function IcoFilm({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.5" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5" />
    </svg>
  );
}

function IcoPlays({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <polygon points="10,8 16,12 10,16" fill={color} stroke="none" />
    </svg>
  );
}

function IcoCal({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IcoClipboard({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function IcoUsers({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IcoMessage({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IcoNutrition({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-5 8-13V4l-8-2-8 2v5c0 8 8 13 8 13z" />
    </svg>
  );
}

function IcoTrainer({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function IcoStudio({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IcoGlobe({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IcoDash({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IcoSun({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IcoJournal({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  );
}

function IcoScan({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function IcoSearch({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IcoStore({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18l-1.5 9H4.5L3 3z" />
      <path d="M4.5 12v7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-7" />
      <path d="M9 21v-5h6v5" />
    </svg>
  );
}

function IcoLibrary({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IcoHelp({ size = 14, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ─── Dropdown nav primitives ──────────────────────────────────────────────────

function NavLink({ href, label, badge, onClick, external, isActiveFn }) {
  const [hov, setHov] = useState(false);
  const active = isActiveFn?.(href) ?? false;
  return (
    <Link
      href={href}
      onClick={onClick}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center",
        padding: "9px 20px 9px 18px",
        borderLeft: `2px solid ${active ? "#4FABFF" : "transparent"}`,
        fontSize: 14, fontWeight: active ? 700 : 500,
        color: active ? "#fff" : hov ? "#fff" : "rgba(255,255,255,0.62)",
        textDecoration: "none",
        transition: "color 0.12s, border-color 0.12s",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4FABFF" }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function NavSection({ children, color = "rgba(255,255,255,0.28)" }) {
  return (
    <div style={{ padding: "14px 20px 4px", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}

function NavDivider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />;
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────

function ProfileDropdown({ user, role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, onClose, onLogout, trainerSlug, isActiveFn, avatarUrl = "" }) {
  const name     = user?.Name || user?.name || "Profile";
  const email    = user?.Email || user?.email || "";
  const color    = avatarColor(name);
  const initials = getInitials(name);
  const isOrgAdmin = role === "organization" || role === "admin";

  const nl = (props) => <NavLink {...props} onClick={onClose} isActiveFn={isActiveFn} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      style={{
        position: "absolute", right: 0, marginTop: 8,
        width: 280, borderRadius: 14,
        maxHeight: "calc(100vh - 90px)",
        display: "flex", flexDirection: "column",
        background: "#0D1119",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.35)",
        overflow: "hidden", zIndex: 200,
      }}
      role="menu"
    >
      {/* ── Identity — pinned top ── */}
      <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: color + "20", border: `1.5px solid ${color}60`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 14, fontWeight: 900, color }}>{initials}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4FABFF", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {roleLabel}{orgName ? ` · ${orgName}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable nav body ── */}
      <div style={{ overflowY: "auto", flex: 1, scrollbarWidth: "none" }}>

        {/* Org / Coach context */}
        {isOrgSide && (
          <>
            <NavSection>Coaching</NavSection>
            {nl({ href: "/org/film",              label: "Film",         badge: "Beta" })}
            {nl({ href: "/org/plays",             label: "Play Library"               })}
            {nl({ href: "/org/workouts-calendar", label: "Schedule"                   })}
            {nl({ href: "/org/review-queue",      label: "Review Queue"               })}

            <NavDivider />

            <NavSection>Team</NavSection>
            {nl({ href: "/org/messaging",     label: "Messaging" })}
            {nl({ href: "/org/prescriptions", label: "Nutrition"  })}
            {isOrgAdmin && nl({ href: "/org/athletes", label: "Athletes & Stats" })}
            {isAdmin    && nl({ href: "/org/trainers", label: "Trainers" })}

            <NavDivider />

            <NavSection>Tools</NavSection>
            {nl({ href: "/nutrition-label-scanner", label: "Label Scanner" })}
            {nl({ href: "/search",                  label: "Search"        })}
            {nl({ href: "/smartstack-compare",      label: "SmartStack"    })}
            {nl({ href: "/compliance/ncaa",         label: "NCAA Rules"    })}
            {nl({ href: "/info",                    label: "Info"          })}

            {trainerSlug && (
              <>
                <NavDivider />
                <NavSection color="rgba(70,118,155,0.9)">Studio</NavSection>
                {nl({ href: "/commercial/dashboard",   label: "Dashboard"      })}
                {nl({ href: `/trainer/${trainerSlug}`, label: "Public Profile", external: true })}
              </>
            )}

            <NavDivider />
            {nl({ href: "/org/help", label: "Help Center" })}
            <div style={{ height: 10 }} />
          </>
        )}

        {/* Athlete context */}
        {isAthlete && (
          <>
            <NavSection>My Space</NavSection>
            {nl({ href: "/dashboard",          label: "Dashboard"          })}
            {nl({ href: "/athlete/today",      label: "Today"              })}
            {nl({ href: "/athlete/journal",    label: "Journal"            })}
            {nl({ href: "/athlete/profile",    label: "Recruiting Profile", badge: "New" })}
            {nl({ href: "/athlete/stats",      label: "Stats"              })}
            {nl({ href: "/scans",              label: "My Scans"           })}

            <NavDivider />

            <NavSection color="rgba(255,123,53,0.85)">Discover</NavSection>
            {nl({ href: "/trainers",           label: "Marketplace"  })}
            {nl({ href: "/smartstack-compare", label: "SmartStack"   })}
            {nl({ href: "/athlete/libraries",  label: "My Libraries" })}
            <div style={{ height: 10 }} />
          </>
        )}

      </div>

      {/* ── Footer — pinned bottom ── */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0 }}>
        <Link
          href="/account" onClick={onClose}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center", transition: "all 0.12s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
        >
          Account
        </Link>
        <button
          type="button" onClick={onLogout}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 7, background: "rgba(217,43,58,0.1)", border: "1px solid rgba(217,43,58,0.22)", color: "#FF7A7A", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(217,43,58,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(217,43,58,0.1)"; }}
        >
          Sign out
        </button>
      </div>
    </motion.div>
  );
}

// ─── Mobile menu ──────────────────────────────────────────────────────────────

function MobileMenu({ user, role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, isActive, onClose, onLogout, loggedIn, openAuthModal, trainerSlug, avatarUrl = "" }) {
  const name     = user?.Name || user?.name || "Profile";
  const email    = user?.Email || user?.email || "";
  const color    = avatarColor(name);
  const initials = getInitials(name);
  const isOrgAdmin = role === "organization" || role === "admin";

  const ml = ({ href, label, badge, external }) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{
          display: "flex", alignItems: "center",
          padding: "12px 20px 12px 18px",
          borderLeft: `2px solid ${active ? "#4FABFF" : "transparent"}`,
          fontSize: 16, fontWeight: active ? 700 : 500,
          color: active ? "#fff" : "rgba(255,255,255,0.65)",
          textDecoration: "none",
        }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        {badge && (
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4FABFF" }}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const mSection = (label, color = "rgba(255,255,255,0.28)") => (
    <div style={{ padding: "16px 20px 4px", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color }}>
      {label}
    </div>
  );

  const mDivider = () => (
    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{    opacity: 0, height: 0    }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ background: "#0D1119", borderTop: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}
    >
      <div style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 72px)",
        maxHeight: "calc(100dvh - 64px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}>

        {!loggedIn ? (
          <>
            {MOBILE_PUBLIC.map(tab => {
              const active = isActive(tab.href);
              return (
                <Link key={tab.href} href={tab.href} onClick={onClose}
                  style={{ display: "flex", alignItems: "center", padding: "14px 20px", fontSize: 16, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.6)", textDecoration: "none", borderLeft: `2px solid ${active ? "#4FABFF" : "transparent"}` }}>
                  {tab.name}
                </Link>
              );
            })}
            {mDivider()}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px" }}>
              <Link href="/book" onClick={onClose}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px", background: "#46769B", color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none", letterSpacing: "0.07em" }}>
                BOOK A WALKTHROUGH
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <button type="button" onClick={() => { openAuthModal("login"); onClose(); }}
                style={{ padding: "14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.05em" }}>
                LOG IN
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: color + "20", border: `1.5px solid ${color}60`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 14, fontWeight: 900, color }}>{initials}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
                </div>
              </div>
            </div>

            {isOrgSide && (
              <>
                {mSection("Coaching")}
                {ml({ href: "/org/film",              label: "Film",         badge: "Beta" })}
                {ml({ href: "/org/plays",             label: "Play Library"               })}
                {ml({ href: "/org/workouts-calendar", label: "Schedule"                   })}
                {ml({ href: "/org/review-queue",      label: "Review Queue"               })}
                {mDivider()}
                {mSection("Team")}
                {ml({ href: "/org/messaging",     label: "Messaging" })}
                {ml({ href: "/org/prescriptions", label: "Nutrition"  })}
                {isOrgAdmin && ml({ href: "/org/athletes", label: "Athletes & Stats" })}
                {isAdmin    && ml({ href: "/org/trainers", label: "Trainers" })}
                {mDivider()}
                {mSection("Tools")}
                {ml({ href: "/nutrition-label-scanner", label: "Label Scanner" })}
                {ml({ href: "/search",                  label: "Search"        })}
                {ml({ href: "/smartstack-compare",      label: "SmartStack"    })}
                {ml({ href: "/compliance/ncaa",         label: "NCAA Rules"    })}
                {ml({ href: "/info",                    label: "Info"          })}
                {trainerSlug && (
                  <>
                    {mDivider()}
                    {mSection("Studio", "rgba(70,118,155,0.9)")}
                    {ml({ href: "/commercial/dashboard",   label: "Dashboard"      })}
                    {ml({ href: `/trainer/${trainerSlug}`, label: "Public Profile", external: true })}
                  </>
                )}
                {mDivider()}
                {ml({ href: "/org/help", label: "Help Center" })}
              </>
            )}

            {isAthlete && (
              <>
                {mSection("My Space")}
                {ml({ href: "/dashboard",          label: "Dashboard"           })}
                {ml({ href: "/athlete/today",      label: "Today"               })}
                {ml({ href: "/athlete/journal",    label: "Journal"             })}
                {ml({ href: "/athlete/profile",    label: "Recruiting Profile", badge: "New" })}
                {ml({ href: "/athlete/stats",      label: "Stats"               })}
                {ml({ href: "/scans",              label: "My Scans"            })}
                {mDivider()}
                {mSection("Discover", "rgba(255,123,53,0.85)")}
                {ml({ href: "/trainers",           label: "Marketplace"  })}
                {ml({ href: "/smartstack-compare", label: "SmartStack"   })}
                {ml({ href: "/athlete/libraries",  label: "My Libraries" })}
              </>
            )}

            {mDivider()}
            <div style={{ display: "flex", gap: 8, padding: "10px 16px 12px" }}>
              <Link href="/account" onClick={onClose}
                style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
                Account
              </Link>
              <button type="button" onClick={onLogout}
                style={{ flex: 1, padding: "11px", background: "rgba(217,43,58,0.1)", border: "1px solid rgba(217,43,58,0.22)", color: "#FF7A7A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main NavBar ──────────────────────────────────────────────────────────────

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthContext();

  const [isMounted,       setIsMounted]       = useState(false);
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [profileOpen,     setProfileOpen]     = useState(false);
  const [loginModalOpen,  setLoginModalOpen]  = useState(false);
  const [defaultAuthTab,  setDefaultAuthTab]  = useState("login");
  const [trainerSlug,     setTrainerSlug]     = useState("");
  const [scrolled,        setScrolled]        = useState(false);
  const [navAvatarUrl,    setNavAvatarUrl]    = useState("");

  // Pages with dark editorial backgrounds — nav switches to transparent/dark mode
  const DARK_ROUTES = ["/", "/pricing", "/book", "/contact"];
  const isDark = isMounted && DARK_ROUTES.some(r =>
    r === "/" ? pathname === "/" : (pathname || "").startsWith(r)
  );

  const navRef = useRef(null);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isMounted || !navRef.current) return;
    const setVar = () => {
      const h = navRef.current?.getBoundingClientRect?.().height ?? 0;
      document.documentElement.style.setProperty("--app-header-h", `${Math.round(h)}px`);
    };
    setVar();
    window.addEventListener("resize", setVar);
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(setVar);
      ro.observe(navRef.current);
    }
    return () => { window.removeEventListener("resize", setVar); ro?.disconnect(); };
  }, [isMounted]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow     = "hidden";
    document.body.style.paddingRight = sw > 0 ? `${sw}px` : "";
    return () => { document.body.style.overflow = ""; document.body.style.paddingRight = ""; };
  }, [menuOpen]);

  const role = useMemo(() => {
    const raw = (user?.role || user?.Role || "").toString().trim().toLowerCase();
    if (!raw) return "";
    if (raw === "organization" || raw.includes("org"))   return "organization";
    if (raw === "athlete"      || raw.includes("ath"))   return "athlete";
    if (raw === "trainer"      || raw.includes("train")) return "trainer";
    if (raw === "admin"        || raw.includes("admin")) return "admin";
    return raw;
  }, [user]);

  const isAthlete = role === "athlete";
  const isOrgSide = role === "organization" || role === "trainer" || role === "admin";
  const isAdmin   = role === "admin";

  const roleLabel = useMemo(() => {
    const MAP = { organization: "Organization", admin: "Admin", trainer: "Trainer", athlete: "Athlete" };
    return MAP[role] ?? "Member";
  }, [role]);

  const orgName = useMemo(() => (
    String(user?.OrgName || user?.OrganizationName || user?.organizationName || user?.OrganizationDisplay || user?.organizationDisplay || "").trim()
  ), [user]);

  useEffect(() => {
    if (!isOrgSide || !user) return;
    fetch("/api/commercial/trainer", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.trainer?.fields?.slug) setTrainerSlug(data.trainer.fields.slug); })
      .catch(() => {});
  }, [isOrgSide, user]);

  useEffect(() => {
    if (!isMounted || !isAthlete) return;
    try { setNavAvatarUrl(localStorage.getItem("checkpeak:athlete-avatar") || ""); }
    catch {}
  }, [isMounted, isAthlete]);

  const loggedIn = !!user;

  const isActive = useCallback((href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(`${href}/`);
  }, [pathname]);

  const openAuthModal = useCallback((tab = "login") => {
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail ?? {};
      const tab    = detail.defaultTab ?? "login";
      const email  = detail.email ? String(detail.email).trim() : "";
      if (email) { try { window.localStorage.setItem("cp_prefill_login_email", email); } catch {} }
      openAuthModal(tab);
    };
    window.addEventListener("cp:open-auth-modal", handler);
    return () => window.removeEventListener("cp:open-auth-modal", handler);
  }, [openAuthModal]);

  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setMenuOpen(false); setProfileOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setProfileOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen]);

  const handleProfileClick = useCallback(() => {
    if (!loggedIn) return openAuthModal("login");
    setProfileOpen(p => !p);
  }, [loggedIn, openAuthModal]);

  const logoutAndClose = useCallback(async () => {
    try { await logout?.(); } catch {}
    finally { setProfileOpen(false); setMenuOpen(false); router.push("/login"); }
  }, [logout, router]);

  const sharedRoleProps = { role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, trainerSlug };

  const profileButtonLabel = useMemo(() => {
    if (!loggedIn) return "Login";
    const name  = user?.Name || user?.name || "";
    const first = name.trim().split(/\s+/)[0];
    return first || "Profile";
  }, [loggedIn, user]);

  // Nav container styles — dark pages start transparent, solidify on scroll
  const navStyle = isDark ? {
    position: "sticky", top: 0, zIndex: 150,
    background: scrolled ? "rgba(6,8,16,0.92)" : "transparent",
    backdropFilter: scrolled ? "blur(18px)" : "none",
    WebkitBackdropFilter: scrolled ? "blur(18px)" : "none",
    borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
    transition: "background 0.28s ease, border-color 0.28s ease",
  } : {
    position: "sticky", top: 0, zIndex: 150,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: "1px solid #E5E7EB",
  };

  // Link + button color tokens driven by theme
  const C = isDark ? {
    link:        "rgba(255,255,255,0.60)",
    linkHover:   "#ffffff",
    linkActive:  "#ffffff",
    ctaBg:       "#4FABFF",
    ctaText:     "#060810",
    ctaHoverBg:  "#79C4FF",
    btnBorder:   profileOpen ? "rgba(79,171,255,0.5)" : "rgba(255,255,255,0.18)",
    btnBg:       profileOpen ? "rgba(79,171,255,0.1)" : "rgba(255,255,255,0.07)",
    btnText:     "rgba(255,255,255,0.9)",
    chevron:     "rgba(255,255,255,0.5)",
    burger:      menuOpen ? "#ffffff" : "rgba(255,255,255,0.78)",
    burgerBorder:"rgba(255,255,255,0.15)",
    burgerBg:    menuOpen ? "rgba(255,255,255,0.1)" : "transparent",
  } : {
    link:        "#4B5563",
    linkHover:   "#46769B",
    linkActive:  "#46769B",
    ctaBg:       "#46769B",
    ctaText:     "#ffffff",
    ctaHoverBg:  "#3a607f",
    btnBorder:   profileOpen ? "rgba(70,118,155,0.6)" : "#E5E7EB",
    btnBg:       profileOpen ? "#EEF3F9" : "#ffffff",
    btnText:     "#1A2535",
    chevron:     "rgba(26,37,53,0.4)",
    burger:      menuOpen ? "#ffffff" : "#374151",
    burgerBorder:"#E5E7EB",
    burgerBg:    menuOpen ? "#111827" : "#ffffff",
  };

  return (
    <>
      <nav ref={navRef} aria-label="Main navigation" style={navStyle}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(1rem, 4vw, 2rem)" }}>
          <div style={{ height: "clamp(56px, 5vw, 68px)", display: "flex", alignItems: "center", position: "relative" }}>

            {/* ── Logo — centered, sport-brand convention ── */}
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 1 }}>
              <Link href="/" aria-label="CheckPeak Home" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                <span className="block md:hidden"><Logo size="medium" /></span>
                <span className="hidden md:block"><Logo size="medium" /></span>
              </Link>
            </div>

            {/* ── Left spacer ── */}
            <div style={{ flex: 1 }} />

            {/* ── Desktop right side ── */}
            <div className="hidden md:flex" style={{ alignItems: "center", gap: "0.15rem" }}>

              {/* Pricing — only relevant for logged-out visitors */}
              {!loggedIn && (
                <Link
                  href="/pricing"
                  style={{
                    fontSize: 13, fontWeight: 500, textDecoration: "none",
                    padding: "6px 11px", borderRadius: 8,
                    color: isActive("/pricing") ? C.linkActive : C.link,
                    transition: "color 0.14s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.linkHover; }}
                  onMouseLeave={e => { e.currentTarget.style.color = isActive("/pricing") ? C.linkActive : C.link; }}
                >
                  Pricing
                </Link>
              )}

              {/* Book a Walkthrough — primary CTA, hidden once logged in */}
              {!loggedIn && (
                <a
                  href="/book"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 15px", marginLeft: "0.35rem", borderRadius: 22,
                    background: C.ctaBg, color: C.ctaText,
                    fontSize: 13, fontWeight: 700, letterSpacing: "0.01em",
                    textDecoration: "none", flexShrink: 0, transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.ctaHoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.ctaBg; }}
                >
                  Book a Walkthrough
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </a>
              )}

              {/* Login / Profile */}
              {isMounted && (
                <div className="relative" style={{ marginLeft: "0.35rem" }}>
                  <button
                    type="button"
                    onClick={handleProfileClick}
                    aria-expanded={loggedIn ? profileOpen : undefined}
                    aria-haspopup={loggedIn ? "true" : undefined}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "6px 4px",
                      border: "none", background: "none",
                      color: C.btnText,
                      fontSize: 12, fontWeight: 800, letterSpacing: "0.06em",
                      cursor: "pointer", transition: "opacity 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {loggedIn && (
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                        background: avatarColor(user?.Name || user?.name || "") + "22",
                        border: `1.5px solid ${avatarColor(user?.Name || user?.name || "")}88`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800,
                        color: avatarColor(user?.Name || user?.name || ""),
                        overflow: "hidden",
                      }}>
                        {navAvatarUrl
                          ? <img src={navAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : getInitials(user?.Name || user?.name || "")
                        }
                      </div>
                    )}
                    {profileButtonLabel}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.45, transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {loggedIn && profileOpen && (
                      <ProfileDropdown
                        user={user}
                        {...sharedRoleProps}
                        avatarUrl={navAvatarUrl}
                        onClose={() => setProfileOpen(false)}
                        onLogout={logoutAndClose}
                        isActiveFn={isActive}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* ── Mobile hamburger ── */}
            <div className="md:hidden" style={{ marginLeft: "auto" }}>
              <button
                type="button"
                onClick={() => setMenuOpen(v => !v)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  border: `1px solid ${C.burgerBorder}`,
                  background: C.burgerBg,
                  display: "grid", placeItems: "center",
                  cursor: "pointer", transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      display: "block", width: 20, height: 2, borderRadius: 1,
                      background: C.burger,
                      transition: "all 0.2s ease",
                      transform: menuOpen
                        ? i === 0 ? "rotate(45deg) translate(5px, 5px)"
                        : i === 1 ? "scaleX(0)"
                        : "rotate(-45deg) translate(5px, -5px)"
                        : "none",
                      opacity: menuOpen && i === 1 ? 0 : 1,
                    }} />
                  ))}
                </div>
              </button>
            </div>

          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <div className="md:hidden">
              <MobileMenu
                user={user}
                {...sharedRoleProps}
                avatarUrl={navAvatarUrl}
                isActive={isActive}
                loggedIn={loggedIn}
                onClose={() => setMenuOpen(false)}
                onLogout={logoutAndClose}
                openAuthModal={openAuthModal}
              />
            </div>
          )}
        </AnimatePresence>
      </nav>

      <NavBarLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultTab={defaultAuthTab}
        onRequestOpen={(detail = {}) => openAuthModal(detail?.tab === "signup" ? "signup" : "login")}
      />
    </>
  );
}
