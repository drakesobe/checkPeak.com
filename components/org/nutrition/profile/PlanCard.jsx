// components/org/nutrition/profile/PlanCard.jsx
"use client";

import { useMemo, useState } from "react";
import {
  Calendar, ClipboardCopy, ChevronDown, ChevronUp,
  Utensils, Gauge, Sparkles,
} from "lucide-react";
import { fmtDateTime } from "./utils";
import { EmptyState, DS } from "./ui";

/* ---------------- helpers ---------------- */

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function toNumber(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtMacro(v) {
  const n = toNumber(v);
  return n == null ? "-" : String(n);
}

function hasAnyTargets(t = {}) {
  return (
    toNumber(t.calories) != null || toNumber(t.protein) != null ||
    toNumber(t.carbs) != null    || toNumber(t.fat) != null
  );
}

function pickPlanJson(plan) {
  const pj = plan?.planJson || plan?.PlanJson || plan?._raw?.planJson || plan?._raw?.PlanJson;
  return pj && typeof pj === "object" ? pj : null;
}

function pickMealBlocks(planJson) {
  const mb = planJson?.mealBlocks;
  return mb && typeof mb === "object" ? mb : null;
}

function pickDaily(plan, planJson) {
  const d = planJson?.daily || plan?.daily || null;
  return d && typeof d === "object" ? d : null;
}

function pickNotes(planJson) {
  const notes = planJson?.notes;
  return notes && typeof notes === "object" ? notes : null;
}

/* ---------------- shared atoms ---------------- */

function SectionLabel({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span
          className="h-9 w-9 flex items-center justify-center shrink-0"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
        >
          <Icon className="h-4 w-4" style={{ color: DS.labelText }} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>{title}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>{sub}</p>}
      </div>
    </div>
  );
}

function MacroPill({ label, value, unit }) {
  return (
    <div className="p-4" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: DS.dimText }}>{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums" style={{ color: DS.bodyText, fontFamily: "'Barlow Condensed', sans-serif" }}>
        {value}
        {unit && <span className="ml-1 text-xs font-bold" style={{ color: DS.dimText }}>{unit}</span>}
      </p>
    </div>
  );
}

function MealBlockCard({ label, block }) {
  const t      = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home   = safeText(block?.homeExamples);
  const isSet  = hasAnyTargets(t);

  return (
    <div className="p-4" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: DS.bodyText }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>
            <span className="font-bold">{fmtMacro(t.calories)}</span> cal ·{" "}
            <span className="font-bold">{fmtMacro(t.protein)}</span>P ·{" "}
            <span className="font-bold">{fmtMacro(t.carbs)}</span>C ·{" "}
            <span className="font-bold">{fmtMacro(t.fat)}</span>F
          </p>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 text-xs font-bold rounded-sm"
          style={isSet
            ? { backgroundColor: DS.safeBg,  color: DS.safe,    border: `1px solid ${DS.safeBorder}`  }
            : { backgroundColor: DS.pageBg,  color: DS.dimText, border: `1px solid ${DS.border}`      }
          }
        >
          {isSet ? "Set" : "Unset"}
        </span>
      </div>

      {(dining || home) ? (
        <div className="mt-3 space-y-1.5">
          {dining && <p className="text-xs" style={{ color: DS.bodyText }}><span className="font-bold">Dining:</span> {dining}</p>}
          {home   && <p className="text-xs" style={{ color: DS.bodyText }}><span className="font-bold">Home:</span> {home}</p>}
        </div>
      ) : (
        <p className="mt-3 text-xs" style={{ color: DS.dimText }}>No quick plays yet.</p>
      )}
    </div>
  );
}

function GhostBtn({ onClick, icon: Icon, children, disabled: dis, title }) {
  return (
    <button
      onClick={onClick}
      type="button"
      title={title}
      disabled={dis}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
      style={{
        border: `1px solid ${DS.border}`,
        backgroundColor: DS.cardBg,
        color: dis ? DS.dimText : DS.labelText,
        cursor: dis ? "not-allowed" : "pointer",
        opacity: dis ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { if (!dis) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; e.currentTarget.style.backgroundColor = DS.brandBg; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; e.currentTarget.style.backgroundColor = DS.cardBg; }}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/* ---------------- main ---------------- */

export function PlanCard({ plan, onEditPlan }) {
  const createdAt    = plan?.createdAt || "";
  const createdBy    = safeText(plan?.createdBy);
  const prescription = safeText(plan?.prescription);

  const planJson    = useMemo(() => pickPlanJson(plan),             [plan]);
  const mealBlocks  = useMemo(() => pickMealBlocks(planJson),       [planJson]);
  const daily       = useMemo(() => pickDaily(plan, planJson),      [plan, planJson]);
  const notesObj    = useMemo(() => pickNotes(planJson),            [planJson]);

  const hasMealBlocks = Boolean(mealBlocks && typeof mealBlocks === "object");
  const hasDaily      = Boolean(daily && typeof daily === "object");
  const hasPlan       = Boolean(createdAt || prescription || hasMealBlocks || hasDaily);

  const metaLine = useMemo(() => {
    if (!hasPlan) return "No plan found.";
    const pieces = [];
    if (createdAt) pieces.push(`Updated ${fmtDateTime(createdAt)} ET`);
    if (createdBy) pieces.push(`by ${createdBy}`);
    if (hasDaily)      pieces.push("Daily targets");
    if (hasMealBlocks) pieces.push("Meal blocks");
    return pieces.join(" · ") || "Plan available";
  }, [hasPlan, createdAt, createdBy, hasDaily, hasMealBlocks]);

  const [expanded,  setExpanded]  = useState(false);
  const [showMeals, setShowMeals] = useState(true);
  const canExpand = prescription.length > 520;

  const macrosNotes   = safeText(notesObj?.macros);
  const suppNotes     = safeText(notesObj?.supplements);
  const freeformNotes = safeText(planJson?.freeformNotes);

  async function onCopy() {
    if (!prescription) return;
    try { await navigator.clipboard.writeText(prescription); } catch {}
  }

  if (!hasPlan) {
    return (
      <section style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>
        <div className="p-5">
          <EmptyState
            title="No plan yet"
            body="Create something realistic: a few daily targets + simple dining hall plays."
            cta="Create Plan →"
            onCta={onEditPlan}
          />
        </div>
      </section>
    );
  }

  const mealKeys = ["breakfast", "lunch", "afternoon", "dinner"];
  const anyMealTargetsSet = hasMealBlocks
    ? mealKeys.some((k) => hasAnyTargets(mealBlocks?.[k]?.targets || {}))
    : false;

  return (
    <section style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>
      <div className="p-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Current Plan
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: DS.dimText }}>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{metaLine}</span>
            </div>
          </div>
          <button
            onClick={onEditPlan}
            type="button"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{ backgroundColor: DS.brand, color: "#fff" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brand; }}
          >
            Update Plan
          </button>
        </div>

        {/* Daily targets */}
        {hasDaily && (
          <div className="mt-5">
            <SectionLabel
              icon={Gauge}
              title="Daily targets"
              sub="Keep athletes focused on repeatable execution."
            />
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <MacroPill label="Calories" value={fmtMacro(daily?.calories)} unit="kcal" />
              <MacroPill label="Protein"  value={fmtMacro(daily?.protein)}  unit="g"    />
              <MacroPill label="Carbs"    value={fmtMacro(daily?.carbs)}    unit="g"    />
              <MacroPill label="Fat"      value={fmtMacro(daily?.fat)}      unit="g"    />
            </div>
          </div>
        )}

        {/* Meal blocks */}
        {hasMealBlocks && (
          <div className="mt-6">
            <div className="flex items-start justify-between gap-3">
              <SectionLabel
                icon={Utensils}
                title="Targets by meal"
                sub="Breakfast · Lunch · Afternoon · Dinner"
              />
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="px-2 py-0.5 text-xs font-bold rounded-sm"
                  style={anyMealTargetsSet
                    ? { backgroundColor: DS.safeBg,  color: DS.safe,    border: `1px solid ${DS.safeBorder}`  }
                    : { backgroundColor: DS.pageBg,  color: DS.dimText, border: `1px solid ${DS.border}`      }
                  }
                >
                  {anyMealTargetsSet ? "Configured" : "Not set"}
                </span>
                <GhostBtn
                  onClick={() => setShowMeals((v) => !v)}
                  icon={showMeals ? ChevronUp : ChevronDown}
                >
                  {showMeals ? "Hide" : "Show"}
                </GhostBtn>
              </div>
            </div>

            {showMeals ? (
              <div className="mt-3 grid md:grid-cols-2 gap-2">
                <MealBlockCard label="Breakfast" block={mealBlocks.breakfast} />
                <MealBlockCard label="Lunch"     block={mealBlocks.lunch}     />
                <MealBlockCard label="Afternoon" block={mealBlocks.afternoon} />
                <MealBlockCard label="Dinner"    block={mealBlocks.dinner}    />
              </div>
            ) : (
              <div className="mt-3 p-4" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
                <p className="text-sm" style={{ color: DS.labelText }}>
                  Hidden to reduce noise. Open when you want to tweak meal plays.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Coach notes */}
        {(macrosNotes || suppNotes || freeformNotes) && (
          <div className="mt-6 p-4" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4" style={{ color: DS.brand }} />
              <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
                Coach notes
              </p>
            </div>
            <div className="space-y-1.5 text-sm" style={{ color: DS.bodyText }}>
              {macrosNotes   && <p><span className="font-bold">Macros:</span> {macrosNotes}</p>}
              {suppNotes     && <p><span className="font-bold">Supplements:</span> {suppNotes}</p>}
              {freeformNotes && <p style={{ color: DS.labelText }}>{freeformNotes}</p>}
            </div>
          </div>
        )}

        {/* Full plan text */}
        <div className="mt-6 p-4" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
                Full plan text
              </p>
              <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>Copyable summary.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <GhostBtn onClick={onCopy} icon={ClipboardCopy} disabled={!prescription} title="Copy plan text">
                Copy
              </GhostBtn>
              {canExpand && (
                <GhostBtn
                  onClick={() => setExpanded((v) => !v)}
                  icon={expanded ? ChevronUp : ChevronDown}
                >
                  {expanded ? "Collapse" : "Expand"}
                </GhostBtn>
              )}
            </div>
          </div>

          {prescription ? (
            <pre
              className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
              style={{
                color: DS.bodyText,
                maxHeight: !expanded && canExpand ? "14rem" : "none",
                overflow: !expanded && canExpand ? "hidden" : "visible",
              }}
            >
              {prescription}
            </pre>
          ) : (
            <p className="mt-3 text-sm" style={{ color: DS.dimText }}>No plan text found.</p>
          )}
        </div>

        <div className="mt-5 h-px w-full" style={{ backgroundColor: DS.border }} />
      </div>
    </section>
  );
}