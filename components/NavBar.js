"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import useAuth from "@/hooks/useAuth";
import Logo from "@/components/Logo";

export default function NavBar() {
  const pathname = usePathname();
  const { user, login, logout } = useAuth();

  const [isMounted, setIsMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [stackIconBroken, setStackIconBroken] = useState(false);

  // Ensure client-only dynamic bits mount after hydration
  useEffect(() => setIsMounted(true), []);

  const role = useMemo(() => (user?.Role || user?.role || "").trim(), [user]);
  const loggedIn = !!user;

  const leftTabs = useMemo(
    () => [
      { name: "Scan", href: "/ocr" },
      { name: "Search", href: "/search" },
      { name: "Info", href: "/info" },
      // If you want Blogs back, uncomment:
      // { name: "Blogs", href: "/blogs" },
    ],
    []
  );

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  const handleAuthClick = useCallback(async () => {
    if (loggedIn) {
      setProfileDropdownOpen((prev) => !prev);
      return;
    }
    const email = typeof window !== "undefined" ? window.prompt("Enter your email to log in:") : null;
    if (!email) return;

    try {
      await login(email);
      setProfileDropdownOpen(true);
    } catch {
      alert("Could not look up user. Please check the API route or Airtable config.");
    }
  }, [loggedIn, login]);

  const RoleLinks = () => {
    const L = ({ href, children }) => (
      <Link href={href} className="block px-4 py-3 hover:bg-gray-50">
        {children}
      </Link>
    );

    const normalized = (role || "").toLowerCase();

    if (normalized.includes("admin")) {
      return (
        <>
          <L href="/organization">Organization Dashboard</L>
          <L href="/invites">Manage Invites</L>
          <L href="/account">Account</L>
        </>
      );
    }
    if (normalized.includes("head") && normalized.includes("trainer")) {
      return (
        <>
          <L href="/team">Team Dashboard</L>
          <L href="/athletes">Athlete Management</L>
          <L href="/account">Account</L>
        </>
      );
    }
    if (normalized.includes("athlete")) {
      return (
        <>
          <L href="/athlete-profile">Athlete Profile</L>
          <L href="/scans">My Scans</L>
          <L href="/account">Account</L>
        </>
      );
    }
    return <L href="/account">Account</L>;
  };

  return (
    <nav className="bg-white/90 backdrop-blur-md shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-24 gap-4">
          {/* LEFT NAV LINKS (desktop) */}
          <div className="hidden md:flex items-center space-x-6 justify-start">
            {leftTabs.map((tab) => {
              const isActive = pathname === tab.href;
              const showUnderline = isActive || hoveredTab === tab.name;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className="relative px-4 py-2 rounded-2xl font-medium text-gray-700 hover:text-[#46769B] transition transform hover:scale-[1.02]"
                  onMouseEnter={() => setHoveredTab(tab.name)}
                  onMouseLeave={() => setHoveredTab(null)}
                >
                  {tab.name}
                  {showUnderline && (
                    <motion.span
                      layoutId="underline"
                      className="absolute left-0 bottom-0 w-full h-1 bg-[#46769B] rounded-full shadow-[0_0_4px_#46769B33]"
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* CENTER LOGO (desktop & mobile) */}
          <div className="flex justify-center items-center">
            <Link href="/" aria-label="PEAK Home">
              {/* Animated SVG lives in components/Logo.js */}
              <Logo size="large" />
            </Link>
          </div>

          {/* RIGHT NAV (desktop) */}
          <div className="hidden md:flex items-center justify-end space-x-6">
            {/* SmartStack */}
            <Link
              href="/smartstack"
              className="relative px-4 py-2 rounded-2xl font-medium text-gray-700 hover:text-[#46769B] transition transform hover:scale-[1.02] text-center"
              onMouseEnter={() => setHoveredTab("SmartStack")}
              onMouseLeave={() => setHoveredTab(null)}
              aria-current={pathname === "/smartstack" ? "page" : undefined}
            >
              <span className="flex flex-col items-center leading-none">
                {!stackIconBroken ? (
                  <img
                    src="/mountain.svg"
                    alt="SmartStack"
                    className="h-5 w-auto mb-1"
                    onError={() => setStackIconBroken(true)}
                    draggable={false}
                  />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 mb-1" aria-hidden="true">
                    <path d="M3 18l6-8 3 4 3-4 6 8H3z" fill="currentColor" />
                  </svg>
                )}
                SmartStack
              </span>
              {(pathname === "/smartstack" || hoveredTab === "SmartStack") && (
                <motion.span
                  layoutId="underline"
                  className="absolute left-0 bottom-0 w-full h-1 bg-[#46769B] rounded-full shadow-[0_0_4px_#46769B33]"
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                />
              )}
            </Link>

            {/* Profile/Login (hydrate-safe) */}
            {isMounted && (
              <div className="relative">
                <button
                  onClick={handleAuthClick}
                  className="px-4 py-2 rounded-2xl font-medium text-gray-700 hover:text-[#46769B] border border-gray-200 hover:border-[#46769B] transition"
                >
                  {loggedIn ? (user?.Name || user?.name || "Profile") : "Login"}
                </button>

                <AnimatePresence>
                  {loggedIn && profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-56 bg-white shadow-md rounded-xl border border-gray-200 z-50 overflow-hidden"
                    >
                      <RoleLinks />
                      <button
                        onClick={() => {
                          logout();
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50"
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* MOBILE HAMBURGER (separate row) */}
          <div className="md:hidden flex items-center justify-end col-span-3">
            <button
              onClick={toggleMenu}
              className="flex flex-col justify-center items-center w-10 h-10"
              aria-label="Toggle Menu"
            >
              <span
                className={`block w-6 h-0.5 bg-gray-700 mb-1 rounded transform transition duration-300 ${
                  menuOpen ? "rotate-45 translate-y-1.5" : ""
                }`}
              />
              <span
                className={`block w-6 h-0.5 bg-gray-700 mb-1 rounded transition-opacity duration-300 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block w-6 h-0.5 bg-gray-700 rounded transform transition duration-300 ${
                  menuOpen ? "-rotate-45 -translate-y-1.5" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU (with Logo header) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-white border-t border-gray-200 shadow-md"
          >
            {/* Drawer header with animated logo */}
            <div className="px-6 pt-4 pb-2 flex items-center justify-between">
              <Link href="/" aria-label="PEAK Home" onClick={() => setMenuOpen(false)}>
                <Logo size="small" />
              </Link>
              <button
                onClick={toggleMenu}
                className="p-2 rounded-lg border border-gray-200"
                aria-label="Close Menu"
              >
                ✕
              </button>
            </div>

            {[...leftTabs, { name: "SmartStack", href: "/smartstack" }].map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative block px-6 py-4 font-medium text-gray-700 hover:text-[#46769B] ${
                    isActive ? "bg-blue-50 text-[#46769B]" : ""
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {tab.name}
                </Link>
              );
            })}

            {/* Mobile Login/Profile */}
            {isMounted && !loggedIn ? (
              <button
                onClick={async () => {
                  await handleAuthClick();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-6 py-4 font-medium text-gray-700 hover:text-[#46769B]"
              >
                Login
              </button>
            ) : (
              isMounted && (
                <div className="border-t border-gray-100">
                  <div className="px-6 py-3 text-xs uppercase tracking-wide text-gray-400">
                    {role || "Profile"}
                  </div>
                  <div className="pb-2">
                    <Link
                      href={
                        (role || "").toLowerCase().includes("athlete")
                          ? "/athlete-profile"
                          : (role || "").toLowerCase().includes("admin")
                          ? "/organization"
                          : (role || "").toLowerCase().includes("trainer")
                          ? "/team"
                          : "/account"
                      }
                      className="block px-6 py-3 font-medium text-gray-700 hover:text-[#46769B]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Go to Dashboard
                    </Link>
                    <Link
                      href="/account"
                      className="block px-6 py-3 font-medium text-gray-700 hover:text-[#46769B]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Account
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-6 py-3 font-medium text-gray-700 hover:text-[#46769B]"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
