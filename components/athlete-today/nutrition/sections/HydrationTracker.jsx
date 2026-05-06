// components/athlete-today/nutrition/sections/HydrationTracker.jsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Droplets, Plus, Minus, CheckCircle2 } from "lucide-react";

const C = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F8",
  brandBorder: "#C5D5E8",
  water:       "#2563EB",
  waterBg:     "#EFF6FF",
  waterBorder: "#BFDBFE",
  safe:        "#059669",
  safeBg:      "#ECFDF5",
  safeBorder:  "#A7F3D0",
};

const SEGMENTS    = 10;
const DEFAULT_GOAL = 128;

/* per-meal hydration oz field picker - same as MealFlow */
function pickMealHydrationOz(targets) {
  const t = targets && typeof targets === "object" ? targets : {};
  const n = Number(String(
    t.hydrationOz ?? t.HydrationOz ??
    t.waterOz     ?? t.WaterOz     ??
    t.water       ?? t.Water       ??
    t.hydration   ?? t.Hydration   ?? ""
  ).trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/* quick-add presets */
const QUICK_ADDS = [
  ["Cup",   8  ],
  ["16 oz", 16 ],
  ["24 oz", 24 ],
  ["32 oz", 32 ],
];

const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner" };
const MEAL_KEYS   = ["breakfast", "lunch", "afternoon", "dinner"];

function lsSafeGet(key) {
  try { if (typeof window === "undefined") return null; return window.localStorage.getItem(key); }
  catch { return null; }
}
function lsSafeSet(key, value) {
  try { if (typeof window === "undefined") return; window.localStorage.setItem(key, value); }
  catch {}
}

function useFlash(ms = 700) {
  const [flashing, setFlashing] = useState(false);
  const timer = useRef(null);
  const flash = useCallback(() => {
    setFlashing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashing(false), ms);
  }, [ms]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [flashing, flash];
}

/* ── Per-meal breakdown row ── */
function MealBreakdownRow({ mealBlocks }) {
  const rows = MEAL_KEYS.map(k => {
    const targets = mealBlocks?.[k]?.targets;
    const oz = pickMealHydrationOz(targets);
    return { k, label: MEAL_LABELS[k][0], oz };
  }).filter(r => r.oz != null);

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 mb-3">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Per-meal targets
      </p>
      <div className="grid grid-cols-4 gap-2">
        {MEAL_KEYS.map(k => {
          const targets = mealBlocks?.[k]?.targets;
          const oz = pickMealHydrationOz(targets);
          return (
            <div key={k} className="flex flex-col items-center">
              <p className="text-[10px] font-semibold text-gray-400 mb-1">
                {MEAL_LABELS[k][0]}
              </p>
              <p className="text-[15px] font-extrabold tabular-nums leading-none"
                style={{ color: oz != null ? C.water : "#D1D5DB" }}>
                {oz != null ? oz : "-"}
              </p>
              {oz != null && (
                <p className="text-[9px] font-semibold text-gray-400 mt-0.5">oz</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HydrationTracker
════════════════════════════════════════════════════════════════════════════ */
export default function HydrationTracker({ goalOz, storageKey, mealBlocks }) {
  const goal = Number(goalOz) > 0 ? Math.round(Number(goalOz)) : DEFAULT_GOAL;
  const key  = storageKey || "checkpeak:hydrationOz:today";

  const [currentOz, setCurrentOz] = useState(0);
  const hydrating  = useRef(false);
  const [flashing, flash] = useFlash();

  /* hydrate from localStorage */
  useEffect(() => {
    hydrating.current = true;
    const raw    = lsSafeGet(key);
    const parsed = Number(raw);
    setCurrentOz(Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0);
    setTimeout(() => { hydrating.current = false; }, 0);
  }, [key]);

  /* persist */
  useEffect(() => {
    if (hydrating.current) return;
    lsSafeSet(key, String(currentOz));
  }, [key, currentOz]);

  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef(null);

  const startEdit = useCallback(() => {
    setEditVal(String(currentOz));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [currentOz]);

  const commitEdit = useCallback(() => {
    const n = Math.round(Number(editVal));
    if (Number.isFinite(n) && n >= 0) {
      setCurrentOz(Math.min(n, goal * 2));
    }
    setEditing(false);
  }, [editVal, goal]);

  const addOz = useCallback((oz) => {
    setCurrentOz(prev => Math.min(prev + oz, goal * 2));
    flash();
  }, [goal, flash]);

  const subtractOz = useCallback((oz) => {
    setCurrentOz(prev => Math.max(prev - oz, 0));
  }, []);

  const pct        = Math.min(Math.round((currentOz / goal) * 100), 100);
  const isAtGoal   = currentOz >= goal;
  const remaining  = Math.max(goal - currentOz, 0);
  const filledSegs = Math.min(Math.round((currentOz / goal) * SEGMENTS), SEGMENTS);
  const barColor   = isAtGoal ? C.water : C.brand;

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      style={{ borderTop: `3px solid ${isAtGoal ? C.water : C.brand}` }}
    >
      <div className="p-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition"
              style={{
                backgroundColor: isAtGoal ? C.waterBg : C.brandBg,
                border: `1px solid ${isAtGoal ? C.waterBorder : C.brandBorder}`,
              }}
            >
              <Droplets className="w-4 h-4 transition"
                style={{ color: isAtGoal ? C.water : C.brand }} />
            </span>
            <div>
              <p className="text-[16px] font-extrabold text-gray-900 leading-tight">Hydration</p>
              <p className="text-[12px] text-gray-400 leading-tight">Daily goal: {goal} oz</p>
            </div>
          </div>

          {/* Tappable oz counter - tap to type a value directly */}
          <div className="text-right">
            {editing ? (
              <div className="flex items-baseline justify-end gap-1">
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={goal * 2}
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="w-20 text-right text-[28px] font-black tabular-nums leading-none outline-none bg-transparent border-b-2"
                  style={{ color: isAtGoal ? C.water : C.brand, borderColor: isAtGoal ? C.water : C.brand }}
                />
                <span className="text-[13px] font-semibold text-gray-400">oz</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="text-right group"
                title="Tap to set amount"
              >
                <p className="text-[28px] font-black tabular-nums leading-none transition"
                  style={{ color: isAtGoal ? C.water : C.brand }}>
                  {currentOz}
                  <span className="text-[13px] font-semibold text-gray-400 ml-0.5">oz</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 group-hover:text-gray-600 transition">
                  {isAtGoal ? "Goal reached 🎉" : `${remaining} oz to go · tap to edit`}
                </p>
              </button>
            )}
          </div>
        </div>

        {/* Segmented bar */}
        <div className="flex gap-1 mb-3"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Hydration: ${currentOz} of ${goal} oz`}
        >
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div key={i} className="flex-1 h-3 rounded-full transition-all duration-300"
              style={{ backgroundColor: i < filledSegs ? barColor : "#F1F5F9" }} />
          ))}
        </div>

        {/* Goal reached banner */}
        {isAtGoal && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl px-4 py-3"
            style={{ backgroundColor: C.waterBg, border: `1px solid ${C.waterBorder}` }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: C.water }} />
            <p className="text-[13px] font-semibold" style={{ color: C.water }}>
              Daily hydration goal reached.
            </p>
          </div>
        )}

        {/* Per-meal breakdown - shows how daily goal is distributed */}
        <MealBreakdownRow mealBlocks={mealBlocks} />

        {/* Quick-add buttons - full row, 48px tall for easy thumb tapping */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
            Add water
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_ADDS.map(([label, oz]) => (
              <button
                key={oz}
                type="button"
                onClick={() => addOz(oz)}
                className="flex flex-col items-center justify-center gap-0.5 rounded-xl border min-h-[52px] transition active:scale-[0.97] select-none"
                style={
                  flashing
                    ? { backgroundColor: C.waterBg, borderColor: C.waterBorder, color: C.water }
                    : { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", color: "#374151" }
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[12px] font-extrabold">{label}</span>
              </button>
            ))}
          </div>

          {/* Subtract row */}
          <button
            type="button"
            onClick={() => subtractOz(8)}
            disabled={currentOz <= 0}
            className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white flex items-center justify-center gap-2 text-[12px] font-semibold text-gray-500 transition active:scale-[0.97] disabled:opacity-30 select-none"
            aria-label="Remove 8 oz"
          >
            <Minus className="w-3.5 h-3.5" />
            Remove 8 oz
          </button>
        </div>
      </div>
    </div>
  );
}