// components/MarketingNav.jsx
// Centered logo · The Arena + Pricing on left · Log in + Book a Walkthrough on right.
// Transparent on dark hero pages, frosted dark on scroll.

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "@/components/Logo";
import NavBarLoginModal from "@/components/NavBarLoginModal";
import { useAuthContext } from "@/hooks/useAuth";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";

const HERO_PAGES = ["/", "/pricing", "/book", "/contact", "/trainers"];

function track(action, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
}

const LEFT_TABS = [
  { name: "The Arena", href: "/trainers", accent: ACCENT },
  { name: "Pricing",   href: "/pricing",  accent: null   },
];

const MOBILE_TABS = [
  { name: "The Arena", href: "/trainers" },
  { name: "Pricing",   href: "/pricing"  },
  { name: "Contact",   href: "/contact"  },
];

function NavLink({ href, children, activeHref }) {
  const pathname = usePathname();
  const isActive = pathname === activeHref || pathname === href;
  return (
    <Link
      href={href}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: "0.8rem", fontWeight: 700,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: isActive ? "#fff" : "rgba(255,255,255,0.52)",
        textDecoration: "none", padding: "6px 4px",
        transition: "color 0.18s", whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.color = isActive ? "#fff" : "rgba(255,255,255,0.52)"; }}
    >
      {children}
    </Link>
  );
}

export default function MarketingNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (raw.includes("org") || raw === "organization") return "organization";
    if (raw.includes("admin"))  return "admin";
    if (raw.includes("train"))  return "trainer";
    return raw;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";
  const dashHref  = isOrgSide ? "/org/workouts-calendar" : "/dashboard";

  const isHeroPage = HERO_PAGES.some(p =>
    p === "/" ? pathname === "/" : (pathname || "").startsWith(p)
  );

  const [scrolled,       setScrolled]      = useState(!isHeroPage);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [defaultAuthTab, setDefaultAuthTab] = useState("login");

  useEffect(() => {
    if (!isHeroPage) { setScrolled(true); return; }
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, [isHeroPage]);

  useEffect(() => {
    setScrolled(!HERO_PAGES.some(p =>
      p === "/" ? pathname === "/" : (pathname || "").startsWith(p)
    ));
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail ?? {};
      const tab = detail.defaultTab ?? detail.tab ?? "login";
      setDefaultAuthTab(tab === "signup" ? "signup" : "login");
      setLoginModalOpen(true);
    };
    window.addEventListener("cp:open-auth-modal", handler);
    return () => window.removeEventListener("cp:open-auth-modal", handler);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow     = "hidden";
    document.body.style.paddingRight = sw > 0 ? sw + "px" : "";
    return () => { document.body.style.overflow = ""; document.body.style.paddingRight = ""; };
  }, [menuOpen]);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const openModal = useCallback((tab = "login") => {
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
    setMenuOpen(false);
  }, []);

  const handleLogin   = useCallback(() => openModal("login"), [openModal]);
  const onRequestOpen = useCallback((detail = {}) => {
    openModal(detail?.tab === "signup" ? "signup" : "login");
  }, [openModal]);

  return (
    <>
      <style>{`
        .hero-nav { display: none !important; }

        /* Always-white logo */
        .mkt-logo img, .mkt-logo svg { filter: brightness(0) invert(1); }

        /* Desktop/mobile show-hide */
        .mkt-logo-sm  { display: block; }
        .mkt-logo-lg  { display: none;  }
        .mkt-left     { display: none  !important; }
        .mkt-right    { display: none  !important; }
        .mkt-ham      { display: flex  !important; }
        .mkt-spacer   { display: block !important; }

        @media (min-width: 768px) {
          .mkt-logo-sm  { display: none  !important; }
          .mkt-logo-lg  { display: block !important; }
          .mkt-left     { display: flex  !important; }
          .mkt-right    { display: flex  !important; }
          .mkt-ham      { display: none  !important; }
          .mkt-spacer   { display: none  !important; }
        }
      `}</style>

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 150,
        height: 68,
        display: "flex", alignItems: "center",
        padding: "0 clamp(1.25rem, 4vw, 2.5rem)",
        transition: "background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease",
        background:           scrolled ? "rgba(6,8,16,0.92)"               : "transparent",
        backdropFilter:       scrolled ? "blur(16px)"                       : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)"                       : "none",
        borderBottom:         scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
      }}>

        {/* ── Desktop left: The Arena · Pricing ── */}
        <div className="mkt-left" style={{ display: "none", alignItems: "center", gap: "clamp(1rem, 2.5vw, 2rem)", flex: 1 }}>
          {LEFT_TABS.map(t => (
            <NavLink key={t.href} href={t.href}>{t.name}</NavLink>
          ))}
        </div>

        {/* ── Mobile spacer (keeps logo centered) ── */}
        <div className="mkt-spacer" style={{ width: 40, flexShrink: 0 }} aria-hidden="true" />

        {/* ── Logo — centered (absolute) ── */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 1 }}>
          <Link href="/" aria-label="CheckPeak Home" className="mkt-logo"
            style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            <span className="mkt-logo-sm"><Logo size="medium" /></span>
            <span className="mkt-logo-lg"><Logo size="large"  /></span>
          </Link>
        </div>

        {/* ── Desktop right: Log in · Book a Walkthrough ── */}
        <div className="mkt-right" style={{ display: "none", alignItems: "center", gap: "clamp(0.75rem, 1.5vw, 1.25rem)", flex: 1, justifyContent: "flex-end" }}>

          {user ? (
            <button
              type="button"
              onClick={() => router.push(dashHref)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 20px", background: ACCENT, color: BLACK,
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem",
                fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                border: "none", cursor: "pointer", transition: "filter 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
            >
              Dashboard
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLogin}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem", fontWeight: 700,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.52)", background: "none", border: "none",
                  cursor: "pointer", padding: "6px 4px", transition: "color 0.18s", whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.52)"; }}
              >
                Log in
              </button>

              <a
                href="/book"
                onClick={() => track("cta_nav_book", { source: "marketing_nav" })}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 20px", background: ACCENT, color: BLACK,
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem",
                  fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                  textDecoration: "none", transition: "filter 0.2s", whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
              >
                Book a Walkthrough
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            </>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="mkt-ham"
          style={{
            display: "flex", flexDirection: "column", gap: 5,
            background: "none", border: "none", cursor: "pointer",
            padding: "8px 4px", width: 40, alignItems: "center",
            marginLeft: "auto", flexShrink: 0,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: "block", width: 22, height: 2, borderRadius: 1, background: "#fff",
              transition: "all 0.22s ease",
              transform: menuOpen
                ? (i === 0 ? "rotate(45deg) translate(5px,5px)" : i === 1 ? "scaleX(0)" : "rotate(-45deg) translate(5px,-5px)")
                : "none",
              opacity: menuOpen && i === 1 ? 0 : 1,
            }} />
          ))}
        </button>

      </nav>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(6,8,16,0.7)", backdropFilter: "blur(4px)" }}
            />

            <motion.div
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "fixed", top: 68, left: 0, right: 0, zIndex: 149,
                background: "rgba(6,8,16,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                padding: "20px clamp(1.25rem,5vw,2.5rem) 28px",
                display: "flex", flexDirection: "column", gap: 2,
              }}
            >
              {MOBILE_TABS.map((tab, i) => (
                <motion.div key={tab.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.18 }}>
                  <Link
                    href={tab.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "flex", alignItems: "center",
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "clamp(1.6rem,7vw,2.2rem)", fontWeight: 900,
                      fontStyle: "italic", letterSpacing: "-0.01em", textTransform: "uppercase",
                      color: "rgba(255,255,255,0.75)", textDecoration: "none",
                      padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {tab.name}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: MOBILE_TABS.length * 0.05 + 0.04, duration: 0.18 }}
                style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}
              >
                {user ? (
                  <button
                    type="button"
                    onClick={() => { router.push(dashHref); setMenuOpen(false); }}
                    style={{
                      padding: "14px 20px", background: ACCENT, color: BLACK,
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem",
                      fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                      border: "none", cursor: "pointer", textAlign: "center",
                    }}
                  >
                    Go to Dashboard →
                  </button>
                ) : (
                  <>
                    <a
                      href="/book"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: "block", padding: "14px 20px", background: ACCENT, color: BLACK,
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem",
                        fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                        textDecoration: "none", textAlign: "center",
                      }}
                    >
                      Book a Walkthrough →
                    </a>
                    <button
                      type="button"
                      onClick={handleLogin}
                      style={{
                        padding: "12px 20px",
                        background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)",
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.9rem",
                        fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                        border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", textAlign: "center",
                      }}
                    >
                      Log in
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NavBarLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultTab={defaultAuthTab}
        onRequestOpen={onRequestOpen}
      />
    </>
  );
}
