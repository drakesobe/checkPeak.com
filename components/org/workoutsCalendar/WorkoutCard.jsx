"use client";

import { ArrowRight, Dumbbell, Users } from "lucide-react";
import Pill from "./Pill";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function toneForStatus(s) {
  const status = String(s || "").toLowerCase();
  if (status.includes("complete")) return "good";
  if (status.includes("pending")) return "warn";
  if (status.includes("assign")) return "warn";
  if (status.includes("draft")) return "neutral";
  if (status.includes("arch")) return "neutral";
  return "neutral";
}

export default function WorkoutCard({ w, onOpen, compact = false }) {
  const title = w?.Title || "Workout";
  const status = w?.Status || "assigned";
  const sport = titleSport(w?.Sport || "");
  const athletes = Number(w?.athleteCount || 0);
  const items = Number(w?.itemCount || 0);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(w)}
      className={classNames(
        "w-full text-left rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition",
        "overflow-hidden",
        compact ? "p-2" : "p-3"
      )}
      title="Open workout"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={classNames("font-extrabold text-gray-900 truncate", compact ? "text-[12px]" : "text-sm")}>
            {title}
          </p>

          <div className="mt-2 flex flex-wrap gap-2 min-w-0">
            <Pill tone={toneForStatus(status)} className={compact ? "text-[10px]" : ""}>
              <span className="truncate max-w-[140px] inline-block">{status}</span>
            </Pill>

            {sport ? (
              <Pill className={compact ? "text-[10px]" : ""}>
                <span className="truncate max-w-[140px] inline-block">{sport}</span>
              </Pill>
            ) : null}

            <Pill className={compact ? "text-[10px]" : ""}>
              <Users className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              {athletes}
            </Pill>

            <Pill className={compact ? "text-[10px]" : ""}>
              <Dumbbell className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              {items}
            </Pill>
          </div>
        </div>

        <ArrowRight className={classNames("text-gray-400 shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
      </div>
    </button>
  );
}
