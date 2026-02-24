// components/org/nutrition/nutritionTable/helpers.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

export function asNumber(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

export function clampPct(v) {
  const n = asNumber(v);
  if (n == null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function pctText(v) {
  const n = clampPct(v);
  return n == null ? "—" : `${n}%`;
}

export function fmtDateTime(v) {
  if (!v) return "—";
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(v);
  }
}

export function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return String(v);
  }
}

export function clampText(s = "", max = 140) {
  const t = safeText(s);
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export function hasAthleteToken(r) {
  return safeText(r?.athleteToken).toUpperCase().startsWith("ATH-");
}

export function getRowKey(r, i) {
  return safeText(r?.athleteToken) || safeText(r?.athleteEmail) || safeText(r?.id) || `row-${i}`;
}

export function toneForPct(pct) {
  const p = clampPct(pct);
  if (p == null) return "neutral";
  if (p >= 80) return "good";
  if (p >= 65) return "warn";
  return "bad";
}

export function pillClass(tone) {
  if (tone === "good") return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (tone === "warn") return "bg-amber-50 text-amber-900 border-amber-200";
  if (tone === "bad") return "bg-red-50 text-red-900 border-red-200";
  return "bg-gray-50 text-gray-800 border-gray-200";
}

export function badgeForRow(r) {
  const planStatus = safeText(r?.plan?.status).toLowerCase();
  const hasPlan = Boolean(r?.plan && (r?.plan?.daily || r?.plan?.phase || r?.plan?.createdAt));
  const completion = r?.completion || null;

  const totalPct = clampPct(
    completion?.totalPct ?? completion?.adherencePct ?? completion?.avgPct ?? r?.rollup?.last7Avg
  );

  if (!hasAthleteToken(r)) {
    return { text: "Missing token", cls: "bg-red-50 text-red-900 border-red-200" };
  }

  if (!hasPlan) {
    return { text: "Needs plan", cls: "bg-amber-50 text-amber-900 border-amber-200" };
  }

  if (planStatus && planStatus !== "active") {
    return { text: planStatus, cls: "bg-gray-50 text-gray-800 border-gray-200" };
  }

  if (totalPct == null) {
    return { text: "No completion", cls: "bg-gray-50 text-gray-800 border-gray-200" };
  }

  const tone = toneForPct(totalPct);
  return {
    text: tone === "good" ? "On track" : tone === "warn" ? "Watch" : "At risk",
    cls: pillClass(tone),
  };
}

export function mailtoForAthlete({ email, name }) {
  const to = safeText(email);
  if (!to) return "";
  const subject = "Nutrition completions — quick check-in";
  const body = `Hey ${safeText(name) || ""},\n\nQuick note: please make sure you’re completing Meal + Hydration swipes each block (Breakfast/Lunch/Afternoon/Dinner).\n\nIf anything is confusing in the dining hall, reply with what’s hard and we’ll simplify the rule.\n\nThanks!`;
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}