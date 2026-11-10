// components/org/workoutsCalendar/WorkoutCard.jsx
"use client";

import { Users, Dumbbell } from "lucide-react";
import { APP } from "@/components/app/ui";
import { titleSport } from "@/lib/org/workoutsCalendar/sports";

function statusTone(s) {
  const v = String(s || "").toLowerCase();
  if (v.includes("complete")) return { dot: "#15803D", label: "Completed" };
  if (v.includes("reject"))   return { dot: "#B91C1C", label: "Needs changes" };
  if (v.includes("pending"))  return { dot: "#B45309", label: "In review" };
  if (v.includes("assign"))   return { dot: "#D97706", label: "Assigned" };
  return { dot: APP.faint, label: s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "Draft" };
}

const CARD_CSS = `
  .wc { width: 100%; display: block; text-align: left; border: 1px solid ${APP.line}; border-radius: 8px; background: #fff;
    cursor: pointer; font-family: ${APP.font}; box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s; }
  .wc:hover { border-color: #CBD5E1; box-shadow: 0 4px 12px rgba(15,23,42,0.08); }
  .wc:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: 1px; }
  .wc-title { margin: 0; color: ${APP.ink}; font-weight: 600; line-height: 1.3; overflow: hidden; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .wc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 6px; font-size: 12px; color: ${APP.muted}; }
  .wc-meta span { display: inline-flex; align-items: center; gap: 4px; }
`;

export default function WorkoutCard({ w, onOpen, compact = false }) {
  const title       = w?.Title || "Workout";
  const sport       = titleSport(w?.Sport || "");
  const athletes    = Number(w?.athleteCount || 0);
  const items       = Number(w?.itemCount || 0);
  const athleteName = String(w?.athleteName || "").trim();
  const tone        = statusTone(w?.Status || "assigned");

  return (
    <>
      <style>{CARD_CSS}</style>
      <button
        type="button"
        className="wc"
        onClick={() => onOpen?.(w)}
        style={{ padding: compact ? "8px 10px" : "10px 12px" }}
        aria-label={`${title}, ${tone.label}${sport ? `, ${sport}` : ""}`}
      >
        <p className="wc-title" style={{ fontSize: compact ? 13 : 14 }}>{title}</p>
        {athleteName && (
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: APP.brand, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {athleteName}
          </p>
        )}
        <div className="wc-meta">
          <span style={{ color: APP.text, fontWeight: 600 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: tone.dot }} />
            {tone.label}
          </span>
          {sport && !compact && <span>{sport}</span>}
          <span title={`${athletes} athlete${athletes === 1 ? "" : "s"}`}><Users size={12} aria-hidden="true" />{athletes}</span>
          {/* Narrow week columns: keep the card to two lines */}
          {!compact && <span title={`${items} exercise${items === 1 ? "" : "s"}`}><Dumbbell size={12} aria-hidden="true" />{items}</span>}
        </div>
      </button>
    </>
  );
}
