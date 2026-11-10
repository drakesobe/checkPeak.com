// components/nav/menu.js
// Navigation shared by the header dropdown, the mobile menu, the desktop sidebar and the
// mobile tab bar, so every surface lists the same destinations.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, ClipboardCheck, Clapperboard, BookOpen, Users, MessageSquare, Apple, UserCog,
  LayoutDashboard, ExternalLink, ScanLine, Search, Layers, ShieldCheck, Sun, NotebookPen, Award,
  BarChart3, History, Store, Library, Menu as MenuIcon,
} from "lucide-react";

export { MenuIcon };

// ─── Menu definition ──────────────────────────────────────────────────────────

// countKey links an item to a live badge from /api/org/nav-counts
export function buildMenu({ isOrgSide, isAthlete, isOrgAdmin, isAdmin, trainerSlug }) {
  if (isOrgSide) {
    return [
      { title: "Coaching", items: [
        { href: "/org/workouts-calendar", label: "Schedule",     short: "Schedule", icon: CalendarDays },
        { href: "/org/review-queue",      label: "Review Queue", short: "Review",   icon: ClipboardCheck, countKey: "reviewQueue" },
        { href: "/org/film",              label: "Film",         short: "Film",     icon: Clapperboard, badge: "Beta" },
        { href: "/org/plays",             label: "Play Library", icon: BookOpen },
      ] },
      { title: "Team", items: [
        isOrgAdmin && { href: "/org/athletes", label: "Athletes & Stats", icon: Users },
        { href: "/org/messaging",     label: "Messaging", short: "Messages", icon: MessageSquare, countKey: "messages" },
        { href: "/org/prescriptions", label: "Nutrition", icon: Apple },
        isAdmin && { href: "/org/trainers", label: "Trainers", icon: UserCog },
      ].filter(Boolean) },
      { title: "Studio", items: [
        { href: "/commercial/dashboard", label: "Studio Dashboard", icon: LayoutDashboard },
        trainerSlug && { href: `/trainer/${trainerSlug}`, label: "Public Profile", icon: ExternalLink, external: true },
      ].filter(Boolean) },
      { title: "Compliance", items: [
        { href: "/nutrition-label-scanner", label: "Scan a Label",       icon: ScanLine },
        { href: "/search",                  label: "Search Ingredients", icon: Search },
        { href: "/smartstack-compare",      label: "SmartStack",         icon: Layers },
        { href: "/compliance/ncaa",         label: "NCAA Rules",         icon: ShieldCheck },
      ] },
    ];
  }
  if (isAthlete) {
    return [
      { title: "My Space", items: [
        { href: "/dashboard",       label: "Dashboard",          icon: LayoutDashboard },
        { href: "/athlete/today",   label: "Today",              icon: Sun },
        { href: "/athlete/journal", label: "Journal",            icon: NotebookPen },
        { href: "/athlete/profile", label: "Recruiting Profile", icon: Award, badge: "New" },
        { href: "/athlete/stats",   label: "Stats",              icon: BarChart3 },
      ] },
      { title: "Supplement Check", items: [
        { href: "/nutrition-label-scanner", label: "Scan a Label",       icon: ScanLine },
        { href: "/search",                  label: "Search Ingredients", icon: Search },
        { href: "/scans",                   label: "My Scans",           icon: History },
      ] },
      { title: "Discover", items: [
        { href: "/trainers",           label: "Marketplace",  icon: Store },
        { href: "/smartstack-compare", label: "SmartStack",   icon: Layers },
        { href: "/athlete/libraries",  label: "My Libraries", icon: Library },
      ] },
    ];
  }
  return [];
}

// Items for the phone tab bar: every item that has a short label (the coach's daily destinations)
export function tabItems(sections) {
  return sections.flatMap((s) => s.items).filter((i) => i.short);
}

// Split sections into two columns of roughly equal item counts (sections stay whole)
export function splitColumns(sections) {
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const left = [];
  let count = 0;
  for (const s of sections) {
    if (left.length && count >= total / 2) break;
    left.push(s);
    count += s.items.length;
  }
  return [left, sections.slice(left.length)];
}

// ─── Where the sidebar / tab bar shell appears ────────────────────────────────

const SHELL_PREFIXES = ["/org/", "/scans"];
const SHELL_EXACT = ["/commercial/dashboard", "/account"];

// Coach/org accounts on in-app pages. Athlete pages have their own mobile-app style layout.
export function isShellRoute(pathname, isOrgSide) {
  if (!isOrgSide || !pathname) return false;
  return SHELL_EXACT.includes(pathname) || SHELL_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isActiveHref(pathname, href) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Live counts (one shared poller for every nav surface) ───────────────────

let countsState = { reviewQueue: 0, messages: 0 };
const subscribers = new Set();
let pollTimer = null;
let activeHooks = 0;

export async function refreshNavCounts({ fresh = false } = {}) {
  try {
    const res = await fetch(`/api/org/nav-counts${fresh ? "?fresh=1" : ""}`, { credentials: "include" });
    if (!res.ok) return;
    countsState = await res.json();
    subscribers.forEach((fn) => fn(countsState));
  } catch { /* offline or signed out: keep the last known counts */ }
}

export function useNavCounts(enabled) {
  const [counts, setCounts] = useState(countsState);
  useEffect(() => {
    if (!enabled) return undefined;
    subscribers.add(setCounts);
    if (activeHooks++ === 0) {
      refreshNavCounts();
      pollTimer = setInterval(refreshNavCounts, 60_000);
      window.addEventListener("focus", refreshNavCounts);
    }
    return () => {
      subscribers.delete(setCounts);
      if (--activeHooks === 0) {
        clearInterval(pollTimer);
        window.removeEventListener("focus", refreshNavCounts);
      }
    };
  }, [enabled]);
  return counts;
}

export const formatCount = (n) => (n > 99 ? "99+" : String(n));

// Studio public-profile slug, fetched once per page load and shared by every nav surface
let slugPromise = null;
export function useTrainerSlug(enabled) {
  const [slug, setSlug] = useState("");
  useEffect(() => {
    if (!enabled) return;
    slugPromise ??= fetch("/api/commercial/trainer", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.trainer?.fields?.slug || "")
      .catch(() => "");
    let alive = true;
    slugPromise.then((s) => { if (alive) setSlug(s); });
    return () => { alive = false; };
  }, [enabled]);
  return slug;
}

// Role helpers matching the session cookie's loose role strings
export function normalizeRole(user) {
  const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "organization" || raw.includes("org"))   return "organization";
  if (raw === "athlete"      || raw.includes("ath"))   return "athlete";
  if (raw === "trainer"      || raw.includes("train")) return "trainer";
  if (raw === "admin"        || raw.includes("admin")) return "admin";
  return raw;
}
export const isOrgSideRole = (role) => role === "organization" || role === "trainer" || role === "admin";

// ─── Items ────────────────────────────────────────────────────────────────────

// Dark surfaces (header dropdown, mobile menu) and light surfaces (desktop sidebar)
export const MENU_STYLE = `
  .cp-mi { display: flex; align-items: center; gap: 12px; padding: 0 10px; border-radius: 8px;
    color: rgba(255,255,255,0.8); text-decoration: none; font-weight: 500; letter-spacing: 0.01em;
    transition: background 0.12s, color 0.12s; }
  .cp-mi:hover { background: rgba(255,255,255,0.07); color: #fff; }
  .cp-mi-icon { flex-shrink: 0; color: rgba(255,255,255,0.45); transition: color 0.12s; }
  .cp-mi:hover .cp-mi-icon { color: #fff; }
  .cp-mi.is-active { background: rgba(79,171,255,0.14); color: #fff; font-weight: 700; }
  .cp-mi.is-active .cp-mi-icon { color: #4FABFF; }
  .cp-mi:focus-visible { outline: 2px solid #4FABFF; outline-offset: -2px; }
  .cp-mi-badge { font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
    color: #4FABFF; background: rgba(79,171,255,0.14); padding: 2px 6px; border-radius: 4px; }
  .cp-mi-count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; display: inline-flex;
    align-items: center; justify-content: center; font-size: 11px; font-weight: 800;
    font-variant-numeric: tabular-nums; color: #fff; background: #DC2626; }
  .cp-ms-title { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(255,255,255,0.55); padding: 0 10px 6px; }

  .cp-light .cp-mi { color: #374151; }
  .cp-light .cp-mi:hover { background: #F3F4F6; color: #111827; }
  .cp-light .cp-mi-icon { color: #6B7280; }
  .cp-light .cp-mi:hover .cp-mi-icon { color: #111827; }
  .cp-light .cp-mi.is-active { background: rgba(30,58,95,0.08); color: #0F172A; }
  .cp-light .cp-mi.is-active .cp-mi-icon { color: #1E3A5F; }
  .cp-light .cp-mi:focus-visible { outline-color: #1E3A5F; }
  .cp-light .cp-mi-badge { color: #1E3A5F; background: rgba(30,58,95,0.08); }
  .cp-light .cp-ms-title { color: #6B7280; }
`;

// collapsed: icon-only sidebar rail, so the label becomes a hover tooltip
export function MenuItem({ item, active, onClick, large = false, count = 0, collapsed = false }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`cp-mi${active ? " is-active" : ""}`}
      style={{ minHeight: large ? 48 : 38, fontSize: large ? 16 : 14 }}
    >
      <Icon size={large ? 19 : collapsed ? 19 : 16} strokeWidth={2} className="cp-mi-icon" aria-hidden="true" />
      <span className="cp-mi-label" style={{ flex: 1 }}>{item.label}</span>
      {count > 0 && (
        <span className="cp-mi-count" aria-label={`${count} waiting`}>{formatCount(count)}</span>
      )}
      {item.badge && <span className="cp-mi-badge">{item.badge}</span>}
    </Link>
  );
}

export function MenuSection({ section, isActive, onClose, large, counts, collapsed = false }) {
  return (
    <div role="group" aria-label={section.title}>
      <div className="cp-ms-title">{section.title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {section.items.map((item) => (
          <MenuItem
            key={item.href}
            item={item}
            active={!item.external && isActive(item.href)}
            onClick={onClose}
            large={large}
            collapsed={collapsed}
            count={item.countKey ? counts?.[item.countKey] || 0 : 0}
          />
        ))}
      </div>
    </div>
  );
}
