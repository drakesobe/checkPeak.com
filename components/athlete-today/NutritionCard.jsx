"use client";

import { useMemo, useState } from "react";

/* ---------------- helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function toNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmt(v) {
  const n = toNum(v);
  if (n == null) return "—";
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function fmtHumanDate(isoDate) {
  if (!isISODateOnly(isoDate)) return isoDate || "";
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

/* ---------------- UI atoms ---------------- */

function Chip({ children, tone = "base" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tone === "base" && "bg-white border-gray-200 text-gray-700",
        tone === "blue" && "bg-blue-50 border-blue-200 text-blue-700",
        tone === "emerald" && "bg-emerald-50 border-emerald-200 text-emerald-700",
        tone === "gray" && "bg-gray-50 border-gray-200 text-gray-700"
      )}
    >
      {children}
    </span>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 my-4" />;
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm sm:text-base font-extrabold text-gray-900">{title}</p>
        {subtitle ? (
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function StatTile({ label, value, unit }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm min-w-0">
      <p className="text-[11px] text-gray-500 truncate">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-none">{value}</p>
        {unit ? <span className="text-[11px] font-semibold text-gray-500">{unit}</span> : null}
      </div>
    </div>
  );
}

/* ---------------- compact supplements dropdown ---------------- */

function SuppRow({ label, value }) {
  const v = safeText(value);
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <p className="text-sm text-gray-700 font-semibold">{label}</p>
      <p className={cx("text-sm text-right break-words", v ? "text-gray-900" : "text-gray-400")}>
        {v || "No recommendation"}
      </p>
    </div>
  );
}

function SupplementsDropdown({ supplements }) {
  const [open, setOpen] = useState(false);

  const hasAny = Boolean(
    safeText(supplements?.protein) ||
      safeText(supplements?.creatine) ||
      safeText(supplements?.bcaa) ||
      safeText(supplements?.electrolytes) ||
      safeText(supplements?.notes)
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "w-full text-left px-5 py-4",
          "flex items-start justify-between gap-4",
          "hover:bg-gray-50 transition",
          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={open ? "true" : "false"}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm sm:text-base font-extrabold text-gray-900">Supplements</p>
            {hasAny ? <Chip tone="emerald">Coach set</Chip> : <Chip tone="gray">Optional</Chip>}
            <Chip tone="blue">Suggested</Chip>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
            These are <span className="font-semibold">suggestions</span> — not medical advice.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          <span className="text-[10px] sm:text-[11px] text-gray-500 whitespace-nowrap">
            {open ? "Hide" : "Open"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="px-5 pb-5 pt-2">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="divide-y divide-gray-200">
              <SuppRow label="Protein" value={supplements?.protein} />
              <SuppRow label="Creatine" value={supplements?.creatine} />
              <SuppRow label="BCAA / EAA" value={supplements?.bcaa} />
              <SuppRow label="Electrolytes" value={supplements?.electrolytes} />
            </div>

            {safeText(supplements?.notes) ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-extrabold text-gray-900">Supplement Notes</p>
                <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap leading-relaxed">
                  {safeText(supplements?.notes)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
                No additional notes. If your coach adds them later, they’ll appear here.
              </p>
            )}

            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              Reminder: these are <span className="font-semibold">suggestions</span> and not medical advice. If you have
              allergies, conditions, or medication concerns, check with a qualified healthcare professional.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Meal tile ---------------- */

function MealTile({ title, block, defaultOpen = false }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);

  const cal = fmt(t.calories);
  const p = fmt(t.protein);
  const c = fmt(t.carbs);
  const f = fmt(t.fat);
  const w = fmt(t.hydrationOz);

  const hasAnyTargets =
    toNum(t.calories) != null ||
    toNum(t.protein) != null ||
    toNum(t.carbs) != null ||
    toNum(t.fat) != null ||
    toNum(t.hydrationOz) != null;

  const MacroMini = ({ label, value, unit }) => (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 min-w-0">
      <p className="text-[10px] text-gray-500 truncate">{label}</p>
      <p className="text-base font-extrabold text-gray-900 mt-1 tabular-nums leading-none">
        {value}{" "}
        <span className="text-[10px] font-semibold text-gray-500 align-middle">{unit}</span>
      </p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "w-full text-left px-5 py-4",
          "flex items-start justify-between gap-4",
          "hover:bg-gray-50 transition",
          "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={open ? "true" : "false"}
      >
        <div className="min-w-0">
          <p className="text-base sm:text-lg font-extrabold text-gray-900">{title}</p>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed break-words">
            <span className="font-semibold">{cal}</span> cals ·{" "}
            <span className="font-semibold">P {p}</span> ·{" "}
            <span className="font-semibold">C {c}</span> ·{" "}
            <span className="font-semibold">F {f}</span>
            {toNum(t.hydrationOz) != null ? (
              <>
                {" "}
                · <span className="font-semibold">💧 {w} oz</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          <span
            className={cx(
              "text-[10px] px-2 py-1 rounded-lg border font-semibold whitespace-nowrap",
              hasAnyTargets
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            )}
          >
            {hasAnyTargets ? "Set" : "Unset"}
          </span>
          <span className="text-[10px] sm:text-[11px] text-gray-500 whitespace-nowrap">
            {open ? "Hide" : "Open"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="px-5 pb-5 pt-2 space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <p className="text-sm sm:text-base font-extrabold text-gray-900">Macro breakdown</p>
              <p className="text-[11px] text-gray-500">Targets for this meal</p>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MacroMini label="Calories" value={cal} unit="kcal" />
              <MacroMini label="Protein" value={p} unit="g" />
              <MacroMini label="Carbs" value={c} unit="g" />
              <MacroMini label="Fat" value={f} unit="g" />
              <MacroMini label="Water" value={w} unit="oz" />
            </div>

            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              Use this as a guide. If you’re close, you’re winning.
            </p>
          </div>

          {(dining || home) ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="grid sm:grid-cols-2 gap-4">
                {dining ? (
                  <div className="text-sm text-gray-800 leading-relaxed break-words">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Dining hall</p>
                    <p className="mt-1">{dining}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-[11px] text-gray-600">No dining hall rules.</p>
                  </div>
                )}

                {home ? (
                  <div className="text-sm text-gray-800 leading-relaxed break-words">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Home</p>
                    <p className="mt-1">{home}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-[11px] text-gray-600">No home examples.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[11px] text-gray-600">No meal notes added yet.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- main card ---------------- */

export default function NutritionCard({
  loading,
  err,
  hasPlan,
  daily,
  mealBlocks,
  planJson,

  // Airtable "Prescription" long text should be passed here
  prescription,

  onRefresh,
  onOpenNutrition,

  selectedDate,
  effectiveDate,
  nextPlan,
  isFuture,
  message,
}) {
  const [expandedNotes, setExpandedNotes] = useState(false);

  /* ✅ Daily hydration (oz): prefer daily, then PlanJson */
  const dailyHydrationOz = useMemo(() => {
    const v =
      daily?.hydrationOz ??
      planJson?.daily?.hydrationOz ??
      planJson?.hydrationOz ??
      daily?.waterOz ??
      null;

    const n = toNum(v);
    return n == null ? null : n;
  }, [daily, planJson]);

  /* ✅ Supplements extraction (robust across shapes) */
  const supplements = useMemo(() => {
    const s = planJson?.supplements && typeof planJson.supplements === "object" ? planJson.supplements : {};

    const protein =
      safeText(s.protein) ||
      safeText(s.proteinRecommendation) ||
      safeText(planJson?.proteinRecommendation) ||
      "";

    const creatine =
      safeText(s.creatine) ||
      safeText(s.creatineRecommendation) ||
      safeText(planJson?.creatineRecommendation) ||
      "";

    const bcaa =
      safeText(s.bcaa) ||
      safeText(s.eaa) ||
      safeText(s.bcaaRecommendation) ||
      safeText(planJson?.bcaaRecommendation) ||
      "";

    const electrolytes =
      safeText(s.electrolytes) ||
      safeText(s.electrolytesRecommendation) ||
      safeText(planJson?.electrolytesRecommendation) ||
      "";

    const notes =
      safeText(s.notes) ||
      safeText(s.notesSupplements) ||
      safeText(planJson?.notesSupplements) ||
      safeText(planJson?.notes?.supplements) ||
      "";

    return { protein, creatine, bcaa, electrolytes, notes };
  }, [planJson]);

  /* ✅ Coach notes (prefer Airtable Prescription long text) */
  const coachNotes = useMemo(() => {
    const p = safeText(prescription);
    if (p) return p;

    const s1 = safeText(planJson?.prescription);
    if (s1) return s1;

    const s2 = safeText(planJson?.freeformNotes || planJson?.coachNotes || "");
    if (s2) return s2;

    const notes = planJson?.notes;
    if (notes && typeof notes === "object") {
      const macros = safeText(notes?.macros);
      const supp = safeText(notes?.supplements);
      const lines = [];
      if (macros) lines.push(`Macros: ${macros}`);
      if (supp) lines.push(`Supplements: ${supp}`);
      return lines.join("\n");
    }

    return safeText(planJson?.notes || "");
  }, [prescription, planJson]);

  const canExpandNotes = coachNotes.length > 260;

  const notesMacros = useMemo(() => {
    return safeText(planJson?.notesMacros) || safeText(planJson?.daily?.notesMacros) || "";
  }, [planJson]);

  const metaStatus = useMemo(() => safeText(planJson?.meta?.status), [planJson]);

  const metaEff = useMemo(() => {
    const eff = safeText(planJson?.meta?.effectiveDate) || safeText(effectiveDate);
    if (/^\d{4}-\d{2}-\d{2}T/.test(eff)) return eff.slice(0, 10);
    return eff;
  }, [planJson, effectiveDate]);

  const subtitle = useMemo(() => {
    const d = safeText(selectedDate);
    if (isISODateOnly(d)) {
      return `Suggested targets for ${fmtHumanDate(d)} — calm, simple, and easy to follow.`;
    }
    return "Suggested targets by meal + daily macros from your coach.";
  }, [selectedDate]);

  const showUpcoming = Boolean(!loading && !err && !hasPlan && (isFuture || safeText(nextPlan?.effectiveDate)));

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-gray-900">Nutrition Today</h2>
            <Chip tone="blue">Suggested</Chip>
            {metaStatus ? <Chip tone="gray">{metaStatus}</Chip> : null}
            {dailyHydrationOz != null ? <Chip tone="emerald">💧 {dailyHydrationOz} oz</Chip> : null}
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

      <Divider />

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">Loading nutrition plan…</p>
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{err}</p>
          <p className="text-xs text-red-700/80 mt-1">
            If this persists, confirm /api/athlete/nutrition/today is deployed and the athlete session cookie is valid.
          </p>
        </div>
      ) : !hasPlan ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {showUpcoming ? "Plan starts soon" : "No plan yet"}
            </p>

            <p className="text-sm text-gray-600 mt-1 leading-relaxed">
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

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Quick approach</p>
            <p className="text-sm text-blue-900/85 mt-1 leading-relaxed">
              Keep it simple: protein + water first, then carbs around training.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* DAILY TARGETS */}
          {daily ? (
            <div className="space-y-3">
              <SectionTitle
                title="Daily Targets"
                subtitle="Aim to be close — consistency beats perfection."
                right={metaEff && isISODateOnly(metaEff) ? <Chip tone="base">{fmtHumanDate(metaEff)}</Chip> : null}
              />

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <StatTile label="Calories" value={fmt(daily?.calories)} unit="kcal" />
                <StatTile label="Protein" value={fmt(daily?.protein)} unit="g" />
                <StatTile label="Carbs" value={fmt(daily?.carbs)} unit="g" />
                <StatTile label="Fat" value={fmt(daily?.fat)} unit="g" />
                <StatTile label="Water" value={dailyHydrationOz != null ? fmt(dailyHydrationOz) : "—"} unit="oz" />
              </div>

              {notesMacros ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-bold text-gray-900">Macro Notes</p>
                  <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap leading-relaxed">{notesMacros}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Daily targets missing</p>
              <p className="text-xs text-amber-900/80 mt-1">Plan exists but daily macros were not found.</p>
            </div>
          )}

          {/* ✅ SUPPLEMENTS (FULL WIDTH DROPDOWN) — placed ABOVE coach notes */}
          <SupplementsDropdown supplements={supplements} />

          {/* MEALS */}
          {mealBlocks ? (
            <div className="space-y-3">
              <SectionTitle
                title="Targets by Meal"
                subtitle="Tap a meal to expand. Use targets as guardrails — no need for perfect labels."
                right={<span className="text-[11px] text-gray-500">Tap to expand</span>}
              />

              <div className="grid md:grid-cols-2 gap-3">
                <MealTile title="Breakfast" block={mealBlocks.breakfast} defaultOpen />
                <MealTile title="Lunch" block={mealBlocks.lunch} />
                <MealTile title="Afternoon" block={mealBlocks.afternoon} />
                <MealTile title="Dinner" block={mealBlocks.dinner} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">Meal blocks aren’t enabled on this plan yet.</p>
              <p className="text-xs text-gray-500 mt-1">
                Your coach can add meal targets + dining hall rules + home examples.
              </p>
            </div>
          )}

          {/* COACH NOTES */}
          {coachNotes ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-2">
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
                  "mt-2 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed",
                  !expandedNotes && canExpandNotes && "max-h-28 overflow-hidden"
                )}
              >
                {coachNotes}
              </div>

              <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                Reminder: this plan provides <span className="font-semibold">suggestions</span> and is not medical advice.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
