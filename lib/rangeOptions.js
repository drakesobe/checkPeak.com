// lib/rangeOptions.js
export function rangeOptions(min, max, step = 1, suffix = "") {
  const out = [];
  const steps = Math.floor((max - min) / step);
  for (let i = 0; i <= steps; i++) {
    const v = min + i * step;
    // Avoid floating precision junk (like 0.30000000004)
    const s =
      Number.isInteger(step) ? String(v) : String(Math.round(v * 100) / 100);
    out.push(suffix ? `${s}${suffix}` : s);
  }
  return out;
}
