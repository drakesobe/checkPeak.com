// components/athlete-today/nutrition/sections/MealTargets.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Droplets,
  Info,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Utensils,
  Home,
  Coffee,
  Sun,
  Sunset,
  Moon,
  Zap,
  Target,
  Flame,
  ArrowRight,
} from "lucide-react";
import { cx, safeText } from "../helpers";
import SwipeCompleteRow from "../ui/SwipeCompleteRow";
import MacroGrid from "../ui/MacroGrid";

/* -------------------------------------------------------------------------- */
/* Micro UI bits                                                              */
/* -------------------------------------------------------------------------- */

function MealIcon({ mealKey, active }) {
  const cls = cx("w-4 h-4", active ? "text-[#46769B]" : "text-gray-500");
  if (mealKey === "breakfast") return <Coffee className={cls} />;
  if (mealKey === "lunch") return <Sun className={cls} />;
  if (mealKey === "afternoon") return <Sunset className={cls} />;
  return <Moon className={cls} />;
}

function FieldTag({ children, tone = "soft" }) {
  const toneCls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-gray-200 bg-gray-50 text-gray-800";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
        "shrink-0 whitespace-nowrap"
      , toneCls)}
    >
      {children}
    </span>
  );
}

/** Clamp helper: 1 line on mobile, 2 lines on sm+ */
function ClampText({ children, className }) {
  return (
    <p className={cx("text-xs text-gray-500 font-semibold line-clamp-1 sm:line-clamp-2", className)}>
      {children}
    </p>
  );
}

/** Small, clean ring that reads well on mobile */
function StatusRing({ mealDone, waterDone, pulse = false }) {
  const doneBoth = mealDone && waterDone;
  const partial = !doneBoth && (mealDone || waterDone);

  // Soft SaaS tones
  const shellCls = doneBoth
    ? "border-emerald-200 bg-emerald-50"
    : partial
    ? "border-blue-200 bg-blue-50"
    : "border-gray-200 bg-white";

  const iconCls = doneBoth
    ? "text-emerald-700"
    : partial
    ? "text-blue-700"
    : "text-gray-400";

  // A subtle “halo” behind the ring when done (or while pulsing)
  const haloCls = doneBoth
    ? "bg-emerald-200/30"
    : partial
    ? "bg-blue-200/25"
    : "bg-transparent";

  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      {/* Halo */}
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-[-6px] rounded-full blur-[2px] transition-opacity",
          haloCls,
          pulse ? "opacity-100" : doneBoth || partial ? "opacity-80" : "opacity-0"
        )}
      />

      {/* Ring */}
      <span
        className={cx(
          "relative inline-flex items-center justify-center h-9 w-9 rounded-full border",
          "shadow-[0_1px_0_rgba(0,0,0,0.04)]",
          shellCls
        )}
        aria-hidden="true"
      >
        {doneBoth ? (
          <CheckCircle2 className={cx("w-5 h-5", iconCls)} />
        ) : (
          <Circle className={cx("w-5 h-5", iconCls)} />
        )}
        </span>
      </span>
  );
}

function MiniStat({ icon, label, value, tone = "soft" }) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-gray-200 bg-gray-50 text-gray-900";

  return (
    <div className={cx("rounded-2xl border px-3 py-2 min-w-0 flex items-center gap-2", toneCls)}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-extrabold opacity-80 truncate">{label}</p>
        <p className="text-xs font-extrabold truncate">{value}</p>
      </div>
    </div>
  );
}

/**
 * CollapsiblePanel
 * ✅ better spacing
 * ✅ preview line when closed
 * ✅ inner “Details” wrapper to feel like a premium drawer
 */
function CollapsiblePanel({ title, icon, open, onToggle, preview = "", children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
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
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {open ? "Tap to hide" : preview ? preview : "Tap to view"}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {open ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#46769B]" aria-hidden="true" />
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-700 truncate">
                    Details
                  </p>
                </div>
                {children}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Completion helpers                                                         */
/* -------------------------------------------------------------------------- */

function buildSafeCompletion(cur) {
  const c = cur && typeof cur === "object" ? cur : {};
  return {
    breakfast: { mealDone: Boolean(c?.breakfast?.mealDone), hydrationDone: Boolean(c?.breakfast?.hydrationDone) },
    lunch: { mealDone: Boolean(c?.lunch?.mealDone), hydrationDone: Boolean(c?.lunch?.hydrationDone) },
    afternoon: { mealDone: Boolean(c?.afternoon?.mealDone), hydrationDone: Boolean(c?.afternoon?.hydrationDone) },
    dinner: { mealDone: Boolean(c?.dinner?.mealDone), hydrationDone: Boolean(c?.dinner?.hydrationDone) },
  };
}

function findNextIncomplete(nextCompletion, mealKeys, afterKey) {
  const idx = Math.max(0, mealKeys.indexOf(afterKey));
  for (let i = 1; i <= mealKeys.length; i++) {
    const k = mealKeys[(idx + i) % mealKeys.length];
    const doneBoth = Boolean(nextCompletion?.[k]?.mealDone) && Boolean(nextCompletion?.[k]?.hydrationDone);
    if (!doneBoth) return k;
  }
  return afterKey;
}

function firstLinePreview(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  const line = s.split("\n").find(Boolean) || s;
  return line.replace(/\s+/g, " ").slice(0, 120);
}

function safeMacro(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function pickMacroSummary(t) {
  const obj = t && typeof t === "object" ? t : {};
  const calories =
    safeMacro(obj.calories ?? obj.Calories ?? obj.kcal ?? obj.Kcal ?? obj.energy ?? obj.Energy) ?? null;

  const protein = safeMacro(obj.protein ?? obj.Protein ?? obj.p ?? obj.P) ?? null;
  const carbs = safeMacro(obj.carbs ?? obj.Carbs ?? obj.c ?? obj.C) ?? null;
  const fat = safeMacro(obj.fat ?? obj.Fat ?? obj.f ?? obj.F) ?? null;

  return { calories, protein, carbs, fat };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

export default function MealTargets({
  mealBlocks,
  completion,
  nutritionCompletion, // raw for toggles (defensive)
  onSetCompletion,
}) {
  const mealKeys = useMemo(() => ["breakfast", "lunch", "afternoon", "dinner"], []);
  const mealLabels = useMemo(
    () => ({
      breakfast: "Breakfast",
      lunch: "Lunch",
      afternoon: "Afternoon",
      dinner: "Dinner",
    }),
    []
  );

  const initialMeal = useMemo(() => {
    for (const k of mealKeys) {
      const doneBoth = Boolean(completion?.[k]?.mealDone) && Boolean(completion?.[k]?.hydrationDone);
      if (!doneBoth) return k;
    }
    return "breakfast";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeMeal, setActiveMeal] = useState(initialMeal);

  const currentMealBlock = useMemo(() => {
    const mb = mealBlocks && typeof mealBlocks === "object" ? mealBlocks : null;
    if (!mb) return null;
    const b = mb?.[activeMeal];
    return b && typeof b === "object" ? b : null;
  }, [mealBlocks, activeMeal]);

  const currentTargets = useMemo(() => currentMealBlock?.targets || {}, [currentMealBlock]);
  const currentDining = useMemo(() => safeText(currentMealBlock?.diningHallRules), [currentMealBlock]);
  const currentHome = useMemo(() => safeText(currentMealBlock?.homeExamples), [currentMealBlock]);

  // Collapsible panels default open if content exists, but also update when content changes
  const [diningOpen, setDiningOpen] = useState(Boolean(currentDining));
  const [homeOpen, setHomeOpen] = useState(Boolean(currentHome));
  useEffect(() => setDiningOpen(Boolean(currentDining)), [currentDining]);
  useEffect(() => setHomeOpen(Boolean(currentHome)), [currentHome]);

  // Completion counts
  const counts = useMemo(() => {
    const c = completion && typeof completion === "object" ? completion : {};
    let mealsDone = 0;
    let waterDone = 0;
    for (const k of mealKeys) {
      if (Boolean(c?.[k]?.mealDone)) mealsDone += 1;
      if (Boolean(c?.[k]?.hydrationDone)) waterDone += 1;
    }
    const total = mealKeys.length * 2;
    const done = mealsDone + waterDone;
    return { mealsDone, waterDone, done, total };
  }, [completion, mealKeys]);

  const macroSummary = useMemo(() => pickMacroSummary(currentTargets), [currentTargets]);

  // Pulse when meal becomes doneBoth
  const [pulseKey, setPulseKey] = useState("");
  useEffect(() => {
    if (!pulseKey) return;
    const t = setTimeout(() => setPulseKey(""), 650);
    return () => clearTimeout(t);
  }, [pulseKey]);

  // Content animation (subtle)
  const contentAnim = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
  };

  const toggleMealDone = (mealKey) => {
    const safe = buildSafeCompletion(nutritionCompletion);
    const next = {
      ...safe,
      [mealKey]: { ...safe[mealKey], mealDone: !safe[mealKey].mealDone },
    };

    onSetCompletion(next);

    if (mealKey === activeMeal) {
      const doneBoth = Boolean(next[mealKey].mealDone) && Boolean(next[mealKey].hydrationDone);
      if (doneBoth) {
        setPulseKey(mealKey);
        setActiveMeal(findNextIncomplete(next, mealKeys, mealKey));
      }
    }
  };

  const toggleHydrationDone = (mealKey) => {
    const safe = buildSafeCompletion(nutritionCompletion);
    const next = {
      ...safe,
      [mealKey]: { ...safe[mealKey], hydrationDone: !safe[mealKey].hydrationDone },
    };

    onSetCompletion(next);

    if (mealKey === activeMeal) {
      const doneBoth = Boolean(next[mealKey].mealDone) && Boolean(next[mealKey].hydrationDone);
      if (doneBoth) {
        setPulseKey(mealKey);
        setActiveMeal(findNextIncomplete(next, mealKeys, mealKey));
      }
    }
  };

  const activeDoneMeal = Boolean(completion?.[activeMeal]?.mealDone);
  const activeDoneWater = Boolean(completion?.[activeMeal]?.hydrationDone);
  const activeDoneBoth = activeDoneMeal && activeDoneWater;

  const hasMealBlocks = Boolean(mealBlocks);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden relative">
      {/* Top accent + subtle wash */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-70" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-blue-50/40 to-white/0" />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-extrabold text-gray-900">Targets by Meal</p>

              <FieldTag tone="blue">
                <span className="inline-flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Suggested
                </span>
              </FieldTag>

              <FieldTag tone={counts.done === counts.total && counts.total > 0 ? "ok" : "soft"}>
                <span className="inline-flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {counts.done}/{counts.total}
                </span>
              </FieldTag>
            </div>

            <ClampText className="mt-1">
              Tap a meal. Swipe right to complete meal + hydration.
            </ClampText>
          </div>
        </div>

        {/* Mini KPI row */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStat
            icon={<Utensils className="w-4 h-4 text-[#46769B]" />}
            label="Meals"
            value={`${counts.mealsDone}/4`}
            tone={counts.mealsDone === 4 ? "ok" : "soft"}
          />
          <MiniStat
            icon={<Droplets className="w-4 h-4 text-blue-700" />}
            label="Hydration"
            value={`${counts.waterDone}/4`}
            tone={counts.waterDone === 4 ? "ok" : "blue"}
          />
          <MiniStat
            icon={<Flame className="w-4 h-4 text-amber-700" />}
            label="Total"
            value={`${counts.done}/8`}
            tone={counts.done === 8 ? "ok" : "soft"}
          />
          <MiniStat
            icon={<Zap className="w-4 h-4 text-gray-700" />}
            label="Now"
            value={mealLabels[activeMeal]}
            tone="soft"
          />
        </div>

        <div className="mt-4 h-px w-full bg-gray-200" />

        {/* Meal tabs (grid; mobile safe) */}
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mealKeys.map((k) => {
              const isActive = activeMeal === k;
              const doneMeal = Boolean(completion?.[k]?.mealDone);
              const doneWater = Boolean(completion?.[k]?.hydrationDone);
              const doneBoth = doneMeal && doneWater;

              return (
                <motion.button
                  key={k}
                  type="button"
                  onClick={() => setActiveMeal(k)}
                  whileTap={{ scale: 0.98 }}
                  className={cx(
                    "relative rounded-2xl text-left w-full min-w-0",
                    "focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                  )}
                  aria-pressed={isActive}
                >
                  {isActive ? (
                    <motion.div
                      layoutId="mealTabActive"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                      className="absolute inset-0 rounded-2xl bg-white border border-gray-200 shadow-sm"
                    />
                  ) : (
                    <div className="absolute inset-0 rounded-2xl hover:bg-white/70" />
                  )}

                  {isActive ? (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-[#46769B]" />
                  ) : null}

                  <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-white flex items-center justify-center shrink-0">
                        <MealIcon mealKey={k} active={isActive} />
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-gray-900 truncate">
                          {mealLabels[k]}
                        </p>
                        <p className="text-[11px] font-semibold text-gray-500 truncate">
                          Meal {doneMeal ? "✓" : "—"} · Water {doneWater ? "✓" : "—"}
                        </p>
                      </div>
                    </div>

                    <StatusRing mealDone={doneMeal} waterDone={doneWater} pulse={pulseKey === k} />
                  </div>

                  {doneBoth ? (
                    <span className="absolute right-2 bottom-2 inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
                      Done
                    </span>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        {!hasMealBlocks ? (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-900 font-extrabold">Meal blocks not enabled</p>
            <ClampText className="mt-1">
              Your coach can turn them on to add dining hall rules + home examples.
            </ClampText>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Active meal summary */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeMeal}
                  initial={contentAnim.initial}
                  animate={contentAnim.animate}
                  exit={contentAnim.exit}
                  transition={{ duration: 0.16 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-gray-900 truncate">
                          {mealLabels[activeMeal]} focus
                        </p>

                        {activeDoneBoth ? (
                          <FieldTag tone="ok">
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Locked in
                            </span>
                          </FieldTag>
                        ) : (
                          <FieldTag>
                            <span className="inline-flex items-center gap-1">
                              <ArrowRight className="w-3.5 h-3.5" />
                              Next up
                            </span>
                          </FieldTag>
                        )}
                      </div>

                      <ClampText className="mt-1">
                        {activeDoneBoth ? "Nice. Keep momentum." : "Meal first. Hydration next. Stay consistent."}
                      </ClampText>
                    </div>

                    <div className="shrink-0">
                      <FieldTag tone={activeDoneBoth ? "ok" : "soft"}>
                        <span className="inline-flex items-center gap-2">
                          {activeDoneBoth ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Circle className="w-3.5 h-3.5" />
                          )}
                          Meal {activeDoneMeal ? "✓" : "—"} · Water {activeDoneWater ? "✓" : "—"}
                        </span>
                      </FieldTag>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Completion actions */}
            <div className="grid md:grid-cols-2 gap-3">
              <SwipeCompleteRow
                tone="meal"
                title={`${mealLabels[activeMeal]} complete`}
                subtitle={activeDoneMeal ? "Marked complete." : "Swipe right or tap Done when you finish this meal."}
                done={activeDoneMeal}
                onToggle={() => toggleMealDone(activeMeal)}
                icon={
                  <CheckCircle2 className={cx("w-4 h-4", activeDoneMeal ? "text-emerald-700" : "text-gray-500")} />
                }
              />

              <SwipeCompleteRow
                tone="water"
                title="Hydration complete"
                subtitle={activeDoneWater ? "Marked complete." : "Swipe right or tap Done when you hit the water target."}
                done={activeDoneWater}
                onToggle={() => toggleHydrationDone(activeMeal)}
                icon={<Droplets className={cx("w-4 h-4", activeDoneWater ? "text-blue-700" : "text-gray-500")} />}
              />
            </div>

            <div className="h-px w-full bg-gray-200" />

            {/* Macros */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-extrabold text-gray-900 truncate">Macro breakdown</p>
                    <FieldTag>Targets</FieldTag>
                  </div>
                  <ClampText className="mt-1">Use this as a guide. Close counts.</ClampText>
                </div>
              </div>

              {/* Macro quick-read cards */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniStat
                  icon={<Flame className="w-4 h-4 text-amber-700" />}
                  label="Calories"
                  value={macroSummary.calories != null ? `${macroSummary.calories}` : "—"}
                />
                <MiniStat
                  icon={<Target className="w-4 h-4 text-[#46769B]" />}
                  label="Protein"
                  value={macroSummary.protein != null ? `${macroSummary.protein}g` : "—"}
                />
                <MiniStat
                  icon={<Zap className="w-4 h-4 text-blue-700" />}
                  label="Carbs"
                  value={macroSummary.carbs != null ? `${macroSummary.carbs}g` : "—"}
                  tone="blue"
                />
                <MiniStat
                  icon={<Droplets className="w-4 h-4 text-gray-700" />}
                  label="Fat"
                  value={macroSummary.fat != null ? `${macroSummary.fat}g` : "—"}
                />
              </div>

              <div className="mt-3 h-px w-full bg-gray-200" />

              <div className="mt-3">
                <MacroGrid t={currentTargets} />
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <p className="text-[11px] text-gray-500 font-semibold line-clamp-1 sm:line-clamp-none">
                  Don’t chase perfect labels. Prioritize protein + hydration.
                </p>
                <p className="text-[11px] text-gray-500 font-extrabold">
                  Consistency &gt; perfection
                </p>
              </div>
            </div>

            {/* Tips panels */}
            <div className="grid md:grid-cols-2 gap-3">
              <CollapsiblePanel
                title="Dining hall"
                icon={<Utensils className="w-4 h-4 text-gray-700" />}
                open={diningOpen}
                onToggle={() => setDiningOpen((v) => !v)}
                preview={firstLinePreview(currentDining)}
              >
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {currentDining || "No dining hall rules added yet."}
                </p>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Home examples"
                icon={<Home className="w-4 h-4 text-gray-700" />}
                open={homeOpen}
                onToggle={() => setHomeOpen((v) => !v)}
                preview={firstLinePreview(currentHome)}
              >
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {currentHome || "No home examples added yet."}
                </p>
              </CollapsiblePanel>
            </div>

            <p className="text-[11px] text-gray-500 font-semibold line-clamp-1 sm:line-clamp-none">
              Tip: guardrails only — protein + hydration first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
