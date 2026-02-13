"use client";

import { useMemo, useState } from "react";
import { fmtDateTime } from "./utils";
import { EmptyState } from "./ui";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function asNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function fmtMacro(v) {
  const n = asNum(v);
  return n == null ? "—" : String(n);
}

function pickPlanJson(plan) {
  // support a couple possible shapes from your API
  const pj = plan?.planJson || plan?.PlanJson || plan?._raw?.planJson || plan?._raw?.PlanJson;
  return pj && typeof pj === "object" ? pj : null;
}

function pickMealBlocks(planJson) {
  const mb = planJson?.mealBlocks;
  if (mb && typeof mb === "object") return mb;
  return null;
}

function MealBlockCard({ label, block }) {
  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);

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

        {/* tiny status chip if we have at least one target */}
        <span
          className={cx(
            "shrink-0 text-[10px] px-2 py-1 rounded-lg border font-semibold",
            asNum(t.calories) != null || asNum(t.protein) != null || asNum(t.carbs) != null || asNum(t.fat) != null
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-gray-100 text-gray-500 border-gray-200"
          )}
        >
          {asNum(t.calories) != null || asNum(t.protein) != null || asNum(t.carbs) != null || asNum(t.fat) != null
            ? "Set"
            : "Unset"}
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

      {/* SmartStack picks placeholder (V1b) */}
      {Array.isArray(block?.smartStackItems) && block.smartStackItems.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] text-gray-500">
            Safe picks attached: <span className="font-semibold">{block.smartStackItems.length}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function PlanCard({ plan, onEditPlan }) {
  const createdAt = plan?.createdAt || "";
  const createdBy = safeText(plan?.createdBy);
  const prescription = safeText(plan?.prescription);

  const planJson = useMemo(() => pickPlanJson(plan), [plan]);
  const mealBlocks = useMemo(() => pickMealBlocks(planJson), [planJson]);

  const hasMealBlocks = Boolean(mealBlocks && typeof mealBlocks === "object");
  const hasPlan = Boolean(createdAt || prescription || hasMealBlocks);

  const metaLine = useMemo(() => {
    if (!hasPlan) return "No plan found for this athlete.";
    const pieces = [];
    if (createdAt) pieces.push(`Created ${fmtDateTime(createdAt)} ET`);
    if (createdBy) pieces.push(`by ${createdBy}`);
    if (hasMealBlocks) pieces.push("Meal blocks enabled");
    return pieces.join(" • ") || "Plan is active.";
  }, [hasPlan, createdAt, createdBy, hasMealBlocks]);

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
          {/* ✅ Meal blocks first (if available) */}
          {hasMealBlocks ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Today’s Targets by Meal</p>
                <p className="text-[11px] text-gray-500">Breakfast • Lunch • Afternoon • Dinner</p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <MealBlockCard label="Breakfast" block={mealBlocks.breakfast} />
                <MealBlockCard label="Lunch" block={mealBlocks.lunch} />
                <MealBlockCard label="Afternoon" block={mealBlocks.afternoon} />
                <MealBlockCard label="Dinner" block={mealBlocks.dinner} />
              </div>
            </div>
          ) : null}

          {/* Legacy plan text (always useful for copy/paste + backward compatibility) */}
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

                {!expanded && canExpand ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                    >
                      Show full plan
                    </button>
                  </div>
                ) : null}

                {expanded && canExpand ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                    >
                      Collapse
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-gray-700">
                This plan is marked active, but no prescription text was found.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onEditPlan}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              type="button"
            >
              {hasPlan ? "Update Plan →" : "Create Plan →"}
            </button>

            <button
              onClick={onCopy}
              disabled={!prescription}
              className={cx(
                "px-4 py-2 rounded-xl text-sm font-semibold border",
                prescription
                  ? "bg-white text-gray-900 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              )}
              type="button"
              title={prescription ? "Copy plan text" : "Nothing to copy"}
            >
              Copy
            </button>

            {canExpand ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                type="button"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
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
