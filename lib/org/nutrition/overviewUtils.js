// lib/org/nutrition/overviewUtils.js

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function fmtDateShort(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  } catch {
    return String(v);
  }
}

export function computeOverview(rows) {
  const list = Array.isArray(rows) ? rows : [];

  const total = list.length;
  const withPlan = list.filter((r) => r?.hasPlan).length;
  const noPlan = total - withPlan;

  const missingCheckin = list.filter((r) => r?.missingCheckin).length;
  const lowAdherence = list.filter((r) => r?.lowAdherence).length;
  const needsAction = list.filter((r) => r?.needsAction).length;

  const withCheckin = list.filter((r) => r?.lastCheckin);
  const avgAdherence =
    withCheckin.length > 0
      ? Math.round(withCheckin.reduce((sum, r) => sum + Number(r?.adherenceAvg || 0), 0) / withCheckin.length)
      : 0;

  const adherenceBuckets = {
    "0–49": 0,
    "50–69": 0,
    "70–84": 0,
    "85–100": 0,
    "No check-in": 0,
  };

  for (const r of list) {
    if (!r?.lastCheckin) {
      adherenceBuckets["No check-in"]++;
      continue;
    }
    const a = Number(r?.adherenceAvg || 0);
    if (a < 50) adherenceBuckets["0–49"]++;
    else if (a < 70) adherenceBuckets["50–69"]++;
    else if (a < 85) adherenceBuckets["70–84"]++;
    else adherenceBuckets["85–100"]++;
  }

  const atRisk = [...list]
    .sort((a, b) => {
      // deterministic priority
      const score = (r) => {
        if (!r?.hasPlan) return 0;
        if (r?.missingCheckin) return 1;
        if (r?.lowAdherence) return 2;
        if (r?.needsAction) return 3;
        return 4;
      };

      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;

      const pa = Number(a?.priority ?? 9);
      const pb = Number(b?.priority ?? 9);
      if (pa !== pb) return pa - pb;

      const na = String(a?.athleteName || "").toLowerCase();
      const nb = String(b?.athleteName || "").toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    })
    .slice(0, 10);

  const recentCheckins = [...withCheckin]
    .sort((a, b) => {
      const ta = new Date(a?.lastCheckin?.createdAt || 0).getTime() || 0;
      const tb = new Date(b?.lastCheckin?.createdAt || 0).getTime() || 0;
      return tb - ta;
    })
    .slice(0, 8);

  return {
    total,
    withPlan,
    noPlan,
    missingCheckin,
    lowAdherence,
    needsAction,
    avgAdherence,
    adherenceBuckets,
    atRisk,
    recentCheckins,
  };
}