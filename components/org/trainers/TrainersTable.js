"use client";

import { useMemo } from "react";
import { formatET } from "@/components/org/trainers/utils/time";

/* ----------------------------------------------------- */
/* Helpers                                               */
/* ----------------------------------------------------- */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/**
 * Always render in Eastern Time
 */
function fmtDate(value) {
  if (!value) return "—";
  return formatET(value) + " ET";
}

/* ----------------------------------------------------- */
/* UI atoms (local to table)                             */
/* ----------------------------------------------------- */

function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------- */
/* Table Component                                      */
/* ----------------------------------------------------- */

export default function TrainersTable({
  trainers = [],
  loading = false,
}) {
  const rows = useMemo(() => {
    return Array.isArray(trainers) ? trainers : [];
  }, [trainers]);

  return (
    <div className="bg-white rounded-2xl shadow-md border p-6 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-3 pr-4">Name</th>
            <th className="py-3 pr-4">Email</th>
            <th className="py-3 pr-4">Role</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Added (ET)</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b last:border-b-0">
              <td className="py-3 pr-4 font-semibold text-gray-900">
                {t.Name || "—"}
              </td>

              <td className="py-3 pr-4 text-gray-700">
                {normalizeEmail(t.Email)}
              </td>

              <td className="py-3 pr-4">
                <Pill tone={t.Role === "admin" ? "good" : "neutral"}>
                  {String(t.Role || "trainer")}
                </Pill>
              </td>

              <td className="py-3 pr-4">
                <Pill tone={t.Active ? "good" : "warn"}>
                  {t.Active ? "Active" : "Inactive"}
                </Pill>
              </td>

              <td className="py-3 pr-4 text-gray-700">
                {fmtDate(t.createdAt)}
              </td>
            </tr>
          ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="py-6 text-center text-gray-500"
              >
                No trainers found.
              </td>
            </tr>
          )}

          {loading && (
            <tr>
              <td
                colSpan={5}
                className="py-6 text-center text-gray-500"
              >
                Loading trainers…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
