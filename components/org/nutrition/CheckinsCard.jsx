// components/org/nutrition/CheckinsCard.jsx
"use client";

import { useMemo } from "react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function asNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function pillClass(p) {
  const n = asNum(p);
  if (n == null) return "bg-gray-50 text-gray-700 border-gray-200";
  if (n >= 85) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (n >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (n >= 50) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function fmtPct(v) {
  const n = asNum(v);
  return n == null ? "—" : `${n}%`;
}

function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return x.toLocaleString();
}

export default function CheckinsCard({ checkins = [] }) {
  const items = useMemo(() => (Array.isArray(checkins) ? checkins : []), [checkins]);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900">Weekly Nutrition Check-ins</h2>
          <p className="text-sm text-gray-500 mt-1 break-words">
            Self-report snapshots. Great for catching patterns without food logging.
          </p>
        </div>

        <span
          className={cx(
            "shrink-0 text-[11px] px-2 py-1 rounded-lg border font-semibold",
            items.length ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-700 border-gray-200"
          )}
        >
          {items.length ? `${items.length} total` : "None"}
        </span>
      </div>

      {items.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-gray-500">
                <th className="py-2 pr-3">Week (Mon)</th>
                <th className="py-2 pr-3">Calories</th>
                <th className="py-2 pr-3">Protein</th>
                <th className="py-2 pr-3">Hydration</th>
                <th className="py-2 pr-3">Submitted</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {items.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="py-3 pr-3 font-semibold text-gray-900 whitespace-nowrap">
                    {c.weekStartISO || "—"}
                  </td>

                  <td className="py-3 pr-3">
                    <span className={cx("text-[11px] px-2 py-1 rounded-lg border font-semibold", pillClass(c.caloriesPct))}>
                      {fmtPct(c.caloriesPct)}
                    </span>
                  </td>

                  <td className="py-3 pr-3">
                    <span className={cx("text-[11px] px-2 py-1 rounded-lg border font-semibold", pillClass(c.proteinPct))}>
                      {fmtPct(c.proteinPct)}
                    </span>
                  </td>

                  <td className="py-3 pr-3">
                    <span className={cx("text-[11px] px-2 py-1 rounded-lg border font-semibold", pillClass(c.hydrationPct))}>
                      {fmtPct(c.hydrationPct)}
                    </span>
                  </td>

                  <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">
                    {fmtDate(c.createdAt)}
                  </td>

                  <td className="py-3 text-gray-700 min-w-[260px]">
                    {String(c.notes || "").trim() ? (
                      <div className="whitespace-pre-wrap">{c.notes}</div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 text-[11px] text-gray-500">
            Coaching tip: use a simple rule—if Protein &lt; 70% two weeks in a row, intervene with 1–2 dining hall rules.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700">
            No check-ins yet. Athletes can submit one weekly from their nutrition page.
          </p>
        </div>
      )}
    </section>
  );
}
