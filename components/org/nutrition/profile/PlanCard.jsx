// components/org/nutrition/profile/PlanCard.jsx
"use client";

import { useMemo, useState } from "react";
import { fmtDateTime } from "./utils";
import { EmptyState } from "./ui";

/* ---------------- tiny helpers ---------------- */

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
  // Support a couple possible shapes from your API
  const pj = plan?.planJson || plan?.PlanJson || plan?._raw?.planJson || plan?._raw?.PlanJson;
  return pj && typeof pj === "object" ? pj : null;
}

function pickMealBlocks(planJson) {
  const mb = planJson?.mealBlocks;
  return mb && typeof mb === "object" ? mb : null;
}

function pickDaily(plan, planJson) {
  // Prefer the structured daily saved in PlanJson, fall back to Airtable "daily" object if present
  const d = planJson?.daily || plan?.daily || null;
  return d && typeof d === "object" ? d : null;
}

function pickSupplements(planJson) {
  const s = planJson?.supplements;
  return s && typeof s === "object" ? s : null;
}

/* ---------------- UI pieces ---------------- */

function StatPill({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-lg font-extrabold text-gray-900 mt-1">{value}</p>
      {sub ? <p className="text-[11px] text-gray-500 mt-1">{sub}</p> : null}
    </div>
  );
}

function MealBlockCard({ label, block }) {
  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);
  const smartCount = Array.isArray(block?.smartStackItems) ? block.smartStackItems.length : 0;

  const isSet = hasAnyTargets(t);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{label}</p>
          <p className="text-xs text-gray-600 mt-1">
            Target:{" "}
            <span className="font-semibold">{fmtMacro(t.calories)}</span> cals •{" "}
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

      {(dining || home) && (
        <div className="mt-3 space-y-2">
          {dining ? (
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Dining hall:</span> {dining}
            </div>
          ) : null}
          {home ? (
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Home:</span> {home}
            </div>
          ) : null}
        </div>
      )}

      {smartCount > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] text-gray-500">
            Safe picks attached: <span className="font-semibold">{smartCount}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function WarningBanner({ title, body }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-extrabold text-amber-900">{title}</p>
      {body ? <p className="text-xs text-amber-900/80 mt-1">{body}</p> : null}
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
  const supplements = useMemo(() => pickSupplements(planJson), [planJson]);

  const hasMealBlocks = Boolean(mealBlocks && typeof mealBlocks === "object");
  const hasDaily = Boolean(daily && typeof daily === "object");
  const hasPlan = Boolean(createdAt || prescription || hasMealBlocks || hasDaily);

  const dailyMissingProteinOrCarbs = useMemo(() => {
    if (!hasDaily) return false;
    // In PlanJson daily, protein/carbs can be null if not set
    const p = daily?.protein;
    const c = daily?.carbs;
    return p == null || c == null || p === "" || c === "";
  }, [hasDaily, daily]);

  const anyMealTargetsSet = useMemo(() => {
    if (!hasMealBlocks) return false;
    const keys = ["breakfast", "lunch", "afternoon", "dinner"];
    return keys.some((k) => hasAnyTargets(mealBlocks?.[k]?.targets || {}));
  }, [hasMealBlocks, mealBlocks]);

  const metaLine = useMemo(() => {
    if (!hasPlan) return "No plan found for this athlete.";
    const pieces = [];
    if (createdAt) pieces.push(`Created ${fmtDateTime(createdAt)} ET`);
    if (createdBy) pieces.push(`by ${createdBy}`);
    if (hasDaily) pieces.push("Daily targets enabled");
    if (hasMealBlocks) pieces.push("Meal blocks enabled");
    return pieces.join(" • ") || "Plan is active.";
  }, [hasPlan, createdAt, createdBy, hasDaily, hasMealBlocks]);

  const [expanded, setExpanded] = useState(false);
  const canExpand = prescription.length > 550;

  async function onCopy() {
    if (!prescription) return;
    try {
      await navigator.clipboard.writeText(prescription);
    } catch {
      // ignore silently (some browsers block clipboard)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900">Current Nutrition Plan</h2>
          <p className="text-sm text-gray-500 mt-1 break-words">{metaLine}</p>
        </div>

        <span
          className={cx(
            "shrink-0 text-[11px] px-2 py-1 rounded-lg border font-semibold",
            hasPlan
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          )}
          aria-label={hasPlan ? "Plan active" : "Plan missing"}
        >
          {hasPlan ? "Active" : "Missing"}
        </span>
      </div>

      {hasPlan ? (
        <div className="mt-4 space-y-4">
          {/* Debug + data health hints */}
          {dailyMissingProteinOrCarbs ? (
            <WarningBanner
              title="Daily Protein / Carbs look missing"
              body="This plan’s daily targets are missing protein/carbs. If the builder has values, the issue is likely in the API upsert field mapping (DailyProtein / DailyCarbs) or how the structured values are being passed into PlanJson."
            />
          ) : null}

          {/* ✅ Daily targets row */}
          {hasDaily ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Daily Targets</p>
                <p className="text-[11px] text-gray-500">Calories • Protein • Carbs • Fat</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatPill label="Calories" value={fmtMacro(daily?.calories)} sub="kcal" />
                <StatPill label="Protein" value={fmtMacro(daily?.protein)} sub="grams" />
                <StatPill label="Carbs" value={fmtMacro(daily?.carbs)} sub="grams" />
                <StatPill label="Fat" value={fmtMacro(daily?.fat)} sub="grams" />
              </div>
            </div>
          ) : null}

          {/* ✅ Meal blocks */}
          {hasMealBlocks ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900">Targets by Meal</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Breakfast • Lunch • Afternoon • Dinner
                  </p>
                </div>
                <span
                  className={cx(
                    "text-[11px] px-2 py-1 rounded-lg border font-semibold w-fit",
                    anyMealTargetsSet
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-100 text-gray-600 border-gray-200"
                  )}
                  title={anyMealTargetsSet ? "At least one meal target is set" : "No meal targets set yet"}
                >
                  {anyMealTargetsSet ? "Targets configured" : "Targets not configured"}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <MealBlockCard label="Breakfast" block={mealBlocks.breakfast} />
                <MealBlockCard label="Lunch" block={mealBlocks.lunch} />
                <MealBlockCard label="Afternoon" block={mealBlocks.afternoon} />
                <MealBlockCard label="Dinner" block={mealBlocks.dinner} />
              </div>
            </div>
          ) : null}

          {/* ✅ Supplements quick view */}
          {supplements ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Supplements</p>
                <p className="text-[11px] text-gray-500">Daily recommendations</p>
              </div>

              <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-gray-500">Protein</p>
                  <p className="font-semibold text-gray-900 mt-1">{safeText(supplements?.protein) || "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-gray-500">Creatine</p>
                  <p className="font-semibold text-gray-900 mt-1">{safeText(supplements?.creatine) || "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-gray-500">BCAA/EAA</p>
                  <p className="font-semibold text-gray-900 mt-1">{safeText(supplements?.bcaaEaa) || "—"}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-[11px] text-gray-500">Electrolytes</p>
                  <p className="font-semibold text-gray-900 mt-1">{safeText(supplements?.electrolytes) || "—"}</p>
                </div>
              </div>

              {safeText(supplements?.notes) ? (
                <p className="text-xs text-gray-600 mt-3">
                  <span className="font-semibold text-gray-900">Notes:</span> {safeText(supplements?.notes)}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Full plan text (copy-friendly fallback) */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            {prescription ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">Full Plan Text</p>
                  <p className="text-[11px] text-gray-500">Copyable summary</p>
                </div>

                <pre
                  className={cx(
                    "mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-900",
                    !expanded && canExpand && "max-h-56 overflow-hidden"
                  )}
                >
                  {prescription}
                </pre>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canExpand ? (
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                      {expanded ? "Collapse" : "Expand"}
                    </button>
                  ) : null}

                  <button
                    onClick={onCopy}
                    className="px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    type="button"
                    title="Copy plan text"
                  >
                    Copy
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-700">
                No plan text found. (That’s ok if you’re fully using PlanJson + meal blocks.)
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onEditPlan}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              type="button"
            >
              Update Plan →
            </button>

            {/* Helpful: if no meal blocks exist but daily exists, prompt trainer */}
            {!hasMealBlocks && hasDaily ? (
              <span className="text-[11px] text-gray-500">
                Tip: add meal blocks to make this easier for athletes to follow.
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No plan yet"
          body="Create something realistic and trackable: a few staple meals, clear targets, and adherence-friendly choices."
          cta="Create Plan →"
          onCta={onEditPlan}
        />
      )}
    </section>
  );
}
