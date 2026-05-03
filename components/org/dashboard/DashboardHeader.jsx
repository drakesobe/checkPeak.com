// components/org/workouts-calendar/DashboardHeader.jsx
"use client";

import {
  RefreshCcw, CalendarDays, Download, LogOut,
  CheckCircle2, AlertTriangle, UserCircle2, KeyRound,
} from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

export default function DashboardHeader({
  orgName, orgEmail, orgToken, orgId,
  loading, error,
  onRefresh, onOpenCalendar, onExportCSV, disableExport, onLogout,
  onGoInvite,
}) {
  const tokenOk   = Boolean(String(orgToken || "").trim());
  const orgIdOk   = Boolean(String(orgId    || "").trim());
  const sessionOk = tokenOk && orgIdOk;

  function ghostBtn(danger = false) {
    return {
      display:         "inline-flex",
      alignItems:      "center",
      gap:             "5px",
      padding:         "6px 10px",
      fontSize:        "11px",
      fontWeight:      900,
      textTransform:   "uppercase",
      letterSpacing:   "0.07em",
      border:          danger
        ? "1px solid rgba(200,16,46,0.4)"
        : "1px solid rgba(255,255,255,0.2)",
      backgroundColor: danger
        ? "rgba(200,16,46,0.25)"
        : "rgba(255,255,255,0.08)",
      color:           "#fff",
      cursor:          "pointer",
      transition:      "background-color 0.15s",
      whiteSpace:      "nowrap",
    };
  }

  function ghostBtnHover(el, danger = false) {
    el.style.backgroundColor = danger
      ? "rgba(200,16,46,0.45)"
      : "rgba(255,255,255,0.18)";
  }
  function ghostBtnLeave(el, danger = false) {
    el.style.backgroundColor = danger
      ? "rgba(200,16,46,0.25)"
      : "rgba(255,255,255,0.08)";
  }

  return (
    <div style={{ backgroundColor: DS.brand }}>

      {/* ── Main bar ── */}
      <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">

        {/* Identity — always visible */}
        <div className="min-w-0 flex items-center gap-3">
          <div className="min-w-0">
            <h1
              className="text-base font-black uppercase tracking-wide truncate"
              style={{ color: "#fff" }}
            >
              {orgName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <UserCircle2 className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
              <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                {orgEmail}
              </p>
              {/* Session pill */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: sessionOk
                    ? "rgba(0,135,62,0.18)"
                    : "rgba(184,96,0,0.25)",
                  color:  sessionOk ? "#A8DFB8" : "#FFD580",
                  border: `1px solid ${sessionOk
                    ? "rgba(168,223,184,0.25)"
                    : "rgba(255,213,128,0.25)"}`,
                }}
              >
                {sessionOk
                  ? <CheckCircle2  className="w-2.5 h-2.5" />
                  : <AlertTriangle className="w-2.5 h-2.5" />
                }
                {sessionOk ? "OK" : "Session partial"}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons — ALL hidden on mobile, full row on sm+ */}
        <div className="hidden sm:flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            style={{ ...ghostBtn(), opacity: loading ? 0.5 : 1 }}
            onMouseEnter={(e) => ghostBtnHover(e.currentTarget)}
            onMouseLeave={(e) => ghostBtnLeave(e.currentTarget)}
          >
            <RefreshCcw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={onOpenCalendar}
            style={ghostBtn()}
            onMouseEnter={(e) => ghostBtnHover(e.currentTarget)}
            onMouseLeave={(e) => ghostBtnLeave(e.currentTarget)}
          >
            <CalendarDays className="w-3 h-3" />
            Calendar
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            disabled={disableExport}
            style={{ ...ghostBtn(), opacity: disableExport ? 0.4 : 1 }}
            onMouseEnter={(e) => { if (!disableExport) ghostBtnHover(e.currentTarget); }}
            onMouseLeave={(e) => ghostBtnLeave(e.currentTarget)}
          >
            <Download className="w-3 h-3" />
            Export
          </button>

          {onGoInvite && (
            <button
              type="button"
              onClick={onGoInvite}
              style={ghostBtn()}
              onMouseEnter={(e) => ghostBtnHover(e.currentTarget)}
              onMouseLeave={(e) => ghostBtnLeave(e.currentTarget)}
            >
              <KeyRound className="w-3 h-3" />
              Invite
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            style={ghostBtn(true)}
            onMouseEnter={(e) => ghostBtnHover(e.currentTarget, true)}
            onMouseLeave={(e) => ghostBtnLeave(e.currentTarget, true)}
          >
            <LogOut className="w-3 h-3" />
            Log out
          </button>
        </div>

        {/* Mobile-only: single logout icon so users aren't totally stranded */}
        <button
          type="button"
          onClick={onLogout}
          className="sm:hidden p-1.5 shrink-0"
          style={{
            border:          "1px solid rgba(200,16,46,0.4)",
            backgroundColor: "rgba(200,16,46,0.25)",
            color:           "#fff",
          }}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Error stripe ── */}
      {error && (
        <div
          className="px-4 sm:px-5 py-2 text-xs font-bold"
          style={{
            backgroundColor: "rgba(200,16,46,0.25)",
            color:           "#FFC8C8",
            borderTop:       "1px solid rgba(200,16,46,0.3)",
          }}
        >
          {error} — try refreshing or logging out.
        </div>
      )}
    </div>
  );
}