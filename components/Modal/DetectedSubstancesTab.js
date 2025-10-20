"use client";
import { useEffect, useState } from "react";
import ResultsTableSmartstack from "../ResultsTable-smartstack";

export default function DetectedSubstancesTab({
  matchedRecords = [],
  error = "",
  hideCounts = false,
}) {
  const [expanded, setExpanded] = useState({});
  const [records, setRecords] = useState(matchedRecords);

  // Keep data updated when parent sends new scan results
  useEffect(() => {
    setRecords(matchedRecords);
    setExpanded({}); // collapse old rows when new data arrives
  }, [matchedRecords]);

  const toggleRow = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Handle errors cleanly
  if (error) {
    return (
      <p className="text-red-400 text-center mt-4 text-sm">
        ⚠️ Error loading detected substances: {error}
      </p>
    );
  }

  // Handle no matches found
  if (!records || records.length === 0) {
    return (
      <p className="text-gray-400 text-center mt-4 text-sm">
        ✅ No banned substances detected from the current OCR scan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Badge summary (if hideCounts = false) */}
      {!hideCounts && (
        <div className="flex flex-wrap gap-2">
          {records.map((r) => {
            const banType = r.fields?.["Ban Type"];
            const colorClass =
              banType === "Prohibited"
                ? "bg-red-600"
                : banType === "Limited to Out of Competition"
                ? "bg-yellow-500 text-black"
                : "bg-green-500";
            return (
              <span
                key={r.id}
                className={`px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}
              >
                {banType || "Not Listed"}
              </span>
            );
          })}
        </div>
      )}

      {/* Results table */}
      <ResultsTableSmartstack matchedRecords={records} />

      {/* Collapsible details section */}
      <div className="space-y-2">
        {records.map((r) => {
          const id = r.id;
          const name = r.fields?.["Substance Name"] || r.name || "Unnamed Substance";
          const notes = r.fields?.Notes;
          const source = r.fields?.["Source / Citation"];
          const limit = r.fields?.["Dosage Limit"];

          return (
            <div
              key={id}
              className="border border-white/10 rounded p-2 hover:bg-white/5 transition-colors"
            >
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => toggleRow(id)}
              >
                <span className="font-semibold">{name}</span>
                <span className="text-white/70 text-sm">{expanded[id] ? "▼" : "►"}</span>
              </div>

              {expanded[id] && (
                <div className="mt-2 text-white/80 text-sm space-y-1">
                  {notes && <p>Notes: {notes}</p>}
                  {source && <p>Source: {source}</p>}
                  {limit && <p>Dosage Limit: {limit}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
