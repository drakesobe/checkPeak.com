// components/org/nutrition/NutritionRow.jsx
"use client";

/**
 * NutritionRow (polished + simple)
 * - clearer athlete identity (name + email + optional sport/team)
 * - status badge remains triage-based (No Plan / Missing / Low / Good)
 * - adherence shows avg + small metric breakdown when available
 * - priority chip is normalized (P1/P2/P3/Other) but won’t break if label differs
 * - reasons display as compact chips (2 max) so row stays clean
 * - row is clickable (desktop), with button that stops propagation
 */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function fmtDateTime(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function reasonBadge(row) {
  if (!row?.hasPlan) return { t: "No Plan", cls: "bg-red-50 text-red-700 border-red-200" };
  if (row?.missingCheckin) return { t: "Missing Check-in", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (row?.lowAdherence) return { t: "Low Adherence", cls: "bg-orange-50 text-orange-800 border-orange-200" };
  return { t: "Good", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function priorityTone(label) {
  const t = safeStr(label).toUpperCase();
  if (t === "P1" || t.includes("P1")) return "p1";
  if (t === "P2" || t.includes("P2")) return "p2";
  if (t === "P3" || t.includes("P3")) return "p3";
  return "base";
}

function PriorityChip({ label }) {
  const t = priorityTone(label);
  const cls =
    t === "p1"
      ? "bg-red-50 text-red-700 border-red-200"
      : t === "p2"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : t === "p3"
      ? "bg-orange-50 text-orange-800 border-orange-200"
      : "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span className={cx("inline-flex px-2 py-1 rounded-lg border text-xs font-semibold", cls)}>
      {safeStr(label) || "—"}
    </span>
  );
}

function ReasonChip({ children }) {
  return (
    <span className="inline-flex px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-semibold">
      {children}
    </span>
  );
}

function MetricPills({ lastCheckin }) {
  if (!lastCheckin) return null;

  const cal = pct(lastCheckin?.caloriesPct);
  const pro = pct(lastCheckin?.proteinPct);
  const hyd = pct(lastCheckin?.hydrationPct);

  const hasAny = cal != null || pro != null || hyd != null;
  if (!hasAny) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
      {cal != null ? (
        <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
          <span className="text-gray-500">Cal</span>{" "}
          <span className="font-semibold text-gray-900">{cal}%</span>
        </span>
      ) : null}
      {pro != null ? (
        <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
          <span className="text-gray-500">Pro</span>{" "}
          <span className="font-semibold text-gray-900">{pro}%</span>
        </span>
      ) : null}
      {hyd != null ? (
        <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
          <span className="text-gray-500">Hyd</span>{" "}
          <span className="font-semibold text-gray-900">{hyd}%</span>
        </span>
      ) : null}
    </div>
  );
}

export default function NutritionRow({ row, onOpenAthlete }) {
  const r = row || {};
  const badge = reasonBadge(r);

  const hasToken = Boolean(safeStr(r.athleteToken));
  const showSub = safeStr(r.athleteEmail) || safeStr(r.athleteToken);

  const reasons = Array.isArray(r.reasons) ? r.reasons.map((x) => safeStr(x)).filter(Boolean) : [];

  const handleOpen = () => {
    if (typeof onOpenAthlete === "function") onOpenAthlete(r);
  };

  return (
    <tr
      className={cx(
        "transition",
        hasToken ? "hover:bg-blue-50/40 cursor-pointer" : ""
      )}
      onClick={() => {
        if (!hasToken) return;
        handleOpen();
      }}
      role={hasToken ? "button" : undefined}
    >
      {/* Athlete */}
      <td className="px-5 py-4 align-top">
        <div className="font-semibold text-gray-900">{safeStr(r.athleteName) || "Athlete"}</div>

        {showSub ? (
          <div className="text-xs text-gray-500 mt-0.5">
            {safeStr(r.athleteEmail) ? safeStr(r.athleteEmail) : null}
            {safeStr(r.athleteEmail) && safeStr(r.athleteToken) ? " • " : null}
            {safeStr(r.athleteToken) ? `Token: ${safeStr(r.athleteToken)}` : null}
          </div>
        ) : (
          <div className="text-xs text-gray-500 mt-0.5">—</div>
        )}

        {(safeStr(r.team) || safeStr(r.sport)) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {safeStr(r.team) ? (
              <span className="inline-flex px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-[11px] text-blue-900 font-semibold">
                {safeStr(r.team)}
              </span>
            ) : null}
            {safeStr(r.sport) ? (
              <span className="inline-flex px-2 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-700 font-semibold">
                {safeStr(r.sport)}
              </span>
            ) : null}
          </div>
        ) : null}

        {!hasToken ? (
          <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 inline-flex rounded-lg px-2 py-1">
            Missing athleteToken (cannot open)
          </div>
        ) : null}
      </td>

      {/* Latest plan */}
      <td className="px-5 py-4 align-top">
        <div className="text-xs text-gray-500">Latest plan</div>
        <div className="text-sm text-gray-800">{fmtDateTime(r.latestPlanCreatedAt)}</div>
        {typeof r.planAgeDays === "number" ? (
          <div className="text-[11px] text-gray-500 mt-1">{r.planAgeDays} day(s) ago</div>
        ) : null}
      </td>

      {/* Status */}
      <td className="px-5 py-4 align-top">
        <span className={cx("inline-flex px-2 py-1 rounded-lg border text-xs font-semibold", badge.cls)}>
          {badge.t}
        </span>
      </td>

      {/* Adherence */}
      <td className="px-5 py-4 align-top">
        <div className="text-sm font-semibold text-gray-900">
          {r.lastCheckin ? `${pct(r.adherenceAvg) ?? r.adherenceAvg}%` : "—"}
        </div>
        <div className="text-xs text-gray-500">
          {r.lastCheckin?.createdAt ? `Last: ${fmtDateTime(r.lastCheckin.createdAt)}` : ""}
        </div>
        <MetricPills lastCheckin={r.lastCheckin} />
      </td>

      {/* Priority + Reasons */}
      <td className="px-5 py-4 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityChip label={r.priorityLabel} />

          {reasons.length ? (
            <div className="flex flex-wrap gap-2">
              {reasons.slice(0, 2).map((x) => (
                <ReasonChip key={x}>{x.replace(/_/g, " ")}</ReasonChip>
              ))}
              {reasons.length > 2 ? (
                <span className="text-[11px] text-gray-500">+{reasons.length - 2} more</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>

      {/* Action */}
      <td className="px-5 py-4 align-top" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleOpen}
          disabled={!hasToken}
          className={cx(
            "px-3 py-2 rounded-xl text-xs font-semibold transition",
            hasToken ? "bg-[#46769B] text-white hover:brightness-110" : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
        >
          Open →
        </button>
      </td>
    </tr>
  );
}