"use client";

import { useMemo } from "react";
import { asNum, clamp } from "../mealBlocks/mealBlockUtils";

export default function SplitPctInput({ label, value, onChange }) {
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
