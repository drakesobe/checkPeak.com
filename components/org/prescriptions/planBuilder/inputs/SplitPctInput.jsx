// components/org/prescriptions/planBuilder/inputs/SplitPctInput.jsx
"use client";

import { useMemo } from "react";
import { asNum, clamp } from "../mealBlocks/mealBlockUtils";

const DS = {
  brand: "#1E3A5F", brandBorder: "#C0D0E0",
  border: "#E8ECF0", cardBg: "#FFFFFF",
  bodyText: "#1A2535", dimText: "#9BA8B4",
};

export default function SplitPctInput({ label, value, onChange }) {
  const pct = useMemo(() => {
    const v = Number(value);
    if (!Number.isFinite(v)) return "";
    return String(Math.round(v * 100));
  }, [value]);

  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
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
          className="w-full pr-8 text-sm px-3 py-2 outline-none rounded-sm tabular-nums"
          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
          onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 2px ${DS.brand}18`; }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none"
          style={{ color: DS.dimText }}
        >
          %
        </span>
      </div>
    </label>
  );
}