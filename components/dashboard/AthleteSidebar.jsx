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

export default function AthleteSidebar({
  user,
  routes,
  onNavigate,
  onLogout,
  todayHasWork = false,
}) {
  return (
    <aside className="hidden lg:flex bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm p-4 flex-col gap-4 h-fit">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden">
          <Image
            src="/apple-touch-icon.png"
            alt="CheckPeak"
            width={28}
            height={28}
            priority
          />
        </div>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            PEAK
          </span>
          <span className="text-xs text-gray-700">
            Supplement Safety
          </span>
        </div>
      </div>

      <div className="mt-1 mb-2 border-t border-gray-100" />

      {/* Nav */}
      <nav className="flex flex-col gap-1.5 text-sm">
        <SidebarLink
          label="Dashboard"
          icon={<BarChart3 className="w-4 h-4" />}
          active
          onClick={() => onNavigate(routes.dashboard)}
        />
        <SidebarLink
          label="Today"
          icon={<CalendarDays className="w-4 h-4" />}
          badge={todayHasWork ? "!" : null}
          onClick={() => onNavigate(routes.today)}
        />
        <SidebarLink
          label="Search ingredients"
          icon={<Search className="w-4 h-4" />}
          onClick={() => onNavigate(routes.search)}
        />
        <SidebarLink
          label="Scan a label"
          icon={<ScanBarcode className="w-4 h-4" />}
          onClick={() => onNavigate(routes.scan)}
        />
        <SidebarLink
          label="My scans"
          icon={<Folder className="w-4 h-4" />}
          onClick={() => onNavigate(routes.scans)}
        />
        <SidebarLink
          label="Saved stacks"
          icon={<Bookmark className="w-4 h-4" />}
          onClick={() => onNavigate(routes.savedStacks)}
        />
        <SidebarLink
          label="SmartStack"
          icon={<Sparkles className="w-4 h-4" />}
          onClick={() => onNavigate(routes.smartstack)}
        />

        <div className="mt-3 border-t border-gray-100 pt-2">
          <SidebarLink
            label="Account settings"
            icon={<Settings className="w-4 h-4" />}
            onClick={() => onNavigate(routes.account)}
          />
        </div>
      </nav>

      {/* User / Logout */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-semibold text-blue-700">
            {(user?.Name || user?.name || "U")[0]?.toUpperCase?.()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-gray-800 truncate">
              {user?.Name || user?.name || "Athlete"}
            </span>
            <span className="text-[11px] text-gray-500 truncate">
              {user?.Email || user?.email}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium px-3 py-2 hover:bg-red-100 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
