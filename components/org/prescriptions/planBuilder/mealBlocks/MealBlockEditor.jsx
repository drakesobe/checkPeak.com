// components/org/prescriptions/planBuilder/mealBlocks/MealBlockEditor.jsx
"use client";

import { useMemo, useRef, useState } from "react";
import { autoSplitMeals } from "@/lib/org/prescriptions/prescriptions-utils";
import NumInput from "../inputs/NumInput";
import SplitPctInput from "../inputs/SplitPctInput";
import {
  cx,
  asNum,
  normalizeSplit,
  pctStr,
  mealCardTitle,
  getDefaultMealBlock,
  pickStructuredMacro,
} from "./mealBlockUtils";

/** ---------------- helpers ---------------- */

function safeTargets(t) {
  const x = t && typeof t === "object" ? t : {};
  return {
    calories: x.calories ?? "",
    protein: x.protein ?? "",
    carbs: x.carbs ?? "",
    fat: x.fat ?? "",
    hydrationOz: x.hydrationOz ?? "", // ✅
  };
}

// locks stored on structured so templates keep them
function getLocks(structured) {
  const raw = structured?.mealAutoSplitLocks;
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    calories: Boolean(s.calories),
    protein: Boolean(s.protein),
    carbs: Boolean(s.carbs),
    fat: Boolean(s.fat),
    hydrationOz: Boolean(s.hydrationOz), // ✅
  };
}

function setLocks(onChange, nextLocks) {
  onChange("mealAutoSplitLocks", nextLocks);
}

function applyLocksToBlocks({ currentBlocks, nextBlocks, locks }) {
  const out = { ...(nextBlocks && typeof nextBlocks === "object" ? nextBlocks : {}) };
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];

  for (const k of keys) {
    const cur = currentBlocks?.[k] || {};
    const nxt = out?.[k] || {};
    const curT = safeTargets(cur.targets);
    const nxtT = safeTargets(nxt.targets);

    out[k] = {
      ...(getDefaultMealBlock(mealCardTitle(k))),
      ...nxt,
      targets: {
        ...nxtT,
        calories: locks.calories ? curT.calories : nxtT.calories,
        protein: locks.protein ? curT.protein : nxtT.protein,
        carbs: locks.carbs ? curT.carbs : nxtT.carbs,
        fat: locks.fat ? curT.fat : nxtT.fat,
        hydrationOz: locks.hydrationOz ? curT.hydrationOz : nxtT.hydrationOz, // ✅
      },
    };
  }

  return out;
}

/**
 * ✅ Hydration split
 * - Uses normalized split ratios (breakfast/lunch/afternoon/dinner)
 * - Produces integer oz targets
 * - Dinner gets the remainder to keep totals exact
 */
function applyHydrationSplit({ blocks, normSplit, dailyHydrationOz }) {
  const total = Number(dailyHydrationOz);
  if (!Number.isFinite(total) || total <= 0) return blocks;

  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  const ratios = {
    breakfast: Number(normSplit.breakfast) || 0,
    lunch: Number(normSplit.lunch) || 0,
    afternoon: Number(normSplit.afternoon) || 0,
    dinner: Number(normSplit.dinner) || 0,
  };

  const out = { ...(blocks || {}) };

  let used = 0;
  for (const k of keys) {
    const b = out?.[k] || getDefaultMealBlock(mealCardTitle(k));
    const t = safeTargets(b.targets);

    let oz = 0;
    if (k !== "dinner") {
      oz = Math.round(total * (ratios[k] || 0));
      used += oz;
    } else {
      oz = Math.max(0, Math.round(total - used));
    }

    out[k] = {
      ...b,
      targets: { ...t, hydrationOz: String(oz) },
    };
  }

  return out;
}

function MacroLockPill({ label, locked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      className={cx(
        "group relative inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-[#46769B]/30",
        locked
          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
          : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
      )}
      title={
        locked
          ? "Locked: Auto-split will not overwrite this field"
          : "Unlocked: Auto-split can overwrite this field"
      }
    >
      <span
        className={cx(
          "inline-flex h-2.5 w-2.5 rounded-full transition",
          locked ? "bg-emerald-400" : "bg-gray-300 group-hover:bg-gray-400"
        )}
      />
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={cx(
          "ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
          locked ? "bg-white/15 text-white" : "bg-gray-100 text-gray-600"
        )}
      >
        {locked ? "LOCKED" : "AUTO"}
      </span>
    </button>
  );
}

function MealRowSummary({ targets }) {
  const t = safeTargets(targets);
  const cal = String(t.calories || "—");
  const p = String(t.protein || "—");
  const c = String(t.carbs || "—");
  const f = String(t.fat || "—");
  const w = String(t.hydrationOz || "—"); // ✅
  return (
    <span className="text-[11px] text-gray-600 tabular-nums break-words">
      {cal} cal · P {p} · C {c} · F {f} · 💧 {w}oz
    </span>
  );
}

export default function MealBlockEditor({ subtleHint, structured, onChange, ui = "guided" }) {
  const split = structured?.mealSplit || {};
  const normSplit = useMemo(() => normalizeSplit(split), [split]);

  const mealBlocks =
    structured?.mealBlocks && typeof structured.mealBlocks === "object" ? structured.mealBlocks : {};

  const blocks = useMemo(
    () => [
      { key: "breakfast", label: "Breakfast" },
      { key: "lunch", label: "Lunch" },
      { key: "afternoon", label: "Afternoon" },
      { key: "dinner", label: "Dinner" },
    ],
    []
  );

  // ✅ include daily hydration
  const daily = useMemo(
    () => ({
      calories: pickStructuredMacro(structured, ["calories"]),
      protein: pickStructuredMacro(structured, ["proteinGrams", "protein"]),
      carbs: pickStructuredMacro(structured, ["carbsGrams", "carbs"]),
      fat: pickStructuredMacro(structured, ["fatsGrams", "fat"]),
      hydrationOz: pickStructuredMacro(structured, ["hydrationOz", "dailyHydrationOz", "hydration"]), // ✅
    }),
    [structured]
  );

  const anyDailySet =
    daily.calories != null ||
    daily.protein != null ||
    daily.carbs != null ||
    daily.fat != null ||
    daily.hydrationOz != null; // ✅

  const locks = useMemo(() => getLocks(structured), [structured]);

  // accordion + advanced toggle
  const [openMeal, setOpenMeal] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // one-level undo for bulk actions
  const undoRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);

  const saveUndoSnapshot = () => {
    undoRef.current =
      structured?.mealBlocks && typeof structured.mealBlocks === "object" ? structured.mealBlocks : {};
    setCanUndo(true);
  };

  const handleUndo = () => {
    const snap = undoRef.current;
    if (!snap || typeof snap !== "object") return;
    onChange("mealBlocks", snap);
    undoRef.current = null;
    setCanUndo(false);
  };

  const computedTotals = useMemo(() => {
    const sum = { calories: 0, protein: 0, carbs: 0, fat: 0, hydrationOz: 0 }; // ✅
    for (const { key } of blocks) {
      const t = mealBlocks?.[key]?.targets || {};
      sum.calories += asNum(t.calories) || 0;
      sum.protein += asNum(t.protein) || 0;
      sum.carbs += asNum(t.carbs) || 0;
      sum.fat += asNum(t.fat) || 0;
      sum.hydrationOz += asNum(t.hydrationOz) || 0; // ✅
    }
    return sum;
  }, [blocks, mealBlocks]);

  const mismatch = useMemo(() => {
    const m = {};
    if (daily.calories != null) m.calories = computedTotals.calories - daily.calories;
    if (daily.protein != null) m.protein = computedTotals.protein - daily.protein;
    if (daily.carbs != null) m.carbs = computedTotals.carbs - daily.carbs;
    if (daily.fat != null) m.fat = computedTotals.fat - daily.fat;
    if (daily.hydrationOz != null) m.hydrationOz = computedTotals.hydrationOz - daily.hydrationOz; // ✅
    return m;
  }, [daily, computedTotals]);

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
    if (!anyDailySet) return;
    saveUndoSnapshot();

    // 1) split macros via your existing helper
    let nextBlocks = autoSplitMeals(structured);

    // 2) ✅ add hydration split using ratios (keeps totals exact)
    if (daily.hydrationOz != null) {
      nextBlocks = applyHydrationSplit({
        blocks: nextBlocks,
        normSplit,
        dailyHydrationOz: daily.hydrationOz,
      });
    }

    // 3) apply locks (including hydrationOz lock)
    nextBlocks = applyLocksToBlocks({
      currentBlocks: mealBlocks,
      nextBlocks,
      locks,
    });

    onChange("mealBlocks", nextBlocks);

    if (!openMeal) setOpenMeal("breakfast");
  };

  const handleResetBlocks = () => {
    saveUndoSnapshot();
    const next = {};
    for (const { key, label } of blocks) next[key] = getDefaultMealBlock(label);
    onChange("mealBlocks", next);
    setOpenMeal("");
  };

  const splitSumPct = useMemo(() => {
    const s =
      (asNum(split.breakfast) || 0) +
      (asNum(split.lunch) || 0) +
      (asNum(split.afternoon) || 0) +
      (asNum(split.dinner) || 0);
    return Math.round(s * 100);
  }, [split]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-4 overflow-hidden">
      {/* Header + primary actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">Meal Plan</p>
          <p className="text-xs text-gray-600 mt-1 break-words">
            Click <span className="font-semibold">Auto-split</span> to fill macros +{" "}
            <span className="font-semibold">water (oz)</span> per meal. Expand a meal only if you need to tweak.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleAutoSplit}
            disabled={!anyDailySet}
            className={cx(
              "px-4 py-2 rounded-xl text-sm font-semibold transition",
              anyDailySet
                ? "bg-[#46769B] text-white hover:brightness-110"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            )}
            title={anyDailySet ? "Fill meals from daily targets" : "Set daily macros/hydration above first"}
          >
            Auto-split
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className={cx(
              "px-4 py-2 rounded-xl border text-sm font-semibold transition",
              canUndo
                ? "bg-white border-gray-200 hover:bg-gray-50"
                : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            Undo
          </button>

          <button
            type="button"
            onClick={handleResetBlocks}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {!anyDailySet ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Step 1 needed first</p>
          <p className="text-xs text-amber-800 mt-1">
            Set daily calories/macros and hydration above, then Auto-split fills meal targets instantly.
          </p>
        </div>
      ) : null}

      {/* Totals check */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">Totals check</p>
            <p className="text-xs text-gray-500 mt-1">Quick sanity check vs daily targets (including water).</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-semibold hover:bg-gray-50"
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { k: "calories", label: "Calories", val: computedTotals.calories, daily: daily.calories, diff: mismatch.calories },
            { k: "protein", label: "Protein", val: computedTotals.protein, daily: daily.protein, diff: mismatch.protein },
            { k: "carbs", label: "Carbs", val: computedTotals.carbs, daily: daily.carbs, diff: mismatch.carbs },
            { k: "fat", label: "Fat", val: computedTotals.fat, daily: daily.fat, diff: mismatch.fat },
            { k: "hydrationOz", label: "Water (oz)", val: computedTotals.hydrationOz, daily: daily.hydrationOz, diff: mismatch.hydrationOz }, // ✅
          ].map((x) => (
            <div key={x.k} className="rounded-xl border border-gray-200 bg-gray-50 p-3 min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{x.label}</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1 tabular-nums">{x.val}</p>
              <p className="text-[11px] text-gray-600 mt-1 break-words">
                vs {x.daily ?? "—"} <span className="ml-1">{mismatchBadge(x.diff)}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced drawer */}
      {showAdvanced ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 space-y-4 overflow-hidden">
          <div>
            <p className="text-sm font-bold text-gray-900">Auto-split locks</p>
            <p className="text-xs text-gray-500 mt-1">
              Lock fields you set manually so Auto-split won’t overwrite them.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <MacroLockPill
                label="Calories"
                locked={locks.calories}
                onToggle={() => setLocks(onChange, { ...locks, calories: !locks.calories })}
              />
              <MacroLockPill
                label="Protein"
                locked={locks.protein}
                onToggle={() => setLocks(onChange, { ...locks, protein: !locks.protein })}
              />
              <MacroLockPill
                label="Carbs"
                locked={locks.carbs}
                onToggle={() => setLocks(onChange, { ...locks, carbs: !locks.carbs })}
              />
              <MacroLockPill
                label="Fat"
                locked={locks.fat}
                onToggle={() => setLocks(onChange, { ...locks, fat: !locks.fat })}
              />
              <MacroLockPill
                label="Water (oz)"
                locked={locks.hydrationOz}
                onToggle={() => setLocks(onChange, { ...locks, hydrationOz: !locks.hydrationOz })}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-900">Split ratios</p>
            <p className="text-xs text-gray-500 mt-1">Optional. If you never touch this, it still works.</p>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-600">
              <span>
                Sum:{" "}
                <span className={cx("font-semibold", splitSumPct === 100 ? "text-emerald-700" : "text-amber-700")}>
                  {splitSumPct}%
                </span>{" "}
                <span className="text-gray-400">(normalizes)</span>
              </span>
              <span className="text-gray-500">
                Normalized:{" "}
                <span className="font-semibold">
                  {pctStr(normSplit.breakfast)} / {pctStr(normSplit.lunch)} / {pctStr(normSplit.afternoon)} /{" "}
                  {pctStr(normSplit.dinner)}
                </span>
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SplitPctInput
                label="Breakfast"
                value={split.breakfast ?? 0.25}
                onChange={(r) => setSplit("breakfast", r)}
              />
              <SplitPctInput label="Lunch" value={split.lunch ?? 0.3} onChange={(r) => setSplit("lunch", r)} />
              <SplitPctInput
                label="Afternoon"
                value={split.afternoon ?? 0.15}
                onChange={(r) => setSplit("afternoon", r)}
              />
              <SplitPctInput label="Dinner" value={split.dinner ?? 0.3} onChange={(r) => setSplit("dinner", r)} />
            </div>

            <p className={cx("mt-3", subtleHint)}>
              Tip: hydration uses the same split ratios so athletes get “water per meal.”
            </p>
          </div>
        </div>
      ) : null}

      {/* Meal accordion */}
      <div className="space-y-3">
        {blocks.map(({ key, label }) => {
          const b = mealBlocks?.[key] || getDefaultMealBlock(label);
          const t = b.targets || {};
          const isOpen = openMeal === key;

          return (
            <div key={key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenMeal(isOpen ? "" : key)}
                className="w-full px-4 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-gray-900">{mealCardTitle(key)}</p>
                  <div className="mt-1">
                    <MealRowSummary targets={t} />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-500">{isOpen ? "Hide" : "Edit"}</span>
              </button>

              {isOpen ? (
                <div className="px-4 pb-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumInput
                      label="Calories"
                      value={t.calories ?? ""}
                      onChange={(v) => setTargets(key, { calories: v })}
                      step={25}
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

                    {/* ✅ Water per meal (full width on small screens, fits grid cleanly) */}
                    <div className="sm:col-span-2">
                      <NumInput
                        label="Water (oz)"
                        value={t.hydrationOz ?? ""}
                        onChange={(v) => setTargets(key, { hydrationOz: v })}
                        step={1}
                        hint="Athlete goal for this meal (ounces)."
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Dining Hall Rules</p>
                      <textarea
                        className="w-full min-h-[84px] sm:min-h-[96px] resize-y px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                        value={String(b.diningHallRules || "")}
                        onChange={(e) => setBlock(key, { diningHallRules: e.target.value })}
                        placeholder="e.g. 2 proteins + 1 carb + fruit. Avoid fried foods."
                      />
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-2">Home Examples</p>
                      <textarea
                        className="w-full min-h-[84px] sm:min-h-[96px] resize-y px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                        value={String(b.homeExamples || "")}
                        onChange={(e) => setBlock(key, { homeExamples: e.target.value })}
                        placeholder="e.g. Eggs + oats + banana. Turkey sandwich + greek yogurt."
                      />
                    </div>

                    <p className={cx("break-words", subtleHint)}>
                      SmartStack safe picks will be stored in{" "}
                      <span className="font-semibold">mealBlocks.{key}.smartStackItems</span>.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
