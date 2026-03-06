// components/org/prescriptions/planBuilder/inputs/NumInput.jsx
"use client";

const DS = {
  brand: "#1E3A5F", brandBorder: "#C0D0E0",
  border: "#E8ECF0", cardBg: "#FFFFFF",
  bodyText: "#1A2535", dimText: "#9BA8B4",
};

export default function NumInput({ label, value, onChange, placeholder = "—", min = 0, max, step = 1, hint }) {
  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full text-sm px-3 py-2 outline-none rounded-sm tabular-nums"
        style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
        onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 2px ${DS.brand}18`; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
      />
      {hint && <p className="text-xs mt-1 leading-relaxed" style={{ color: DS.dimText }}>{hint}</p>}
    </label>
  );
}