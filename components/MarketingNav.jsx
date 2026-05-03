// components/MarketingNav.jsx
// Transparent on load → dark frosted on scroll.
// On non-home pages: always frosted (no transparent state).
// Includes NavBarLoginModal so auth works on marketing pages.
// Auth-aware: shows Dashboard button when user is already logged in.

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

// Pages where the nav should be transparent initially (dark hero bg)
const HERO_PAGES = ["/"];

function track(action, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
}

const ALL_TABS = [
  { name: "Scan",       href: "/nutrition-label-scanner"              },
  { name: "Search",     href: "/search"                               },
  { name: "Info",       href: "/info"                                 },
  { name: "NCAA Rules", href: "/compliance/ncaa"                      },
  { name: "SmartStack", href: "/smartstack-compare", icon: "mountain" },
];

const DESKTOP_LEFT_TABS  = ALL_TABS.filter(t => ["Scan","Search","Info","NCAA Rules"].includes(t.name));
const DESKTOP_RIGHT_TABS = ALL_TABS.filter(t => t.name === "SmartStack");
const MOBILE_TABS        = ALL_TABS;

const MountainFallback = (
  <svg viewBox="0 0 24 24" style={{ width:14, height:14 }} aria-hidden="true">
    <path d="M3 18l6-8 3 4 3-4 6 8H3z" fill="currentColor" />
  </svg>
);

function NavTab({ tab, stackIconBroken, onStackIconError }) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      href={tab.href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        fontFamily:"'Barlow Condensed', sans-serif",
        fontSize:"0.78rem", fontWeight:700,
        letterSpacing:"0.12em", textTransform:"uppercase",
        color: hov ? "#fff" : "rgba(255,255,255,0.6)",
        textDecoration:"none", transition:"color 0.18s ease", padding:"6px 2px",
      }}
    >
      {tab.icon === "mountain" && (
        !stackIconBroken
          ? <img src="/mountain.svg" alt="" style={{width:14,height:14}} onError={onStackIconError} draggable={false} />
          : MountainFallback
      )}
      {tab.name}
    </Link>
  );
}

export default function MarketingNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuthContext();

  // Derive role + dashboard destination from the logged-in user
  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (raw.includes("org") || raw === "organization") return "organization";
    if (raw.includes("admin"))  return "admin";
    if (raw.includes("train"))  return "trainer";
    return raw;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";
  const dashHref  = isOrgSide ? "/org/workouts-calendar" : "/dashboard";

  // Only hero pages start transparent — all others start frosted
  const isHeroPage = HERO_PAGES.includes(pathname);

  const [scrolled,        setScrolled]       = useState(!isHeroPage);
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [stackIconBroken, setStackIconBroken] = useState(false);
  const [loginModalOpen,  setLoginModalOpen]  = useState(false);
  const [defaultAuthTab,  setDefaultAuthTab]  = useState("login");

  // Scroll detection — only matters on hero pages
  useEffect(() => {
    if (!isHeroPage) {
      setScrolled(true);
      return;
    }
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, [isHeroPage]);

  // Reset frosted state when navigating between pages
  useEffect(() => {
    setScrolled(!HERO_PAGES.includes(pathname));
    setMenuOpen(false);
  }, [pathname]);

  // Listen for auth modal events (from other components or CTAs)
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail ?? {};
      const tab    = detail.defaultTab ?? detail.tab ?? "login";
      setDefaultAuthTab(tab === "signup" ? "signup" : "login");
      setLoginModalOpen(true);
    };
    window.addEventListener("cp:open-auth-modal", handler);
    return () => window.removeEventListener("cp:open-auth-modal", handler);
  }, []);

  // Body scroll lock when mobile menu open
  useEffect(() => {
    if (!menuOpen) return;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow     = "hidden";
    document.body.style.paddingRight = sw > 0 ? sw + "px" : "";
    return () => { document.body.style.overflow = ""; document.body.style.paddingRight = ""; };
  }, [menuOpen]);

  // Escape key
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

  const handleLogin  = useCallback(() => openModal("login"),  [openModal]);
  const handleSignup = useCallback(() => {
    track("cta_nav", { source: "marketing_nav" });
    openModal("signup");
  }, [openModal]);

  const onRequestOpen = useCallback((detail = {}) => {
    openModal(detail?.tab === "signup" ? "signup" : "login");
  }, [openModal]);

  const onStackErr = useCallback(() => setStackIconBroken(true), []);
  const tabProps   = { stackIconBroken, onStackIconError: onStackErr };

  return (
    <>
      {/* Hide hero's internal nav since MarketingNav owns navigation */}
      <style>{`
        .hero-nav { display: none !important; }
        .mkt-logo-sm { display:block; }
        .mkt-logo-lg { display:none;  }
        .mkt-left    { display:none  !important; }
        .mkt-right   { display:none  !important; }
        .mkt-ham     { display:flex  !important; }
        .mkt-spacer  { display:block !important; }
        /* Logo always white on dark nav */
        .mkt-logo-wrap img,
        .mkt-logo-wrap svg { filter: brightness(0) invert(1); }
        @media (min-width: 768px) {
          .mkt-logo-sm { display:none  !important; }
          .mkt-logo-lg { display:block !important; }
          .mkt-left    { display:flex  !important; }
          .mkt-right   { display:flex  !important; }
          .mkt-ham     { display:none  !important; }
          .mkt-spacer  { display:none  !important; }
        }
      `}</style>

      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:150,
        height:72, display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px clamp(1rem,4vw,2.5rem) 0",
        transition:"background 0.35s ease, border-color 0.35s ease, backdrop-filter 0.35s ease",
        background:           scrolled ? "rgba(6,8,16,0.92)"               : "transparent",
        backdropFilter:       scrolled ? "blur(16px)"                       : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)"                       : "none",
        borderBottom:         scrolled ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
      }}>

        {/* Desktop left tabs */}
        <div className="mkt-left" style={{ display:"none", alignItems:"center", gap:"clamp(0.75rem,2vw,1.75rem)", flex:1 }}>
          {DESKTOP_LEFT_TABS.map(t => <NavTab key={t.href} tab={t} {...tabProps} />)}
        </div>

        {/* Mobile spacer */}
        <div className="mkt-spacer" style={{ width:40 }} aria-hidden="true" />

        {/* Logo — absolutely centered, always white */}
        <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
          <Link href="/" aria-label="CheckPeak Home" style={{ display:"inline-flex", alignItems:"center" }}>
            <span className="mkt-logo-wrap">
              <span className="mkt-logo-sm"><Logo size="medium" /></span>
              <span className="mkt-logo-lg"><Logo size="large"  /></span>
            </span>
          </Link>
        </div>

        {/* Desktop right */}
        <div className="mkt-right" style={{ display:"none", alignItems:"center", gap:"clamp(0.75rem,2vw,1.5rem)", flex:1, justifyContent:"flex-end" }}>
          {DESKTOP_RIGHT_TABS.map(t => <NavTab key={t.href} tab={t} {...tabProps} />)}
          <div style={{ width:1, height:18, background:"rgba(255,255,255,0.15)", flexShrink:0 }} />

          {user ? (
            /* ── Logged-in: show Dashboard button ── */
            <button
              type="button"
              onClick={() => router.push(dashHref)}
              style={{
                display:"inline-flex", alignItems:"center", gap:7,
                padding:"8px 18px", background:ACCENT, color:BLACK,
                fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem",
                fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
                border:"none", cursor:"pointer", flexShrink:0, transition:"filter 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter="brightness(1.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
            >
              Dashboard
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          ) : (
            /* ── Logged-out: show Log in + Start Your Pilot ── */
            <>
              <button
                type="button"
                onClick={handleLogin}
                style={{
                  fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem", fontWeight:700,
                  letterSpacing:"0.12em", textTransform:"uppercase",
                  color:"rgba(255,255,255,0.55)", background:"none", border:"none",
                  cursor:"pointer", padding:"6px 4px", transition:"color 0.18s", flexShrink:0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color="#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.color="rgba(255,255,255,0.55)"; }}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={handleSignup}
                style={{
                  display:"inline-flex", alignItems:"center", gap:7,
                  padding:"8px 18px", background:ACCENT, color:BLACK,
                  fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.78rem",
                  fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
                  border:"none", cursor:"pointer", flexShrink:0, transition:"filter 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.filter="brightness(1.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
              >
                Start Your Pilot
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="mkt-ham"
          style={{ display:"flex", flexDirection:"column", gap:5, background:"none", border:"none", cursor:"pointer", padding:"8px 4px", flexShrink:0, width:40, alignItems:"center" }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{
              display:"block", width:22, height:2, borderRadius:1, background:"#fff",
              transition:"all 0.22s ease",
              transform: menuOpen
                ? (i===0 ? "rotate(45deg) translate(5px,5px)" : i===1 ? "scaleX(0)" : "rotate(-45deg) translate(5px,-5px)")
                : "none",
              opacity: menuOpen && i===1 ? 0 : 1,
            }} />
          ))}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
              onClick={() => setMenuOpen(false)}
              style={{ position:"fixed", inset:0, zIndex:140, background:"rgba(6,8,16,0.7)", backdropFilter:"blur(4px)" }}
            />

            <motion.div
              initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.2,ease:"easeOut"}}
              style={{
                position:"fixed", top:72, left:0, right:0, zIndex:149,
                background:"rgba(6,8,16,0.97)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
                borderBottom:"1px solid rgba(255,255,255,0.08)",
                padding:"20px clamp(1.25rem,5vw,2.5rem) 28px",
                display:"flex", flexDirection:"column", gap:2,
              }}
            >
              {MOBILE_TABS.map((tab,i) => (
                <motion.div key={tab.href} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.04,duration:0.18}}>
                  <Link
                    href={tab.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display:"flex", alignItems:"center", gap:8,
                      fontFamily:"'Barlow Condensed',sans-serif",
                      fontSize:"clamp(1.5rem,6vw,2rem)", fontWeight:900,
                      fontStyle:"italic", letterSpacing:"-0.01em", textTransform:"uppercase",
                      color:"rgba(255,255,255,0.7)", textDecoration:"none",
                      padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {tab.name}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                transition={{delay:MOBILE_TABS.length*0.04+0.04,duration:0.18}}
                style={{ display:"flex", flexDirection:"column", gap:8, marginTop:16 }}
              >
                {user ? (
                  /* ── Logged-in mobile: Dashboard button only ── */
                  <button
                    type="button"
                    onClick={() => { router.push(dashHref); setMenuOpen(false); }}
                    style={{
                      padding:"13px 20px", background:ACCENT, color:BLACK,
                      fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.95rem",
                      fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
                      border:"none", cursor:"pointer", textAlign:"center",
                    }}
                  >
                    Go to Dashboard →
                  </button>
                ) : (
                  /* ── Logged-out mobile: Sign up + Log in ── */
                  <>
                    <button
                      type="button"
                      onClick={handleSignup}
                      style={{
                        padding:"13px 20px", background:ACCENT, color:BLACK,
                        fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.95rem",
                        fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
                        border:"none", cursor:"pointer", textAlign:"center",
                      }}
                    >
                      Start Your Pilot — 30 Days Free
                    </button>
                    <button
                      type="button"
                      onClick={handleLogin}
                      style={{
                        padding:"12px 20px",
                        background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.65)",
                        fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.88rem",
                        fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase",
                        border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer", textAlign:"center",
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

      {/* Auth modal — required since NavBar isn't mounted on marketing pages */}
      <NavBarLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultTab={defaultAuthTab}
        onRequestOpen={onRequestOpen}
      />
    </>
  );
}