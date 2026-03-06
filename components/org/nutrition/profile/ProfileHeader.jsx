// components/org/nutrition/profile/ProfileHeader.jsx
"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Copy, Check, ChevronLeft, RefreshCw,
  Pencil, ChevronDown, ChevronUp,
  Mail, KeyRound, Clock, ExternalLink,
} from "lucide-react";
import { fmtDateTime, shortToken, adherenceTone } from "./utils";
import { StatusPill, DS } from "./ui";

function pillForAdherence(avg) {
  if (avg == null) return { tone: "neutral", text: "Adherence —" };
  if (avg >= 75)   return { tone: "good",    text: `Adherence ${avg}%` };
  if (avg >= 60)   return { tone: "warn",    text: `Adherence ${avg}%` };
  return                   { tone: "bad",    text: `Adherence ${avg}%` };
}

function Initials({ name }) {
  const initials = String(name || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .filter(Boolean)
    .join("");

  return (
    <div
      className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center"
      style={{ border: `2px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg }}
    >
      <span className="text-sm font-black" style={{ color: DS.brand }}>
        {initials || "A"}
      </span>
    </div>
  );
}

function DetailRow({ icon, label, value, action }) {
  return (
    <div
      className="flex items-start justify-between gap-3 py-2.5"
      style={{ borderBottom: `1px solid ${DS.border}` }}
    >
      <div className="min-w-0 flex items-start gap-2">
        <span style={{ color: DS.dimText, marginTop: 2 }}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>
            {label}
          </p>
          <p className="text-sm mt-0.5 break-words" style={{ color: DS.bodyText }}>
            {value || "—"}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ProfileHeader({
  name,
  email,
  token,
  lastLoadedAt,
  hasPlan,
  missedThisWeek,
  latestAvg,
  onBack,
  onRefresh,
  onEditPlan,
}) {
  const adherencePill = useMemo(() => pillForAdherence(latestAvg), [latestAvg]);
  const tone = useMemo(() => adherenceTone(latestAvg), [latestAvg]);

  const [copied,        setCopied]        = useState(false);
  const [open,          setOpen]          = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  useEffect(() => {
    if (!justRefreshed) return;
    const t = window.setTimeout(() => setJustRefreshed(false), 900);
    return () => window.clearTimeout(t);
  }, [justRefreshed]);

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const handleRefresh = async () => {
    try { await onRefresh?.(); }
    finally { setJustRefreshed(true); }
  };

  const titleName  = (name || "Athlete").trim() || "Athlete";
  const detailsId  = "athlete-profile-details";

  return (
    <div className="sticky top-0 z-30">
      {/* ── Nav bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 gap-4"
        style={{ backgroundColor: DS.brand }}
      >
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-bold transition-all"
          style={{ color: "rgba(255,255,255,0.6)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Nutrition Queue</span>
          <span className="sm:hidden">Back</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            type="button"
            className="inline-flex items-center justify-center p-2 rounded-sm transition-all"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${justRefreshed ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={onEditPlan}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)"; }}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{hasPlan ? "Edit Plan" : "Create Plan"}</span>
            <span className="sm:hidden">{hasPlan ? "Edit" : "Create"}</span>
          </button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all"
            style={{
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            aria-expanded={open}
            aria-controls={detailsId}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >
            Details
            {open
              ? <ChevronUp   className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>

      {/* ── Identity card ── */}
      <div
        className="px-4 py-4"
        style={{ backgroundColor: DS.cardBg, borderBottom: `1px solid ${DS.border}` }}
      >
        <div className="flex items-start gap-3">
          <Initials name={titleName} />

          <div className="min-w-0 flex-1">
            <h1
              className="font-black tracking-tight truncate"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "1.5rem",
                color: DS.bodyText,
              }}
            >
              {titleName}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={hasPlan ? "good" : "bad"} text={hasPlan ? "Plan Active" : "Plan Missing"} />
              <StatusPill
                tone={!missedThisWeek ? "good" : "warn"}
                text={!missedThisWeek ? "Check-in Current" : "Check-in Missing"}
              />
              <StatusPill tone={adherencePill.tone} text={adherencePill.text} />
            </div>

            <p className="mt-1.5 text-xs" style={{ color: DS.dimText }}>
              {latestAvg != null
                ? <>Signal: <span style={{ color: DS.bodyText, fontWeight: 700 }}>
                    {tone === "good" ? "Good" : tone === "bad" ? "At risk" : "Neutral"}
                  </span> · Use completions to adjust meal rules.</>
                : "Adherence will populate automatically as swipes come in."
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Collapsible details panel ── */}
      {open && (
        <div
          id={detailsId}
          style={{ backgroundColor: DS.brandBg, borderBottom: `1px solid ${DS.brandBorder}` }}
        >
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: `1px solid ${DS.brandBorder}` }}
          >
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.labelText }}>
              Profile details
            </p>
            <button
              type="button"
              onClick={onEditPlan}
              className="inline-flex items-center gap-1 text-xs font-bold"
              style={{ color: DS.brand }}
            >
              Open plan editor <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          <div className="px-4 py-1">
            <DetailRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={email ? String(email).trim() : "No email on file"}
            />
            <DetailRow
              icon={<KeyRound className="h-4 w-4" />}
              label="Athlete Token"
              value={token ? shortToken(token) : "—"}
              action={
                token ? (
                  <button
                    onClick={copyToken}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded-sm transition-all"
                    style={{
                      border: `1px solid ${copied ? DS.safeBorder : DS.border}`,
                      color: copied ? DS.safe : DS.labelText,
                      backgroundColor: DS.cardBg,
                    }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                ) : null
              }
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="Last refreshed"
              value={lastLoadedAt ? `${fmtDateTime(lastLoadedAt)} ET` : "—"}
            />
          </div>
        </div>
      )}
    </div>
  );
}