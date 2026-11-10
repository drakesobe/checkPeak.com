// components/nav/AppShell.jsx
// In-app navigation for coach/org accounts: a sidebar on desktop and a tab bar on phones/tablets.
// Breakpoints are pure CSS (no JS measuring), so the layout never flickers on load.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import {
  buildMenu, tabItems, isShellRoute, isActiveHref, useNavCounts, refreshNavCounts, useTrainerSlug,
  normalizeRole, isOrgSideRole, MenuSection, MENU_STYLE, MenuIcon, formatCount,
} from "@/components/nav/menu";

export const SIDEBAR_W = 232;
const RAIL_W = 72;       // collapsed, icon-only sidebar
const TABBAR_H = 64;
const COLLAPSE_KEY = "cp_sidebar_collapsed";

// Pages read --app-sidebar-w / --app-bottom-nav-h to keep fixed bars clear of the shell
const SHELL_STYLE = `
  html.has-app-shell { --app-sidebar-w: 0px; --app-bottom-nav-h: calc(${TABBAR_H}px + env(safe-area-inset-bottom, 0px)); }
  @media (min-width: 1024px) {
    html.has-app-shell { --app-sidebar-w: ${SIDEBAR_W}px; --app-bottom-nav-h: 0px; }
    html.has-app-shell.sidebar-collapsed { --app-sidebar-w: ${RAIL_W}px; }
  }
  html.has-app-shell .cp-shell-offset { padding-left: var(--app-sidebar-w); padding-bottom: var(--app-bottom-nav-h); transition: padding-left 0.18s ease; }

  .cp-sidebar { display: none; }
  @media (min-width: 1024px) {
    .cp-sidebar {
      display: flex; flex-direction: column; gap: 18px;
      position: fixed; left: 0; top: var(--app-header-h, 64px); bottom: 0; width: var(--app-sidebar-w);
      padding: 20px 12px 12px; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin;
      background: #FFFFFF; border-right: 1px solid #E5E7EB; z-index: 35;
      transition: width 0.18s ease;
    }
  }
  /* Pinned to the bottom so it stays reachable when the sidebar scrolls on short laptop screens */
  .cp-sidebar-toggle {
    margin-top: auto; position: sticky; bottom: -12px; flex-shrink: 0;
    display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 10px;
    border: none; border-top: 1px solid #F1F5F9; border-radius: 0; background: #fff;
    color: #6B7280; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
  }
  .cp-sidebar-toggle:hover { color: #111827; }
  .cp-sidebar-toggle:focus-visible { outline: 2px solid #1E3A5F; outline-offset: -2px; }

  /* Collapsed rail: icons only, labels stay available to screen readers, section titles become dividers */
  .cp-sidebar.is-collapsed { padding: 16px 10px 12px; gap: 14px; }
  .cp-sidebar.is-collapsed .cp-ms-title { height: 1px; margin: 0 8px 10px; padding: 0; overflow: hidden; background: #E5E7EB; color: transparent; }
  .cp-sidebar.is-collapsed .cp-mi { justify-content: center; padding: 0; position: relative; }
  .cp-sidebar.is-collapsed .cp-mi-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .cp-sidebar.is-collapsed .cp-mi-badge { display: none; }
  .cp-sidebar.is-collapsed .cp-mi-count { position: absolute; top: 2px; right: 6px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; border: 2px solid #fff; }
  .cp-sidebar.is-collapsed .cp-sidebar-toggle { justify-content: center; padding: 0; }
  @media (prefers-reduced-motion: reduce) { .cp-sidebar, html.has-app-shell .cp-shell-offset { transition: none; } }

  .cp-tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
    display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
    height: var(--app-bottom-nav-h); padding-bottom: env(safe-area-inset-bottom, 0px);
    background: rgba(255,255,255,0.97); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid #E5E7EB; box-shadow: 0 -4px 16px rgba(15,23,42,0.05);
  }
  @media (min-width: 1024px) { .cp-tabbar { display: none; } }
  .cp-tab {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    min-height: ${TABBAR_H}px; padding: 0 2px; font: inherit; font-size: 11px; font-weight: 600; letter-spacing: 0.01em;
    color: #6B7280; text-decoration: none; background: none; border: none; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .cp-tab.is-active { color: #1E3A5F; font-weight: 800; }
  .cp-tab.is-active::before {
    content: ""; position: absolute; top: 0; left: 28%; right: 28%; height: 3px;
    border-radius: 0 0 3px 3px; background: #1E3A5F;
  }
  .cp-tab:focus-visible { outline: 2px solid #1E3A5F; outline-offset: -4px; }
  .cp-tab-icon { position: relative; display: flex; }
  .cp-tab-count {
    position: absolute; top: -7px; left: 13px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
    display: inline-flex; align-items: center; justify-content: center; border: 2px solid #fff;
    font-size: 10px; font-weight: 800; font-variant-numeric: tabular-nums; color: #fff; background: #DC2626;
  }
`;

export default function AppShell() {
  const pathname = usePathname();
  const { user } = useAuthContext();
  const role = normalizeRole(user);
  const isOrgSide = isOrgSideRole(role);
  const enabled = isShellRoute(pathname, isOrgSide && !!user);

  const counts = useNavCounts(enabled);
  const trainerSlug = useTrainerSlug(enabled);

  // Counts change as the coach works (approving a review, opening a thread): refresh per page
  useEffect(() => { if (enabled) refreshNavCounts(); }, [pathname, enabled]);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* private mode */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* private mode */ }
      return !c;
    });
  };

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("has-app-shell", enabled);
    el.classList.toggle("sidebar-collapsed", enabled && collapsed);
    return () => el.classList.remove("has-app-shell", "sidebar-collapsed");
  }, [enabled, collapsed]);

  const sections = useMemo(() => buildMenu({
    isOrgSide,
    isAthlete: false,
    isOrgAdmin: role === "organization" || role === "admin",
    isAdmin: role === "admin",
    trainerSlug,
  }), [isOrgSide, role, trainerSlug]);

  if (!enabled) return null;

  const isActive = (href) => isActiveHref(pathname, href);
  const tabs = tabItems(sections);

  return (
    <>
      <style>{MENU_STYLE + SHELL_STYLE}</style>

      <aside className={`cp-sidebar cp-light${collapsed ? " is-collapsed" : ""}`} aria-label="App navigation">
        {sections.map((s) => (
          <MenuSection key={s.title} section={s} isActive={isActive} counts={counts} collapsed={collapsed} />
        ))}
        <button
          type="button"
          className="cp-sidebar-toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      <nav className="cp-tabbar" aria-label="App navigation">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const count = item.countKey ? counts[item.countKey] || 0 : 0;
          return (
            <Link key={item.href} href={item.href} className={`cp-tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="cp-tab-icon">
                <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {count > 0 && <span className="cp-tab-count" aria-label={`${count} waiting`}>{formatCount(count)}</span>}
              </span>
              {item.short}
            </Link>
          );
        })}
        {/* "More" carries the highlight on pages that aren't one of the tabs (e.g. Play Library) */}
        <button
          type="button"
          className={`cp-tab${tabs.some((t) => isActive(t.href)) ? "" : " is-active"}`}
          onClick={() => window.dispatchEvent(new CustomEvent("cp:open-app-menu"))}
        >
          <span className="cp-tab-icon"><MenuIcon size={22} strokeWidth={2} aria-hidden="true" /></span>
          More
        </button>
      </nav>
    </>
  );
}
