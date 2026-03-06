// components/org/workoutsCalendar/WorkoutCard.jsx
"use client";

import { ArrowRight, Users, Dumbbell } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

function statusTone(s) {
  const v = String(s || "").toLowerCase();
  if (v.includes("complete"))  return { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe    };
  if (v.includes("assign"))    return { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution };
  if (v.includes("pending"))   return { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution };
  if (v.includes("reject"))    return { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned  };
  return { bg: DS.pageBg, border: DS.border, text: DS.dimText };
}

export default function WorkoutCard({ w, onOpen, compact = false }) {
  const title    = w?.Title || "Workout";
  const status   = w?.Status || "assigned";
  const sport    = titleSport(w?.Sport || "");
  const athletes = Number(w?.athleteCount || 0);
  const items    = Number(w?.itemCount    || 0);
  const tone     = statusTone(status);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(w)}
      className="w-full text-left transition-colors"
      style={{
        backgroundColor: DS.cardBg,
        border:          `1px solid ${DS.border}`,
        borderLeft:      `3px solid ${tone.text}`,
        padding:         compact ? "7px 10px" : "10px 12px",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.cardBg; }}
      title="Open workout"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Title */}
          <p
            className="font-bold truncate"
            style={{ color: DS.bodyText, fontSize: compact ? "11px" : "12px" }}
          >
            {title}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {/* Status pill */}
            <span
              className="px-1.5 py-0.5 font-bold uppercase tracking-wide"
              style={{ backgroundColor: tone.bg, color: tone.text, border: `1px solid ${tone.border}`, fontSize: "10px" }}
            >
              {status}
            </span>

            {sport && (
              <span className="text-xs font-bold" style={{ color: DS.dimText }}>{sport}</span>
            )}

            <span className="inline-flex items-center gap-1 text-xs" style={{ color: DS.dimText }}>
              <Users className="w-3 h-3" />
              {athletes}
            </span>

            <span className="inline-flex items-center gap-1 text-xs" style={{ color: DS.dimText }}>
              <Dumbbell className="w-3 h-3" />
              {items}
            </span>
          </div>
        </div>

        <ArrowRight
          className="shrink-0 mt-0.5"
          style={{ width: compact ? "12px" : "14px", height: compact ? "12px" : "14px", color: DS.dimText }}
        />
      </div>
    </button>
  );
}