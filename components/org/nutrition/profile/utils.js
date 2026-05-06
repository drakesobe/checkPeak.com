// components/org/nutrition/profile/utils.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function asString(v) {
  return String(v ?? "").trim();
}

export function normalizeEmail(v) {
  return asString(v).toLowerCase();
}

export function isLikelyOrgToken(v) {
  return asString(v).toUpperCase().startsWith("ORG-");
}

export function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/* ---------------- Number helpers ---------------- */

export function clampPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

/* ---------------- Date helpers (ET-stable) ---------------- */

export function fmtDateTime(v) {
  if (!v) return "-";
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch {
    return String(v);
  }
}

export function fmtDate(v) {
  if (!v) return "-";
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "short", day: "2-digit",
    }).format(d);
  } catch {
    return String(v);
  }
}

// Loose local format - use only for display strings that don't need timezone stability
export function fmtIsoToNice(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

export function daysSince(dateValue) {
  try {
    const t = new Date(dateValue).getTime();
    if (!t) return Infinity;
    return (Date.now() - t) / 86400000;
  } catch {
    return Infinity;
  }
}

/* ---------------- Adherence helpers ---------------- */

// Avg of present metrics only - missing fields are ignored, not treated as 0
export function avgAdherence(c) {
  const fields = [c?.caloriesPct, c?.proteinPct, c?.carbsPct, c?.hydrationPct];
  const vals = fields
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .map((v) => clampPct(v));
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function badgeForAdherence(pct) {
  const p = clampPct(pct);
  if (p >= 80) return { t: "Good",       cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  if (p >= 60) return { t: "Watch",      cls: "bg-amber-50 text-amber-900 border-amber-200"       };
  return              { t: "Needs Help", cls: "bg-red-50 text-red-800 border-red-200"             };
}

export function adherenceTone(latestAvg) {
  if (latestAvg == null) return "neutral";
  const p = clampPct(latestAvg);
  if (p >= 80) return "good";
  if (p >= 60) return "warn";
  return "bad";
}

/* ---------------- Sort + display helpers ---------------- */

export function sortNewestFirst(checkins) {
  return [...safeArr(checkins)].sort((a, b) => {
    const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
}

export function shortToken(t) {
  const s = asString(t);
  if (s.length <= 14) return s;
  return `${s.slice(0, 7)}…${s.slice(-5)}`;
}