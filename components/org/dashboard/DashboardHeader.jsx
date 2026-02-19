// components/org/dashboard/DashboardHeader.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  LayoutDashboard,
  RefreshCcw,
  CalendarDays,
  Download,
  LogOut,
  Link as LinkIcon,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserCircle2,
  Copy,
  ExternalLink,
} from "lucide-react";

import { Button, CopyButton, Pill } from "@/components/org/dashboard/DashboardUI";

/**
 * DashboardHeader (professional, simplified)
 * ✅ clear hierarchy (title → meta → actions)
 * ✅ compact + readable status indicator
 * ✅ invite section collapsible to reduce visual weight
 * ✅ mobile-safe layout + wrapping
 * ✅ optional "copied" micro-feedback without extra dependencies
 *
 * Notes:
 * - Invite section defaults to open if token is missing; otherwise collapsed.
 * - Keeps the CopyButton component you already have.
 */
export default function DashboardHeader({
  orgName,
  orgEmail,
  orgToken,
  orgId,
  inviteLink,
  triageHeadline,
  loading,
  error,
  onRefresh,
  onOpenCalendar,
  onExportCSV,
  disableExport,
  onLogout,
}) {
  const tokenOk = Boolean(String(orgToken || "").trim());
  const orgIdOk = Boolean(String(orgId || "").trim());

  // Collapsible invite panel:
  // - If token is missing, open by default (action required).
  // - If token exists, default collapsed (less noise).
  const [inviteOpen, setInviteOpen] = useState(!tokenOk);

  useEffect(() => {
    // If token flips to missing, force open so user sees what to do.
    if (!tokenOk) setInviteOpen(true);
  }, [tokenOk]);

  // micro “Copied” feedback (in addition to whatever CopyButton does)
  const [copied, setCopied] = useState("");
  const flashCopied = useCallback((key) => {
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  }, []);

  const status = useMemo(() => {
    /**
     * Keep it short. This is meant to be scanned, not read.
     * "Billing OK" lives here because this header is only rendered post-gate.
     */
    if (tokenOk && orgIdOk) return { tone: "good", text: "Session OK • Billing OK" };
    if (!tokenOk && !orgIdOk) return { tone: "warn", text: "Session partial • Missing token + orgId" };
    if (!tokenOk) return { tone: "warn", text: "Session partial • Missing token" };
    return { tone: "warn", text: "Session partial • Missing orgId" };
  }, [tokenOk, orgIdOk]);

  const inviteSummary = useMemo(() => {
    if (!tokenOk) return "Action needed: add token to session";
    return "Token + signup link ready";
  }, [tokenOk]);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      {/* Header: title/meta + actions */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-[#46769B]" />
            <h1 className="text-2xl font-extrabold truncate">{orgName}</h1>
          </div>

          {/* Meta row */}
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <UserCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
              <p className="text-sm text-gray-600 break-all">
                Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>
            </div>

            <div className="hidden sm:block w-1 h-1 rounded-full bg-gray-300" />

            <Pill tone={status.tone}>
              {status.tone === "good" ? (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              )}
              {status.text}
            </Pill>
          </div>

          {/* Triage line */}
          {triageHeadline ? (
            <p className="mt-2 text-[12px] text-gray-600">
              <span className="font-semibold text-gray-900">Triage:</span> {triageHeadline}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={loading}
            className="w-full sm:w-auto"
            title="Refresh dashboard data"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="secondary"
            onClick={onOpenCalendar}
            className="w-full sm:w-auto"
            title="Open workouts calendar"
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </Button>

          <Button
            variant="secondary"
            onClick={onExportCSV}
            disabled={disableExport}
            className="w-full sm:w-auto"
            title={disableExport ? "No roster loaded to export" : "Export roster to CSV"}
          >
            <Download className="w-4 h-4" />
            Export
          </Button>

          <Button variant="dark" onClick={onLogout} className="w-full sm:w-auto" title="Log out of org dashboard">
            <LogOut className="w-4 h-4" />
            Log out
          </Button>
        </div>
      </div>

      {/* Invite (collapsible) */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
        {/* Invite header row */}
        <button
          type="button"
          onClick={() => setInviteOpen((v) => !v)}
          className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/80"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gray-500 shrink-0" />
              <p className="text-sm font-extrabold text-gray-900">Invite athletes</p>
              <span className="text-xs text-gray-500 hidden sm:inline">• {inviteSummary}</span>
              {!tokenOk ? (
                <span className="ml-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  Needs attention
                </span>
              ) : null}
            </div>

            <p className="text-[12px] text-gray-600 mt-0.5 sm:hidden">{inviteSummary}</p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[11px] text-gray-500 hidden sm:inline">
              {inviteOpen ? "Hide" : "Show"}
            </span>
            {inviteOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </button>

        {/* Invite body */}
        {inviteOpen ? (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Token card */}
              <div className="lg:col-span-5 rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500">Organization token</p>
                  <div className="flex items-center gap-2">
                    {copied === "token" ? (
                      <span className="text-[11px] font-semibold text-emerald-700">Copied</span>
                    ) : null}
                    <span className="text-[11px] text-gray-400">Used for athlete signup</span>
                  </div>
                </div>

                <p className="font-mono text-xs font-semibold break-all mt-1">
                  {orgToken || "— missing Token —"}
                </p>

                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <CopyButton
                    text={orgToken}
                    label="Copy token"
                    compact
                    onClick={() => flashCopied("token")}
                    icon={<Copy className="w-4 h-4" />}
                  />
                </div>
              </div>

              {/* Link card */}
              <div className="lg:col-span-7 rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500">Signup link</p>
                  <div className="flex items-center gap-2">
                    {copied === "link" ? (
                      <span className="text-[11px] font-semibold text-emerald-700">Copied</span>
                    ) : null}
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <p className="font-mono text-xs font-semibold break-all mt-1">{inviteLink || "—"}</p>

                <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                  <CopyButton
                    text={inviteLink}
                    label="Copy link"
                    compact
                    onClick={() => flashCopied("link")}
                    icon={<Copy className="w-4 h-4" />}
                  />

                  {inviteLink ? (
                    <a
                      href={inviteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      title="Open signup link in a new tab"
                    >
                      <ExternalLink className="w-4 h-4 mr-1.5" />
                      Open
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Missing token helper */}
            {!tokenOk ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-900">Token missing from session</p>
                <p className="text-[12px] text-amber-800 mt-1">
                  Invite links require the org token. Log out and back in to refresh your session cookie. If you’re a
                  trainer/admin, make sure lookupUser sets <span className="font-semibold">Token</span> from the linked
                  Organization record.
                </p>
              </div>
            ) : null}

            {/* orgId warning (legacy sessions) */}
            {!orgIdOk ? (
              <div className="mt-2 rounded-xl border border-gray-200 bg-gray-100 p-3">
                <p className="text-sm font-semibold text-gray-900">orgId missing (legacy session)</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  This usually means the session cookie was created before the orgId field was added. Logging out and
                  back in should refresh it.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Loading + error messages */}
      {loading ? (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-gray-800 font-semibold">Loading organization overview…</p>
          <p className="text-[11px] text-gray-600 mt-1">Pulling roster + plan status in one request.</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{error}</p>
          <p className="text-[11px] text-red-600 mt-1">
            If this persists, log out and back in to refresh your session cookie.
          </p>
        </div>
      ) : null}
    </div>
  );
}
