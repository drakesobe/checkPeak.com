"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";
import Logo from "@/components/Logo";
import NavBarLoginModal from "@/components/NavBarLoginModal";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const [isMounted, setIsMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [defaultAuthTab, setDefaultAuthTab] = useState("login");
  const [stackIconBroken, setStackIconBroken] = useState(false);

  const navRef = useRef(null);

  useEffect(() => setIsMounted(true), []);

  /**
   * ✅ Nav height -> CSS variable
   * Sets: --app-header-h on <html>
   *
   * Why:
   * - Your drawer/modals can respect the sticky NavBar without hardcoding 64/80.
   * - Responsive (h-16 vs h-20), font changes, etc.
   */
  useEffect(() => {
    if (!isMounted) return;
    if (!navRef.current) return;

    const setVar = () => {
      const h = navRef.current?.getBoundingClientRect?.().height || 0;
      // Put it on <html> so it is globally available
      document.documentElement.style.setProperty("--app-header-h", `${Math.round(h)}px`);
    };

    // Initial set
    setVar();

    // Keep correct on resize / breakpoint changes
    window.addEventListener("resize", setVar);

    // Keep correct if nav changes size due to content/font load
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => setVar());
      ro.observe(navRef.current);
    }

    return () => {
      window.removeEventListener("resize", setVar);
      if (ro) ro.disconnect();
    };
  }, [isMounted]);

  const loggedIn = !!user;

  /* =========================
     ROLE NORMALIZATION
  ========================= */
  const role = useMemo(() => {
    const raw = (user?.role || user?.Role || "").toString().trim().toLowerCase();
    if (!raw) return "";

    if (raw === "organization") return "organization";
    if (raw === "athlete") return "athlete";
    if (raw === "trainer") return "trainer";
    if (raw === "admin") return "admin";

    if (raw.includes("org")) return "organization";
    if (raw.includes("ath")) return "athlete";
    if (raw.includes("train")) return "trainer";
    if (raw.includes("admin")) return "admin";

    return raw;
  }, [user]);

  const isAthlete = role === "athlete";
  const isOrgSide = role === "organization" || role === "trainer" || role === "admin";
  const isAdmin = role === "admin";

  const roleLabel = useMemo(() => {
    if (role === "organization") return "Organization";
    if (role === "admin") return "Admin";
    if (role === "trainer") return "Trainer";
    if (role === "athlete") return "Athlete";
    return "Member";
  }, [role]);

    /* =========================
     NAV TABS (MODULAR)
  ========================= */
  const { DESKTOP_LEFT_TABS, DESKTOP_RIGHT_TABS, MOBILE_TABS } = useMemo(() => {
    // Keep this inline memo so it’s tree-shakeable & easy to adjust
    // (Alternatively import helpers directly)
    const tabs = [
      { name: "Scan", href: "/nutrition-label-scanner" },
      { name: "Search", href: "/search" },
      { name: "Info", href: "/info" },
      { name: "NCAA Rules", href: "/compliance/ncaa" },
      { name: "SmartStack", href: "/smartstack", icon: "mountain" },
    ];

    return {
      DESKTOP_LEFT_TABS: tabs.filter((t) => ["Scan", "Search", "Info", "NCAA Rules"].includes(t.name)),
      DESKTOP_RIGHT_TABS: tabs.filter((t) => ["SmartStack"].includes(t.name)),
      MOBILE_TABS: tabs,
    };
  }, []);

  /* =========================
     AUTH MODAL OPENERS
     - Supports BOTH:
       1) cp:open-auth-modal (older pattern)
       2) NavBarLoginModal's auth:open -> onRequestOpen bridge (newer pattern)
  ========================= */

  // Backwards compatible open event (your existing pattern)
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {};
      const tab = detail.defaultTab || "login";
      const email = detail.email ? String(detail.email).trim() : "";

      try {
        if (typeof window !== "undefined" && email) {
          window.localStorage.setItem("cp_prefill_login_email", email);
        }
      } catch {}

      setDefaultAuthTab(tab);
      setLoginModalOpen(true);
    };

    window.addEventListener("cp:open-auth-modal", handler);
    return () => window.removeEventListener("cp:open-auth-modal", handler);
  }, []);

  // ✅ required for NavBarLoginModal's global "auth:open" triggers
  const onRequestOpen = useCallback((detail = {}) => {
    const tab = detail?.tab === "signup" ? "signup" : "login";
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
  }, []);

  const openAuthModal = useCallback((tab = "login") => {
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
  }, []);

  /* =========================
     CLOSE MENUS ON NAV
  ========================= */
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

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

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen]);

  /* =========================
     ✅ REMOVE LOCK FEATURE
     No body overflow/position locking here.
     (So background can scroll even while menu is open.)
  ========================= */

  const handleProfileClick = useCallback(() => {
    if (!loggedIn) return openAuthModal("login");
    setProfileOpen((p) => !p);
  }, [loggedIn, openAuthModal]);

  const isActive = useCallback(
    (href) => {
      if (href === "/") return pathname === "/";
      return pathname === href || pathname?.startsWith(`${href}/`);
    },
    [pathname]
  );

  const logoutAndClose = useCallback(async () => {
    try {
      await logout?.();
    } finally {
      setProfileOpen(false);
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    }
  }, [logout, router]);

  const NavItem = ({ tab, onClick }) => {
    const active = isActive(tab.href);
    const isSmartStack = tab.name === "mountain";

    return (
      <Link
        href={tab.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={[
          "relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition",
          active
            ? "text-[#46769B] bg-blue-50"
            : "text-gray-700 hover:text-[#46769B] hover:bg-gray-50",
        ].join(" ")}
      >
        {isSmartStack ? (
          !stackIconBroken ? (
            <img
              src="/mountain.svg"
              alt=""
              className="h-4 w-4"
              onError={() => setStackIconBroken(true)}
              draggable={false}
            />
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path d="M3 18l6-8 3 4 3-4 6 8H3z" fill="currentColor" />
            </svg>
          )
        ) : null}
        <span>{tab.name}</span>
      </Link>
    );
  };

  const RoleLinks = ({ compact = false, onNavigate }) => {
    const L = ({ href, children }) => {
      const active = isActive(href);
      return (
        <Link
          href={href}
          onClick={() => onNavigate?.()}
          className={[
            "block transition rounded-xl",
            compact ? "px-3 py-2 text-sm" : "px-4 py-3 text-sm",
            active
              ? "bg-blue-50 text-[#46769B] font-semibold"
              : "text-gray-700 hover:bg-gray-50",
          ].join(" ")}
        >
          {children}
        </Link>
      );
    };

    if (isOrgSide) {
      return (
        <>
          <L href="/org/dashboard">Dashboard</L>
          <L href="/org/review-queue">Review Queue</L>
          <L href="/org/workouts-calendar">Workouts Calendar</L>
          {/* ✅ Prescriptions → Nutrition */}
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
  };

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* TOP BAR */}
          <div className="h-16 md:h-20 flex items-center justify-between gap-3">
            {/* Desktop left tabs */}
            <div className="hidden md:flex items-center gap-2">
              {DESKTOP_LEFT_TABS.map((tab) => (
                <NavItem key={tab.href} tab={tab} />
              ))}
            </div>

            {/* Mobile spacer (logo centering) */}
            <div className="md:hidden h-10 w-10" aria-hidden />

            {/* Center logo */}
            <div className="flex-1 flex justify-center">
              <Link href="/" aria-label="PEAK Home" className="inline-flex items-center">
                <div className="block md:hidden">
                  <Logo size="medium" />
                </div>
                <div className="hidden md:block">
                  <Logo size="large" />
                </div>
              </Link>
            </div>

            {/* Desktop right */}
            <div className="hidden md:flex items-center gap-2">
              {DESKTOP_RIGHT_TABS.map((tab) => (
                <NavItem key={tab.href} tab={tab} />
        ))}

              {isMounted && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleProfileClick}
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
                        className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-lg overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b">
                          <p className="text-xs font-semibold truncate">{user?.Name || user?.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{user?.Email || user?.email}</p>
                          <p className="text-[11px] text-gray-400 mt-1 truncate">{roleLabel}</p>
                        </div>

                        {/* Slightly tighter, scrollable area */}
                        <div className="max-h-[300px] overflow-auto p-2">
                          <RoleLinks compact />
                        </div>

                        <div className="p-2 border-t">
                          <button
                            onClick={logoutAndClose}
                            type="button"
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
                onClick={() => setMenuOpen((v) => !v)}
                className="h-10 w-10 rounded-xl border border-gray-200 text-gray-900 grid place-items-center"
                aria-label="Open menu"
                type="button"
              >
                <div className="flex flex-col">
                  <span
                    className={`w-5 h-0.5 bg-gray-700 mb-1 transition ${
                      menuOpen ? "rotate-45 translate-y-1.5" : ""
                    }`}
                  />
                  <span
                    className={`w-5 h-0.5 bg-gray-700 mb-1 transition ${
                      menuOpen ? "opacity-0" : ""
                    }`}
                  />
                  <span
                    className={`w-5 h-0.5 bg-gray-700 transition ${
                      menuOpen ? "-rotate-45 -translate-y-1.5" : ""
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE MENU */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-white border-t border-gray-200 text-gray-900"
            >
              <div className="px-4 py-4 space-y-2">
                {MOBILE_TABS.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "block rounded-xl px-4 py-3 text-sm font-medium",
                      isActive(tab.href)
                        ? "bg-blue-50 text-[#46769B]"
                        : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {tab.name}
                  </Link>
                ))}

                <div className="border-t pt-3" />

                {!loggedIn ? (
                  <div className="grid gap-2">
                    <button
                      onClick={() => openAuthModal("login")}
                      className="rounded-xl bg-[#46769B] text-white py-3 font-semibold"
                      type="button"
                    >
                      Log in
                    </button>
                    <button
                      onClick={() => openAuthModal("signup")}
                      className="rounded-xl border py-3 font-semibold"
                      type="button"
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
                      <p className="text-[11px] text-gray-400 mt-1 truncate">{roleLabel}</p>
                    </div>

                    {/* Mobile-friendly role nav */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-2">
                      <RoleLinks onNavigate={() => setMenuOpen(false)} compact />
                    </div>

                    <button
                      onClick={logoutAndClose}
                      type="button"
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
        onRequestOpen={onRequestOpen} // ✅ required for your modal's global open hook
      />
    </>
  );
}