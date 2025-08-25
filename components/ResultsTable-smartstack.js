"use client";
import { useMemo, useState } from "react";

const banTypeColors = [
  { label: "Prohibited", color: "#d62828" },
  { label: "Limited to Out of Competition", color: "#f77f00" },
  { label: "Particular Sports", color: "#3fb0ac" }, // slightly brighter for dark bg
];

export default function ResultsTableSmartstack({ matchedRecords = [] }) {
  const [activeBanType, setActiveBanType] = useState(null);

  const filtered = useMemo(() => {
    if (!activeBanType) return matchedRecords;
    return matchedRecords.filter(
      (r) => (r.fields?.["Ban Type"] || "None") === activeBanType
    );
  }, [matchedRecords, activeBanType]);

  const getBadge = (banType) => {
    const c = banTypeColors.find((b) => b.label === banType)?.color || "#999";
    return (
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          color: "white",
          backgroundColor: c,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
        }}
      >
        {banType || "None"}
      </span>
    );
  };

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {banTypeColors.map((b) => (
          <button
            key={b.label}
            onClick={() =>
              setActiveBanType(activeBanType === b.label ? null : b.label)
            }
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${
              activeBanType === b.label
                ? "border-white/50 bg-white/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            <span className="text-sm font-medium text-white">{b.label}</span>
          </button>
        ))}
        {activeBanType && (
          <button
            onClick={() => setActiveBanType(null)}
            className="text-sm text-white/80 underline underline-offset-2"
            title="Clear filter"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-gray-900/60">
        <table className="min-w-full text-sm">
          <thead className="bg-[#2a3d4d] text-white/95">
            <tr>
              {[
                "Substance Name",
                "Synonyms",
                "Banned By",
                "Ban Type",
                "Dosage Limit",
                "Notes",
                "Source / Citation",
              ].map((h) => (
                <th key={h} className="px-4 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-white/70"
                >
                  No banned substances detected for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((rec, i) => {
                const f = rec.fields || {};
                return (
                  <tr
                    key={rec.id || i}
                    className={i % 2 === 0 ? "bg-white/5" : "bg-white/0"}
                  >
                    <td className="px-4 py-2 text-white">{f["Substance Name"] || "-"}</td>
                    <td className="px-4 py-2 text-white/80">
                      {f["Synonyms"] || "-"}
                    </td>
                    <td className="px-4 py-2 text-white/80">
                      {f["Banned By"] || "-"}
                    </td>
                    <td className="px-4 py-2">{getBadge(f["Ban Type"])}</td>
                    <td className="px-4 py-2 text-white/80">
                      {f["Dosage Limit"] || "-"}
                    </td>
                    <td className="px-4 py-2 text-white/80">
                      {f["Notes"] || "-"}
                    </td>
                    <td className="px-4 py-2 text-white/80 break-words">
                      {f["Source / Citation"] || "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
