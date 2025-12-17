"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";
import Logo from "@/components/Logo";
import NavBarLoginModal from "@/components/NavBarLoginModal";

export default function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuthContext();

  const [isMounted, setIsMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [defaultAuthTab, setDefaultAuthTab] = useState("login");
  const [stackIconBroken, setStackIconBroken] = useState(false);

  const navRef = useRef(null);

  useEffect(() => setIsMounted(true), []);

  const loggedIn = !!user;

  // Normalize role across all possible shapes
  const role = useMemo(() => {
    const raw = (user?.Role || user?.role || "").toString().trim();
    const normalized = raw.toLowerCase();
    if (normalized.includes("org")) return "organization";
    if (normalized.includes("ath")) return "athlete";
    if (normalized.includes("admin")) return "admin";
    if (normalized.includes("trainer")) return "trainer";
    return normalized || "";
  }, [user]);

  const isOrg = role === "organization";
  const isAthlete = role === "athlete";

  // Tabs shown on left side (desktop)
  const leftTabs = useMemo(
    () => [
      { name: "Scan", href: "/ocr" },
      { name: "Search", href: "/search" },
      { name: "Info", href: "/info" },
    ],
    []
  );

  // Mobile main tabs include SmartStack
  const mainTabs = useMemo(
    () => [...leftTabs, { name: "SmartStack", href: "/smartstack" }],
    [leftTabs]
  );

  // ✅ Global event listener to open auth modal from anywhere (FinishSetupModal, etc.)
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

    if (typeof window !== "undefined") {
      window.addEventListener("cp:open-auth-modal", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("cp:open-auth-modal", handler);
      }
    };
  }, []);

  // Close dropdowns/menus when route changes
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  // ESC to close mobile menu + profile dropdown
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

  // Click outside closes dropdowns (desktop)
  useEffect(() => {
    if (!profileOpen) return;

    const onDown = (e) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target)) setProfileOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen]);

  const openAuthModal = useCallback((tab = "login") => {
    setDefaultAuthTab(tab);
    setLoginModalOpen(true);
  }, []);

  const handleProfileClick = useCallback(() => {
    if (!loggedIn) return openAuthModal("login");
    setProfileOpen((p) => !p);
  }, [loggedIn, openAuthModal]);

  const logoutAndClose = useCallback(() => {
    logout();
    setProfileOpen(false);
    setMenuOpen(false);
  }, [logout]);

  const isActive = useCallback(
    (href) => {
      if (href === "/") return pathname === "/";
      // treat nested routes as active too (ex: /scans/123)
      return pathname === href || pathname?.startsWith(`${href}/`);
    },
    [pathname]
  );

  const NavItem = ({ tab, onClick }) => {
    const active = isActive(tab.href);
    const isSmartStack = tab.name === "SmartStack";

    return (
      <Link
        href={tab.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={[
          "relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition",
          active ? "text-[#46769B]" : "text-gray-700 hover:text-[#46769B]",
          active ? "bg-blue-50" : "hover:bg-gray-50",
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
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M3 18l6-8 3 4 3-4 6 8H3z" fill="currentColor" />
            </svg>
          )
        ) : null}

        <span>{tab.name}</span>

        {active && (
          <motion.span
            layoutId="navActivePill"
            className="absolute inset-0 -z-10 rounded-2xl bg-blue-50"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
      </Link>
    );
  };

  /**
   * ✅ RoleLinks now maps to your actual role system:
   * - Organization -> /org/*
   * - Athlete -> /dashboard, /scans
   */
  const RoleLinks = () => {
    const L = ({ href, children }) => (
      <Link
        href={href}
        className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
      >
        {children}
      </Link>
    );

    if (isOrg) {
      return (
        <>
          <L href="/org/dashboard">Organization Dashboard</L>
          <L href="/org/athletes">Athletes</L>
          <L href="/org/prescriptions">Prescriptions</L>
          <L href="/account">Account</L>
        </>
      );
    }

    if (isAthlete) {
      return (
        <>
          <L href="/dashboard">Athlete Dashboard</L>
          <L href="/scans">My Scans</L>
          <L href="/account">Account</L>
        </>
      );
    }

    // fallback for any legacy roles you still have in Airtable
    if (role.includes("admin")) {
      return (
        <>
          <L href="/org/dashboard">Organization Dashboard</L>
          <L href="/account">Account</L>
        </>
      );
    }

    if (role.includes("trainer")) {
      return (
        <>
          <L href="/team">Team Dashboard</L>
          <L href="/athletes">Athlete Management</L>
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
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="h-16 md:h-20 flex items-center justify-between gap-3">
            {/* Left (desktop tabs) */}
            <div className="hidden md:flex items-center gap-2">
              {leftTabs.map((tab) => (
                <NavItem key={tab.href} tab={tab} />
              ))}
            </div>

            {/* Center Logo */}
            <div className="flex-1 flex justify-center">
              <Link href="/" aria-label="PEAK Home" className="inline-flex">
                <div className="block md:hidden">
                  <Logo size="medium" />
                </div>
                <div className="hidden md:block">
                  <Logo size="large" />
                </div>
              </Link>
            </div>

            {/* Right (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <NavItem tab={{ name: "SmartStack", href: "/smartstack" }} />

              {isMounted && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleProfileClick}
                    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#46769B] hover:border-[#46769B] hover:bg-gray-50 transition"
                    aria-haspopup="menu"
                    aria-expanded={profileOpen}
                  >
                    {loggedIn ? (user?.Name || user?.name || "Profile") : "Login"}
                  </button>

                  <AnimatePresence>
                    {loggedIn && profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
                        role="menu"
                      >
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {user?.Name || user?.name || "Profile"}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {user?.Email || user?.email}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1 truncate">
                            {isOrg ? "Organization" : isAthlete ? "Athlete" : role || "Member"}
                          </p>
                        </div>

                        <RoleLinks />

                        <button
                          onClick={logoutAndClose}
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Mobile controls */}
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (loggedIn) {
                    setProfileOpen(false);
                    setMenuOpen((v) => !v);
                  } else {
                    setMenuOpen((v) => !v);
                  }
                }}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                className="h-10 w-10 rounded-xl border border-gray-200 grid place-items-center bg-white hover:bg-gray-50 transition"
              >
                <div className="flex flex-col justify-center items-center">
                  <span
                    className={`block w-5 h-0.5 bg-gray-700 mb-1 rounded transition ${
                      menuOpen ? "rotate-45 translate-y-1.5" : ""
                    }`}
                  />
                  <span
                    className={`block w-5 h-0.5 bg-gray-700 mb-1 rounded transition ${
                      menuOpen ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  <span
                    className={`block w-5 h-0.5 bg-gray-700 rounded transition ${
                      menuOpen ? "-rotate-45 -translate-y-1.5" : ""
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-white border-t border-gray-200"
            >
              <div className="px-4 sm:px-6 py-4 space-y-2">
                {/* Nav links */}
                <div className="grid gap-1">
                  {mainTabs.map((tab) => (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={isActive(tab.href) ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={[
                        "rounded-xl px-4 py-3 text-sm font-medium transition",
                        isActive(tab.href)
                          ? "bg-blue-50 text-[#46769B]"
                          : "text-gray-700 hover:bg-gray-50 hover:text-[#46769B]",
                      ].join(" ")}
                    >
                      {tab.name}
                    </Link>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3" />

                {/* Auth area */}
                {isMounted && !loggedIn && (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        openAuthModal("login");
                      }}
                      className="w-full rounded-xl bg-[#46769B] text-white py-3 text-sm font-semibold hover:opacity-95 transition"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        openAuthModal("signup");
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white text-gray-800 py-3 text-sm font-semibold hover:bg-gray-50 transition"
                    >
                      Sign up
                    </button>
                  </div>
                )}

                {isMounted && loggedIn && (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {user?.Name || user?.name || "Profile"}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {user?.Email || user?.email}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1 truncate">
                        {isOrg ? "Organization" : isAthlete ? "Athlete" : role || "Member"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <RoleLinks />
                      <button
                        onClick={logoutAndClose}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* LOGIN/SIGNUP MODAL */}
      <NavBarLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        defaultTab={defaultAuthTab}
      />
    </>
  );
}
