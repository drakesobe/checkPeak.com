// components/org/prescriptions/planBuilder/mealBlocks/MealBlockEditor.jsx
"use client";

import { useMemo, useRef, useState } from "react";
import { autoSplitMeals } from "@/lib/org/prescriptions/prescriptions-utils";
import NumInput from "../inputs/NumInput";
import SplitPctInput from "../inputs/SplitPctInput";
import {
  cx, asNum, normalizeSplit, pctStr, mealCardTitle,
  getDefaultMealBlock, pickStructuredMacro,
} from "./mealBlockUtils";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";

const DS = {
  brand: "#1E3A5F", brandLight: "#2A4F7C", brandBg: "#EEF3F9", brandBorder: "#C0D0E0",
  safe: "#00873E", safeBg: "#F0FBF4", safeBorder: "#A8DFB8",
  caution: "#B86000", cautionBg: "#FFFBF0", cautionBorder: "#FFD580",
  border: "#E8ECF0", pageBg: "#F4F7FB", cardBg: "#FFFFFF",
  bodyText: "#1A2535", labelText: "#5A6A7D", dimText: "#9BA8B4",
};

/* ── helpers (logic unchanged) ────────────────────────────────────────────── */

function safeTargets(t) {
  const x = t && typeof t === "object" ? t : {};
  return {
    calories:    x.calories    ?? "",
    protein:     x.protein     ?? "",
    carbs:       x.carbs       ?? "",
    fat:         x.fat         ?? "",
    hydrationOz: x.hydrationOz ?? "",
  };
}

function getLocks(structured) {
  const raw = structured?.mealAutoSplitLocks;
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    calories:    Boolean(s.calories),
    protein:     Boolean(s.protein),
    carbs:       Boolean(s.carbs),
    fat:         Boolean(s.fat),
    hydrationOz: Boolean(s.hydrationOz),
  };
}

function setLocks(onChange, nextLocks) {
  onChange("mealAutoSplitLocks", nextLocks);
}

function applyLocksToBlocks({ currentBlocks, nextBlocks, locks }) {
  const out = { ...(nextBlocks && typeof nextBlocks === "object" ? nextBlocks : {}) };
  for (const k of ["breakfast", "lunch", "afternoon", "dinner"]) {
    const curT = safeTargets(currentBlocks?.[k]?.targets);
    const nxtT = safeTargets(out?.[k]?.targets);
    out[k] = {
      ...(getDefaultMealBlock(mealCardTitle(k))),
      ...out[k],
      targets: {
        ...nxtT,
        calories:    locks.calories    ? curT.calories    : nxtT.calories,
        protein:     locks.protein     ? curT.protein     : nxtT.protein,
        carbs:       locks.carbs       ? curT.carbs       : nxtT.carbs,
        fat:         locks.fat         ? curT.fat         : nxtT.fat,
        hydrationOz: locks.hydrationOz ? curT.hydrationOz : nxtT.hydrationOz,
      },
    };
  }
  return out;
}

function applyHydrationSplit({ blocks, normSplit, dailyHydrationOz }) {
  const total = Number(dailyHydrationOz);
  if (!Number.isFinite(total) || total <= 0) return blocks;
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  const ratios = {
    breakfast: Number(normSplit.breakfast) || 0,
    lunch:     Number(normSplit.lunch)     || 0,
    afternoon: Number(normSplit.afternoon) || 0,
    dinner:    Number(normSplit.dinner)    || 0,
  };
  const out = { ...(blocks || {}) };
  let used = 0;
  for (const k of keys) {
    const b = out?.[k] || getDefaultMealBlock(mealCardTitle(k));
    const t = safeTargets(b.targets);
    let oz = 0;
    if (k !== "dinner") { oz = Math.round(total * (ratios[k] || 0)); used += oz; }
    else { oz = Math.max(0, Math.round(total - used)); }
    out[k] = { ...b, targets: { ...t, hydrationOz: String(oz) } };
  }
  return out;
}

/* ── LockPill ──────────────────────────────────────────────────────────────── */

function LockPill({ label, locked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-sm transition-all"
      style={{
        backgroundColor: locked ? DS.brand   : DS.cardBg,
        color:           locked ? "#fff"     : DS.labelText,
        border:          `1px solid ${locked ? DS.brand : DS.border}`,
      }}
      onMouseEnter={(e) => { if (!locked) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
      onMouseLeave={(e) => { if (!locked) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; } }}
    >
      <span
        className="inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: locked ? "#6EE7B7" : DS.dimText }}
      />
      {label}
      <span
        className="text-[10px] font-black tracking-wide"
        style={{ color: locked ? "rgba(255,255,255,0.65)" : DS.dimText }}
      >
        {locked ? "LOCKED" : "AUTO"}
      </span>
    </button>
  );
}

/* ── MealSummaryLine ───────────────────────────────────────────────────────── */

function MealSummaryLine({ targets }) {
  const t = safeTargets(targets);
  return (
    <span className="text-xs tabular-nums" style={{ color: DS.labelText }}>
      {t.calories || "-"} cal · P {t.protein || "-"} · C {t.carbs || "-"} · F {t.fat || "-"} · 💧{t.hydrationOz || "-"}oz
    </span>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

export default function MealBlockEditor({ subtleHint, structured, onChange }) {
  const split    = structured?.mealSplit || {};
  const normSplit = useMemo(() => normalizeSplit(split), [split]);

  const mealBlocks = structured?.mealBlocks && typeof structured.mealBlocks === "object"
    ? structured.mealBlocks : {};

  const blocks = useMemo(() => [
    { key: "breakfast", label: "Breakfast" },
    { key: "lunch",     label: "Lunch"     },
    { key: "afternoon", label: "Afternoon" },
    { key: "dinner",    label: "Dinner"    },
  ], []);

  const daily = useMemo(() => ({
    calories:    pickStructuredMacro(structured, ["calories"]),
    protein:     pickStructuredMacro(structured, ["proteinGrams", "protein"]),
    carbs:       pickStructuredMacro(structured, ["carbsGrams", "carbs"]),
    fat:         pickStructuredMacro(structured, ["fatsGrams", "fat"]),
    hydrationOz: pickStructuredMacro(structured, ["hydrationOz", "dailyHydrationOz", "hydration"]),
  }), [structured]);

  const anyDailySet = Object.values(daily).some((v) => v != null);
  const locks = useMemo(() => getLocks(structured), [structured]);

  const [openMeal,     setOpenMeal]     = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const undoRef  = useRef(null);
  const [canUndo, setCanUndo] = useState(false);

  const saveUndoSnapshot = () => {
    undoRef.current = structured?.mealBlocks && typeof structured.mealBlocks === "object"
      ? structured.mealBlocks : {};
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
    const sum = { calories: 0, protein: 0, carbs: 0, fat: 0, hydrationOz: 0 };
    for (const { key } of blocks) {
      const t = mealBlocks?.[key]?.targets || {};
      sum.calories    += asNum(t.calories)    || 0;
      sum.protein     += asNum(t.protein)     || 0;
      sum.carbs       += asNum(t.carbs)       || 0;
      sum.fat         += asNum(t.fat)         || 0;
      sum.hydrationOz += asNum(t.hydrationOz) || 0;
    }
    return sum;
  }, [blocks, mealBlocks]);

  const mismatch = useMemo(() => {
    const m = {};
    if (daily.calories    != null) m.calories    = computedTotals.calories    - daily.calories;
    if (daily.protein     != null) m.protein     = computedTotals.protein     - daily.protein;
    if (daily.carbs       != null) m.carbs       = computedTotals.carbs       - daily.carbs;
    if (daily.fat         != null) m.fat         = computedTotals.fat         - daily.fat;
    if (daily.hydrationOz != null) m.hydrationOz = computedTotals.hydrationOz - daily.hydrationOz;
    return m;
  }, [daily, computedTotals]);

  const splitSumPct = useMemo(() => {
    const s = (asNum(split.breakfast) || 0) + (asNum(split.lunch) || 0) +
              (asNum(split.afternoon) || 0) + (asNum(split.dinner) || 0);
    return Math.round(s * 100);
  }, [split]);

  const setSplit   = (key, ratio) => onChange("mealSplit", { ...(structured.mealSplit || {}), [key]: ratio });
  const setBlock   = (key, patch) => {
    const next = { ...(structured.mealBlocks || {}) };
    next[key] = { ...(next[key] || getDefaultMealBlock(mealCardTitle(key))), ...patch };
    onChange("mealBlocks", next);
  };
  const setTargets = (key, patch) => {
    const next = { ...(structured.mealBlocks || {}) };
    const prev = next[key] || getDefaultMealBlock(mealCardTitle(key));
    next[key] = { ...prev, targets: { ...(prev.targets || {}), ...patch } };
    onChange("mealBlocks", next);
  };

  const handleAutoSplit = () => {
    if (!anyDailySet) return;
    saveUndoSnapshot();
    let nextBlocks = autoSplitMeals(structured);
    if (daily.hydrationOz != null) {
      nextBlocks = applyHydrationSplit({ blocks: nextBlocks, normSplit, dailyHydrationOz: daily.hydrationOz });
    }
    nextBlocks = applyLocksToBlocks({ currentBlocks: mealBlocks, nextBlocks, locks });
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

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAutoSplit}
          disabled={!anyDailySet}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
          style={{
            backgroundColor: anyDailySet ? DS.brand : DS.pageBg,
            color: anyDailySet ? "#fff" : DS.dimText,
            cursor: anyDailySet ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => { if (anyDailySet) e.currentTarget.style.backgroundColor = DS.brandLight; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = anyDailySet ? DS.brand : DS.pageBg; }}
          title={anyDailySet ? "Fill meals from daily targets" : "Set daily targets first"}
        >
          <Zap className="h-3.5 w-3.5" />
          Auto-split
        </button>

        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="px-3 py-2 text-xs font-bold rounded-sm transition-all"
          style={{
            border: `1px solid ${DS.border}`,
            backgroundColor: DS.cardBg,
            color: canUndo ? DS.labelText : DS.dimText,
            cursor: canUndo ? "pointer" : "not-allowed",
          }}
        >
          Undo
        </button>

        <button
          type="button"
          onClick={handleResetBlocks}
          className="px-3 py-2 text-xs font-bold rounded-sm transition-all"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
        >
          Reset meals
        </button>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all ml-auto"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
        >
          Advanced
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!anyDailySet && (
        <div
          className="px-3 py-2.5 text-xs"
          style={{ backgroundColor: DS.cautionBg, borderLeft: `3px solid ${DS.caution}`, color: DS.caution }}
        >
          Set daily targets first, then Auto-split fills meal targets instantly.
        </div>
      )}

      {/* Totals check */}
      <div style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
        <div className="px-3 py-2" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.labelText }}>
            Totals check
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px" style={{ backgroundColor: DS.border }}>
          {[
            { k: "calories",    label: "Cal",    val: computedTotals.calories,    d: daily.calories,    diff: mismatch.calories    },
            { k: "protein",     label: "Pro g",  val: computedTotals.protein,     d: daily.protein,     diff: mismatch.protein     },
            { k: "carbs",       label: "Carb g", val: computedTotals.carbs,       d: daily.carbs,       diff: mismatch.carbs       },
            { k: "fat",         label: "Fat g",  val: computedTotals.fat,         d: daily.fat,         diff: mismatch.fat         },
            { k: "hydrationOz", label: "Water oz", val: computedTotals.hydrationOz, d: daily.hydrationOz, diff: mismatch.hydrationOz },
          ].map((x) => {
            const onTarget = x.diff === 0;
            const over     = x.diff > 0;
            return (
              <div key={x.k} className="px-3 py-2" style={{ backgroundColor: DS.cardBg }}>
                <p className="text-xs" style={{ color: DS.dimText }}>{x.label}</p>
                <p className="text-sm font-black tabular-nums mt-0.5" style={{ color: DS.bodyText }}>{x.val}</p>
                <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                  vs {x.d ?? "-"}{" "}
                  {x.diff != null && (
                    <span
                      className="font-bold"
                      style={{ color: onTarget ? DS.safe : over ? DS.caution : DS.brand }}
                    >
                      {onTarget ? "✓" : over ? `+${x.diff}` : `${x.diff}`}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced drawer */}
      {showAdvanced && (
        <div style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}>
          <div className="px-3 py-3 space-y-3">
            {/* Locks */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.labelText }}>
                Auto-split locks
              </p>
              <p className="text-xs mb-2" style={{ color: DS.dimText }}>
                Lock fields you set manually - Auto-split won't overwrite them.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { k: "calories",    l: "Calories" },
                  { k: "protein",     l: "Protein"  },
                  { k: "carbs",       l: "Carbs"    },
                  { k: "fat",         l: "Fat"      },
                  { k: "hydrationOz", l: "Water"    },
                ].map(({ k, l }) => (
                  <LockPill
                    key={k}
                    label={l}
                    locked={locks[k]}
                    onToggle={() => setLocks(onChange, { ...locks, [k]: !locks[k] })}
                  />
                ))}
              </div>
            </div>

            {/* Split ratios */}
            <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "0.75rem" }}>
              <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.labelText }}>
                Split ratios
              </p>
              <div className="flex items-center gap-3 mb-2 text-xs">
                <span style={{ color: DS.dimText }}>
                  Sum:{" "}
                  <span
                    className="font-bold"
                    style={{ color: splitSumPct === 100 ? DS.safe : DS.caution }}
                  >
                    {splitSumPct}%
                  </span>
                  <span style={{ color: DS.dimText }}> (auto-normalizes)</span>
                </span>
                <span style={{ color: DS.dimText }}>
                  Normalized: <span className="font-bold">
                    {pctStr(normSplit.breakfast)} / {pctStr(normSplit.lunch)} / {pctStr(normSplit.afternoon)} / {pctStr(normSplit.dinner)}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SplitPctInput label="Breakfast" value={split.breakfast ?? 0.25} onChange={(r) => setSplit("breakfast", r)} />
                <SplitPctInput label="Lunch"     value={split.lunch     ?? 0.30} onChange={(r) => setSplit("lunch", r)}     />
                <SplitPctInput label="Afternoon" value={split.afternoon ?? 0.15} onChange={(r) => setSplit("afternoon", r)} />
                <SplitPctInput label="Dinner"    value={split.dinner    ?? 0.30} onChange={(r) => setSplit("dinner", r)}    />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meal accordion */}
      <div className="space-y-1.5">
        {blocks.map(({ key, label }) => {
          const b      = mealBlocks?.[key] || getDefaultMealBlock(label);
          const t      = b.targets || {};
          const isOpen = openMeal === key;

          return (
            <div key={key} style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}>
              <button
                type="button"
                onClick={() => setOpenMeal(isOpen ? "" : key)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                style={{ backgroundColor: isOpen ? DS.brandBg : "transparent" }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = DS.pageBg; }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: DS.bodyText }}>{mealCardTitle(key)}</p>
                  <div className="mt-0.5"><MealSummaryLine targets={t} /></div>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: DS.dimText }}>
                  {isOpen ? "Hide" : "Edit"}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: `1px solid ${DS.border}` }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <NumInput label="Calories"   value={t.calories    ?? ""} onChange={(v) => setTargets(key, { calories:    v })} step={25} />
                    <NumInput label="Protein g"  value={t.protein     ?? ""} onChange={(v) => setTargets(key, { protein:     v })} step={5}  />
                    <NumInput label="Carbs g"    value={t.carbs       ?? ""} onChange={(v) => setTargets(key, { carbs:       v })} step={5}  />
                    <NumInput label="Fat g"      value={t.fat         ?? ""} onChange={(v) => setTargets(key, { fat:         v })} step={5}  />
                    <NumInput label="Water oz"   value={t.hydrationOz ?? ""} onChange={(v) => setTargets(key, { hydrationOz: v })} step={1}
                      hint="Goal for this meal (ounces)." />
                  </div>

                  <div className="grid gap-2">
                    {[
                      { label: "Dining Hall Rules", field: "diningHallRules", placeholder: "e.g. 2 proteins + 1 carb + fruit. Avoid fried foods." },
                      { label: "Home Examples",     field: "homeExamples",     placeholder: "e.g. Eggs + oats + banana. Turkey sandwich + greek yogurt." },
                    ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>
                          {label}
                        </p>
                        <textarea
                          className="w-full min-h-[80px] resize-y text-sm px-3 py-2 outline-none rounded-sm"
                          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
                          value={String(b[field] || "")}
                          onChange={(e) => setBlock(key, { [field]: e.target.value })}
                          placeholder={placeholder}
                          onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
                          onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}