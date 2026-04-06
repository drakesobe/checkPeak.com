// components/day-planner/DayBlock.jsx
// Nutrition blocks are tap-to-expand, showing meal targets + coach notes.
// Workout and class blocks remain compact single-row cards.
import { useState } from "react";
import {
  IconDumbbell, IconLeaf, IconBook,
  IconGrip, IconCheck, IconTrash,
} from "./DayPlannerIcons";

/* ─── Type config ────────────────────────────────────────────────────────── */

export const TYPE_CONFIG = {
  workout: {
    color:  "#3B82F6",
    bg:     "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.25)",
    label:  "Workout",
  },
  nutrition: {
    color:  "#10B981",
    bg:     "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.25)",
    label:  "Nutrition",
  },
  class: {
    color:  "#F59E0B",
    bg:     "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
    label:  "Class",
  },
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function fmtMacro(v, unit = "") {
  const n = safeNum(v);
  return n != null ? `${n}${unit}` : "—";
}

/* ─── Type icon ──────────────────────────────────────────────────────────── */

function TypeIcon({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.workout;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {type === "workout"   && <IconDumbbell />}
      {type === "nutrition" && <IconLeaf />}
      {type === "class"     && <IconBook />}
    </div>
  );
}

/* ─── Chevron ────────────────────────────────────────────────────────────── */

function IconChevron({ open }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{
        transition: "transform 0.2s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

/* ─── Nutrition detail panel ─────────────────────────────────────────────── */

function NutritionDetail({ block, onToggleMealDone, onToggleHydrationDone }) {
  const targets     = block.mealTargets || {};
  const hydrationOz = block.hydrationOz || null;
  const dining      = block.diningNotes || "";
  const home        = block.homeExamples || "";
  const coachNote   = block.coachNote   || "";

  const hasMacros   = safeNum(targets.calories) || safeNum(targets.protein)
                    || safeNum(targets.carbs)   || safeNum(targets.fat);
  const hasNotes    = dining || home || coachNote;

  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.07)",
      marginTop: 10, paddingTop: 12,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {/* Macro targets */}
      {hasMacros ? (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "#4B5563", marginBottom: 8,
          }}>
            Targets
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {[
              { label: "Cal",     value: fmtMacro(targets.calories)      },
              { label: "Protein", value: fmtMacro(targets.protein, "g")  },
              { label: "Carbs",   value: fmtMacro(targets.carbs,   "g")  },
              { label: "Fat",     value: fmtMacro(targets.fat,     "g")  },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8, padding: "8px 6px", textAlign: "center",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981", lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "#4B5563",
                  marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {hydrationOz && (
            <div style={{
              marginTop: 8, fontSize: 12, color: "#6B7280",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 14 }}>💧</span>
              <span>{fmtMacro(hydrationOz)} oz water with this meal</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#4B5563", fontStyle: "italic" }}>
          No macro targets set for this meal.
        </div>
      )}

      {/* Coach notes */}
      {hasNotes && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {coachNote && (
            <div style={{
              padding: "8px 10px",
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.15)",
              borderRadius: 8, fontSize: 12, color: "#D1FAE5", lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700, color: "#10B981" }}>Coach: </span>
              {coachNote}
            </div>
          )}
          {dining && (
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: "#F9FAFB" }}>Dining hall: </span>
              {dining}
            </div>
          )}
          {home && (
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: "#F9FAFB" }}>At home: </span>
              {home}
            </div>
          )}
        </div>
      )}

      {/* Completion toggles */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggleMealDone(); }}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
            border: `1px solid ${block.mealDone ? "#10B981" : "rgba(255,255,255,0.1)"}`,
            background: block.mealDone ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
            color: block.mealDone ? "#10B981" : "#6B7280",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.18s ease",
          }}
          onMouseEnter={e => { if (!block.mealDone) { e.currentTarget.style.borderColor = "#10B981"; e.currentTarget.style.color = "#10B981"; }}}
          onMouseLeave={e => { if (!block.mealDone) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#6B7280"; }}}
        >
          {block.mealDone ? "✓" : "○"} Meal eaten
        </button>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggleHydrationDone(); }}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
            border: `1px solid ${block.hydDone ? "#3B82F6" : "rgba(255,255,255,0.1)"}`,
            background: block.hydDone ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
            color: block.hydDone ? "#3B82F6" : "#6B7280",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.18s ease",
          }}
          onMouseEnter={e => { if (!block.hydDone) { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.color = "#3B82F6"; }}}
          onMouseLeave={e => { if (!block.hydDone) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#6B7280"; }}}
        >
          {block.hydDone ? "✓" : "○"} 💧 Hydrated
        </button>
      </div>
    </div>
  );
}

/* ─── Main DayBlock ──────────────────────────────────────────────────────── */

export function DayBlock({
  block,
  isDragging, isDragOver,
  onDragStart, onDragEnter, onDragOver, onDragEnd, onDrop,
  onToggleDone, onToggleMealDone, onToggleHydrationDone, onDelete,
}) {
  const cfg         = TYPE_CONFIG[block.type] || TYPE_CONFIG.workout;
  const isDone      = block.done;
  const isEmpty     = block.empty;
  const isNutrition = block.type === "nutrition";

  // Start expanded if the athlete has a plan, collapsed otherwise
  const [expanded, setExpanded] = useState(isNutrition && Boolean(block.hasPlan));

  const subLabel = isNutrition && block.subTotal > 0
    ? `${block.subDone}/${block.subTotal}`
    : null;

  return (
    <div
      draggable={!isEmpty}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      style={{
        background: isEmpty || isDone
          ? "rgba(255,255,255,0.02)"
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${isDragOver ? cfg.color : "rgba(255,255,255,0.08)"}`,
        borderLeft: `3px solid ${isDone || isEmpty ? "rgba(255,255,255,0.08)" : cfg.color}`,
        borderRadius: 12,
        opacity: isDragging ? 0.4 : isEmpty ? 0.5 : 1,
        transform: isDragOver ? "scale(1.01)" : "scale(1)",
        transition: "transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "13px 14px",
          cursor: isNutrition && !isEmpty ? "pointer" : isEmpty ? "default" : "grab",
        }}
        onClick={isNutrition && !isEmpty ? () => setExpanded(e => !e) : undefined}
      >
        {/* Drag handle */}
        {!isEmpty && (
          <div
            style={{ color: "rgba(255,255,255,0.18)", flexShrink: 0, cursor: "grab" }}
            onClick={e => e.stopPropagation()}
          >
            <IconGrip />
          </div>
        )}

        <TypeIcon type={block.type} />

        {/* Label + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: isDone || isEmpty ? "#6B7280" : "#F9FAFB",
            textDecoration: isDone ? "line-through" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            transition: "color 0.2s",
          }}>
            {block.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{block.time}</span>
            {block.subtitle && (
              <>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.12)" }}>·</span>
                <span style={{ fontSize: 12, color: "#6B7280" }}>{block.subtitle}</span>
              </>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: isDone || isEmpty ? "#4B5563" : cfg.color, marginLeft: 2,
            }}>
              {cfg.label}
            </span>
            {subLabel && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: block.subDone === block.subTotal ? "#10B981" : "#6B7280",
                background: block.subDone === block.subTotal
                  ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${block.subDone === block.subTotal
                  ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 99, padding: "1px 6px",
              }}>
                {subLabel}
              </span>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isNutrition && !isEmpty && (
            <div style={{ color: "#4B5563" }}>
              <IconChevron open={expanded} />
            </div>
          )}
          {!isEmpty && !isNutrition && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggleDone(); }}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: isDone ? "#10B981" : "rgba(255,255,255,0.05)",
                border: `1px solid ${isDone ? "#10B981" : "rgba(255,255,255,0.12)"}`,
                color: isDone ? "#fff" : "#6B7280", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { if (!isDone) { e.currentTarget.style.borderColor = "#10B981"; e.currentTarget.style.color = "#10B981"; }}}
              onMouseLeave={e => { if (!isDone) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#6B7280"; }}}
              aria-label={isDone ? "Mark incomplete" : "Mark complete"}
            >
              <IconCheck />
            </button>
          )}
          {block.type === "class" && onDelete && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#4B5563", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#EF4444"; e.currentTarget.style.color = "#EF4444"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#4B5563"; }}
              aria-label="Remove class"
            >
              <IconTrash />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded nutrition detail ────────────────────────────────────── */}
      {isNutrition && expanded && !isEmpty && (
        <div style={{ padding: "0 14px 14px" }}>
          <NutritionDetail
            block={block}
            onToggleMealDone={onToggleMealDone}
            onToggleHydrationDone={onToggleHydrationDone}
          />
        </div>
      )}
    </div>
  );
}