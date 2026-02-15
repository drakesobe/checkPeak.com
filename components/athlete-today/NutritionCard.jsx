// components/athlete-today/NutritionCard.jsx
"use client";

import { useMemo, useState } from "react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function toNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmt(v) {
  const n = toNum(v);
  return n == null ? "—" : String(n);
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function fmtHumanDate(isoDate) {
  // isoDate: YYYY-MM-DD
  if (!isISODateOnly(isoDate)) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return isoDate;
  }
}

function pct(n) {
  const x = toNum(n);
  if (x == null) return "—";
  return `${x}%`;
}

function StatPill({ label, value, sub, tone = "base" }) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-4 shadow-sm",
        tone === "base" && "border-gray-200 bg-white",
        tone === "soft" && "border-gray-200 bg-gray-50",
        tone === "warn" && "border-amber-200 bg-amber-50",
        tone === "ok" && "border-emerald-200 bg-emerald-50"
      )}
    >
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xl font-extrabold text-gray-900 mt-1">{value}</p>
      {sub ? <p className="text-[11px] text-gray-500 mt-1">{sub}</p> : null}
    </div>
  );
}

function MacroRow({ label, value, unit }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-sm font-extrabold text-gray-900">
        {value} <span className="text-[11px] font-semibold text-gray-500">{unit}</span>
      </p>
    </div>
  );
}

function MealBlock({ title, block, defaultOpen = false }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);
  const picksCount = Array.isArray(block?.smartStackItems) ? block.smartStackItems.length : 0;

  const hasAnyTargets =
    toNum(t.calories) != null || toNum(t.protein) != null || toNum(t.carbs) != null || toNum(t.fat) != null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#46769B]/25 rounded-xl"
        aria-expanded={open ? "true" : "false"}
      >
        <div className="min-w-0">
          <p className="text-base font-extrabold text-gray-900">{title}</p>
          <p className="text-xs text-gray-600 mt-1">
            Target: <span className="font-semibold">{fmt(t.calories)}</span> cals •{" "}
            <span className="font-semibold">{fmt(t.protein)}</span>P •{" "}
            <span className="font-semibold">{fmt(t.carbs)}</span>C •{" "}
            <span className="font-semibold">{fmt(t.fat)}</span>F
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span
            className={cx(
              "text-[10px] px-2 py-1 rounded-lg border font-semibold",
              hasAnyTargets ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"
            )}
          >
            {hasAnyTargets ? "Set" : "Unset"}
          </span>

          <span className="text-[10px] text-gray-500">{open ? "Hide" : "Open"}</span>
        </div>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {(dining || home) ? (
            <div className="space-y-2">
              {dining ? (
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">Dining hall:</span> {dining}
                </p>
              ) : null}
              {home ? (
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">Home:</span> {home}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">No options added yet.</p>
          )}

          {picksCount > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-[11px] text-gray-600">
                Safe picks attached: <span className="font-semibold text-gray-900">{picksCount}</span>
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">
              Tip: use these targets as a guide — you don’t need “perfect” food labels for every bite.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function NutritionCard({
  loading,
  err,
  hasPlan,
  daily,
  mealBlocks,
  planJson,
  onRefresh,
  onOpenNutrition,

  // ✅ Optional extras from the updated hook (safe if undefined)
  selectedDate,
  effectiveDate,
  nextPlan,
  isFuture,
  message,
}) {
  const [expandedNotes, setExpandedNotes] = useState(false);

  const coachNotes = useMemo(() => safeText(planJson?.notes), [planJson]);
  const canExpandNotes = coachNotes.length > 260;

  const notesMacros = useMemo(() => safeText(planJson?.notesMacros), [planJson]);
  const hydrationOz = useMemo(() => {
    const v = planJson?.hydrationOz;
    const n = toNum(v);
    return n == null ? null : n;
  }, [planJson]);

  const metaStatus = useMemo(() => safeText(planJson?.meta?.status), [planJson]);
  const metaEff = useMemo(() => {
    const eff = safeText(planJson?.meta?.effectiveDate) || safeText(effectiveDate);
    if (/^\d{4}-\d{2}-\d{2}T/.test(eff)) return eff.slice(0, 10);
    return eff;
  }, [planJson, effectiveDate]);

  // Better messaging to match your philosophy: guidance, not mandatory
  const subtitle = useMemo(() => {
    const d = safeText(selectedDate);
    if (isISODateOnly(d)) {
      return `Suggested targets for ${fmtHumanDate(d)} — built for real life (especially campus dining).`;
    }
    return "Suggested targets by meal + daily macros from your coach.";
  }, [selectedDate]);

  const showUpcoming = Boolean(!loading && !err && !hasPlan && (isFuture || safeText(nextPlan?.effectiveDate)));

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-gray-900">Nutrition Today</h2>

            <span className="text-[10px] px-2 py-1 rounded-lg border font-semibold bg-blue-50 text-blue-700 border-blue-200">
              Suggested
            </span>

            {metaStatus ? (
              <span className="text-[10px] px-2 py-1 rounded-lg border font-semibold bg-gray-50 text-gray-700 border-gray-200">
                {metaStatus}
              </span>
            ) : null}
          </div>

          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>

          {metaEff && isISODateOnly(metaEff) ? (
            <p className="text-[11px] text-gray-500 mt-1">
              Plan effective: <span className="font-semibold text-gray-700">{fmtHumanDate(metaEff)}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={onOpenNutrition}
            className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
          >
            Open →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Loading nutrition plan…</p>
        </div>
      ) : err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{err}</p>
          <p className="text-xs text-red-700/80 mt-1">
            If this persists, confirm /api/athlete/nutrition/today is deployed and the athlete session cookie is valid.
          </p>
        </div>
      ) : !hasPlan ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {showUpcoming ? "Plan starts soon" : "No plan yet"}
            </p>

            <p className="text-sm text-gray-600 mt-1">
              {showUpcoming ? (
                <>
                  {safeText(message) ? (
                    <span>{message}</span>
                  ) : (
                    <>
                      No plan is effective for this date.{" "}
                      {safeText(nextPlan?.effectiveDate) ? (
                        <>
                          Next plan starts{" "}
                          <span className="font-semibold text-gray-800">
                            {fmtHumanDate(String(nextPlan.effectiveDate))}
                          </span>
                          .
                        </>
                      ) : null}
                    </>
                  )}
                </>
              ) : (
                <>Your coach hasn’t assigned a nutrition plan. Check back soon.</>
              )}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenNutrition}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
              >
                Open Nutrition →
              </button>

              <button
                type="button"
                onClick={onRefresh}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Guidance framing */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">How to use this</p>
            <p className="text-sm text-blue-900/80 mt-1">
              Nutrition targets are a guide — not “mandatory” like workouts. Focus on hitting the big rocks:
              protein, hydration, and reasonable portions at the dining hall.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Daily */}
          {daily ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Daily Targets</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Aim to be close — consistency beats perfection.
                  </p>
                </div>

                {hydrationOz != null ? (
                  <span className="text-[11px] px-2 py-1 rounded-lg border font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                    Hydration: {hydrationOz} oz
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatPill label="Calories" value={fmt(daily?.calories)} sub="kcal" />
                <StatPill label="Protein" value={fmt(daily?.protein)} sub="grams" />
                <StatPill label="Carbs" value={fmt(daily?.carbs)} sub="grams" />
                <StatPill label="Fat" value={fmt(daily?.fat)} sub="grams" />
              </div>

              {notesMacros ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-bold text-gray-900">Macro Notes</p>
                  <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{notesMacros}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Daily targets missing</p>
              <p className="text-xs text-amber-900/80 mt-1">
                Plan exists but daily macros were not found in PlanJson.daily.
              </p>
            </div>
          )}

          {/* Meals */}
          {mealBlocks ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Targets by Meal</p>
                  <p className="text-xs text-gray-500 mt-1">
                    These are “good enough” anchors for dining hall decisions.
                  </p>
                </div>

                <p className="text-[11px] text-gray-500">Tap a meal to expand</p>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <MealBlock title="Breakfast" block={mealBlocks.breakfast} defaultOpen />
                <MealBlock title="Lunch" block={mealBlocks.lunch} />
                <MealBlock title="Afternoon" block={mealBlocks.afternoon} />
                <MealBlock title="Dinner" block={mealBlocks.dinner} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">Meal blocks aren’t enabled on this plan yet.</p>
              <p className="text-xs text-gray-500 mt-1">
                Your coach can turn them on to give you “dining hall rules” + simple home examples.
              </p>
            </div>
          )}

          {/* Coach notes */}
          {coachNotes ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-gray-900">Coach Notes</p>
                {canExpandNotes ? (
                  <button
                    type="button"
                    onClick={() => setExpandedNotes((v) => !v)}
                    className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                  >
                    {expandedNotes ? "Collapse" : "Expand"}
                  </button>
                ) : null}
              </div>

              <div
                className={cx(
                  "mt-2 text-sm text-gray-800 whitespace-pre-wrap",
                  !expandedNotes && canExpandNotes && "max-h-28 overflow-hidden"
                )}
              >
                {coachNotes}
              </div>
            </div>
          ) : null}

          {/* Bottom guidance: reinforces "suggested" */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Quick approach</p>
            <div className="mt-2 space-y-2 text-sm text-blue-900/85">
              <p>• Prioritize protein each meal (a “palm + a half” is usually close enough).</p>
              <p>• Use carbs strategically around lifts / practice.</p>
              <p>• Don’t stress exact labels — use the meal targets as guardrails.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
