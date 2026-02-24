"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Copy,
  Check,
  ChevronLeft,
  RefreshCcw,
  Pencil,
  ChevronDown,
  ChevronUp,
  Mail,
  KeyRound,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cx, fmtDateTime, shortToken, adherenceTone } from "./utils";
import { StatusPill } from "./ui";

function pillForAdherence(avg) {
  if (avg == null) return { tone: "neutral", text: "Adherence —" };
  if (avg >= 85) return { tone: "good", text: `Adherence ${avg}%` };
  if (avg >= 75) return { tone: "good", text: `Adherence ${avg}%` };
  if (avg >= 60) return { tone: "warn", text: `Adherence ${avg}%` };
  return { tone: "bad", text: `Adherence ${avg}%` };
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
    <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center shadow-sm">
      <span className="text-[12px] sm:text-sm font-extrabold text-gray-900">{initials || "A"}</span>
    </div>
  );
}

function DetailRow({ icon, label, value, action }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0 flex items-start gap-2">
        <span className="mt-0.5 text-gray-500">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="text-sm text-gray-800 break-words sm:truncate">{value || "—"}</p>
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
  const tone = useMemo(() => adherenceTone(latestAvg), [latestAvg]);
  const adherencePill = useMemo(() => pillForAdherence(latestAvg), [latestAvg]);

  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
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

  const titleName = (name || "Athlete").trim() || "Athlete";

  const handleRefresh = async () => {
    try {
      await onRefresh?.();
    } finally {
      setJustRefreshed(true);
    }
  };

  const detailsId = "athlete-profile-details";

  return (
    <div className="sticky top-0 z-30 pt-2">
      <div
        className={cx(
          "rounded-3xl border border-blue-100/70 bg-white/80 backdrop-blur-xl",
          "shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)]",
          justRefreshed && "ring-2 ring-[#46769B]/15"
        )}
      >
        {/* tighter mobile padding, same desktop */}
        <div className="p-4 sm:p-6">
          {/* top row */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <button
              onClick={onBack}
              type="button"
              className={cx(
                "inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold",
                "text-gray-700 hover:text-gray-900 hover:bg-gray-50",
                "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
              )}
              aria-label="Back to Nutrition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Nutrition</span>
              <span className="sm:hidden">Back</span>
            </button>

            {/* actions: allow wrapping on small screens */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={handleRefresh}
                type="button"
                className={cx(
                  "inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2.5",
                  "text-gray-800 hover:bg-gray-50",
                  "focus:outline-none focus:ring-2 focus:ring-gray-200"
                )}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCcw className={cx("h-4 w-4", justRefreshed && "animate-spin")} />
              </button>

              <button
                onClick={onEditPlan}
                type="button"
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl bg-[#46769B] px-3.5 py-2.5",
                  "text-sm font-semibold text-white hover:brightness-110",
                  "focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
                )}
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">{hasPlan ? "Edit Plan" : "Create Plan"}</span>
                <span className="sm:hidden">{hasPlan ? "Edit" : "Create"}</span>
              </button>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5",
                  "text-sm font-semibold text-gray-800 hover:bg-gray-50",
                  "focus:outline-none focus:ring-2 focus:ring-gray-200"
                )}
                aria-expanded={open}
                aria-controls={detailsId}
              >
                <span>Details</span>
                {open ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {/* identity + key pills */}
          <div className="mt-4 flex items-start gap-3">
            <Initials name={titleName} />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-[28px] font-extrabold tracking-tight text-gray-900 truncate">
                {titleName}
              </h1>

              {/* pills: tighter gap on mobile */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill tone={hasPlan ? "good" : "bad"} text={hasPlan ? "Plan Active" : "Plan Missing"} />
                <StatusPill
                  tone={!missedThisWeek ? "good" : "warn"}
                  text={!missedThisWeek ? "Completion Recent" : "Completion Missing/Old"}
                />
                <StatusPill tone={adherencePill.tone} text={adherencePill.text} />
              </div>

              {/* keep the helper line from wrapping weirdly */}
              {latestAvg != null ? (
                <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                  Signal:{" "}
                  <span className="font-semibold text-gray-700">
                    {tone === "good" ? "Good" : tone === "bad" ? "At risk" : "Neutral"}
                  </span>
                  <span className="text-gray-400"> • </span>
                  <span className="text-gray-500">Use completions to adjust meal rules.</span>
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                  Tip: As swipes come in, adherence will populate automatically.
                </p>
              )}
            </div>
          </div>

          {/* details panel (collapsible) */}
          <div
            id={detailsId}
            className={cx(
              "mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white/70 transition-all",
              open ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0"
            )}
            aria-hidden={!open}
          >
            {/* header wraps on mobile so the link doesn’t smash the title */}
            <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600">
                Profile details
              </p>

              <button
                type="button"
                onClick={onEditPlan}
                className={cx(
                  "inline-flex items-center gap-1.5 text-[11px] font-semibold",
                  "text-[#46769B] hover:underline",
                  "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25 rounded"
                )}
                title="Open plan editor"
              >
                Open plan editor <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-4 py-2">
              <DetailRow
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={email ? String(email).trim() : "No email on file"}
              />

              <DetailRow
                icon={<KeyRound className="h-4 w-4" />}
                label="AthleteToken"
                value={token ? shortToken(token) : "—"}
                action={
                  token ? (
                    <button
                      onClick={copyToken}
                      type="button"
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold",
                        "bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200",
                        copied ? "border-emerald-200 text-emerald-800" : "border-gray-200 text-gray-800"
                      )}
                      title="Copy AthleteToken"
                      aria-label="Copy AthleteToken"
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

          {/* subtle divider */}
          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
        </div>
      </div>
    </div>
  );
}