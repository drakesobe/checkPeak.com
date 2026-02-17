// components/athlete-today/nutrition/sections/MealTargets.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Droplets,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Coffee,
  Sun,
  Sunset,
  Moon,
  Utensils,
  Home,
  Clock3,
} from "lucide-react";
import { cx, safeText } from "../helpers";
import SwipeCompleteRow from "../ui/SwipeCompleteRow";
import MacroGrid from "../ui/MacroGrid";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mealForHour(h) {
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 18) return "afternoon";
  return "dinner";
}

function buildSafeCompletion(cur) {
  const c = cur && typeof cur === "object" ? cur : {};
  return {
    breakfast: {
      mealDone: Boolean(c?.breakfast?.mealDone),
      hydrationDone: Boolean(c?.breakfast?.hydrationDone),
    },
    lunch: {
      mealDone: Boolean(c?.lunch?.mealDone),
      hydrationDone: Boolean(c?.lunch?.hydrationDone),
    },
    afternoon: {
      mealDone: Boolean(c?.afternoon?.mealDone),
      hydrationDone: Boolean(c?.afternoon?.hydrationDone),
    },
    dinner: {
      mealDone: Boolean(c?.dinner?.mealDone),
      hydrationDone: Boolean(c?.dinner?.hydrationDone),
    },
  };
}

function safeMacro(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function pickMacroSummary(targets) {
  const t = targets && typeof targets === "object" ? targets : {};
  const calories =
    safeMacro(t.calories ?? t.Calories ?? t.kcal ?? t.Kcal ?? t.energy ?? t.Energy) ?? null;
  const protein = safeMacro(t.protein ?? t.Protein) ?? null;
  const carbs = safeMacro(t.carbs ?? t.Carbs) ?? null;
  const fat = safeMacro(t.fat ?? t.Fat) ?? null;
  return { calories, protein, carbs, fat };
}

function macroLine(summary) {
  if (!summary) return "";
  const bits = [];
  if (summary.calories != null) bits.push(`${summary.calories} cal`);
  if (summary.protein != null) bits.push(`${summary.protein}P`);
  if (summary.carbs != null) bits.push(`${summary.carbs}C`);
  if (summary.fat != null) bits.push(`${summary.fat}F`);
  return bits.join(" • ");
}

function MealIcon({ mealKey, active }) {
  const cls = cx("w-4 h-4", active ? "text-[#46769B]" : "text-gray-500");
  if (mealKey === "breakfast") return <Coffee className={cls} />;
  if (mealKey === "lunch") return <Sun className={cls} />;
  if (mealKey === "afternoon") return <Sunset className={cls} />;
  return <Moon className={cls} />;
}

function StatusDot({ doneBoth, partial }) {
  const cls = doneBoth ? "bg-emerald-500" : partial ? "bg-blue-500" : "bg-gray-300";
  return <span className={cx("h-2 w-2 rounded-full", cls)} aria-hidden="true" />;
}

function MiniBar({ pctValue }) {
  const p = clampPct(pctValue);
  return (
    <div
      className="h-2 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label="Meal completion progress"
    >
      <div className="h-full rounded-full bg-[#46769B] transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

function Chip({ children, tone = "neutral" }) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

/**
 * Mobile-friendly vertical macro list (readable on narrow screens)
 */
function MacroListMobile({ t }) {
  const obj = t && typeof t === "object" ? t : {};
  const rows = [
    { k: "Calories", v: obj.calories ?? obj.Calories ?? obj.kcal ?? obj.Kcal ?? obj.energy ?? obj.Energy, unit: "cal" },
    { k: "Protein", v: obj.protein ?? obj.Protein, unit: "g" },
    { k: "Carbs", v: obj.carbs ?? obj.Carbs, unit: "g" },
    { k: "Fat", v: obj.fat ?? obj.Fat, unit: "g" },
  ].filter((r) => String(r.v ?? "").trim() !== "");

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <p className="text-[12px] text-gray-600">No macro targets for this meal.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {rows.map((r, idx) => (
        <div
          key={r.k}
          className={cx(
            "flex items-center justify-between gap-3 px-4 py-3",
            idx !== 0 ? "border-t border-gray-200" : ""
          )}
        >
          <p className="text-[12px] font-semibold text-gray-700">{r.k}</p>
          <p className="text-[13px] font-extrabold text-gray-900 tabular-nums">
            {String(r.v).trim()}
            {r.unit ? <span className="ml-1 text-[11px] font-semibold text-gray-500">{r.unit}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function CollapsibleTip({ title, icon, text }) {
  const [open, setOpen] = useState(false);
  const preview = useMemo(() => {
    const s = String(text || "").trim();
    if (!s) return "";
    return s.replace(/\s+/g, " ").slice(0, 90);
  }, [text]);

  if (!String(text || "").trim()) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "w-full px-4 py-3 flex items-center justify-between gap-3 text-left",
          "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
        )}
        aria-expanded={open}
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{open ? "Tap to hide" : preview || "Tap to view"}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="tip"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{text}</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function MealTargets({ mealBlocks, completion, nutritionCompletion, onSetCompletion }) {
  const mealKeys = useMemo(() => ["breakfast", "lunch", "afternoon", "dinner"], []);
  const mealLabels = useMemo(
    () => ({ breakfast: "Breakfast", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner" }),
    []
  );

  const safeBlocks = useMemo(() => (mealBlocks && typeof mealBlocks === "object" ? mealBlocks : {}), [mealBlocks]);

  const counts = useMemo(() => {
    const c = completion && typeof completion === "object" ? completion : {};
    let done = 0;
    const total = mealKeys.length * 2;
    for (const k of mealKeys) {
      if (Boolean(c?.[k]?.mealDone)) done += 1;
      if (Boolean(c?.[k]?.hydrationDone)) done += 1;
    }
    const pctVal = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pctVal };
  }, [completion, mealKeys]);

  const tone = counts.done === counts.total && counts.total > 0 ? "ok" : counts.pctVal >= 50 ? "blue" : "neutral";

  // Simple selection model:
  // - default to “recommended by time”
  // - user can tap a meal row to open it
  const recommendedMeal = useMemo(() => mealForHour(new Date().getHours()), []);
  const [openMeal, setOpenMeal] = useState(recommendedMeal);

  const setCompletion = useCallback(
    (next) => typeof onSetCompletion === "function" && onSetCompletion(next),
    [onSetCompletion]
  );

  const toggleMealDone = useCallback(
    (mealKey) => {
      const safe = buildSafeCompletion(nutritionCompletion);
      const next = { ...safe, [mealKey]: { ...safe[mealKey], mealDone: !safe[mealKey].mealDone } };
      setCompletion(next);
    },
    [nutritionCompletion, setCompletion]
  );

  const toggleHydrationDone = useCallback(
    (mealKey) => {
      const safe = buildSafeCompletion(nutritionCompletion);
      const next = { ...safe, [mealKey]: { ...safe[mealKey], hydrationDone: !safe[mealKey].hydrationDone } };
      setCompletion(next);
    },
    [nutritionCompletion, setCompletion]
  );

  const anim = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4 text-[#46769B]" />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900">Meals</p>
              <p className="text-[11px] text-gray-500 truncate inline-flex items-center gap-1">
                <Clock3 className="w-3.5 h-3.5" />
                Recommended now: {mealLabels[recommendedMeal]}
              </p>
            </div>
          </div>

          <Chip tone={tone}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            {counts.done}/{counts.total}
          </Chip>
        </div>

        <div className="mt-3">
          <MiniBar pctValue={counts.pctVal} />
        </div>

        {/* MOBILE: Simple accordion list */}
        <div className="mt-4 space-y-2 sm:hidden">
          {mealKeys.map((k) => {
            const isOpen = openMeal === k;
            const doneMeal = Boolean(completion?.[k]?.mealDone);
            const doneWater = Boolean(completion?.[k]?.hydrationDone);
            const doneBoth = doneMeal && doneWater;
            const partial = !doneBoth && (doneMeal || doneWater);

            const block = safeBlocks?.[k];
            const targets = block?.targets && typeof block.targets === "object" ? block.targets : {};
            const dining = safeText(block?.diningHallRules);
            const home = safeText(block?.homeExamples);

            const preview = macroLine(pickMacroSummary(targets)) || "Targets set by your coach.";

            return (
              <div key={k} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setOpenMeal((cur) => (cur === k ? "" : k))}
                  className={cx(
                    "w-full px-4 py-3 flex items-center justify-between gap-3 text-left",
                    "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#46769B]/25"
                  )}
                  aria-expanded={isOpen}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                      <MealIcon mealKey={k} active={isOpen} />
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-gray-900 truncate">{mealLabels[k]}</p>
                        <StatusDot doneBoth={doneBoth} partial={partial} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {doneBoth ? "Done" : preview}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                      {doneMeal ? "Meal ✓" : "Meal —"} · {doneWater ? "Water ✓" : "Water —"}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Body */}
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key={`open-${k}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.16 }}
                      className="overflow-hidden"
                    >
                      <motion.div
                        initial={anim.initial}
                        animate={anim.animate}
                        exit={anim.exit}
                        transition={{ duration: 0.16 }}
                        className="px-4 pb-4"
                      >
                        <div className="pt-3 space-y-3">
                          {/* Targets */}
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-700">
                              Targets
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 truncate">
                              {macroLine(pickMacroSummary(targets))}
                            </p>
                            <div className="mt-3">
                              <MacroListMobile t={targets} />
                            </div>
                          </div>

                          {/* Completion actions */}
                          <div className="grid gap-3">
                            <SwipeCompleteRow
                              tone="meal"
                              title="Meal complete"
                              subtitle={doneMeal ? "Marked complete." : "Swipe right when you finish."}
                              done={doneMeal}
                              onToggle={() => toggleMealDone(k)}
                              icon={
                                doneMeal ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-400" />
                                )
                              }
                            />

                            <SwipeCompleteRow
                              tone="water"
                              title="Hydration complete"
                              subtitle={doneWater ? "Marked complete." : "Swipe right when you hit the water target."}
                              done={doneWater}
                              onToggle={() => toggleHydrationDone(k)}
                              icon={<Droplets className={cx("w-4 h-4", doneWater ? "text-blue-700" : "text-gray-400")} />}
                            />
                          </div>

                          {/* Tips (optional) */}
                          {(dining || home) ? (
                            <div className="grid gap-3">
                              <CollapsibleTip
                                title="Dining hall"
                                icon={<Utensils className="w-4 h-4 text-gray-700" />}
                                text={dining}
                              />
                              <CollapsibleTip
                                title="Home examples"
                                icon={<Home className="w-4 h-4 text-gray-700" />}
                                text={home}
                              />
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* SM+: Keep your richer view (simple selection, no pin wording) */}
        <div className="hidden sm:block mt-4">
          {/* Selected meal buttons */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2">
            <div className="grid grid-cols-4 gap-2">
              {mealKeys.map((k) => {
                const isActive = openMeal === k;
                const doneMeal = Boolean(completion?.[k]?.mealDone);
                const doneWater = Boolean(completion?.[k]?.hydrationDone);
                const doneBoth = doneMeal && doneWater;

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOpenMeal(k)}
                    className={cx(
                      "rounded-2xl border px-3 py-2 text-left transition",
                      isActive ? "bg-white border-gray-200 shadow-sm" : "bg-transparent border-transparent hover:bg-white/70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
                        <MealIcon mealKey={k} active={isActive} />
                      </span>
                      <span
                        className={cx(
                          "text-[10px] font-extrabold px-2 py-1 rounded-full border whitespace-nowrap",
                          doneBoth ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-gray-50 border-gray-200 text-gray-700"
                        )}
                      >
                        {doneBoth ? "Done" : "Open"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-extrabold text-gray-900 truncate">{mealLabels[k]}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      Meal {doneMeal ? "✓" : "—"} · Water {doneWater ? "✓" : "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected meal content */}
          {(() => {
            const k = openMeal || recommendedMeal;
            const block = safeBlocks?.[k];
            const targets = block?.targets && typeof block.targets === "object" ? block.targets : {};
            const dining = safeText(block?.diningHallRules);
            const home = safeText(block?.homeExamples);

            const doneMeal = Boolean(completion?.[k]?.mealDone);
            const doneWater = Boolean(completion?.[k]?.hydrationDone);

            return (
              <div className="mt-4 rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <span className="h-10 w-10 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
                        <MealIcon mealKey={k} active />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-extrabold text-gray-900">{mealLabels[k]}</p>
                          <Chip tone={doneMeal && doneWater ? "ok" : "blue"}>
                            {doneMeal && doneWater ? "Done" : "In progress"}
                          </Chip>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-1">Hit the targets. Then mark meal + water.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-700">Targets</p>
                      <p className="text-[11px] font-semibold text-gray-500 truncate">
                        {macroLine(pickMacroSummary(targets)) || ""}
                      </p>
                    </div>
                    <div className="mt-3">
                      <MacroGrid t={targets} />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <SwipeCompleteRow
                      tone="meal"
                      title="Meal complete"
                      subtitle={doneMeal ? "Marked complete." : "Swipe right when you finish."}
                      done={doneMeal}
                      onToggle={() => toggleMealDone(k)}
                      icon={
                        doneMeal ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-400" />
                        )
                      }
                    />

                    <SwipeCompleteRow
                      tone="water"
                      title="Hydration complete"
                      subtitle={doneWater ? "Marked complete." : "Swipe right when you hit the water target."}
                      done={doneWater}
                      onToggle={() => toggleHydrationDone(k)}
                      icon={<Droplets className={cx("w-4 h-4", doneWater ? "text-blue-700" : "text-gray-400")} />}
                    />
                  </div>

                  {(dining || home) ? (
                    <div className="grid md:grid-cols-2 gap-3">
                      <CollapsibleTip title="Dining hall" icon={<Utensils className="w-4 h-4 text-gray-700" />} text={dining} />
                      <CollapsibleTip title="Home examples" icon={<Home className="w-4 h-4 text-gray-700" />} text={home} />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>

        <p className="text-[11px] text-gray-500 sm:hidden mt-3">
          Tap a meal to open it. Swipe right to mark meal + hydration.
        </p>
      </div>
    </div>
  );
}
