"use client";

export default function NumInput({
  label,
  value,
  onChange,
  placeholder = "—",
  min = 0,
  max,
  step = 1,
  hint,
}) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-2">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
      />
      {hint ? <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{hint}</p> : null}
    </label>
  );
}
