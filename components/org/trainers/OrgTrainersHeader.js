// components/org/trainers/OrgTrainersHeader.js
"use client";

import { useRef } from "react";
import { Users, RefreshCcw, LogOut, ArrowLeft, UserPlus, Search, X, AlertTriangle } from "lucide-react";
import { DS, FONT_CONDENSED } from "./ds.js";
import { Btn, Banner } from "./ui.js";

const FILTERS = [
  { key: "all",      label: "All"      },
  { key: "admin",    label: "Admins"   },
  { key: "trainer",  label: "Trainers" },
  { key: "inactive", label: "Inactive" },
];

export default function OrgTrainersHeader({
  orgName = "Organization",
  orgEmail = "",
  orgToken = "",
  counts = { total: 0, admins: 0, coaches: 0, inactive: 0 },
  canManageMembers = false,
  loading = false,
  // filter + search (lifted to page)
  filter,
  onFilterChange,
  search,
  onSearchChange,
  // actions
  onBack,
  onRefresh,
  onLogout,
  onInvite,
  // banners
  error = "",
  inviteErr = "",
  saveErr = "",
  inviteOk = "",
  saveOk = "",
}) {
  const searchRef = useRef(null);

  const errText = error || inviteErr || saveErr;
  const okText  = saveOk || inviteOk;

  const countFor = (key) => {
    if (key === "all")      return counts.total;
    if (key === "admin")    return counts.admins;
    if (key === "trainer")  return counts.coaches;
    if (key === "inactive") return counts.inactive;
    return 0;
  };

  return (
    <div className="bg-white" style={{ border: `1px solid ${DS.border}` }}>

      {/* ── Row 1: Title + Actions ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4"
        style={{ borderBottom: `1px solid ${DS.border}` }}
      >
        {/* Left */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-10 h-10 flex items-center justify-center shrink-0"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
          >
            <Users className="w-5 h-5" style={{ color: DS.brand }} />
          </div>
          <div className="min-w-0">
            <h1
              className="font-black leading-none"
              style={{ fontFamily: FONT_CONDENSED, fontSize: "1.75rem", color: DS.bodyText, letterSpacing: "-0.02em" }}
            >
              STAFF
            </h1>
            <p className="text-xs mt-0.5 truncate" style={{ color: DS.dimText }}>
              {orgName}{orgEmail ? ` · ${orgEmail}` : ""}
              {!orgToken && (
                <span className="ml-3 inline-flex items-center gap-1" style={{ color: DS.warn }}>
                  <AlertTriangle className="w-3 h-3" /> Missing token
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <Btn onClick={onBack} disabled={typeof onBack !== "function"} variant="ghost">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Btn>
          <Btn
            onClick={onRefresh}
            disabled={loading || typeof onRefresh !== "function"}
            variant="ghost"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Btn>
          <Btn onClick={onLogout} disabled={typeof onLogout !== "function"} variant="ghost">
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </Btn>
          {canManageMembers && (
            <Btn onClick={onInvite} variant="primary">
              <UserPlus className="w-3.5 h-3.5" />
              Invite member
            </Btn>
          )}
        </div>
      </div>

      {/* ── Row 2: Filter chips + Search ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-3"
        style={{ borderBottom: `1px solid ${DS.border}` }}
      >
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            const count  = countFor(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors"
                style={{
                  backgroundColor: active ? DS.brand    : DS.pageBg,
                  border:          `1px solid ${active ? DS.brand : DS.border}`,
                  color:           active ? "#FFF"      : DS.labelText,
                }}
              >
                {label}
                <span
                  className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-black"
                  style={{
                    backgroundColor: active ? "rgba(255,255,255,0.2)" : DS.border,
                    color:           active ? "#FFF" : DS.dimText,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: DS.dimText }} />
          <input
            ref={searchRef}
            className="w-full pl-9 pr-8 py-2 text-sm outline-none transition-colors"
            style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.bodyText }}
            placeholder="Search name, email, role…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={loading}
            autoCapitalize="none"
            autoCorrect="off"
            onFocus={e  => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={e   => { e.currentTarget.style.borderColor = DS.border; }}
          />
          {search && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              onClick={() => onSearchChange("")}
              style={{ color: DS.dimText }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Banners ── */}
      {(errText || okText) && (
        <div className="px-6 py-3 space-y-2">
          {errText && (
            <Banner type="error">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errText}
            </Banner>
          )}
          {okText && (
            <Banner type="success">
              {okText}
            </Banner>
          )}
        </div>
      )}
    </div>
  );
}