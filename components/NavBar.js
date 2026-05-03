// components/NavBar.jsx
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";
import Logo from "@/components/Logo";
import NavBarLoginModal from "@/components/NavBarLoginModal";

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

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

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */

const ALL_TABS = [
  { name: "Scan",       href: "/nutrition-label-scanner" },
  { name: "Search",     href: "/search"                  },
  { name: "Info",       href: "/info"                    },
  { name: "NCAA Rules", href: "/compliance/ncaa"         },
  { name: "SmartStack", href: "/smartstack-compare", icon: "mountain" },
];

const DESKTOP_LEFT_TABS  = ALL_TABS.filter(t => ["Scan", "Search", "Info", "NCAA Rules"].includes(t.name));
const DESKTOP_RIGHT_TABS = ALL_TABS.filter(t => ["SmartStack"].includes(t.name));
const MOBILE_TABS        = ALL_TABS;

const MountainIconFallback = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path d="M3 18l6-8 3 4 3-4 6 8H3z" fill="currentColor" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* NavItem                                                                     */
/* -------------------------------------------------------------------------- */
function NavItem({ tab, isActive, stackIconBroken, onStackIconError, onClick }) {
  const active        = isActive(tab.href);
  const isMountainTab = tab.icon === "mountain";

  return (
    <Link
      href={tab.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition",
        active
          ? "text-[#46769B] bg-blue-50"
          : "text-gray-700 hover:text-[#46769B] hover:bg-gray-50"
      )}
    >
      {isMountainTab && (
        !stackIconBroken ? (
          <img src="/mountain.svg" alt="" className="h-4 w-4" onError={onStackIconError} draggable={false} />
        ) : MountainIconFallback
      )}
      <span>{tab.name}</span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Premium Profile Dropdown                                                    */
/* -------------------------------------------------------------------------- */

// Section label
function DropSection({ label }) {
  return (
    <div style={{
      padding:       "10px 16px 4px",
      fontSize:      9,
      fontWeight:    800,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color:         "rgba(255,255,255,0.25)",
    }}>
      {label}
    </div>
  );
}

// Single link row
function DropLink({ href, children, icon, onClick, badge }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        padding:        "9px 16px",
        fontSize:       13,
        fontWeight:     500,
        color:          hovered ? "#fff" : "rgba(255,255,255,0.65)",
        background:     hovered ? "rgba(255,255,255,0.06)" : "transparent",
        borderRadius:   8,
        textDecoration: "none",
        transition:     "all 0.12s ease",
        margin:         "0 6px",
        cursor:         "pointer",
      }}
    >
      {icon && <span style={{ fontSize: 15, flexShrink: 0, opacity: 0.7 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{children}</span>
      {badge && (
        <span style={{
          fontSize:      10,
          fontWeight:    700,
          color:         "#4FABFF",
          background:    "rgba(79,171,255,0.12)",
          border:        "1px solid rgba(79,171,255,0.25)",
          borderRadius:  20,
          padding:       "1px 7px",
          letterSpacing: "0.04em",
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

// Divider
function DropDivider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />;
}

// The full dropdown panel
function ProfileDropdown({ user, role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, isActive, onClose, onLogout }) {
  const name   = user?.Name || user?.name || "Profile";
  const email  = user?.Email || user?.email || "";
  const color  = avatarColor(name);
  const initials = getInitials(name);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      style={{
        position:     "absolute",
        right:        0,
        marginTop:    8,
        width:        280,
        borderRadius: 16,
        background:   "#111827",
        border:       "1px solid rgba(255,255,255,0.1)",
        boxShadow:    "0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)",
        overflow:     "hidden",
        zIndex:       200,
      }}
      role="menu"
    >
      {/* ── User identity hero ── */}
      <div style={{
        padding:    "16px 16px 14px",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width:          44,
            height:         44,
            borderRadius:   "50%",
            background:     color + "22",
            border:         `1.5px solid ${color}55`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <span style={{ fontSize: 16, fontWeight: 900, color, letterSpacing: -0.5 }}>{initials}</span>
          </div>

          {/* Name + email + role */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#46769B", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {roleLabel}{orgName ? ` · ${orgName}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Org links ── */}
      {isOrgSide && (
        <>
          <div style={{ padding: "6px 0" }}>
            <DropSection label="Workspace" />
            <DropLink href="/org/workouts-calendar"  icon="⬡" onClick={onClose}>Workouts Calendar</DropLink>
            <DropLink href="/org/review-queue"       icon="✦" onClick={onClose}>Review Queue</DropLink>
            <DropLink href="/org/nutrition"          icon="◎" onClick={onClose}>Nutrition</DropLink>
          </div>
          <DropDivider />
          <div style={{ padding: "0 0 6px" }}>
            <DropSection label="Team" />
            <DropLink href="/org/messaging" icon="◉" onClick={onClose}>Messaging</DropLink>
            {(isAdmin || role === "organization") && (
              <>
                <DropLink href="/org/athletes" icon="◈" onClick={onClose}>Athletes</DropLink>
                <DropLink href="/org/trainers" icon="◈" onClick={onClose}>Trainers</DropLink>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Athlete links ── */}
      {isAthlete && (
        <div style={{ padding: "6px 0" }}>
          <DropSection label="My Account" />
          <DropLink href="/dashboard"     icon="⬡" onClick={onClose}>Athlete Dashboard</DropLink>
          <DropLink href="/athlete/today" icon="◎" onClick={onClose}>Today</DropLink>
          <DropLink href="/scans"         icon="◈" onClick={onClose}>My Scans</DropLink>
        </div>
      )}

      <DropDivider />

      {/* ── Help Center ── */}
      {isOrgSide && (
        <>
          <Link
            href="/org/help"
            onClick={onClose}
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            12,
              padding:        "11px 16px",
              margin:         "4px 6px",
              borderRadius:   10,
              background:     "rgba(79,171,255,0.07)",
              border:         "1px solid rgba(79,171,255,0.18)",
              textDecoration: "none",
              cursor:         "pointer",
              transition:     "background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(79,171,255,0.13)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(79,171,255,0.07)"; }}
          >
            <div style={{ fontSize: 20, flexShrink: 0 }}>🎬</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 1 }}>Help Center</div>
              <div style={{ fontSize: 11, color: "#4FABFF", fontWeight: 500 }}>7 tutorial videos · ~26 min</div>
            </div>
          </Link>
          <div style={{ height: 6 }} />
        </>
      )}

      {/* ── Bottom: Account + Sign out ── */}
      <div style={{
        padding:      "10px 10px",
        borderTop:    "1px solid rgba(255,255,255,0.07)",
        display:      "flex",
        gap:          8,
      }}>
        <Link
          href="/account"
          onClick={onClose}
          style={{
            flex:           1,
            padding:        "9px 12px",
            borderRadius:   8,
            background:     "rgba(255,255,255,0.05)",
            border:         "1px solid rgba(255,255,255,0.1)",
            color:          "rgba(255,255,255,0.7)",
            fontSize:       13,
            fontWeight:     600,
            textDecoration: "none",
            textAlign:      "center",
            cursor:         "pointer",
            transition:     "all 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
        >
          Account
        </Link>
        <button
          type="button"
          onClick={onLogout}
          style={{
            flex:         1,
            padding:      "9px 12px",
            borderRadius: 8,
            background:   "rgba(217,43,58,0.1)",
            border:       "1px solid rgba(217,43,58,0.25)",
            color:        "#FF6B6B",
            fontSize:     13,
            fontWeight:   700,
            cursor:       "pointer",
            transition:   "all 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(217,43,58,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(217,43,58,0.1)"; }}
        >
          Sign out
        </button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile Menu Panel                                                           */
/* -------------------------------------------------------------------------- */

function MobileMenu({ user, role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, isActive, onClose, onLogout, loggedIn, openAuthModal }) {
  const name     = user?.Name || user?.name || "Profile";
  const email    = user?.Email || user?.email || "";
  const color    = avatarColor(name);
  const initials = getInitials(name);

  const MLink = ({ href, children, icon }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={onClose}
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            10,
          padding:        "11px 14px",
          borderRadius:   10,
          fontSize:       14,
          fontWeight:     active ? 700 : 500,
          color:          active ? "#fff" : "rgba(255,255,255,0.6)",
          background:     active ? "rgba(255,255,255,0.08)" : "transparent",
          textDecoration: "none",
          transition:     "all 0.12s",
        }}
      >
        {icon && <span style={{ fontSize: 16, opacity: 0.6 }}>{icon}</span>}
        {children}
      </Link>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{    opacity: 0, height: 0    }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{
        background:   "#111827",
        borderTop:    "1px solid rgba(255,255,255,0.07)",
        overflow:     "hidden",
      }}
    >
      <div style={{ padding: "12px", maxHeight: "calc(100vh - 64px)", overflowY: "auto" }}>

        {/* Public nav links */}
        <div style={{ marginBottom: 8 }}>
          {MOBILE_TABS.map(tab => (
            <MLink key={tab.href} href={tab.href}>{tab.name}</MLink>
          ))}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />

        {!loggedIn ? (
          /* ── Auth buttons ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
            <button
              type="button"
              onClick={() => { openAuthModal("login"); onClose(); }}
              style={{ padding: "13px", borderRadius: 10, background: "#46769B", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => { openAuthModal("signup"); onClose(); }}
              style={{ padding: "13px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Sign up
            </button>
          </div>
        ) : (
          <>
            {/* ── User identity card ── */}
            <div style={{ padding: "14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: color + "22", border: `1.5px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color }}>{initials}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#46769B" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {roleLabel}{orgName ? ` · ${orgName}` : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Org nav ── */}
            {isOrgSide && (
              <>
                <div style={{ padding: "4px 0 2px", fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", paddingLeft: 14, marginBottom: 2 }}>Workspace</div>
                <MLink href="/org/workouts-calendar"         icon="⬡">Dashboard</MLink>
                <MLink href="/org/review-queue"      icon="✦">Review Queue</MLink>
                <MLink href="/org/workouts-calendar" icon="◈">Workouts Calendar</MLink>
                <MLink href="/org/nutrition"         icon="◎">Nutrition</MLink>

                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />

                <div style={{ padding: "4px 0 2px", fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", paddingLeft: 14, marginBottom: 2 }}>Team</div>
                <MLink href="/org/messaging" icon="◉">Messaging</MLink>
                {(isAdmin || role === "organization") && (
                  <>
                    <MLink href="/org/athletes" icon="◈">Athletes</MLink>
                    <MLink href="/org/trainers" icon="◈">Trainers</MLink>
                  </>
                )}
              </>
            )}

            {/* ── Athlete nav ── */}
            {isAthlete && (
              <>
                <MLink href="/dashboard"     icon="⬡">Athlete Dashboard</MLink>
                <MLink href="/athlete/today" icon="◎">Today</MLink>
                <MLink href="/scans"         icon="◈">My Scans</MLink>
              </>
            )}

            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />

            {/* ── Help Center ── */}
            {isOrgSide && (
              <Link
                href="/org/help"
                onClick={onClose}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(79,171,255,0.07)", border: "1px solid rgba(79,171,255,0.18)", textDecoration: "none", marginBottom: 8 }}
              >
                <span style={{ fontSize: 20 }}>🎬</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Help Center</div>
                  <div style={{ fontSize: 11, color: "#4FABFF", fontWeight: 500 }}>7 tutorial videos · ~26 min</div>
                </div>
              </Link>
            )}

            {/* ── Account + Sign out ── */}
            <div style={{ display: "flex", gap: 8 }}>
              <Link
                href="/account"
                onClick={onClose}
                style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}
              >
                Account
              </Link>
              <button
                type="button"
                onClick={onLogout}
                style={{ flex: 1, padding: "11px", borderRadius: 10, background: "rgba(217,43,58,0.1)", border: "1px solid rgba(217,43,58,0.25)", color: "#FF6B6B", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* NavBar                                                                      */
/* -------------------------------------------------------------------------- */
export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuthContext();

  const [isMounted,       setIsMounted]       = useState(false);
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [profileOpen,     setProfileOpen]     = useState(false);
  const [loginModalOpen,  setLoginModalOpen]  = useState(false);
  const [defaultAuthTab,  setDefaultAuthTab]  = useState("login");
  const [stackIconBroken, setStackIconBroken] = useState(false);

  const navRef = useRef(null);

  useEffect(() => setIsMounted(true), []);

  /* ── Nav height → CSS variable ── */
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

  /* ── Lock body scroll when mobile menu open ── */
  useEffect(() => {
    if (!menuOpen) return;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow     = "hidden";
    document.body.style.paddingRight = sw > 0 ? `${sw}px` : "";
    return () => { document.body.style.overflow = ""; document.body.style.paddingRight = ""; };
  }, [menuOpen]);

  /* ── Role normalisation ── */
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

  const orgName = useMemo(() => {
    return String(
      user?.OrgName || user?.OrganizationName || user?.organizationName ||
      user?.OrganizationDisplay || user?.organizationDisplay || ""
    ).trim();
  }, [user]);

  const loggedIn = !!user;

  const isActive = useCallback((href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(`${href}/`);
  }, [pathname]);

  const openAuthModal = useCallback((tab = "login") => {
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
  }, []);

  const onRequestOpen = useCallback((detail = {}) => {
    openAuthModal(detail?.tab === "signup" ? "signup" : "login");
  }, [openAuthModal]);

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

  const handleStackIconError = useCallback(() => setStackIconBroken(true), []);

  const logoutAndClose = useCallback(async () => {
    try { await logout?.(); } catch {}
    finally { setProfileOpen(false); setMenuOpen(false); router.push("/login"); }
  }, [logout, router]);

  const sharedRoleProps = { role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, isActive };
  const navItemSharedProps = { isActive, stackIconBroken, onStackIconError: handleStackIconError };

  /* ── Profile button label ── */
  const profileButtonLabel = useMemo(() => {
    if (!loggedIn) return "Login";
    const name = user?.Name || user?.name || "";
    const first = name.trim().split(/\s+/)[0];
    return first || "Profile";
  }, [loggedIn, user]);

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-2 z-[150] bg-white/90 backdrop-blur-md border-b border-gray-200"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative h-16 md:h-20 flex items-center justify-between">

            {/* Desktop left tabs */}
            <div className="hidden md:flex items-center gap-2 flex-1">
              {DESKTOP_LEFT_TABS.map(tab => (
                <NavItem key={tab.href} tab={tab} {...navItemSharedProps} />
              ))}
            </div>

            {/* Mobile spacer */}
            <div className="md:hidden h-10 w-10" aria-hidden="true" />

            {/* Logo */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <Link href="/" aria-label="CheckPeak Home" className="inline-flex items-center">
                <span className="block md:hidden"><Logo size="medium" /></span>
                <span className="hidden md:block"><Logo size="large" /></span>
              </Link>
            </div>

            {/* Desktop right */}
            <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
              {DESKTOP_RIGHT_TABS.map(tab => (
                <NavItem key={tab.href} tab={tab} {...navItemSharedProps} />
              ))}

              {isMounted && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleProfileClick}
                    aria-expanded={loggedIn ? profileOpen : undefined}
                    aria-haspopup={loggedIn ? "true" : undefined}
                    style={{
                      display:      "inline-flex",
                      alignItems:   "center",
                      gap:          8,
                      padding:      "7px 14px",
                      borderRadius: 22,
                      border:       profileOpen
                        ? "1px solid rgba(70,118,155,0.6)"
                        : "1px solid #E5E7EB",
                      background:   profileOpen ? "#EEF3F9" : "#fff",
                      color:        "#1A2535",
                      fontSize:     13,
                      fontWeight:   600,
                      cursor:       "pointer",
                      transition:   "all 0.15s ease",
                    }}
                  >
                    {loggedIn && (
                      <div style={{
                        width:          24,
                        height:         24,
                        borderRadius:   "50%",
                        background:     avatarColor(user?.Name || user?.name || "") + "22",
                        border:         `1px solid ${avatarColor(user?.Name || user?.name || "")}55`,
                        display:        "flex",
                        alignItems:     "center",
                        justifyContent: "center",
                        fontSize:       10,
                        fontWeight:     800,
                        color:          avatarColor(user?.Name || user?.name || ""),
                        flexShrink:     0,
                      }}>
                        {getInitials(user?.Name || user?.name || "")}
                      </div>
                    )}
                    {profileButtonLabel}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.4, transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {loggedIn && profileOpen && (
                      <ProfileDropdown
                        user={user}
                        {...sharedRoleProps}
                        onClose={() => setProfileOpen(false)}
                        onLogout={logoutAndClose}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(v => !v)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                style={{
                  width:        40,
                  height:       40,
                  borderRadius: 10,
                  border:       "1px solid #E5E7EB",
                  background:   menuOpen ? "#111827" : "#fff",
                  display:      "grid",
                  placeItems:   "center",
                  cursor:       "pointer",
                  transition:   "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      display:     "block",
                      width:       20,
                      height:      2,
                      borderRadius: 1,
                      background:  menuOpen ? "#fff" : "#374151",
                      transition:  "all 0.2s ease",
                      transform:   menuOpen
                        ? i === 0 ? "rotate(45deg) translate(5px, 5px)"
                        : i === 1 ? "scaleX(0)"
                        : "rotate(-45deg) translate(5px, -5px)"
                        : "none",
                      opacity:     menuOpen && i === 1 ? 0 : 1,
                    }} />
                  ))}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <div className="md:hidden">
              <MobileMenu
                user={user}
                {...sharedRoleProps}
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
        onRequestOpen={onRequestOpen}
      />
    </>
  );
}