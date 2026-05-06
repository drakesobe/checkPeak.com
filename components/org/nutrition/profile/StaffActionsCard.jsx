// components/org/nutrition/profile/StaffActionsCard.jsx
"use client";

import { useMemo, useState } from "react";
import { Mail, Check, Copy } from "lucide-react";
import { DS } from "./ui";
import { clampPct, fmtIsoToNice } from "./utils";

function buildMailto({ email, name, missedThisWeek, lastCheckinAt }) {
  const to = String(email || "").trim();
  if (!to) return "";
  const subject = missedThisWeek
    ? "Quick nutrition completion check-in"
    : "Nutrition - quick update";
  const last = lastCheckinAt ? fmtIsoToNice(lastCheckinAt) : "-";
  const body = missedThisWeek
    ? `Hey ${name || ""},\n\nQuick nudge - I'm not seeing a recent nutrition completion.\n\nLast completion: ${last}\n\nWhen you get a chance, please knock out your Meal + Hydration swipes for today.\n\nThanks!`
    : `Hey ${name || ""},\n\nNice work staying consistent - your completions look current.\n\nLast completion: ${last}\n\nIf anything feels hard to follow in the dining hall, reply with what's tripping you up and I'll simplify the rule.\n\nThanks!`;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function StatusRow({ label, ok, detail }) {
  const color  = ok ? DS.safe   : DS.caution;
  const bg     = ok ? DS.safeBg : DS.cautionBg;
  const border = ok ? DS.safeBorder : DS.cautionBorder;

  return (
    <div
      className="flex items-start justify-between gap-3 p-3 mt-3"
      style={{ backgroundColor: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${color}` }}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color }}>
          {label}
        </p>
        {detail && (
          <p className="text-xs mt-0.5" style={{ color: ok ? DS.safe : DS.caution }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

export function StaffActionsCard({
  loading,
  error,
  missedThisWeek,
  lastCheckinAt,
  daysAgo,
  athleteName,
  athleteEmail,
  latestAvg,
}) {
  if (loading || error) return null;

  const avg = useMemo(() => clampPct(latestAvg), [latestAvg]);

  const adherenceColor =
    avg == null      ? DS.dimText
    : avg >= 80      ? DS.safe
    : avg >= 60      ? DS.caution
    : DS.banned;

  const daysAgoNice = daysAgo != null ? `${Math.round(daysAgo)}d ago` : "";

  const mailto = useMemo(
    () => buildMailto({ email: athleteEmail, name: athleteName, missedThisWeek, lastCheckinAt }),
    [athleteEmail, athleteName, missedThisWeek, lastCheckinAt]
  );

  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyEmail = async () => {
    if (!athleteEmail) return;
    try {
      await navigator.clipboard.writeText(String(athleteEmail).trim());
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1200);
    } catch {}
  };

  return (
    <section
      style={{
        border: `1px solid ${DS.border}`,
        borderTop: `3px solid ${DS.brand}`,
        backgroundColor: DS.cardBg,
      }}
    >
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

          {/* Status summary */}
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Staff Actions
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {avg != null && (
                <span
                  className="px-2 py-0.5 text-xs font-bold rounded-sm"
                  style={{ color: adherenceColor, border: `1px solid ${adherenceColor}20`, backgroundColor: `${adherenceColor}10` }}
                >
                  Adherence {avg}%
                </span>
              )}
              <span
                className="px-2 py-0.5 text-xs font-bold rounded-sm"
                style={!missedThisWeek
                  ? { backgroundColor: DS.safeBg,    color: DS.safe,    border: `1px solid ${DS.safeBorder}`    }
                  : { backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }
                }
              >
                {!missedThisWeek ? "Check-in current" : "Check-in missing"}
              </span>
            </div>

            <p className="mt-1.5 text-xs" style={{ color: DS.dimText }}>
              Quick nudge if needed, or use the email button to reach out directly.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={mailto || "#"}
              onClick={(e) => { if (!mailto) e.preventDefault(); }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
              style={{
                backgroundColor: mailto ? DS.brand : DS.pageBg,
                color:           mailto ? "#fff"   : DS.dimText,
                cursor:          mailto ? "pointer" : "not-allowed",
                border:          `1px solid ${mailto ? DS.brand : DS.border}`,
              }}
              title={mailto ? "Email athlete" : "No athlete email on file"}
              onMouseEnter={(e) => { if (mailto) e.currentTarget.style.backgroundColor = DS.brandLight; }}
              onMouseLeave={(e) => { if (mailto) e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              <Mail className="h-3.5 w-3.5" />
              Email athlete
            </a>

            {athleteEmail && (
              <button
                type="button"
                onClick={copyEmail}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-sm transition-all"
                style={{
                  border: `1px solid ${copiedEmail ? DS.safeBorder : DS.border}`,
                  backgroundColor: DS.cardBg,
                  color: copiedEmail ? DS.safe : DS.labelText,
                }}
                title="Copy athlete email"
                onMouseEnter={(e) => { if (!copiedEmail) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
                onMouseLeave={(e) => { if (!copiedEmail) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; } }}
              >
                {copiedEmail ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{copiedEmail ? "Copied" : "Copy email"}</span>
                <span className="sm:hidden">{copiedEmail ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status notice */}
        {missedThisWeek ? (
          <StatusRow
            ok={false}
            label="Completion missing or outdated"
            detail={`Last: ${lastCheckinAt ? fmtIsoToNice(lastCheckinAt) : "None yet"}${daysAgoNice ? ` · ${daysAgoNice}` : ""}`}
          />
        ) : (
          <StatusRow
            ok={true}
            label="Completion current"
            detail={`Last: ${lastCheckinAt ? fmtIsoToNice(lastCheckinAt) : "-"}`}
          />
        )}

        <div className="mt-4 h-px w-full" style={{ backgroundColor: DS.border }} />
      </div>
    </section>
  );
}