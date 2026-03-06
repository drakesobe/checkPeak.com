// components/org/dashboard/DashboardHeader.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  RefreshCcw, CalendarDays, Download, LogOut,
  Link as LinkIcon, KeyRound, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, UserCircle2, Copy, ExternalLink,
} from "lucide-react";

import { DS, Button, CopyButton } from "@/components/org/dashboard/DashboardUI";

export default function DashboardHeader({
  orgName, orgEmail, orgToken, orgId, inviteLink,
  loading, error, onRefresh, onOpenCalendar, onExportCSV, disableExport, onLogout,
}) {
  const tokenOk = Boolean(String(orgToken || "").trim());
  const orgIdOk = Boolean(String(orgId   || "").trim());

  const [inviteOpen, setInviteOpen] = useState(!tokenOk);
  useEffect(() => { if (!tokenOk) setInviteOpen(true); }, [tokenOk]);

  const [copied, setCopied] = useState("");
  const flashCopied = useCallback((key) => {
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  }, []);

  const status = useMemo(() => {
    if (tokenOk && orgIdOk) return { tone: "good", text: "Session OK" };
    if (!tokenOk)           return { tone: "warn", text: "Token missing" };
    return                         { tone: "warn", text: "OrgId missing" };
  }, [tokenOk, orgIdOk]);

  return (
    <div
      style={{
        backgroundColor: DS.brand,
        borderTop: `3px solid ${DS.brandLight}`,
      }}
    >
      {/* ── Top bar ── */}
      <div className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          {/* Org name */}
          <h1 className="text-xl font-black uppercase tracking-wide text-white truncate">
            {orgName}
          </h1>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <UserCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                {orgEmail}
              </p>
            </div>

            {/* Session status pill */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-sm"
              style={{
                backgroundColor: status.tone === "good" ? "rgba(0,135,62,0.2)" : "rgba(184,96,0,0.2)",
                color:           status.tone === "good" ? "#A8DFB8"            : "#FFD580",
                border:          `1px solid ${status.tone === "good" ? "rgba(168,223,184,0.3)" : "rgba(255,213,128,0.3)"}`,
              }}
            >
              {status.tone === "good"
                ? <CheckCircle2 className="w-3 h-3" />
                : <AlertTriangle className="w-3 h-3" />
              }
              {status.text}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; }}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={onOpenCalendar}
            title="Calendar"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; }}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Calendar
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            disabled={disableExport}
            title={disableExport ? "No roster loaded" : "Export CSV"}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              backgroundColor: "rgba(255,255,255,0.1)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              opacity: disableExport ? 0.4 : 1,
              cursor: disableExport ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!disableExport) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{ backgroundColor: "rgba(200,16,46,0.3)", color: "#fff", border: "1px solid rgba(200,16,46,0.4)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(200,16,46,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(200,16,46,0.3)"; }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </div>

      {/* ── Invite collapsible ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <button
          type="button"
          onClick={() => setInviteOpen((v) => !v)}
          className="w-full text-left px-5 py-3 flex items-center justify-between gap-3 transition-all"
          style={{ backgroundColor: inviteOpen ? "rgba(0,0,0,0.15)" : "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = inviteOpen ? "rgba(0,0,0,0.15)" : "transparent"; }}
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
            <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
              Invite athletes
            </p>
            {!tokenOk && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: "rgba(184,96,0,0.3)", color: "#FFD580", border: "1px solid rgba(255,213,128,0.2)" }}>
                Needs attention
              </span>
            )}
          </div>
          {inviteOpen
            ? <ChevronUp  className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
            : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
          }
        </button>

        {inviteOpen && (
          <div className="px-5 pb-4" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-3">
              {/* Token */}
              <div className="p-3 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Organization token</p>
                <p className="font-mono text-xs font-semibold break-all" style={{ color: "#fff" }}>
                  {orgToken || "— missing —"}
                </p>
                <div className="mt-2">
                  <CopyButton text={orgToken} label="Copy token" compact onClick={() => flashCopied("token")} />
                </div>
              </div>

              {/* Link */}
              <div className="p-3 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Signup link</p>
                  <LinkIcon className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} />
                </div>
                <p className="font-mono text-xs font-semibold break-all" style={{ color: "#fff" }}>
                  {inviteLink || "—"}
                </p>
                <div className="mt-2 flex gap-2">
                  <CopyButton text={inviteLink} label="Copy link" compact onClick={() => flashCopied("link")} />
                  {inviteLink && (
                    <a
                      href={inviteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
                      style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  )}
                </div>
              </div>
            </div>

            {!tokenOk && (
              <div className="mt-3 p-3 rounded-sm" style={{ backgroundColor: "rgba(184,96,0,0.2)", border: "1px solid rgba(255,213,128,0.2)" }}>
                <p className="text-xs font-bold" style={{ color: "#FFD580" }}>Token missing from session</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,213,128,0.7)" }}>
                  Log out and back in to refresh your session cookie. Confirm lookupUser sets Token from the linked Organization record.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="px-5 py-3 text-xs font-bold"
          style={{ backgroundColor: "rgba(200,16,46,0.2)", color: "#FFC8C8", borderTop: "1px solid rgba(200,16,46,0.3)" }}
        >
          {error} — try refreshing or logging out.
        </div>
      )}
    </div>
  );
}