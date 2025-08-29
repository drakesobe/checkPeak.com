"use client";
import { useState } from "react";
import ResultsTableSmartstack from "../ResultsTable-smartstack";

export default function DetectedSubstancesTab({ matchedRecords = [], error = "", hideCounts = false }) {
  const [expanded, setExpanded] = useState({});

  const toggleRow = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (!matchedRecords || matchedRecords.length === 0) {
    return (
      <p className="text-gray-400 text-center mt-4 text-sm">
        ✅ No banned substances detected from the current OCR scan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Badges - only show if hideCounts is false */}
      {!hideCounts && (
        <div className="flex flex-wrap gap-2">
          {matchedRecords.map((r) => (
            <span
              key={r.id}
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                r.fields?.["Ban Type"] === "Prohibited"
                  ? "bg-red-600"
                  : r.fields?.["Ban Type"] === "Limited to Out of Competition"
                  ? "bg-yellow-500 text-black"
                  : "bg-green-500"
              }`}
            >
              {r.fields?.["Ban Type"] || "None"}
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <ResultsTableSmartstack matchedRecords={matchedRecords} />

      {/* Collapsible details */}
      <div className="space-y-2">
        {matchedRecords.map((r) => (
          <div
            key={r.id}
            className="border border-white/10 rounded p-2 hover:bg-white/5 transition-colors"
          >
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => toggleRow(r.id)}
            >
              <span className="font-semibold">{r.fields?.["Substance Name"] || "Unnamed Substance"}</span>
              <span className="text-white/70 text-sm">{expanded[r.id] ? "▼" : "►"}</span>
            </div>
            {expanded[r.id] && (
              <div className="mt-2 text-white/80 text-sm space-y-1">
                {r.fields?.Notes && <p>Notes: {r.fields.Notes}</p>}
                {r.fields?.["Source / Citation"] && (
                  <p>Source: {r.fields["Source / Citation"]}</p>
                )}
                {r.fields?.["Dosage Limit"] && (
                  <p>Dosage Limit: {r.fields["Dosage Limit"]}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
