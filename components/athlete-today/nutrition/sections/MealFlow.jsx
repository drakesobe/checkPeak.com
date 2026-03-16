// components/athlete-today/nutrition/sections/MealFlow.jsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Coffee, Sun, Sunset, Moon,
  CheckCircle2, Circle, Droplets,
  ChevronDown, ChevronUp,
  Utensils, Home,
} from "lucide-react";
import { cx, safeText } from "../helpers";

/* ── tokens ── */
const C = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F8",
  brandBorder: "#C5D5E8",
  safe:        "#059669",
  safeBg:      "#ECFDF5",
  safeBorder:  "#A7F3D0",
  water:       "#2563EB",
  waterBg:     "#EFF6FF",
  waterBorder: "#BFDBFE",
};

const MEAL_KEYS   = ["breakfast", "lunch", "afternoon", "dinner"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner" };
const MEAL_TIMES  = { breakfast: "6–10 AM", lunch: "11 AM–2 PM", afternoon: "2–6 PM", dinner: "6–9 PM" };
const MEAL_SPANS  = { breakfast: [6, 11], lunch: [11, 15], afternoon: [15, 18], dinner: [18, 22] };

/* ── helpers ── */
function mealForHour(h) {
  if (h >= 5  && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 18) return "afternoon";
  return "dinner";
}

function buildSafeCompletion(cur) {
  const c = cur && typeof cur === "object" ? cur : {};
  return {
    breakfast: { mealDone: Boolean(c?.breakfast?.mealDone),  hydrationDone: Boolean(c?.breakfast?.hydrationDone)  },
    lunch:     { mealDone: Boolean(c?.lunch?.mealDone),      hydrationDone: Boolean(c?.lunch?.hydrationDone)      },
    afternoon: { mealDone: Boolean(c?.afternoon?.mealDone),  hydrationDone: Boolean(c?.afternoon?.hydrationDone)  },
    dinner:    { mealDone: Boolean(c?.dinner?.mealDone),     hydrationDone: Boolean(c?.dinner?.hydrationDone)     },
  };
}

function safeMacro(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function pickMacros(targets) {
  const t = targets && typeof targets === "object" ? targets : {};
  return {
    calories: safeMacro(t.calories ?? t.Calories ?? t.kcal ?? t.energy) ?? null,
    protein:  safeMacro(t.protein  ?? t.Protein) ?? null,
    carbs:    safeMacro(t.carbs    ?? t.Carbs)   ?? null,
    fat:      safeMacro(t.fat      ?? t.Fat)     ?? null,
  };
}

/* reads per-meal hydration oz from all known field names */
function pickMealHydrationOz(targets) {
  const t = targets && typeof targets === "object" ? targets : {};
  return safeMacro(
    t.hydrationOz ?? t.HydrationOz ??
    t.waterOz     ?? t.WaterOz     ??
    t.water       ?? t.Water       ??
    t.hydration   ?? t.Hydration   ?? null
  );
}

function nyISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   DayTimeline — tappable segments jump to that meal
──────────────────────────────────────────────────────────────────────────── */
function DayTimeline({ recommendedMeal, completion, onSelectMeal }) {
  const now   = new Date();
  const h     = now.getHours() + now.getMinutes() / 60;
  const START = 6, END = 22, range = END - START;
  const cursorPct = Math.max(0, Math.min(100, ((h - START) / range) * 100));
  const inRange   = h >= START && h <= END;

  const segColors = {
    breakfast: "#FEF9C3",
    lunch:     "#DBEAFE",
    afternoon: "#FCE7F3",
    dinner:    "#EEF3F8",
  };

  return (
    <div className="relative mb-4" aria-label="Day meal timeline">
      {/* Tappable track — h-5 so a thumb can actually hit it */}
      <div className="flex h-5 rounded-full overflow-hidden gap-px bg-gray-100">
        {MEAL_KEYS.map(k => {
          const [s, e]   = MEAL_SPANS[k];
          const widthPct = ((e - s) / range) * 100;
          const safe     = buildSafeCompletion(completion);
          const doneBoth = safe[k].mealDone && safe[k].hydrationDone;
          const isNow    = k === recommendedMeal;
          const bg       = doneBoth ? C.safeBg : isNow ? C.brandBg : segColors[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectMeal(k)}
              aria-label={`Jump to ${MEAL_LABELS[k]}`}
              className="focus:outline-none active:opacity-60 transition-opacity"
              style={{
                width: `${widthPct}%`,
                backgroundColor: bg,
                borderTop: isNow && !doneBoth ? `2px solid ${C.brandBorder}` : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Time cursor */}
      {inRange && (
        <div className="absolute top-0 bottom-4 w-0.5 rounded-full pointer-events-none"
          style={{ left: `${cursorPct}%`, backgroundColor: C.brand, opacity: 0.85 }} />
      )}

      {/* Labels */}
      <div className="flex mt-1.5">
        {MEAL_KEYS.map(k => {
          const [s, e]   = MEAL_SPANS[k];
          const widthPct = ((e - s) / range) * 100;
          const safe     = buildSafeCompletion(completion);
          const doneBoth = safe[k].mealDone && safe[k].hydrationDone;
          return (
            <div key={k} style={{ width: `${widthPct}%` }}>
              <p className="text-[10px] font-extrabold text-center"
                style={{ color: doneBoth ? C.safe : k === recommendedMeal ? C.brand : "#9CA3AF" }}>
                {MEAL_LABELS[k][0]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Macro tiles ── */
function MacroTiles({ targets }) {
  const m = pickMacros(targets);
  const rows = [
    { k: "Calories", v: m.calories, unit: "kcal" },
    { k: "Protein",  v: m.protein,  unit: "g"    },
    { k: "Carbs",    v: m.carbs,    unit: "g"    },
    { k: "Fat",      v: m.fat,      unit: "g"    },
  ].filter(r => r.v != null);

  if (!rows.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mb-1">
      {rows.map(r => (
        <div key={r.k} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{r.k}</p>
          <p className="text-[18px] font-extrabold text-gray-900 tabular-nums mt-0.5 leading-none">
            {r.v}
            <span className="text-[12px] font-semibold text-gray-400 ml-0.5">{r.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Hydration target strip — shown prominently inside each meal ── */
function HydrationTargetStrip({ oz, done }) {
  if (oz == null) return null;
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3.5"
      style={{
        backgroundColor: done ? C.safeBg    : C.waterBg,
        border:          `1px solid ${done ? C.safeBorder : C.waterBorder}`,
      }}
    >
      <Droplets
        className="w-5 h-5 shrink-0"
        style={{ color: done ? C.safe : C.water }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-none"
          style={{ color: done ? C.safe : C.water }}>
          {oz} oz with this meal
        </p>
        <p className="text-[12px] mt-1 leading-none"
          style={{ color: done ? "#047857" : "#3B82F6" }}>
          {done ? "Water logged ✓" : "Drink before marking done"}
        </p>
      </div>
      {done && <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: C.safe }} />}
    </div>
  );
}

/* ── Collapsible tip ── */
function CollapsibleTip({ title, icon, text }) {
  const [open, setOpen] = useState(false);
  if (!String(text || "").trim()) return null;
  const preview = String(text).trim().replace(/\s+/g, " ").slice(0, 72);
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between gap-2 text-left focus:outline-none active:bg-gray-50 select-none"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 text-gray-400">{icon}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-800">{title}</p>
            {!open && <p className="text-[11px] text-gray-400 truncate mt-0.5">{preview}</p>}
          </div>
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="tip"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.14 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Expanded meal body ── */
function MealDetail({ mealKey, block, doneMeal, doneWater, saving, onToggleMeal, onToggleWater }) {
  const targets = block?.targets && typeof block.targets === "object" ? block.targets : {};
  const dining  = safeText(block?.diningHallRules);
  const home    = safeText(block?.homeExamples);
  const hydOz   = pickMealHydrationOz(targets);

  return (
    <div className="pt-3 space-y-3">

      {/* Macros */}
      <MacroTiles targets={targets} />

      {/* Hydration target — front and center, above action buttons */}
      <HydrationTargetStrip oz={hydOz} done={doneWater} />

      {/* Action buttons — 72px tall, full-width feel on mobile */}
      <div className="grid grid-cols-2 gap-3">

        {/* Meal done */}
        <button
          type="button"
          onClick={onToggleMeal}
          disabled={saving}
          className={cx(
            "flex flex-col items-center justify-center gap-2 rounded-xl border",
            "min-h-[76px] px-3 transition active:scale-[0.97] disabled:opacity-60 select-none",
            doneMeal
              ? "bg-emerald-50 border-emerald-200"
              : "bg-white border-gray-200"
          )}
        >
          {doneMeal
            ? <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            : <Circle       className="w-7 h-7 text-gray-300"    />}
          <p className={cx(
            "text-[13px] font-extrabold leading-tight text-center",
            doneMeal ? "text-emerald-700" : "text-gray-800"
          )}>
            {doneMeal ? "Meal done ✓" : "Mark meal done"}
          </p>
          {!doneMeal && (
            <p className="text-[11px] text-gray-400 text-center">Finished eating</p>
          )}
        </button>

        {/* Hydration — label shows exact oz target when known */}
        <button
          type="button"
          onClick={onToggleWater}
          disabled={saving}
          className={cx(
            "flex flex-col items-center justify-center gap-2 rounded-xl border",
            "min-h-[76px] px-3 transition active:scale-[0.97] disabled:opacity-60 select-none",
            doneWater
              ? "bg-blue-50 border-blue-200"
              : "bg-white border-gray-200"
          )}
        >
          <Droplets className={cx("w-7 h-7", doneWater ? "text-blue-500" : "text-gray-300")} />
          <p className={cx(
            "text-[13px] font-extrabold leading-tight text-center",
            doneWater ? "text-blue-700" : "text-gray-800"
          )}>
            {doneWater
              ? "Water done ✓"
              : hydOz != null
              ? `Drank ${hydOz} oz`
              : "Mark water"}
          </p>
          {!doneWater && (
            <p className="text-[11px] text-gray-400 text-center">
              {hydOz != null ? `${hydOz} oz target` : "Hit water target"}
            </p>
          )}
        </button>
      </div>

      {/* Tips */}
      {(dining || home) && (
        <div className="space-y-2">
          <CollapsibleTip title="Dining hall options"
            icon={<Utensils className="w-4 h-4" />} text={dining} />
          <CollapsibleTip title="Home examples"
            icon={<Home className="w-4 h-4" />} text={home} />
        </div>
      )}
    </div>
  );
}

/* ── Compact meal row ── */
function MealRow({ mealKey, isNow, isOpen, doneMeal, doneWater, saving, block, onToggle, onToggleMeal, onToggleWater }) {
  const doneBoth = doneMeal && doneWater;
  const targets  = block?.targets && typeof block.targets === "object" ? block.targets : {};
  const m        = pickMacros(targets);
  const hydOz    = pickMealHydrationOz(targets);

  /* subtitle shows protein + oz at a glance in collapsed state */
  const subtitleParts = [];
  if (m.protein != null) subtitleParts.push(`${m.protein}g protein`);
  if (hydOz     != null) subtitleParts.push(`${hydOz} oz water`);
  const subtitle = subtitleParts.length ? subtitleParts.join(" · ") : MEAL_TIMES[mealKey];

  const Icon = mealKey === "breakfast" ? Coffee
             : mealKey === "lunch"     ? Sun
             : mealKey === "afternoon" ? Sunset
             : Moon;

  const iconBg    = doneBoth ? C.safeBg    : isNow ? C.brandBg    : "#F9FAFB";
  const iconBdr   = doneBoth ? C.safeBorder: isNow ? C.brandBorder: "#E5E7EB";
  const iconColor = doneBoth ? C.safe      : isNow ? C.brand      : "#9CA3AF";

  return (
    <div
      className={cx(
        "rounded-xl border overflow-hidden",
        doneBoth          ? "border-emerald-200 bg-emerald-50/30"
        : isNow && isOpen ? "border-gray-300 bg-white"
        :                   "border-gray-200 bg-white"
      )}
      style={isNow && isOpen ? { borderTop: `2px solid ${C.brand}` } : undefined}
    >
      {/* Row header — min-h-[64px] so thumbs can tap it comfortably */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full min-h-[64px] px-4 py-3 flex items-center gap-3 text-left focus:outline-none active:bg-gray-50/80 select-none"
        aria-expanded={isOpen}
      >
        {/* Meal icon */}
        <span
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition"
          style={{ backgroundColor: iconBg, border: `1px solid ${iconBdr}` }}
        >
          <Icon style={{ width: 20, height: 20, color: iconColor }} />
        </span>

        {/* Name + subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[16px] font-extrabold text-gray-900 leading-tight">
              {MEAL_LABELS[mealKey]}
            </p>
            {isNow && !doneBoth && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0"
                style={{ backgroundColor: C.brandBg, color: C.brand }}>
                Now
              </span>
            )}
            {doneBoth && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0"
                style={{ backgroundColor: C.safeBg, color: C.safe }}>
                Done
              </span>
            )}
          </div>
          {/* protein + oz hint visible without opening */}
          <p className="text-[12px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
        </div>

        {/* Readable status badges — not tiny 8px dots */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span
            className="text-[11px] font-bold px-2 py-1 rounded-lg"
            style={{
              backgroundColor: doneMeal  ? C.safeBg  : "#F3F4F6",
              color:           doneMeal  ? C.safe    : "#9CA3AF",
            }}
          >
            Food
          </span>
          <span
            className="text-[11px] font-bold px-2 py-1 rounded-lg"
            style={{
              backgroundColor: doneWater ? "#EFF6FF" : "#F3F4F6",
              color:           doneWater ? C.water   : "#9CA3AF",
            }}
          >
            H₂O
          </span>
          {isOpen
            ? <ChevronUp   className="w-4 h-4 text-gray-400 ml-0.5" />
            : <ChevronDown className="w-4 h-4 text-gray-400 ml-0.5" />}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={`body-${mealKey}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <MealDetail
                mealKey={mealKey}
                block={block}
                doneMeal={doneMeal}
                doneWater={doneWater}
                saving={saving}
                onToggleMeal={onToggleMeal}
                onToggleWater={onToggleWater}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── All done banner ── */
function AllDoneBanner() {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 flex items-center gap-3 mb-3">
      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
      <div>
        <p className="text-[15px] font-extrabold text-emerald-800">All meals logged</p>
        <p className="text-[12px] text-emerald-600 mt-0.5">Consistent execution. Rest, recover, repeat.</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MealFlow
════════════════════════════════════════════════════════════════════════════ */
export default function MealFlow({ mealBlocks, nutritionCompletion, onSetCompletion, dateISO }) {
  const safeBlocks      = mealBlocks && typeof mealBlocks === "object" ? mealBlocks : {};
  const effectiveDate   = String(dateISO || "").trim() || nyISODate();
  const recommendedMeal = useMemo(() => mealForHour(new Date().getHours()), []);

  const [openMeal, setOpenMeal] = useState(recommendedMeal);
  const [saving,   setSaving]   = useState(false);

  const setCompletionLocal = useCallback(
    next => typeof onSetCompletion === "function" && onSetCompletion(next),
    [onSetCompletion]
  );

  const saveToServer = useCallback(async (nextCompletion) => {
    setCompletionLocal(nextCompletion);
    setSaving(true);
    try {
      const res  = await fetch(
        `/api/athlete/nutrition/completion/upsert?date=${encodeURIComponent(effectiveDate)}`,
        { method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completion: nextCompletion }) }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save.");
      setCompletionLocal(buildSafeCompletion(data?.completion));
    } catch (e) {
      console.error("[MealFlow] save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [effectiveDate, setCompletionLocal]);

  const toggleMealDone = useCallback((mealKey) => {
    const safe = buildSafeCompletion(nutritionCompletion);
    saveToServer({ ...safe, [mealKey]: { ...safe[mealKey], mealDone: !safe[mealKey].mealDone } });
  }, [nutritionCompletion, saveToServer]);

  const toggleHydrationDone = useCallback((mealKey) => {
    const safe = buildSafeCompletion(nutritionCompletion);
    saveToServer({ ...safe, [mealKey]: { ...safe[mealKey], hydrationDone: !safe[mealKey].hydrationDone } });
  }, [nutritionCompletion, saveToServer]);

  const safe    = buildSafeCompletion(nutritionCompletion);
  const allDone = MEAL_KEYS.every(k => safe[k].mealDone && safe[k].hydrationDone);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      style={{ borderTop: `3px solid ${C.brand}` }}>
      <div className="p-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: C.brandBg, border: `1px solid ${C.brandBorder}` }}>
              <Utensils className="w-4 h-4" style={{ color: C.brand }} />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-extrabold text-gray-900 leading-tight">Meals</p>
              <p className="text-[12px] text-gray-400 leading-tight">
                Up now: {MEAL_LABELS[recommendedMeal]}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 shrink-0">Tap bar to jump</p>
        </div>

        {/* Tappable timeline */}
        <DayTimeline
          recommendedMeal={recommendedMeal}
          completion={nutritionCompletion}
          onSelectMeal={k => setOpenMeal(cur => cur === k ? "" : k)}
        />

        {allDone && <AllDoneBanner />}

        {/* Meal rows */}
        <div className="space-y-2">
          {MEAL_KEYS.map(k => (
            <MealRow
              key={k}
              mealKey={k}
              isNow={k === recommendedMeal}
              isOpen={openMeal === k}
              doneMeal={Boolean(safe[k].mealDone)}
              doneWater={Boolean(safe[k].hydrationDone)}
              saving={saving}
              block={safeBlocks[k]}
              onToggle={() => setOpenMeal(cur => cur === k ? "" : k)}
              onToggleMeal={() => toggleMealDone(k)}
              onToggleWater={() => toggleHydrationDone(k)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}