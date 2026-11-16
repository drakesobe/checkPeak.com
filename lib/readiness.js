// lib/readiness.js
// Readiness scoring shared by /api/athlete/readiness and /api/org/readiness.
//
// Inputs are 1–5. Sleep + energy: higher is better. Soreness + stress: higher is worse.
// score = mean of the four "goodness" values mapped to 0–100.
// Bands:  ≥ 75 ready · 50–74 caution · < 50 recovery
// Coach flags: low score, soreness ≥ 4, sleep ≤ 2, stress ≥ 4, or reported pain.

export const READINESS_FIELDS = ["sleep", "energy", "soreness", "stress"];

export function clamp15(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

export function readinessScore({ sleep, energy, soreness, stress }) {
  const good = [sleep, energy, 6 - soreness, 6 - stress];
  const sum  = good.reduce((a, b) => a + b, 0);       // 4 … 20
  return Math.round(((sum - 4) / 16) * 100);
}

export function readinessBand(score) {
  if (score >= 75) return "ready";
  if (score >= 50) return "caution";
  return "recovery";
}

export function readinessFlags(r) {
  const flags = [];
  if (r.pain)            flags.push(r.pain_note ? `Pain: ${r.pain_note}` : "Reported pain");
  if (r.score < 50)      flags.push("Low readiness");
  if (r.soreness >= 4)   flags.push("Very sore");
  if (r.sleep <= 2)      flags.push("Poor sleep");
  if (r.stress >= 4)     flags.push("High stress");
  return flags;
}
