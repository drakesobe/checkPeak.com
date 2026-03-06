// components/org/nutrition/profile/SummaryGrid.jsx
"use client";

import { useMemo } from "react";
import { Calendar, Activity, FileText } from "lucide-react";
import { fmtDateTime, adherenceTone } from "./utils";
import { SummaryCard, StatusPill, DS } from "./ui";

function weekLabel(weekStartISO) {
  const iso = String(weekStartISO || "").trim();
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return `Week of ${new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(d)}`;
  } catch {
    return `Week of ${iso}`;
  }
}

function adherenceSubtitle(avg) {
  if (avg == null)  return "Waiting for first completion";
  if (avg >= 85)    return "Excellent consistency";
  if (avg >= 75)    return "On track";
  if (avg >= 60)    return "Needs attention";
  return                   "Adjustments needed";
}

function adherencePillTone(avg) {
  if (avg == null) return "neutral";
  if (avg >= 75)   return "good";
  if (avg >= 60)   return "warn";
  return                  "bad";
}

function adherencePillText(avg) {
  if (avg == null) return "No data";
  if (avg >= 85)   return "Excellent";
  if (avg >= 75)   return "On track";
  if (avg >= 60)   return "Watch";
  return                  "Critical";
}

function Icon({ children }) {
  return (
    <span
      className="hidden sm:inline-flex h-9 w-9 items-center justify-center shrink-0"
      style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
    >
      {children}
    </span>
  );
}

export function SummaryGrid({ latestCheckin, latestAvg, plan, hasPlan }) {
  const latestWeekText = useMemo(
    () => weekLabel(latestCheckin?.weekStartISO),
    [latestCheckin?.weekStartISO]
  );

  const checkinSub = useMemo(
    () => latestCheckin?.createdAt
      ? `Updated ${fmtDateTime(latestCheckin.createdAt)} ET`
      : "No completions yet",
    [latestCheckin?.createdAt]
  );

  const adherenceValue = useMemo(
    () => latestAvg == null ? "—" : `${latestAvg}%`,
    [latestAvg]
  );

  const adherenceCardTone = useMemo(() => {
    const t = adherenceTone(latestAvg);
    return (t === "good" || t === "bad") ? t : "neutral";
  }, [latestAvg]);

  const planSub = useMemo(
    () => plan?.createdAt
      ? `Updated ${fmtDateTime(plan.createdAt)} ET`
      : "No plan assigned yet",
    [plan?.createdAt]
  );

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        title="Latest Completion"
        value={latestWeekText}
        sub={checkinSub}
        tone={latestCheckin?.createdAt ? "good" : "neutral"}
        right={
          <div className="inline-flex items-center gap-2">
            <Icon><Calendar className="h-4 w-4" style={{ color: DS.labelText }} /></Icon>
            <StatusPill
              tone={latestCheckin?.createdAt ? "good" : "neutral"}
              text={latestCheckin?.createdAt ? "Current" : "None"}
            />
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
            <Icon><Activity className="h-4 w-4" style={{ color: DS.labelText }} /></Icon>
            <StatusPill tone={adherencePillTone(latestAvg)} text={adherencePillText(latestAvg)} />
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
            <Icon><FileText className="h-4 w-4" style={{ color: DS.labelText }} /></Icon>
            <StatusPill tone={hasPlan ? "good" : "bad"} text={hasPlan ? "Active" : "Missing"} />
          </div>
        }
      />
    </div>
  );
}