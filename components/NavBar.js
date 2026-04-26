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

const DESKTOP_LEFT_TABS  = ALL_TABS.filter((t) => ["Scan", "Search", "Info", "NCAA Rules"].includes(t.name));
const DESKTOP_RIGHT_TABS = ALL_TABS.filter((t) => ["SmartStack"].includes(t.name));
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
          <img
            src="/mountain.svg"
            alt=""
            className="h-4 w-4"
            onError={onStackIconError}
            draggable={false}
          />
        ) : (
          MountainIconFallback
        )
      )}
      <span>{tab.name}</span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* RoleLinks                                                                   */
/* -------------------------------------------------------------------------- */
function RoleLinks({ isOrgSide, isAthlete, isAdmin, role, isActive, compact, onNavigate }) {
  const L = useCallback(
    ({ href, children }) => {
      const active = isActive(href);
      return (
        <Link
          href={href}
          onClick={() => onNavigate?.()}
          className={cx(
            "block transition rounded-xl",
            compact ? "px-3 py-2 text-sm" : "px-4 py-3 text-sm",
            active
              ? "bg-blue-50 text-[#46769B] font-semibold"
              : "text-gray-700 hover:bg-gray-50"
          )}
        >
          {children}
        </Link>
      );
    },
    [isActive, compact, onNavigate]
  );

  if (isOrgSide) {
    return (
      <>
        <L href="/org/dashboard">Dashboard</L>
        <L href="/org/review-queue">Review Queue</L>
        <L href="/org/workouts-calendar">Workouts Calendar</L>
        <L href="/org/nutrition">Nutrition</L>
        {(isAdmin || role === "organization") && (
          <>
            <L href="/org/athletes">Athletes</L>
            <L href="/org/trainers">Trainers</L>
          </>
        )}
        <L href="/account">Account</L>
      </>
    );
  }

  if (isAthlete) {
    return (
      <>
        <L href="/dashboard">Athlete Dashboard</L>
        <L href="/athlete/today">Today</L>
        <L href="/scans">My Scans</L>
        <L href="/account">Account</L>
      </>
    );
  }

  return <L href="/account">Account</L>;
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

  // Mark mounted so SSR/hydration never diverges on auth-dependent UI
  useEffect(() => setIsMounted(true), []);

  /* ── Nav height → CSS variable ────────────────────────────────────────────
     Sets --app-header-h on <html> so drawers/modals can offset correctly.
  ──────────────────────────────────────────────────────────────────────────── */
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

    return () => {
      window.removeEventListener("resize", setVar);
      ro?.disconnect();
    };
  }, [isMounted]);

  /* ── Lock body scroll when mobile menu is open ────────────────────────────
     Compensates for scrollbar width before setting overflow:hidden so the
     page layout doesn't shift. A shift would trigger the ResizeObserver on
     the nav → update --app-header-h → menu max-h recalculates → observer
     fires again → flicker loop. Padding compensation kills the shift.
     On mobile, overlay scrollbars take no space so scrollbarWidth = 0
     and the paddingRight line is a safe no-op.
  ──────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!menuOpen) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow     = "hidden";
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";

    return () => {
      document.body.style.overflow     = "";
      document.body.style.paddingRight = "";
    };
  }, [menuOpen]);

  /* ── Role normalisation ───────────────────────────────────────────────────*/
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
    const MAP = {
      organization: "Organization",
      admin:        "Admin",
      trainer:      "Trainer",
      athlete:      "Athlete",
    };
    return MAP[role] ?? "Member";
  }, [role]);

  const loggedIn = !!user;

  /* ── isActive helper ──────────────────────────────────────────────────────*/
  const isActive = useCallback(
    (href) => {
      if (href === "/") return pathname === "/";
      return pathname === href || pathname?.startsWith(`${href}/`);
    },
    [pathname]
  );

  /* ── Auth modal openers ───────────────────────────────────────────────────*/
  const openAuthModal = useCallback((tab = "login") => {
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
  }, []);

  const onRequestOpen = useCallback((detail = {}) => {
    openAuthModal(detail?.tab === "signup" ? "signup" : "login");
  }, [openAuthModal]);

  // Legacy "cp:open-auth-modal" event — kept for backwards compatibility
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail ?? {};
      const tab    = detail.defaultTab ?? "login";
      const email  = detail.email ? String(detail.email).trim() : "";

      if (email) {
        try {
          window.localStorage.setItem("cp_prefill_login_email", email);
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[NavBar] Could not write to localStorage:", err);
          }
        }
      }

      openAuthModal(tab);
    };

    window.addEventListener("cp:open-auth-modal", handler);
    return () => window.removeEventListener("cp:open-auth-modal", handler);
  }, [openAuthModal]);

  /* ── Close menus on route change ─────────────────────────────────────────*/
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  /* ── Close menus on Escape ───────────────────────────────────────────────*/
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Close profile dropdown on outside click ─────────────────────────────*/
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen]);

  /* ── Handlers ─────────────────────────────────────────────────────────────*/
  const handleProfileClick = useCallback(() => {
    if (!loggedIn) return openAuthModal("login");
    setProfileOpen((p) => !p);
  }, [loggedIn, openAuthModal]);

  const handleStackIconError = useCallback(() => setStackIconBroken(true), []);

  const logoutAndClose = useCallback(async () => {
    try {
      await logout?.();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[NavBar] Logout error:", err);
      }
    } finally {
      setProfileOpen(false);
      setMenuOpen(false);
      router.push("/login");
    }
  }, [logout, router]);

  /* ── Shared props ─────────────────────────────────────────────────────────*/
  const navItemSharedProps = {
    isActive,
    stackIconBroken,
    onStackIconError: handleStackIconError,
  };

  const roleLinksSharedProps = {
    isOrgSide,
    isAthlete,
    isAdmin,
    role,
    isActive,
  };

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <>
      {/* z-[150]: above internal page navs (e.g. Nutrition Queue at z-90) */}
      <nav
        ref={navRef}
        className="sticky top-0 z-[150] bg-white/90 backdrop-blur-md border-b border-gray-200"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* ── Top bar ── */}
          <div className="relative h-16 md:h-20 flex items-center justify-between">

            {/* Desktop left tabs */}
            <div className="hidden md:flex items-center gap-2 flex-1">
              {DESKTOP_LEFT_TABS.map((tab) => (
                <NavItem key={tab.href} tab={tab} {...navItemSharedProps} />
              ))}
            </div>

            {/* Mobile spacer — mirrors hamburger width to keep logo centered */}
            <div className="md:hidden h-10 w-10" aria-hidden="true" />

            {/* Logo — absolutely centered, never shifts */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <Link href="/" aria-label="CheckPeak Home" className="inline-flex items-center">
                <span className="block md:hidden">
                  <Logo size="medium" />
                </span>
                <span className="hidden md:block">
                  <Logo size="large" />
                </span>
              </Link>
            </div>

            {/* Desktop right */}
            <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
              {DESKTOP_RIGHT_TABS.map((tab) => (
                <NavItem key={tab.href} tab={tab} {...navItemSharedProps} />
              ))}

              {/* Profile / Login — only rendered after hydration */}
              {isMounted && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleProfileClick}
                    aria-expanded={loggedIn ? profileOpen : undefined}
                    aria-haspopup={loggedIn ? "true" : undefined}
                    className="rounded-2xl border border-gray-200 text-gray-900 px-3 py-2 text-sm font-medium hover:text-[#46769B] hover:border-[#46769B] hover:bg-gray-50 transition"
                  >
                    {loggedIn ? (user?.Name || user?.name || "Profile") : "Login"}
                  </button>

                  <AnimatePresence>
                    {loggedIn && profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        // z-[200]: above the sticky nav (z-150) and any internal
                        // page navs so the dropdown is never clipped
                        className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-lg overflow-hidden z-[200]"
                        role="menu"
                        aria-label="Profile menu"
                      >
                        {/* User identity */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-xs font-semibold truncate">
                            {user?.Name || user?.name}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {user?.Email || user?.email}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">{roleLabel}</p>
                        </div>

                        {/* Role-specific links */}
                        <div className="max-h-[300px] overflow-auto p-2">
                          <RoleLinks
                            {...roleLinksSharedProps}
                            compact
                            onNavigate={() => setProfileOpen(false)}
                          />
                        </div>

                        {/* Logout */}
                        <div className="p-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={logoutAndClose}
                            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 active:bg-red-200 transition"
                          >
                            Logout
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="h-10 w-10 rounded-xl border border-gray-200 text-gray-900 grid place-items-center"
              >
                <div className="flex flex-col gap-[5px]" aria-hidden="true">
                  <span className={cx("w-5 h-0.5 bg-gray-700 block transition-all duration-200 ease-in-out", menuOpen ? "rotate-45 translate-y-[7px]" : "")} />
                  <span className={cx("w-5 h-0.5 bg-gray-700 block transition-all duration-200 ease-in-out", menuOpen ? "opacity-0 scale-x-0" : "")} />
                  <span className={cx("w-5 h-0.5 bg-gray-700 block transition-all duration-200 ease-in-out", menuOpen ? "-rotate-45 -translate-y-[7px]" : "")} />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile menu ──
             max-h uses plain 100vh (not dvh) so it never recalculates while
             the menu is open. dvh changes as the iOS browser chrome animates
             in/out, which fed the ResizeObserver → --app-header-h → max-h
             → ResizeObserver flicker loop. 4rem = 64px = h-16 mobile nav
             height. If your mobile nav is h-20 change 4rem → 5rem.
        ── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="md:hidden bg-white border-t border-gray-200 text-gray-900 overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2 overflow-y-auto max-h-[calc(100vh-4rem)]">

                {/* Nav links */}
                {MOBILE_TABS.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(tab.href) ? "page" : undefined}
                    className={cx(
                      "block rounded-xl px-4 py-3 text-sm font-medium transition",
                      isActive(tab.href)
                        ? "bg-blue-50 text-[#46769B]"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {tab.name}
                  </Link>
                ))}

                <div className="border-t border-gray-100 pt-3" />

                {/* Auth / profile section */}
                {!loggedIn ? (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => { openAuthModal("login"); setMenuOpen(false); }}
                      className="rounded-xl bg-[#46769B] text-white py-3 text-sm font-semibold transition hover:brightness-110"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => { openAuthModal("signup"); setMenuOpen(false); }}
                      className="rounded-xl border border-gray-200 py-3 text-sm font-semibold transition hover:bg-gray-50"
                    >
                      Sign up
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Mobile profile header */}
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-sm font-semibold truncate">
                        {user?.Name || user?.name || "Profile"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user?.Email || user?.email}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">{roleLabel}</p>
                    </div>

                    {/* Role-specific nav */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-2">
                      <RoleLinks
                        {...roleLinksSharedProps}
                        compact
                        onNavigate={() => setMenuOpen(false)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={logoutAndClose}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 active:bg-red-200 transition"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
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