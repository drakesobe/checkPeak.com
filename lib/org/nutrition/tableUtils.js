// lib/org/nutrition/tableUtils.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function asString(v) {
  return String(v ?? "").trim();
}

export function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

export function toNum(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function fmtDateTime(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
  } catch {
    return String(v);
  }
}

/**
 * Your API returns rows shaped like:
 * {
 *  athleteId, athleteName, athleteEmail, athleteToken,
 *  sport, team,
 *  hasPlan, latestPlanCreatedAt,
 *  lastCheckin: { createdAt, weekStartISO, caloriesPct, proteinPct, hydrationPct, notes },
 *  missingCheckin, adherenceAvg, lowAdherence,
 *  needsAction, priority, reasons, priorityLabel
 * }
 */
export function normalizeRow(r) {
  const lastCheckin = r?.lastCheckin
    ? {
        createdAt: asString(r?.lastCheckin?.createdAt),
        weekStartISO: asString(r?.lastCheckin?.weekStartISO),
        caloriesPct: toNum(r?.lastCheckin?.caloriesPct, 0),
        proteinPct: toNum(r?.lastCheckin?.proteinPct, 0),
        hydrationPct: toNum(r?.lastCheckin?.hydrationPct, 0),
        notes: asString(r?.lastCheckin?.notes),
      }
    : null;

  return {
    athleteId: asString(r?.athleteId || r?.id),
    athleteToken: asString(r?.athleteToken),
    athleteName: asString(r?.athleteName) || "Athlete",
    athleteEmail: asString(r?.athleteEmail),

    // NEW: optional cohort fields
    sport: asString(r?.sport),
    team: asString(r?.team),

    // plan/checkin flags
    hasPlan: Boolean(r?.hasPlan),
    latestPlanCreatedAt: asString(r?.latestPlanCreatedAt),

    lastCheckin,
    missingCheckin: Boolean(r?.missingCheckin),
    adherenceAvg: toNum(r?.adherenceAvg, 0),
    lowAdherence: Boolean(r?.lowAdherence),
    needsAction: Boolean(r?.needsAction),

    // priority/reasoning
    priority: toNum(r?.priority, 9),
    reasons: safeArr(r?.reasons).map(asString).filter(Boolean),
    priorityLabel: asString(r?.priorityLabel),
  };
}

export function hasAthleteToken(r) {
  return Boolean(asString(r?.athleteToken));
}

export function getRowKey(r) {
  return (
    asString(r?.athleteToken) ||
    asString(r?.athleteId) ||
    asString(r?.athleteEmail) ||
    asString(r?.athleteName) ||
    Math.random().toString(36).slice(2)
  );
}

/**
 * Badge logic should match API flags.
 * Priority order: No Plan > Missing Check-in > Low Adherence > Good
 */
export function badgeForRow(r) {
  if (!r?.hasPlan) {
    return { text: "No Plan", cls: "bg-red-50 text-red-700 border-red-200" };
  }
  if (r?.missingCheckin) {
    return { text: "Missing Check-in", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  }
  if (r?.lowAdherence) {
    return { text: "Low Adherence", cls: "bg-orange-50 text-orange-800 border-orange-200" };
  }
  return { text: "Good", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

/**
 * Stable default sort:
 * 1) priority asc (1 is most urgent)
 * 2) needsAction true first (tie-break)
 * 3) adherence asc (so worst floats up when same priority)
 * 4) athleteName asc
 */
export function sortRowsDefault(rows) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => {
    const pa = toNum(a?.priority, 9);
    const pb = toNum(b?.priority, 9);
    if (pa !== pb) return pa - pb;

    const na = Boolean(a?.needsAction);
    const nb = Boolean(b?.needsAction);
    if (na !== nb) return nb ? 1 : -1; // needsAction first

    const aa = toNum(a?.adherenceAvg, 0);
    const ab = toNum(b?.adherenceAvg, 0);
    if (aa !== ab) return aa - ab;

    const n1 = asString(a?.athleteName).toLowerCase();
    const n2 = asString(b?.athleteName).toLowerCase();
    if (n1 < n2) return -1;
    if (n1 > n2) return 1;
    return 0;
  });
  return list;
}