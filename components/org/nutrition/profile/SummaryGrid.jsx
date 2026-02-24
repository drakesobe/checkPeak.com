"use client";

import { useMemo } from "react";
import { Calendar, Activity, FileText } from "lucide-react";
import { fmtDateTime, adherenceTone } from "./utils";
import { SummaryCard, StatusPill } from "./ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function weekLabel(weekStartISO) {
  const iso = String(weekStartISO || "").trim();
  if (!iso) return "—";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  try {
    const nice = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(d);

    return `Week of ${nice}`;
  } catch {
    return iso;
  }
}

function adherenceSubtitle(avg) {
  if (avg == null) return "Waiting for first completion";
  if (avg >= 85) return "Excellent consistency";
  if (avg >= 75) return "On track";
  if (avg >= 60) return "Needs attention";
  return "Adjustments needed";
}

function adherencePillTone(avg) {
  if (avg == null) return "neutral";
  if (avg >= 75) return "good";
  if (avg >= 60) return "warn";
  return "bad";
}

function adherencePillText(avg) {
  if (avg == null) return "No data";
  if (avg >= 85) return "Excellent";
  if (avg >= 75) return "On track";
  if (avg >= 60) return "Watch";
  return "Critical";
}

function toneToCardTone(avg) {
  const t = adherenceTone(avg);
  if (t === "good" || t === "bad") return t;
  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function SummaryGrid({ latestCheckin, latestAvg, plan, hasPlan }) {
  const latestWeekText = useMemo(
    () => weekLabel(latestCheckin?.weekStartISO),
    [latestCheckin?.weekStartISO]
  );

  const latestCheckinSub = useMemo(() => {
    if (latestCheckin?.createdAt) return `Updated ${fmtDateTime(latestCheckin.createdAt)} ET`;
    return "No completions yet";
  }, [latestCheckin?.createdAt]);

  const adherenceValue = useMemo(() => {
    if (latestAvg == null) return "—";
    return `${latestAvg}%`;
  }, [latestAvg]);

  const adherenceCardTone = useMemo(() => toneToCardTone(latestAvg), [latestAvg]);

  const adherencePill = useMemo(() => {
    const t = adherencePillTone(latestAvg);
    return <StatusPill tone={t} text={adherencePillText(latestAvg)} />;
  }, [latestAvg]);

  const planSub = useMemo(() => {
    if (plan?.createdAt) return `Updated ${fmtDateTime(plan.createdAt)} ET`;
    return "No plan assigned yet";
  }, [plan?.createdAt]);

  const planPill = useMemo(() => {
    const t = hasPlan ? "good" : "bad";
    return <StatusPill tone={t} text={hasPlan ? "Active" : "Missing"} />;
  }, [hasPlan]);

  const checkinPill = useMemo(() => {
    const ok = Boolean(latestCheckin?.createdAt);
    return <StatusPill tone={ok ? "good" : "neutral"} text={ok ? "Current" : "None"} />;
  }, [latestCheckin?.createdAt]);

  return (
    <div className="grid gap-4 sm:grid-cols-3 font-sans">
      <SummaryCard
        title="Latest Completion"
        value={latestWeekText}
        sub={latestCheckinSub}
        tone={latestCheckin?.createdAt ? "good" : "neutral"}
        right={
          <div className="inline-flex items-center gap-2">
            <span className="hidden sm:inline-flex h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 items-center justify-center">
              <Calendar className="h-4 w-4 text-gray-700" />
            </span>
            {checkinPill}
          </div>
        }
      />

      <SummaryCard
        title="Adherence"
        value={adherenceValue}
        sub={adherenceSubtitle(latestAvg)}
        tone={adherenceCardTone}
        right={
          <div className="inline-flex items-center gap-2">
            <span className="hidden sm:inline-flex h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 items-center justify-center">
              <Activity className="h-4 w-4 text-gray-700" />
            </span>
            {adherencePill}
          </div>
        }
      />

      <SummaryCard
        title="Plan"
        value={hasPlan ? "Active" : "Missing"}
        sub={planSub}
        tone={hasPlan ? "good" : "bad"}
        right={
          <div className="inline-flex items-center gap-2">
            <span className="hidden sm:inline-flex h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 items-center justify-center">
              <FileText className="h-4 w-4 text-gray-700" />
            </span>
            {planPill}
          </div>
        }
      />
    </div>
  );
}