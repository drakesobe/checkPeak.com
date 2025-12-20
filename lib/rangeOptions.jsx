// lib/rangeOptions.js

/**
 * rangeOptions(start, end, step, options?)
 *
 * Builds an array of values for WheelSelect (or <select>) inputs.
 * - Returns strings by default because most form state is string-based.
 * - Allows prefix/suffix formatting (e.g., "g", "oz")
 * - Allows padding (e.g., 000, 005) if you want later
 *
 * Examples:
 *  rangeOptions(0, 5000, 5) -> ["0","5","10",...,"5000"]
 *  rangeOptions(0, 300, 1, { suffix: " oz" }) -> ["0 oz","1 oz",...]
 */
export function rangeOptions(start, end, step, opts = {}) {
  const s = Number(start);
  const e = Number(end);
  const st = Number(step);

  if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(st) || st <= 0) {
    // Fail safely: return empty options rather than crashing UI
    return [];
  }

  const {
    prefix = "",
    suffix = "",
    asNumber = false, // if true, returns numbers instead of strings
    clamp = true,    // if true, ensures we don’t overshoot end
    maxItems = 20000 // safety limit to prevent huge arrays freezing the UI
  } = opts || {};

  const out = [];
  let count = 0;

  // Support ascending or descending ranges
  const ascending = e >= s;

  if (ascending) {
    for (let v = s; v <= e; v += st) {
      const value = asNumber ? v : `${prefix}${v}${suffix}`;
      out.push(value);
      count++;
      if (count >= maxItems) break;
    }
    // If floating math skips end slightly, optionally clamp
    if (clamp && out.length && !asNumber) {
      const last = out[out.length - 1];
      const target = `${prefix}${e}${suffix}`;
      if (last !== target) out[out.length - 1] = target;
    }
    if (clamp && out.length && asNumber) {
      const last = out[out.length - 1];
      if (last !== e) out[out.length - 1] = e;
    }
  } else {
    for (let v = s; v >= e; v -= st) {
      const value = asNumber ? v : `${prefix}${v}${suffix}`;
      out.push(value);
      count++;
      if (count >= maxItems) break;
    }
    if (clamp && out.length && !asNumber) {
      const last = out[out.length - 1];
      const target = `${prefix}${e}${suffix}`;
      if (last !== target) out[out.length - 1] = target;
    }
    if (clamp && out.length && asNumber) {
      const last = out[out.length - 1];
      if (last !== e) out[out.length - 1] = e;
    }
  }

  return out;
}
