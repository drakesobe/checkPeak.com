"use client";

import { useMemo, useState } from "react";
import { cx, fmtDateTime, shortToken, adherenceTone } from "./utils";
import { StatusPill } from "./ui";

function pillForAdherence(avg) {
  if (avg == null) return { tone: "neutral", text: "Adherence —" };
  if (avg >= 85) return { tone: "good", text: `Adherence ${avg}%` };
  if (avg >= 75) return { tone: "good", text: `Adherence ${avg}%` };
  if (avg >= 60) return { tone: "warn", text: `Adherence ${avg}%` };
  return { tone: "bad", text: `Adherence ${avg}%` };
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

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const titleName = (name || "Athlete").trim() || "Athlete";

  return (
    <div className="sticky top-0 z-20 pt-2">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-md border border-blue-100 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left */}
          <div className="min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={onBack}
                className="font-semibold text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded-md px-1 -mx-1"
                type="button"
                aria-label="Back to Nutrition Queue"
              >
                ← Nutrition
              </button>
              <span className="text-gray-300">/</span>
              <span className="text-gray-500">Athlete Profile</span>
            </div>

            {/* Name */}
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight truncate text-gray-900">
              {titleName}
            </h1>

            {/* Meta */}
            <div className="mt-1 space-y-1">
              {email ? (
                <p className="text-sm text-gray-600 truncate">{email}</p>
              ) : (
                <p className="text-sm text-gray-400">No email on file</p>
              )}

              {token ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-gray-500 truncate">
                    AthleteToken:{" "}
                    <span className="font-semibold text-gray-700">{shortToken(token)}</span>
                  </p>

                  <button
                    onClick={copyToken}
                    type="button"
                    className={cx(
                      "text-[11px] px-2 py-1 rounded-lg border font-semibold",
                      "bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200",
                      copied ? "border-emerald-200 text-emerald-800" : "border-gray-200 text-gray-800"
                    )}
                    title="Copy AthleteToken"
                    aria-label="Copy AthleteToken"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : null}

              <p className="text-[11px] text-gray-500">
                {lastLoadedAt ? `Last updated ${fmtDateTime(lastLoadedAt)} ET` : " "}
              </p>
            </div>

            {/* Pills */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={hasPlan ? "good" : "bad"} text={hasPlan ? "Plan Active" : "Plan Missing"} />

              <StatusPill
                tone={!missedThisWeek ? "good" : "warn"}
                text={!missedThisWeek ? "Check-in Recent" : "Check-in Missing/Old"}
              />

              <StatusPill tone={adherencePill.tone} text={adherencePill.text} />
            </div>

            {/* Subtle context line */}
            {latestAvg != null ? (
              <p className="mt-2 text-[11px] text-gray-500">
                Adherence signal:{" "}
                <span className="font-semibold text-gray-700">
                  {tone === "good" ? "Good" : tone === "bad" ? "At risk" : "Neutral"}
                </span>
              </p>
            ) : null}
          </div>

          {/* Right actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRefresh}
              className={cx(
                "px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold",
                "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              )}
              type="button"
            >
              Refresh
            </button>

            <button
              onClick={onEditPlan}
              className={cx(
                "px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold",
                "hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              )}
              type="button"
            >
              {hasPlan ? "Edit Plan" : "Create Plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
