// components/athlete-today/nutrition/ui/MacroGrid.jsx
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Beef, Wheat, Droplets, CircleDot, Sparkles } from "lucide-react";
import { cx } from "../helpers";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

function asTargets(t) {
  return t && typeof t === "object" ? t : {};
}

function hasAnyMacro(targets) {
  const keys = ["calories", "protein", "carbs", "fat", "hydrationOz"];
  return keys.some((k) => toNum(targets?.[k]) != null);
}

function UnitPill({ children, tone = "base" }) {
  const toneCls =
    tone === "cal"
      ? "bg-amber-50 border-amber-200 text-amber-800"
      : tone === "protein"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "water"
      ? "bg-blue-50 border-blue-200 text-blue-800"
      : "bg-white border-gray-200 text-gray-600";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5",
        "text-[10px] font-extrabold tracking-wide whitespace-nowrap",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function ToneDot({ tone = "base" }) {
  const cls =
    tone === "cal"
      ? "bg-amber-500"
      : tone === "protein"
      ? "bg-emerald-500"
      : tone === "water"
      ? "bg-blue-600"
      : "bg-gray-400";

  return <span className={cx("h-2 w-2 rounded-full", cls)} aria-hidden="true" />;
}

function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "base",
  big = false,
  subtitle,
}) {
  const wrapTone =
    tone === "water"
      ? "bg-gradient-to-b from-blue-50 to-white border-blue-200"
      : tone === "protein"
      ? "bg-gradient-to-b from-emerald-50 to-white border-emerald-200"
      : tone === "cal"
      ? "bg-gradient-to-b from-amber-50 to-white border-amber-200"
      : "bg-gradient-to-b from-gray-50 to-white border-gray-200";

  const iconTone =
    tone === "water"
      ? "bg-blue-100 border-blue-200 text-blue-800"
      : tone === "protein"
      ? "bg-emerald-100 border-emerald-200 text-emerald-800"
      : tone === "cal"
      ? "bg-amber-100 border-amber-200 text-amber-800"
      : "bg-white border-gray-200 text-gray-700";

  const isEmpty = value === "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cx(
        "rounded-2xl border p-3 min-w-0 shadow-sm",
        "overflow-hidden",
        wrapTone,
        isEmpty ? "opacity-85" : ""
      )}
    >
      {/* Subtle top highlight bar */}
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-[3px] opacity-70",
          tone === "cal"
            ? "bg-amber-300"
            : tone === "protein"
            ? "bg-emerald-300"
            : tone === "water"
            ? "bg-blue-300"
            : "bg-gray-200"
        )}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ToneDot tone={tone} />
            <p className="text-[11px] text-gray-600 font-semibold truncate">
              {label}
            </p>
          </div>

          <div className="mt-1 flex items-end gap-2">
            <p
              className={cx(
                "font-extrabold text-gray-900 tabular-nums truncate",
                big ? "text-xl" : "text-lg"
              )}
            >
              {value}
            </p>

            {unit ? (
              <UnitPill
                tone={
                  tone === "water"
                    ? "water"
                    : tone === "protein"
                    ? "protein"
                    : tone === "cal"
                    ? "cal"
                    : "base"
                }
              >
                {unit}
              </UnitPill>
            ) : null}
          </div>

          {subtitle ? (
            <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
              {subtitle}
            </p>
          ) : null}
        </div>

        <span
          className={cx(
            "h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0",
            "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
            iconTone
          )}
        >
          {icon}
        </span>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* MacroGrid                                                                  */
/* -------------------------------------------------------------------------- */
/**
 * MacroGrid (Targets-only)
 * Props:
 *  - t: targets object { calories, protein, carbs, fat, hydrationOz }
 */
export default function MacroGrid({ t }) {
  const targets = useMemo(() => asTargets(t), [t]);

  const calories = fmt(targets?.calories);
  const protein = fmt(targets?.protein);
  const carbs = fmt(targets?.carbs);
  const fat = fmt(targets?.fat);
  const water = fmt(targets?.hydrationOz);

  const any = useMemo(() => hasAnyMacro(targets), [targets]);

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-gray-500 shrink-0" />
          <p className="text-[11px] text-gray-600 font-semibold truncate">
            Targets for this meal
          </p>
        </div>
        <p className="text-[11px] text-gray-500">
          Aim for close, not perfect
        </p>
      </div>

      {!any ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">
            No macro targets provided
          </p>
          <p className="text-[12px] text-gray-600 mt-1">
            Your coach can add meal targets (calories/macros/hydration) to make
            this section more specific.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatCard
            label="Calories"
            value={calories}
            unit="kcal"
            tone="cal"
            icon={<Flame className="w-4 h-4" />}
            big
            subtitle="Energy target"
          />

          <StatCard
            label="Protein"
            value={protein}
            unit="g"
            tone="protein"
            icon={<Beef className="w-4 h-4" />}
            big
            subtitle="Anchor macro"
          />

          <StatCard
            label="Carbs"
            value={carbs}
            unit="g"
            icon={<Wheat className="w-4 h-4" />}
            subtitle="Fuel"
          />

          <StatCard
            label="Fat"
            value={fat}
            unit="g"
            icon={<CircleDot className="w-4 h-4" />}
            subtitle="Balance"
          />

          <StatCard
            label="Water"
            value={water}
            unit="oz"
            tone="water"
            icon={<Droplets className="w-4 h-4" />}
            subtitle="Hydration"
          />
        </div>
      )}
    </div>
  );
}
