"use client";

import { useMemo } from "react";
import { fmtDateTime, adherenceTone } from "./utils";
import { SummaryCard, StatusPill } from "./ui";

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
  if (avg == null) return "Waiting for first check-in";
  if (avg >= 85) return "Excellent consistency";
  if (avg >= 75) return "On track";
  if (avg >= 60) return "Needs attention";
  return "Intervention needed";
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

export function SummaryGrid({ latestCheckin, latestAvg, plan, hasPlan }) {
  const latestCheckinValue = useMemo(
    () => weekLabel(latestCheckin?.weekStartISO),
    [latestCheckin?.weekStartISO]
  );

  const latestCheckinSub = useMemo(() => {
    if (latestCheckin?.createdAt) return `Submitted ${fmtDateTime(latestCheckin.createdAt)} ET`;
    return "No check-ins yet";
  }, [latestCheckin?.createdAt]);

  const adherenceValue = useMemo(() => {
    if (latestAvg == null) return "—";
    return `${latestAvg}%`;
  }, [latestAvg]);

  const aTone = useMemo(() => adherenceTone(latestAvg), [latestAvg]);
  const adherenceToneNorm = useMemo(() => {
    if (aTone === "good" || aTone === "bad") return aTone;
    return "neutral";
  }, [aTone]);

  const adherencePill = useMemo(() => {
    const t = adherencePillTone(latestAvg);
    return <StatusPill tone={t} text={adherencePillText(latestAvg)} />;
  }, [latestAvg]);

  const planSub = useMemo(() => {
    if (plan?.createdAt) return `Updated ${fmtDateTime(plan.createdAt)} ET`;
    return "Create a plan to start";
  }, [plan?.createdAt]);

  const planPill = useMemo(() => {
    const t = hasPlan ? "good" : "bad";
    return <StatusPill tone={t} text={hasPlan ? "Active" : "Missing"} />;
  }, [hasPlan]);

  const checkinPill = useMemo(() => {
    const ok = Boolean(latestCheckin?.createdAt);
    return <StatusPill tone={ok ? "good" : "neutral"} text={ok ? "Submitted" : "None"} />;
  }, [latestCheckin?.createdAt]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SummaryCard
        title="Latest Check-in"
        value={latestCheckinValue}
        sub={latestCheckinSub}
        tone={latestCheckin?.createdAt ? "good" : "neutral"}
        right={checkinPill}
      />

      <SummaryCard
        title="Latest Adherence"
        value={adherenceValue}
        sub={adherenceSubtitle(latestAvg)}
        tone={adherenceToneNorm}
        right={adherencePill}
      />

      <SummaryCard
        title="Plan Status"
        value={hasPlan ? "Active" : "Missing"}
        sub={planSub}
        tone={hasPlan ? "good" : "bad"}
        right={planPill}
      />
    </div>
  );
}
