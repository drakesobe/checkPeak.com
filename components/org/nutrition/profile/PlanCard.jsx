/// components/org/nutrition/profile/PlanCard.jsx
"use client";

import { useMemo, useState } from "react";
import { Calendar, ClipboardCopy, ChevronDown, ChevronUp, Utensils, Gauge, Sparkles } from "lucide-react";
import { fmtDateTime } from "./utils";
import { EmptyState } from "./ui";

/* ---------------- helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

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
  return n == null ? "—" : String(n);
}

function hasAnyTargets(t = {}) {
  return (
    toNumber(t.calories) != null ||
    toNumber(t.protein) != null ||
    toNumber(t.carbs) != null ||
    toNumber(t.fat) != null
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
  // Your planJson uses notes.macros + notes.supplements sometimes
  const notes = planJson?.notes;
  return notes && typeof notes === "object" ? notes : null;
}

/* ---------------- small UI atoms ---------------- */

function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex items-start gap-3">
        {Icon ? (
          <span className="h-10 w-10 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-gray-700" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{title}</p>
          {sub ? <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xl font-extrabold text-gray-900 mt-1 tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-[12px] font-semibold text-gray-500">{unit}</span> : null}
      </p>
    </div>
  );
}

function MealBlockCard({ label, block }) {
  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);

  const isSet = hasAnyTargets(t);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{label}</p>
          <p className="text-xs text-gray-600 mt-1">
            <span className="font-semibold">{fmtMacro(t.calories)}</span> cal •{" "}
            <span className="font-semibold">{fmtMacro(t.protein)}</span>P •{" "}
            <span className="font-semibold">{fmtMacro(t.carbs)}</span>C •{" "}
            <span className="font-semibold">{fmtMacro(t.fat)}</span>F
          </p>
        </div>

        <span
          className={cx(
            "shrink-0 text-[10px] px-2 py-1 rounded-lg border font-semibold",
            isSet
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-gray-100 text-gray-500 border-gray-200"
          )}
          title={isSet ? "Targets set" : "Targets not set"}
        >
          {isSet ? "Set" : "Unset"}
        </span>
      </div>

      {(dining || home) ? (
        <div className="mt-3 space-y-2">
          {dining ? (
            <p className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Dining:</span> {dining}
            </p>
          ) : null}
          {home ? (
            <p className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Home:</span> {home}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">No quick plays yet.</p>
      )}
    </div>
  );
}

/* ---------------- main ---------------- */

export function PlanCard({ plan, onEditPlan }) {
  const createdAt = plan?.createdAt || "";
  const createdBy = safeText(plan?.createdBy);
  const prescription = safeText(plan?.prescription);

  const planJson = useMemo(() => pickPlanJson(plan), [plan]);
  const mealBlocks = useMemo(() => pickMealBlocks(planJson), [planJson]);
  const daily = useMemo(() => pickDaily(plan, planJson), [plan, planJson]);
  const notesObj = useMemo(() => pickNotes(planJson), [planJson]);

  const hasMealBlocks = Boolean(mealBlocks && typeof mealBlocks === "object");
  const hasDaily = Boolean(daily && typeof daily === "object");
  const hasPlan = Boolean(createdAt || prescription || hasMealBlocks || hasDaily);

  const metaLine = useMemo(() => {
    if (!hasPlan) return "No plan found for this athlete.";
    const pieces = [];
    if (createdAt) pieces.push(`Updated ${fmtDateTime(createdAt)} ET`);
    if (createdBy) pieces.push(`by ${createdBy}`);
    if (hasDaily) pieces.push("Daily targets");
    if (hasMealBlocks) pieces.push("Meal blocks");
    return pieces.join(" • ") || "Plan available";
  }, [hasPlan, createdAt, createdBy, hasDaily, hasMealBlocks]);

  // Expand/collapse long text
  const [expanded, setExpanded] = useState(false);
  const canExpand = prescription.length > 520;

  // Collapse/expand meal blocks (premium: reduces vertical noise)
  const [showMeals, setShowMeals] = useState(true);

  async function onCopy() {
    if (!prescription) return;
    try {
      await navigator.clipboard.writeText(prescription);
    } catch {
      // ignore
    }
  }

  if (!hasPlan) {
    return (
      <section
        className={cx(
          "rounded-3xl border border-blue-100/70 bg-white/80 backdrop-blur-xl",
          "shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)] p-5"
        )}
      >
        <EmptyState
          title="No plan yet"
          body="Create something realistic: a few daily targets + simple dining hall plays."
          cta="Create Plan →"
          onCta={onEditPlan}
        />
      </section>
    );
  }

  const mealKeys = ["breakfast", "lunch", "afternoon", "dinner"];
  const anyMealTargetsSet = hasMealBlocks
    ? mealKeys.some((k) => hasAnyTargets(mealBlocks?.[k]?.targets || {}))
    : false;

  const macrosNotes = safeText(notesObj?.macros);
  const suppNotes = safeText(notesObj?.supplements);
  const freeformNotes = safeText(planJson?.freeformNotes);

  return (
    <section
      className={cx(
        "rounded-3xl border border-blue-100/70 bg-white/80 backdrop-blur-xl",
        "shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)]"
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-gray-900">Current Plan</h2>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              <span className="truncate">{metaLine}</span>
            </div>
          </div>

          <button
            onClick={onEditPlan}
            type="button"
            className={cx(
              "inline-flex items-center justify-center rounded-xl bg-[#46769B] px-4 py-2.5",
              "text-sm font-semibold text-white hover:brightness-110 transition",
              "focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
            )}
          >
            Update Plan
          </button>
        </div>

        {/* Daily targets */}
        {hasDaily ? (
          <div className="mt-5">
            <SectionTitle
              icon={Gauge}
              title="Daily targets"
              sub="Fast snapshot — keep athletes focused on repeatable execution."
            />

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricPill label="Calories" value={fmtMacro(daily?.calories)} unit="kcal" />
              <MetricPill label="Protein" value={fmtMacro(daily?.protein)} unit="g" />
              <MetricPill label="Carbs" value={fmtMacro(daily?.carbs)} unit="g" />
              <MetricPill label="Fat" value={fmtMacro(daily?.fat)} unit="g" />
            </div>
          </div>
        ) : null}

        {/* Meal blocks (collapsible) */}
        {hasMealBlocks ? (
          <div className="mt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <span className="h-10 w-10 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                  <Utensils className="h-4 w-4 text-gray-700" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-900">Targets by meal</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Breakfast • Lunch • Afternoon • Dinner</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "text-[10px] px-2 py-1 rounded-lg border font-semibold",
                    anyMealTargetsSet
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  )}
                >
                  {anyMealTargetsSet ? "Configured" : "Not set"}
                </span>

                <button
                  type="button"
                  onClick={() => setShowMeals((v) => !v)}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2",
                    "text-xs font-semibold text-gray-900 hover:bg-gray-50",
                    "focus:outline-none focus:ring-2 focus:ring-gray-200"
                  )}
                >
                  {showMeals ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show
                    </>
                  )}
                </button>
              </div>
            </div>

            {showMeals ? (
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                <MealBlockCard label="Breakfast" block={mealBlocks.breakfast} />
                <MealBlockCard label="Lunch" block={mealBlocks.lunch} />
                <MealBlockCard label="Afternoon" block={mealBlocks.afternoon} />
                <MealBlockCard label="Dinner" block={mealBlocks.dinner} />
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">
                  Hidden to reduce noise. Open when you want to tweak meal plays.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* Notes (clean + premium) */}
        {(macrosNotes || suppNotes || freeformNotes) ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gray-700" />
              <p className="text-sm font-extrabold text-gray-900">Coach notes</p>
            </div>

            <div className="mt-2 space-y-2 text-sm text-gray-800">
              {macrosNotes ? (
                <p>
                  <span className="font-semibold text-gray-900">Macros:</span> {macrosNotes}
                </p>
              ) : null}
              {suppNotes ? (
                <p>
                  <span className="font-semibold text-gray-900">Supplements:</span> {suppNotes}
                </p>
              ) : null}
              {freeformNotes ? (
                <p className="text-gray-700">{freeformNotes}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Full text (optional, collapsible) */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900">Full plan text</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Copyable summary (legacy-friendly).</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onCopy}
                type="button"
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2",
                  "text-xs font-semibold text-gray-900 hover:bg-gray-50",
                  "focus:outline-none focus:ring-2 focus:ring-gray-200"
                )}
                title="Copy plan text"
                disabled={!prescription}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy
              </button>

              {canExpand ? (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2",
                    "text-xs font-semibold text-gray-900 hover:bg-gray-50",
                    "focus:outline-none focus:ring-2 focus:ring-gray-200"
                  )}
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {expanded ? "Collapse" : "Expand"}
                </button>
              ) : null}
            </div>
          </div>

          {prescription ? (
            <pre
              className={cx(
                "mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-900",
                !expanded && canExpand && "max-h-56 overflow-hidden"
              )}
            >
              {prescription}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-gray-600">No plan text found.</p>
          )}
        </div>

        {/* Footer divider */}
        <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
      </div>
    </section>
  );
}