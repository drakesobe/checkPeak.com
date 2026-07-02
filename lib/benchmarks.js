// lib/benchmarks.js
// National performance benchmarks for high school athletes.
// Data sourced from NSCA standards, college combine averages, and published strength research.
// All strength values in lb. Speed in seconds. Jump in inches.

// Each metric stores percentile CUTOFF values — the score needed to reach that percentile.
// "p90: 315" means you need 315 lb to be at the 90th percentile (top 10%).

const BENCHMARKS = {
  squat: {
    higherIsBetter: true,
    unit: "lb",
    male: { p10:135, p25:185, p50:245, p75:295, p90:345, p95:390, p99:455 },
    female:{ p10: 75, p25:105, p50:145, p75:185, p90:220, p95:255, p99:310 },
  },
  bench: {
    higherIsBetter: true,
    unit: "lb",
    male: { p10: 95, p25:135, p50:175, p75:215, p90:255, p95:285, p99:335 },
    female:{ p10: 45, p25: 65, p50: 85, p75:105, p90:130, p95:150, p99:185 },
  },
  deadlift: {
    higherIsBetter: true,
    unit: "lb",
    male: { p10:175, p25:225, p50:285, p75:345, p90:405, p95:455, p99:525 },
    female:{ p10: 95, p25:135, p50:175, p75:225, p90:275, p95:315, p99:375 },
  },
  powerClean: {
    higherIsBetter: true,
    unit: "lb",
    male: { p10: 95, p25:135, p50:165, p75:195, p90:225, p95:250, p99:295 },
    female:{ p10: 55, p25: 75, p50: 95, p75:115, p90:135, p95:150, p99:185 },
  },
  fortyYardDash: {
    higherIsBetter: false, // lower time = better
    unit: "s",
    male: { p10:5.15, p25:4.92, p50:4.73, p75:4.55, p90:4.42, p95:4.35, p99:4.24 },
    female:{ p10:6.10, p25:5.85, p50:5.60, p75:5.35, p90:5.10, p95:4.95, p99:4.75 },
  },
  verticalJump: {
    higherIsBetter: true,
    unit: "in",
    male: { p10:18, p25:22, p50:26, p75:30, p90:34, p95:37, p99:42 },
    female:{ p10:12, p25:15, p50:18, p75:22, p90:25, p95:28, p99:32 },
  },
  broadJump: {
    higherIsBetter: true,
    unit: "in",
    male: { p10:78, p25:88, p50:98, p75:108, p90:116, p95:122, p99:130 },
    female:{ p10:58, p25:67, p50:76, p75:86,  p90: 94, p95: 99, p99:107 },
  },
};

// ── Keyword → benchmark key ───────────────────────────────────────────────────
const KEYWORD_MAP = [
  { key: "squat",         words: ["squat"] },
  { key: "bench",         words: ["bench"] },
  { key: "deadlift",      words: ["deadlift", "dead lift"] },
  { key: "powerClean",    words: ["power clean", "powerclean", "clean"] },
  { key: "fortyYardDash", words: ["40", "forty", "40-yard", "forty yard"] },
  { key: "verticalJump",  words: ["vertical", "vert jump"] },
  { key: "broadJump",     words: ["broad", "broad jump", "standing long"] },
];

export function getMetricKey(exerciseTitle = "") {
  const t = exerciseTitle.toLowerCase().trim();
  for (const { key, words } of KEYWORD_MAP) {
    if (words.some(w => t.includes(w))) return key;
  }
  return null;
}

// ── Percentile interpolation ──────────────────────────────────────────────────
// Returns 0-100. Interpolates linearly between bucket boundaries.
export function getPercentile(metricKey, value, gender = "male") {
  const bench = BENCHMARKS[metricKey];
  if (!bench) return null;
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return null;

  const table = bench[gender] || bench.male;
  const pts   = bench.higherIsBetter
    ? [
        { pct:  1, val: 0              },
        { pct: 10, val: table.p10      },
        { pct: 25, val: table.p25      },
        { pct: 50, val: table.p50      },
        { pct: 75, val: table.p75      },
        { pct: 90, val: table.p90      },
        { pct: 95, val: table.p95      },
        { pct: 99, val: table.p99      },
        { pct:100, val: table.p99 * 1.4 },
      ]
    : [
        // Lower is better: invert mapping
        { pct: 99, val: table.p99      },
        { pct: 95, val: table.p95      },
        { pct: 90, val: table.p90      },
        { pct: 75, val: table.p75      },
        { pct: 50, val: table.p50      },
        { pct: 25, val: table.p25      },
        { pct: 10, val: table.p10      },
        { pct:  1, val: table.p10 * 1.4 },
      ].sort((a, b) => a.val - b.val);

  if (bench.higherIsBetter) {
    // Find surrounding bucket
    if (v <= pts[0].val) return pts[0].pct;
    if (v >= pts[pts.length - 1].val) return pts[pts.length - 1].pct;
    for (let i = 0; i < pts.length - 1; i++) {
      const lo = pts[i], hi = pts[i + 1];
      if (v >= lo.val && v <= hi.val) {
        const t = (v - lo.val) / (hi.val - lo.val);
        return Math.round(lo.pct + t * (hi.pct - lo.pct));
      }
    }
  } else {
    // Lower is better — percentile is how many you beat (i.e., score lower than)
    // Convert to "what percentile does this time map to?"
    const sorted = [...pts].sort((a, b) => b.val - a.val); // descending val = ascending percentile
    if (v <= sorted[sorted.length - 1].val) return sorted[sorted.length - 1].pct;
    if (v >= sorted[0].val) return sorted[0].pct;
    for (let i = 0; i < sorted.length - 1; i++) {
      const hi = sorted[i], lo = sorted[i + 1];
      if (v <= hi.val && v >= lo.val) {
        const t = (hi.val - v) / (hi.val - lo.val);
        return Math.round(hi.pct + t * (lo.pct - hi.pct));
      }
    }
  }
  return null;
}

// ── UI tier from percentile ───────────────────────────────────────────────────
// Returns null if below the "show" threshold (50th percentile).
// We only celebrate achievement, not demotivate by showing "below average."
export function getBenchmarkBadge(metricKey, value, gender = "male") {
  const pct = getPercentile(metricKey, value, gender);
  if (pct === null || pct < 50) return null;

  let tier, label, color, bg, border;

  if (pct >= 90) {
    tier = "elite"; label = `TOP ${100 - pct}%`;
    color = "#D4A017"; bg = "rgba(212,160,23,0.12)"; border = "rgba(212,160,23,0.4)";
  } else if (pct >= 75) {
    tier = "great"; label = `TOP ${100 - pct}%`;
    color = "#22C55E"; bg = "rgba(34,197,94,0.1)"; border = "rgba(34,197,94,0.35)";
  } else if (pct >= 60) {
    tier = "solid"; label = "ABOVE AVG";
    color = "#4FABFF"; bg = "rgba(79,171,255,0.1)"; border = "rgba(79,171,255,0.3)";
  } else {
    tier = "avg"; label = "AVG";
    color = "#9BA8B4"; bg = "rgba(255,255,255,0.05)"; border = "rgba(255,255,255,0.12)";
  }

  return { pct, tier, label, color, bg, border };
}

// ── Percentile sentence for recruiting profile ────────────────────────────────
export function getBenchmarkSentence(metricKey, value, gender = "male") {
  const pct = getPercentile(metricKey, value, gender);
  if (pct === null) return null;
  const top = 100 - pct;
  if (top <= 1)  return `Top 1% nationally`;
  if (top <= 5)  return `Top 5% nationally`;
  if (top <= 10) return `Top 10% nationally`;
  if (top <= 15) return `Top 15% nationally`;
  if (top <= 25) return `Top 25% nationally`;
  if (top <= 40) return `Top 40% nationally`;
  if (pct >= 50) return `Above national average`;
  return null;
}

export { BENCHMARKS };
