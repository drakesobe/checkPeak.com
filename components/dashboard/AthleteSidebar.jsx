// /components/dashboard/AthleteSidebar.jsx
"use client";

import Image from "next/image";
import {
  LogOut,
  Search,
  Folder,
  Settings,
  Bookmark,
  BarChart3,
  ScanBarcode,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { SidebarLink } from "./ui";

/* -------------------------------------------------------------------------- */
/* Tokens                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Barlow', sans-serif";

/* -------------------------------------------------------------------------- */
/* NavGroup — small caps label + set of SidebarLinks                          */
/* -------------------------------------------------------------------------- */

function NavGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p
        className="text-[10px] font-bold uppercase tracking-widest px-2 mb-1"
        style={{ color: "#94a3b8", fontFamily: FONT_COND, letterSpacing: "0.1em" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Divider                                                                     */
/* -------------------------------------------------------------------------- */

function Divider() {
  return (
    <div
      className="w-full"
      style={{ height: "1px", background: "#f1f5f9" }}
      aria-hidden="true"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* UserFooter                                                                  */
/* -------------------------------------------------------------------------- */

function UserFooter({ user, onLogout }) {
  const name   = user?.Name  || user?.name  || "Athlete";
  const email  = user?.Email || user?.email || "";
  const initial = name[0]?.toUpperCase?.() || "A";

  return (
    <div className="flex flex-col gap-2.5">
      {/* User identity */}
      <div className="flex items-center gap-2.5 px-1">
        {/* Avatar */}
        <div
          className="h-8 w-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0"
          style={{
            background: "rgba(91,158,201,0.1)",
            border:     "1px solid rgba(91,158,201,0.2)",
            color:      BRAND,
            fontFamily: FONT_COND,
          }}
          aria-hidden="true"
        >
          {initial}
        </div>

        <div className="flex flex-col min-w-0">
          <span
            className="text-xs font-bold truncate leading-tight"
            style={{ color: "#0f172a", fontFamily: FONT_COND }}
          >
            {name}
          </span>
          {email && (
            <span
              className="text-[11px] truncate leading-tight"
              style={{ color: "#64748b" }}
            >
              {email}
            </span>
          )}
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
        style={{
          background:    "transparent",
          border:        "1px solid #fecaca",
          color:         "#ef4444",
          fontFamily:    FONT_COND,
          letterSpacing: "0.05em",
          cursor:        "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#fef2f2";
          e.currentTarget.style.borderColor = "#fca5a5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background  = "transparent";
          e.currentTarget.style.borderColor = "#fecaca";
        }}
      >
        <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
        Log out
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AthleteSidebar                                                              */
/* -------------------------------------------------------------------------- */

export default function AthleteSidebar({
  user,
  routes,
  onNavigate,
  onLogout,
  todayHasWork = false,
  activeRoute,
}) {
  const isActive = (route) => activeRoute === route;

  const nav = (route) => {
    if (typeof onNavigate === "function") onNavigate(route);
  };

  return (
    <aside
      className="hidden lg:flex flex-col gap-4 h-fit"
      style={{
        background:   "#fff",
        border:       "1px solid #e2e8f0",
        borderRadius: "16px",
        boxShadow:    "0 1px 4px rgba(0,0,0,0.06)",
        padding:      "20px 16px",
        fontFamily:   FONT_BODY,
        minWidth:     220,
      }}
    >
      {/* ── Logo / Brand ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-1">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
          style={{
            background: "#fff",
            border:     "1px solid #e2e8f0",
            boxShadow:  "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <Image
            src="/apple-touch-icon.png"
            alt="CheckPeak logo"
            width={28}
            height={28}
            priority
          />
        </div>

        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: BRAND, boxShadow: "0 0 4px rgba(91,158,201,0.5)" }}
              aria-hidden="true"
            />
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: "#0f172a", fontFamily: FONT_COND, letterSpacing: "0.12em" }}
            >
              CheckPeak
            </span>
          </div>
          <span
            className="text-[11px] font-medium"
            style={{ color: "#64748b" }}
          >
            Supplement Safety
          </span>
        </div>
      </div>

      <Divider />

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex flex-col gap-3.5" aria-label="Sidebar navigation">

        {/* Overview */}
        <NavGroup label="Overview">
          <SidebarLink
            label="Dashboard"
            icon={<BarChart3 className="w-4 h-4" />}
            active={isActive(routes?.dashboard)}
            onClick={() => nav(routes?.dashboard)}
          />
          <SidebarLink
            label="Today"
            icon={<CalendarDays className="w-4 h-4" />}
            active={isActive(routes?.today)}
            badge={todayHasWork ? "Today" : null}
            onClick={() => nav(routes?.today)}
          />
        </NavGroup>

        {/* Tools */}
        <NavGroup label="Tools">
          <SidebarLink
            label="Scan a label"
            icon={<ScanBarcode className="w-4 h-4" />}
            active={isActive(routes?.scan)}
            onClick={() => nav(routes?.scan)}
          />
          <SidebarLink
            label="Search ingredients"
            icon={<Search className="w-4 h-4" />}
            active={isActive(routes?.search)}
            onClick={() => nav(routes?.search)}
          />
          <SidebarLink
            label="SmartStack"
            icon={<Sparkles className="w-4 h-4" />}
            active={isActive(routes?.smartstack)}
            onClick={() => nav(routes?.smartstack)}
          />
        </NavGroup>

        {/* Library */}
        <NavGroup label="Library">
          <SidebarLink
            label="My scans"
            icon={<Folder className="w-4 h-4" />}
            active={isActive(routes?.scans)}
            onClick={() => nav(routes?.scans)}
          />
          <SidebarLink
            label="Saved stacks"
            icon={<Bookmark className="w-4 h-4" />}
            active={isActive(routes?.savedStacks)}
            onClick={() => nav(routes?.savedStacks)}
          />
        </NavGroup>

      </nav>

      <Divider />

      {/* ── Account settings ─────────────────────────────────────────── */}
      <SidebarLink
        label="Account settings"
        icon={<Settings className="w-4 h-4" />}
        active={isActive(routes?.account)}
        onClick={() => nav(routes?.account)}
      />

      <Divider />

      {/* ── User / Logout ─────────────────────────────────────────────── */}
      <UserFooter user={user} onLogout={onLogout} />
    </aside>
  );
}