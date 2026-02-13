"use client";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
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

function reasonBadge(row) {
  if (!row?.hasPlan) return { t: "No Plan", cls: "bg-red-50 text-red-700 border-red-200" };
  if (row?.missingCheckin) return { t: "Missing Check-in", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (row?.lowAdherence) return { t: "Low Adherence", cls: "bg-orange-50 text-orange-800 border-orange-200" };
  return { t: "Good", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export default function NutritionRow({ row, onOpenAthlete }) {
  const badge = reasonBadge(row);

  return (
    <tr>
      <td className="px-5 py-4">
        <div className="font-semibold text-gray-900">{row.athleteName || "Athlete"}</div>
        <div className="text-xs text-gray-500">
          {row.athleteToken ? `Token: ${row.athleteToken}` : row.athleteEmail || "—"}
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="text-xs text-gray-500">Latest</div>
        <div className="text-sm text-gray-800">{fmtDateTime(row.latestPlanCreatedAt)}</div>
        {typeof row.planAgeDays === "number" ? (
          <div className="text-[11px] text-gray-500 mt-1">{row.planAgeDays} day(s) ago</div>
        ) : null}
      </td>

      <td className="px-5 py-4">
        <span className={classNames("inline-flex px-2 py-1 rounded-lg border text-xs font-semibold", badge.cls)}>
          {badge.t}
        </span>
      </td>

      <td className="px-5 py-4">
        <div className="text-sm font-semibold text-gray-900">{row.lastCheckin ? `${row.adherenceAvg}%` : "—"}</div>
        <div className="text-xs text-gray-500">
          {row.lastCheckin?.createdAt ? `Last: ${fmtDateTime(row.lastCheckin.createdAt)}` : ""}
        </div>
      </td>

      <td className="px-5 py-4">
        <div className="inline-flex items-center gap-2">
          <span
            className={classNames(
              "inline-flex px-2 py-1 rounded-lg border text-xs font-semibold",
              row.priorityLabel === "P1"
                ? "bg-red-50 text-red-700 border-red-200"
                : row.priorityLabel === "P2"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : row.priorityLabel === "P3"
                ? "bg-orange-50 text-orange-800 border-orange-200"
                : "bg-gray-50 text-gray-700 border-gray-200"
            )}
          >
            {row.priorityLabel || "—"}
          </span>

          {Array.isArray(row.reasons) && row.reasons.length ? (
            <span className="text-[11px] text-gray-500">
              {row.reasons
                .map((x) => String(x).replace(/_/g, " "))
                .join(", ")}
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-5 py-4">
        <button
          type="button"
          onClick={() => onOpenAthlete?.(row)}
          className="px-3 py-2 rounded-xl bg-[#46769B] text-white text-xs font-semibold hover:brightness-110"
        >
          Open →
        </button>
      </td>
    </tr>
  );
}
