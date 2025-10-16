"use client";
import { useState } from "react";
import ResultsTableSmartstack from "../ResultsTable-smartstack";

export default function DetectedSubstancesTab({ matchedRecords = [], detectedIngredients = [] }) {
  const [expanded, setExpanded] = useState({});
  const [expandedIngredients, setExpandedIngredients] = useState({});

  const toggleRow = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleIngredientRow = (id) => setExpandedIngredients((prev) => ({ ...prev, [id]: !prev[id] }));

  if ((!matchedRecords || matchedRecords.length === 0) && (!detectedIngredients || detectedIngredients.length === 0)) {
    return (
      <p className="text-gray-400 text-center mt-4 text-sm">
        ✅ No banned substances or ingredients detected from the current OCR scan.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banned Substances Table */}
      {matchedRecords && matchedRecords.length > 0 && (
        <div className="space-y-4">
          <ResultsTableSmartstack matchedRecords={matchedRecords} />

          {/* Collapsible details for banned substances */}
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
                  <span className="font-semibold">
                    {r.fields?.["Substance Name"] || r.name || "Unnamed Substance"}
                  </span>
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
      )}

      {/* Ingredients Section */}
      {detectedIngredients && detectedIngredients.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-white/80 font-semibold">Detected Ingredients</h3>

          <div className="space-y-2">
            {detectedIngredients.map((ing) => (
              <div
                key={ing.id}
                className="border border-white/10 rounded p-2 hover:bg-white/5 transition-colors"
              >
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => toggleIngredientRow(ing.id)}
                >
                  <span className="font-semibold">{ing.name || ing.fields?.["Ingredient Name"] || "Unnamed Ingredient"}</span>
                  <span className="text-white/70 text-sm">{expandedIngredients[ing.id] ? "▼" : "►"}</span>
                </div>
                {expandedIngredients[ing.id] && (
                  <div className="mt-2 text-white/80 text-sm space-y-1">
                    {ing.fields?.Notes && <p>Notes: {ing.fields.Notes}</p>}
                    {ing.fields?.["Source / Citation"] && <p>Source: {ing.fields["Source / Citation"]}</p>}
                    {ing.fields?.["Amount"] && <p>Amount: {ing.fields["Amount"]}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
