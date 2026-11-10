// components/NavBar.js
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";
import Logo from "@/components/Logo";
import NavBarLoginModal from "@/components/NavBarLoginModal";
import { buildMenu, splitColumns, MenuSection, MENU_STYLE, useNavCounts, useTrainerSlug, isShellRoute } from "@/components/nav/menu";

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
  { name: "Pricing", href: "/pricing" },
];

function AccountButtons({ onClose, onLogout }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Link
        href="/account" onClick={onClose}
        style={{ flex: 1, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
      >
        Account
      </Link>
      <button
        type="button" onClick={onLogout}
        style={{ flex: 1, minHeight: 40, borderRadius: 8, background: "rgba(217,43,58,0.1)", border: "1px solid rgba(217,43,58,0.22)", color: "#FF7A7A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        Sign out
      </button>
    </div>
  );
}

function Identity({ name, email, roleLabel, orgName, avatarUrl, size = 40 }) {
  const color = avatarColor(name);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: color + "20", border: `1.5px solid ${color}60`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 14, fontWeight: 900, color }}>{getInitials(name)}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
        {roleLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4FABFF", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {roleLabel}{orgName && orgName !== name ? ` · ${orgName}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile dropdown (desktop) ───────────────────────────────────────────────

// compact: the sidebar already shows the navigation, so the dropdown only holds the account
function ProfileDropdown({ user, role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, onClose, onLogout, trainerSlug, isActiveFn, avatarUrl = "", counts, compact = false }) {
  const name  = user?.Name || user?.name || "Profile";
  const email = user?.Email || user?.email || "";
  const isOrgAdmin = role === "organization" || role === "admin";
  const sections = compact ? [] : buildMenu({ isOrgSide, isAthlete, isOrgAdmin, isAdmin, trainerSlug });
  const twoColumns = sections.length >= 3;
  const columns = twoColumns ? splitColumns(sections) : [sections];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      style={{
        position: "absolute", right: 0, marginTop: 8,
        width: twoColumns ? 540 : 300, maxWidth: "calc(100vw - 24px)", borderRadius: 14,
        maxHeight: "calc(100vh - 90px)",
        display: "flex", flexDirection: "column",
        background: "#0D1119",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.35)",
        overflow: "hidden", zIndex: 200,
      }}
    >
      <style>{MENU_STYLE}</style>

      <div style={{ padding: "16px 18px 14px", borderBottom: sections.length ? "1px solid rgba(255,255,255,0.08)" : "none", flexShrink: 0 }}>
        <Identity name={name} email={email} roleLabel={roleLabel} orgName={orgName} avatarUrl={avatarUrl} />
      </div>

      {sections.length > 0 && (
        <nav aria-label="Main menu" style={{ overflowY: "auto", flex: 1, padding: "14px 10px", display: "grid", gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`, gap: "0 10px" }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 16, paddingLeft: ci ? 10 : 0, borderLeft: ci ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
              {col.map((s) => <MenuSection key={s.title} section={s} isActive={isActiveFn} onClose={onClose} counts={counts} />)}
            </div>
          ))}
        </nav>
      )}

      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <AccountButtons onClose={onClose} onLogout={onLogout} />
      </div>
    </motion.div>
  );
}

// ─── Mobile menu ──────────────────────────────────────────────────────────────

function MobileMenu({ user, role, roleLabel, orgName, isOrgSide, isAthlete, isAdmin, isActive, onClose, onLogout, loggedIn, openAuthModal, trainerSlug, avatarUrl = "", counts }) {
  const name  = user?.Name || user?.name || "Profile";
  const email = user?.Email || user?.email || "";
  const isOrgAdmin = role === "organization" || role === "admin";
  const sections = buildMenu({ isOrgSide, isAthlete, isOrgAdmin, isAdmin, trainerSlug });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{    opacity: 0, height: 0    }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      style={{ background: "#0D1119", borderTop: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}
    >
      <style>{MENU_STYLE}</style>
      <div style={{
        paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
        maxHeight: "calc(100dvh - 64px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}>
        {!loggedIn ? (
          <>
            <div style={{ padding: "12px 10px 4px" }}>
              {MOBILE_PUBLIC.map((tab) => (
                <Link key={tab.href} href={tab.href} onClick={onClose} className={`cp-mi${isActive(tab.href) ? " is-active" : ""}`} style={{ minHeight: 48, fontSize: 16 }}>
                  {tab.name}
                </Link>
              ))}
            </div>
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
            <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <Identity name={name} email={email} roleLabel={roleLabel} orgName={orgName} avatarUrl={avatarUrl} />
            </div>
            <nav aria-label="Main menu" style={{ display: "flex", flexDirection: "column", gap: 20, padding: "16px 10px 18px" }}>
              {sections.map((s) => <MenuSection key={s.title} section={s} isActive={isActive} onClose={onClose} large counts={counts} />)}
            </nav>
            <div style={{ padding: "12px 16px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <AccountButtons onClose={onClose} onLogout={onLogout} />
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
  const [scrolled,        setScrolled]        = useState(false);
  const [wideScreen,      setWideScreen]      = useState(false);
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
    // Re-attach when the route/user changes: coach app pages swap in a different (slimmer) header element
  }, [isMounted, pathname, user]);

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

  const trainerSlug = useTrainerSlug(isOrgSide && !!user);
  const counts      = useNavCounts(isOrgSide && !!user);

  // Matches the sidebar breakpoint in AppShell
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWideScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // The sidebar already lists every destination, so the avatar dropdown only holds the account
  const compactDropdown = wideScreen && isShellRoute(pathname, isOrgSide && !!user);

  // "More" in the phone/tablet tab bar opens the full menu
  useEffect(() => {
    const open = () => {
      if (window.innerWidth < 768) setMenuOpen(true);
      else setProfileOpen(true);
    };
    window.addEventListener("cp:open-app-menu", open);
    return () => window.removeEventListener("cp:open-app-menu", open);
  }, []);

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

  // Org accounts are named after the school/team, so show the whole name; people show a first name
  const profileButtonLabel = useMemo(() => {
    if (!loggedIn) return "Login";
    const name = String(user?.Name || user?.name || "").trim();
    if (isOrgSide) return name || orgName || "Account";
    return name.split(/\s+/)[0] || "Profile";
  }, [loggedIn, user, isOrgSide, orgName]);

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

  // ── Coach app pages: slim header that pairs with the AppShell sidebar / tab bar ──
  const shellRoute = isMounted && isShellRoute(pathname, isOrgSide && loggedIn);

  if (shellRoute) {
    const name = user?.Name || user?.name || "";
    const color = avatarColor(name);
    const toggleAccount = () => {
      if (window.innerWidth < 768) setMenuOpen((v) => !v);
      else setProfileOpen((v) => !v);
    };
    return (
      <>
        <style>{`
          .cp-apphdr { display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 12px 0 6px; }
          .cp-apphdr-logo { display: inline-flex; align-items: center; flex-shrink: 0; text-decoration: none; }
          .cp-apphdr-name { display: none; }
          @media (min-width: 1024px) {
            .cp-apphdr { height: 56px; padding: 0 20px 0 6px; }
            .cp-apphdr-name { display: inline; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          }
        `}</style>
        <nav ref={navRef} aria-label="Main navigation" style={{ position: "sticky", top: 0, zIndex: 150, background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}>
          <div className="cp-apphdr">
            <Link href="/" className="cp-apphdr-logo" aria-label="CheckPeak home">
              <Logo size="xs" />
            </Link>

            <div className="relative" style={{ marginLeft: "auto" }}>
              <button
                type="button"
                onClick={toggleAccount}
                aria-expanded={profileOpen || menuOpen}
                aria-haspopup="true"
                aria-label={`Account menu for ${name || "your account"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, padding: "4px 6px 4px 4px", border: "1px solid transparent", borderRadius: 999, background: profileOpen || menuOpen ? "#EEF3F9" : "transparent", color: "#1A2535", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: color + "22", border: `1.5px solid ${color}88`, color, fontSize: 11, fontWeight: 800 }}>
                  {getInitials(name)}
                </span>
                <span className="cp-apphdr-name">{profileButtonLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" style={{ opacity: 0.45, transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <ProfileDropdown
                    user={user}
                    {...sharedRoleProps}
                    avatarUrl={navAvatarUrl}
                    onClose={() => setProfileOpen(false)}
                    onLogout={logoutAndClose}
                    isActiveFn={isActive}
                    counts={counts}
                    compact={compactDropdown}
                  />
                )}
              </AnimatePresence>
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
                  counts={counts}
                />
              </div>
            )}
          </AnimatePresence>
        </nav>
      </>
    );
  }

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
                    <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileButtonLabel}</span>
                    {counts.reviewQueue + counts.messages > 0 && compactDropdown === false && isOrgSide && (
                      <span aria-label="Items waiting" style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626", flexShrink: 0 }} />
                    )}
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
                        counts={counts}
                        compact={compactDropdown}
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
                counts={counts}
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
