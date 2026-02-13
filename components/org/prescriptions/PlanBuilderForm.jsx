// components/org/prescriptions/PlanBuilderForm.jsx
"use client";

import { useMemo } from "react";
import SearchSelect from "@/components/SearchSelect";
import { autoSplitMeals } from "@/lib/org/prescriptions/prescriptions-utils";

/* ---------------- tiny helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function asNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function normalizeSplit(split) {
  const s = split && typeof split === "object" ? split : {};
  const b = clamp(s.breakfast ?? 0.25, 0, 1);
  const l = clamp(s.lunch ?? 0.3, 0, 1);
  const a = clamp(s.afternoon ?? 0.15, 0, 1);
  const d = clamp(s.dinner ?? 0.3, 0, 1);
  const sum = b + l + a + d;
  if (!sum) return { breakfast: 0.25, lunch: 0.3, afternoon: 0.15, dinner: 0.3 };
  return {
    breakfast: b / sum,
    lunch: l / sum,
    afternoon: a / sum,
    dinner: d / sum,
  };
}

function pctStr(r) {
  const x = Number(r);
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

function mealCardTitle(key) {
  if (key === "breakfast") return "Breakfast";
  if (key === "lunch") return "Lunch";
  if (key === "afternoon") return "Afternoon";
  if (key === "dinner") return "Dinner";
  return key;
}

function getDefaultMealBlock(label) {
  return {
    name: label,
    targets: { calories: "", protein: "", carbs: "", fat: "" },
    diningHallRules: "",
    homeExamples: "",
    smartStackItems: [],
  };
}

/* ---------------- inputs ---------------- */

function NumInput({
  label,
  value,
  onChange,
  placeholder = "—",
  min = 0,
  max,
  step = 1,
  hint,
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-2">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
      />
      {hint ? <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{hint}</p> : null}
    </label>
  );
}

function SplitPctInput({ label, value, onChange }) {
  // Store as ratio (0..1) but let user type percent (0..100)
  const pct = useMemo(() => {
    const v = Number(value);
    if (!Number.isFinite(v)) return "";
    return String(Math.round(v * 100));
  }, [value]);

  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-2">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          className="w-full pr-10 px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
          value={pct}
          onChange={(e) => {
            const p = asNum(e.target.value);
            if (p == null) return onChange("");
            onChange(clamp(p, 0, 100) / 100);
          }}
          placeholder="e.g. 25"
          min={0}
          max={100}
          step={1}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
      </div>
    </label>
  );
}

/* ---------------- Meal block editor ---------------- */

function MealBlockEditor({ subtleHint, structured, onChange }) {
  const split = structured?.mealSplit || {};
  const normSplit = useMemo(() => normalizeSplit(split), [split]);

  const mealBlocks = structured?.mealBlocks && typeof structured.mealBlocks === "object" ? structured.mealBlocks : {};

  const blocks = useMemo(
    () => [
      { key: "breakfast", label: "Breakfast" },
      { key: "lunch", label: "Lunch" },
      { key: "afternoon", label: "Afternoon" },
      { key: "dinner", label: "Dinner" },
    ],
    []
  );

  const daily = useMemo(
    () => ({
      calories: asNum(structured?.calories),
      protein: asNum(structured?.proteinGrams),
      carbs: asNum(structured?.carbsGrams),
      fat: asNum(structured?.fatsGrams),
    }),
    [structured]
  );

  const computedTotals = useMemo(() => {
    const sum = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const { key } of blocks) {
      const t = mealBlocks?.[key]?.targets || {};
      sum.calories += asNum(t.calories) || 0;
      sum.protein += asNum(t.protein) || 0;
      sum.carbs += asNum(t.carbs) || 0;
      sum.fat += asNum(t.fat) || 0;
    }
    return sum;
  }, [blocks, mealBlocks]);

  const mismatch = useMemo(() => {
    // mismatch only if daily is set
    const m = {};
    if (daily.calories != null) m.calories = computedTotals.calories - daily.calories;
    if (daily.protein != null) m.protein = computedTotals.protein - daily.protein;
    if (daily.carbs != null) m.carbs = computedTotals.carbs - daily.carbs;
    if (daily.fat != null) m.fat = computedTotals.fat - daily.fat;
    return m;
  }, [daily, computedTotals]);

  const anyDailySet = daily.calories != null || daily.protein != null || daily.carbs != null || daily.fat != null;

  const setSplit = (key, ratio) => {
    const next = { ...(structured.mealSplit || {}) };
    next[key] = ratio;
    onChange("mealSplit", next);
  };

  const setBlock = (key, patch) => {
    const next = { ...(structured.mealBlocks || {}) };
    const prev = next[key] || getDefaultMealBlock(mealCardTitle(key));
    next[key] = { ...prev, ...patch };
    onChange("mealBlocks", next);
  };

  const setTargets = (key, patch) => {
    const next = { ...(structured.mealBlocks || {}) };
    const prev = next[key] || getDefaultMealBlock(mealCardTitle(key));
    const prevTargets = prev.targets || {};
    next[key] = { ...prev, targets: { ...prevTargets, ...patch } };
    onChange("mealBlocks", next);
  };

  const handleAutoSplit = () => {
    const nextBlocks = autoSplitMeals(structured);
    onChange("mealBlocks", nextBlocks);
  };

  const handleResetBlocks = () => {
    const next = {};
    for (const { key, label } of blocks) next[key] = getDefaultMealBlock(label);
    onChange("mealBlocks", next);
  };

  const handleCopyFrom = (fromKey, toKey) => {
    const from = mealBlocks?.[fromKey] || null;
    if (!from) return;
    const next = { ...(structured.mealBlocks || {}) };
    next[toKey] = {
      ...(next[toKey] || getDefaultMealBlock(mealCardTitle(toKey))),
      targets: { ...(from.targets || {}) },
      diningHallRules: String(from.diningHallRules || ""),
      homeExamples: String(from.homeExamples || ""),
      smartStackItems: Array.isArray(from.smartStackItems) ? from.smartStackItems : [],
    };
    onChange("mealBlocks", next);
  };

  const splitSumPct = useMemo(() => {
    const s = (asNum(split.breakfast) || 0) + (asNum(split.lunch) || 0) + (asNum(split.afternoon) || 0) + (asNum(split.dinner) || 0);
    return Math.round(s * 100);
  }, [split]);

  const mismatchBadge = (diff) => {
    if (diff == null) return null;
    if (!diff) return <span className="text-[11px] font-semibold text-emerald-700">On target</span>;
    const isOver = diff > 0;
    return (
      <span className={cx("text-[11px] font-semibold", isOver ? "text-amber-700" : "text-blue-700")}>
        {isOver ? `+${diff}` : `${diff}`}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h4 className="font-semibold">Meal Blocks</h4>
          <p className="text-xs text-gray-500 mt-1">
            Set targets for Breakfast / Lunch / Afternoon / Dinner. Add quick “Dining Hall” rules + “Home” examples.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAutoSplit}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            title="Fill meal targets from daily totals using the split ratios"
          >
            Auto-split
          </button>
          <button
            type="button"
            onClick={handleResetBlocks}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            title="Clear meal targets + suggestions"
          >
            Reset blocks
          </button>
        </div>
      </div>

      {/* Split ratios */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">Auto-split ratios</p>
            <p className="text-xs text-gray-500 mt-1">
              Enter percentages. They’ll be normalized to 100% automatically.
            </p>
          </div>

          <div className="text-xs text-gray-600">
            Sum:{" "}
            <span
              className={cx(
                "font-semibold",
                splitSumPct === 100 ? "text-emerald-700" : "text-amber-700"
              )}
            >
              {splitSumPct}%
            </span>{" "}
            <span className="text-gray-400">(normalizes)</span>
          </div>
        </div>

        <div className="mt-3 grid md:grid-cols-4 gap-3">
          <SplitPctInput label="Breakfast" value={split.breakfast ?? 0.25} onChange={(r) => setSplit("breakfast", r)} />
          <SplitPctInput label="Lunch" value={split.lunch ?? 0.3} onChange={(r) => setSplit("lunch", r)} />
          <SplitPctInput label="Afternoon" value={split.afternoon ?? 0.15} onChange={(r) => setSplit("afternoon", r)} />
          <SplitPctInput label="Dinner" value={split.dinner ?? 0.3} onChange={(r) => setSplit("dinner", r)} />
        </div>

        <p className={cx("mt-3", subtleHint)}>
          Current normalized split:{" "}
          <span className="font-semibold">
            {pctStr(normSplit.breakfast)} / {pctStr(normSplit.lunch)} / {pctStr(normSplit.afternoon)} / {pctStr(normSplit.dinner)}
          </span>
          . Dinner is adjusted to keep totals consistent after rounding.
        </p>
      </div>

      {/* Totals checker */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-sm font-bold text-gray-900">Totals check</p>
        <p className="text-xs text-gray-500 mt-1">
          Helps you keep meal blocks aligned with the daily targets.
        </p>

        <div className="mt-3 grid md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] text-gray-500">Calories</p>
            <p className="text-sm font-extrabold text-gray-900 mt-1">{computedTotals.calories}</p>
            <p className="text-[11px] text-gray-600 mt-1">
              vs daily {daily.calories ?? "—"}{" "}
              {anyDailySet ? <span className="ml-1">{mismatchBadge(mismatch.calories)}</span> : null}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] text-gray-500">Protein (g)</p>
            <p className="text-sm font-extrabold text-gray-900 mt-1">{computedTotals.protein}</p>
            <p className="text-[11px] text-gray-600 mt-1">
              vs daily {daily.protein ?? "—"}{" "}
              {anyDailySet ? <span className="ml-1">{mismatchBadge(mismatch.protein)}</span> : null}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] text-gray-500">Carbs (g)</p>
            <p className="text-sm font-extrabold text-gray-900 mt-1">{computedTotals.carbs}</p>
            <p className="text-[11px] text-gray-600 mt-1">
              vs daily {daily.carbs ?? "—"}{" "}
              {anyDailySet ? <span className="ml-1">{mismatchBadge(mismatch.carbs)}</span> : null}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[11px] text-gray-500">Fat (g)</p>
            <p className="text-sm font-extrabold text-gray-900 mt-1">{computedTotals.fat}</p>
            <p className="text-[11px] text-gray-600 mt-1">
              vs daily {daily.fat ?? "—"}{" "}
              {anyDailySet ? <span className="ml-1">{mismatchBadge(mismatch.fat)}</span> : null}
            </p>
          </div>
        </div>

        {!anyDailySet ? (
          <p className={cx("mt-3", subtleHint)}>
            Set daily macros above to enable mismatch indicators.
          </p>
        ) : null}
      </div>

      {/* Meal cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {blocks.map(({ key, label }) => {
          const b = mealBlocks?.[key] || getDefaultMealBlock(label);
          const t = b.targets || {};

          const quickCopyTargets = (fromKey) => handleCopyFrom(fromKey, key);

          return (
            <div key={key} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-extrabold text-gray-900">{mealCardTitle(key)}</p>
                  <p className="text-[11px] text-gray-500 mt-1">Targets + Options</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {key !== "breakfast" ? (
                    <button
                      type="button"
                      onClick={() => quickCopyTargets("breakfast")}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-semibold bg-white hover:bg-gray-50"
                      title="Copy targets + suggestions from Breakfast"
                    >
                      Copy Breakfast
                    </button>
                  ) : null}

                  {key !== "lunch" ? (
                    <button
                      type="button"
                      onClick={() => quickCopyTargets("lunch")}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-semibold bg-white hover:bg-gray-50"
                      title="Copy targets + suggestions from Lunch"
                    >
                      Copy Lunch
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-2 gap-3">
                <NumInput
                  label="Calories"
                  value={t.calories ?? ""}
                  onChange={(v) => setTargets(key, { calories: v })}
                  step={25}
                  hint="Meal calories are usually easier in 25–50 cal increments."
                />
                <NumInput
                  label="Protein (g)"
                  value={t.protein ?? ""}
                  onChange={(v) => setTargets(key, { protein: v })}
                  step={5}
                />
                <NumInput
                  label="Carbs (g)"
                  value={t.carbs ?? ""}
                  onChange={(v) => setTargets(key, { carbs: v })}
                  step={5}
                />
                <NumInput
                  label="Fat (g)"
                  value={t.fat ?? ""}
                  onChange={(v) => setTargets(key, { fat: v })}
                  step={5}
                />
              </div>

              {/* Options */}
              <div className="grid gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Dining Hall Rules (quick picks)</p>
                  <textarea
                    className="w-full min-h-[78px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                    value={String(b.diningHallRules || "")}
                    onChange={(e) => setBlock(key, { diningHallRules: e.target.value })}
                    placeholder="e.g. 2 proteins + 1 carb + fruit. Avoid fried foods."
                  />
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">Home Examples</p>
                  <textarea
                    className="w-full min-h-[78px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                    value={String(b.homeExamples || "")}
                    onChange={(e) => setBlock(key, { homeExamples: e.target.value })}
                    placeholder="e.g. Eggs + oats + banana. Turkey sandwich + greek yogurt."
                  />
                </div>

                <p className={subtleHint}>
                  SmartStack “safe picks” per block can be attached next (we’ll store product IDs in{" "}
                  <span className="font-semibold">mealBlocks.{key}.smartStackItems</span>).
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- main form ---------------- */

export default function PlanBuilderForm({
  inputBase,
  subtleHint,

  title,
  setTitle,

  structured,
  onChange,

  OPTIONS,

  createLoading,
  selectedAthleteEmail,

  onReset,
  onSave,
  onSaveNext,
}) {
  return (
    <form onSubmit={(e) => onSave(e)} className="space-y-6">
      {/* Title + Meta */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <p className="text-xs text-gray-500 mb-2">Plan Title</p>
          <input
            className={inputBase}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. In-season maintenance plan"
          />
        </div>

        <div>
          <SearchSelect
            label="Meta Status"
            options={OPTIONS.metaStatus}
            value={structured.metaStatus}
            onChange={(v) => onChange("metaStatus", v)}
            onCommit={(v) => onChange("metaStatus", v)}
            allowCustom={false}
            placeholder="Search status…"
          />
        </div>

        <div className="md:col-span-3">
          <p className="text-xs text-gray-500 mb-2">Meta Effective Date</p>
          <input
            type="date"
            className={inputBase}
            value={structured.metaEffectiveDate}
            onChange={(e) => onChange("metaEffectiveDate", e.target.value)}
          />
          <p className={subtleHint}>If blank, the API can default to “now”.</p>
        </div>
      </div>

      {/* Macros + Phase */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
        <div>
          <h4 className="font-semibold">Macros</h4>
          <p className="text-xs text-gray-500 mt-1">
            Phase + daily targets. Meal blocks will be derived or customized below.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <SearchSelect
            label="Phase"
            options={OPTIONS.phases}
            value={structured.phase}
            onChange={(v) => onChange("phase", v)}
            onCommit={(v) => onChange("phase", v)}
            allowCustom={false}
            placeholder="Select phase…"
          />

          <SearchSelect
            label="Calories (Daily)"
            options={OPTIONS.calories}
            value={structured.calories}
            onChange={(v) => onChange("calories", v)}
            onCommit={(v) => onChange("calories", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Protein (g, Daily)"
            options={OPTIONS.grams}
            value={structured.proteinGrams}
            onChange={(v) => onChange("proteinGrams", v)}
            onCommit={(v) => onChange("proteinGrams", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Carbs (g, Daily)"
            options={OPTIONS.grams}
            value={structured.carbsGrams}
            onChange={(v) => onChange("carbsGrams", v)}
            onCommit={(v) => onChange("carbsGrams", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Fat (g, Daily)"
            options={OPTIONS.grams}
            value={structured.fatsGrams}
            onChange={(v) => onChange("fatsGrams", v)}
            onCommit={(v) => onChange("fatsGrams", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <SearchSelect
            label="Hydration (oz)"
            options={OPTIONS.hydration}
            value={structured.hydrationOz}
            onChange={(v) => onChange("hydrationOz", v)}
            onCommit={(v) => onChange("hydrationOz", v)}
            allowCustom
            placeholder="Type or search…"
          />

          <div className="md:col-span-3">
            <SearchSelect
              label="Notes (Macros)"
              options={OPTIONS.notesMacros}
              value={structured.notesMacros}
              onChange={(v) => onChange("notesMacros", v)}
              onCommit={(v) => onChange("notesMacros", v)}
              allowCustom
              placeholder="Search or type notes…"
            />
          </div>

          <p className={cx("md:col-span-3", subtleHint)}>
            Pro tip: set daily targets first, then use <span className="font-semibold">Auto-split</span> in Meal Blocks to
            fill everything instantly.
          </p>
        </div>
      </div>

      {/* Meal blocks */}
      <MealBlockEditor subtleHint={subtleHint} structured={structured} onChange={onChange} />

      {/* Supplements */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
        <div>
          <h4 className="font-semibold">Supplements</h4>
          <p className="text-xs text-gray-500 mt-1">
            These are daily recommendations. Next step is attaching SmartStack “safe picks” to each meal block.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <SearchSelect
            label="Protein Recommendation"
            options={OPTIONS.proteinRecommendation}
            value={structured.proteinRecommendation}
            onChange={(v) => onChange("proteinRecommendation", v)}
            onCommit={(v) => onChange("proteinRecommendation", v)}
            allowCustom
            placeholder="Search protein…"
          />

          <SearchSelect
            label="Creatine Recommendation"
            options={OPTIONS.creatineRecommendation}
            value={structured.creatineRecommendation}
            onChange={(v) => onChange("creatineRecommendation", v)}
            onCommit={(v) => onChange("creatineRecommendation", v)}
            allowCustom
            placeholder="Search creatine…"
          />

          <SearchSelect
            label="BCAA/EAA Recommendation"
            options={OPTIONS.bcaaRecommendation}
            value={structured.bcaaRecommendation}
            onChange={(v) => onChange("bcaaRecommendation", v)}
            onCommit={(v) => onChange("bcaaRecommendation", v)}
            allowCustom
            placeholder="Search BCAA/EAA…"
          />

          <SearchSelect
            label="Electrolytes Recommendation"
            options={OPTIONS.electrolytesRecommendation}
            value={structured.electrolytesRecommendation}
            onChange={(v) => onChange("electrolytesRecommendation", v)}
            onCommit={(v) => onChange("electrolytesRecommendation", v)}
            allowCustom
            placeholder="Search electrolytes…"
          />

          <div className="md:col-span-2">
            <SearchSelect
              label="Notes (Supplements)"
              options={OPTIONS.notesSupplements}
              value={structured.notesSupplements}
              onChange={(v) => onChange("notesSupplements", v)}
              onCommit={(v) => onChange("notesSupplements", v)}
              allowCustom
              placeholder="Search or type notes…"
            />
          </div>
        </div>
      </div>

      {/* Freeform notes */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Coach Notes (optional)</p>
        <textarea
          className="w-full min-h-[140px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
          value={structured.freeformNotes}
          onChange={(e) => onChange("freeformNotes", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onSave(e);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              onSaveNext(e);
            }
          }}
          placeholder="Examples: lactose sensitive, practice days increase carbs… (Enter = Save & Next)"
        />
        <p className={subtleHint}>
          Tip: use <span className="font-semibold">Shift+Enter</span> for new lines. Use{" "}
          <span className="font-semibold">Enter</span> to Save & Next.
        </p>
      </div>

      {/* Actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onReset}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={(e) => onSave(e)}
          disabled={createLoading || !selectedAthleteEmail}
          className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 ${
            createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {createLoading ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={(e) => onSaveNext(e)}
          disabled={createLoading || !selectedAthleteEmail}
          className={`w-full px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition ${
            createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
          }`}
        >
          {createLoading ? "Saving…" : "Save & Next"}
        </button>
      </div>

      <div className={subtleHint}>
        Built for speed: set daily targets → Auto-split into meal blocks → add dining hall rules + home examples → Save &
        Next through the roster.
      </div>
    </form>
  );
}
