// components/org/nutrition/NutritionTable.jsx
"use client";

import { useMemo } from "react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmtDateTime(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
  } catch {
    return String(v);
  }
}

function badgeForRow(r) {
  // Priority: no plan > missing checkin > low adherence > good
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

export default function NutritionTable({ loading, rows, onOpenAthlete }) {
  const list = Array.isArray(rows) ? rows : [];

  const safeRows = useMemo(() => {
    // Ensure stable shapes so rendering doesn’t crash
    return list.map((r) => ({
      athleteId: r?.athleteId || "",
      athleteToken: r?.athleteToken || "",
      athleteName: r?.athleteName || "Athlete",
      athleteEmail: r?.athleteEmail || "",
      hasPlan: Boolean(r?.hasPlan),
      latestPlanCreatedAt: r?.latestPlanCreatedAt || "",
      lastCheckin: r?.lastCheckin || null,
      missingCheckin: Boolean(r?.missingCheckin),
      adherenceAvg: Number(r?.adherenceAvg || 0),
      lowAdherence: Boolean(r?.lowAdherence),
      needsAction: Boolean(r?.needsAction),
      priority: Number(r?.priority || 9),
      reasons: Array.isArray(r?.reasons) ? r.reasons : [],
      priorityLabel: r?.priorityLabel || "",
    }));
  }, [list]);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {loading ? "Loading…" : `${safeRows.length} athlete(s)`}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Token-first navigation (AthleteToken). Missing tokens will be flagged.
          </p>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-5 py-3 font-semibold">Athlete</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Latest Plan</th>
              <th className="px-5 py-3 font-semibold">Adherence</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {safeRows.map((r) => {
              const badge = badgeForRow(r);
              const hasToken = Boolean(String(r.athleteToken || "").trim());

              return (
                <tr key={r.athleteToken || r.athleteId || r.athleteEmail || r.athleteName}>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-gray-900">{r.athleteName}</div>
                    <div className="text-xs text-gray-500">{r.athleteEmail || "—"}</div>

                    {!hasToken && (
                      <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 inline-flex rounded-lg px-2 py-1">
                        Missing athleteToken (cannot open)
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={classNames(
                        "inline-flex px-2 py-1 rounded-lg border text-xs font-semibold",
                        badge.cls
                      )}
                    >
                      {badge.text}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="text-xs text-gray-500">Created</div>
                    <div className="text-sm text-gray-800">{fmtDateTime(r.latestPlanCreatedAt)}</div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {r.lastCheckin ? `${r.adherenceAvg}%` : "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.lastCheckin?.createdAt ? `Last: ${fmtDateTime(r.lastCheckin.createdAt)}` : ""}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        // Always call the parent handler
                        if (typeof onOpenAthlete === "function") onOpenAthlete(r);
                        else console.error("[NutritionTable] onOpenAthlete is not a function", onOpenAthlete);
                      }}
                      disabled={!hasToken}
                      className={classNames(
                        "px-3 py-2 rounded-xl text-xs font-semibold transition",
                        hasToken
                          ? "bg-[#46769B] text-white hover:brightness-110"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      )}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && safeRows.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-gray-600" colSpan={5}>
                  No athletes match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-4 space-y-3">
        {safeRows.map((r) => {
          const badge = badgeForRow(r);
          const hasToken = Boolean(String(r.athleteToken || "").trim());

          return (
            <div key={r.athleteToken || r.athleteId || r.athleteEmail || r.athleteName} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.athleteName}</p>
                  <p className="text-xs text-gray-500 truncate">{r.athleteEmail || "—"}</p>
                </div>

                <span className={classNames("shrink-0 inline-flex px-2 py-1 rounded-lg border text-xs font-semibold", badge.cls)}>
                  {badge.text}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-500">Latest Plan</p>
                  <p className="text-gray-900 font-semibold">{fmtDateTime(r.latestPlanCreatedAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Adherence</p>
                  <p className="text-gray-900 font-semibold">{r.lastCheckin ? `${r.adherenceAvg}%` : "—"}</p>
                </div>
              </div>

              {!hasToken && (
                <div className="mt-3 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  Missing athleteToken (cannot open this athlete)
                </div>
              )}

              <button
                type="button"
                onClick={() => onOpenAthlete?.(r)}
                disabled={!hasToken}
                className={classNames(
                  "mt-4 w-full px-4 py-3 rounded-2xl text-sm font-semibold transition",
                  hasToken
                    ? "bg-[#46769B] text-white hover:brightness-110"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                )}
              >
                Open Athlete →
              </button>
            </div>
          );
        })}

        {!loading && safeRows.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No athletes match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
