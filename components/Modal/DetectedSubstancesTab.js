"use client";
import { useState } from "react";
import ResultsTableSmartstack from "../ResultsTable-smartstack";

export default function DetectedSubstancesTab({ matchedRecords = [] }) {
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
              <span className="font-semibold">{r.fields?.["Substance Name"] || r.name || "Unnamed Substance"}</span>
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
