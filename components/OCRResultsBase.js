// components/OCRResultsBase.js
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import ResultsTable from "./ResultsTable";

// Escape regex special characters
const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Normalize ban types
const normalizeBanType = (s) => {
  if (!s) return "None";
  s = s.trim();
  if (/^prohibited$/i.test(s)) return "Prohibited";
  if (/^limited(\s+to)?\s+out\s+of\s+competition$/i.test(s))
    return "Limited Out of Competition";
  if (/^particular\s+sports$/i.test(s)) return "Particular Sports";
  return "None";
};

// Ban type → highlight color
const banTypeColorsMap = {
  Prohibited: "#d62828",
  "Limited Out of Competition": "#f77f00",
  "Particular Sports": "#2a9d8f",
  None: "#111827",
};

export default function OCRResultsBase({
  ocrText = "",
  detectedSubstances = [],
  showOCR = false,
  hideTitle = false,
}) {
  const [activeBanType, setActiveBanType] = useState(null);

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#2a9d8f" },
  ];

  const handleLegendClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  // Filter substances by active legend
  const filteredSubstances = useMemo(() => {
    if (!activeBanType) return detectedSubstances;
    return detectedSubstances.filter(
      (r) => normalizeBanType(r.fields?.["Ban Type"]) === activeBanType
    );
  }, [detectedSubstances, activeBanType]);

  // Precompute highlighted table cells
  const highlightedTableCells = useMemo(() => {
    const map = {};
    filteredSubstances.forEach((record) => {
      const fields = record.fields || {};
      const banType = normalizeBanType(fields["Ban Type"]);
      const textColor = banTypeColorsMap[banType];

      const highlightCellText = (text) => {
        if (!ocrText || !text) return text || "";

        let cellText = text;
        const terms = [
          (fields["Substance Name"] || "").trim(),
          ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
        ].filter(Boolean);

        // Only highlight terms that appear in OCR
        terms.forEach((term) => {
          const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
          if (regex.test(ocrText)) {
            cellText = cellText.replace(
              regex,
              (match) =>
                `<span style="color:${textColor}; font-weight:600; text-decoration:underline; text-decoration-color:${textColor}; text-underline-offset:2px;">${match}</span>`
            );
          }
        });

        return cellText;
      };

      map[record.id] = {
        substanceName: highlightCellText(fields["Substance Name"] || ""),
        synonyms: highlightCellText(fields["Synonyms"] || ""),
      };
    });
    return map;
  }, [filteredSubstances, ocrText]);

  // Highlight OCR text for display above table
  const highlightedOCRText = useMemo(() => {
    if (!ocrText) return "No text scanned yet.";
    let highlighted = ocrText;

    filteredSubstances.forEach((record) => {
      const fields = record.fields || {};
      const banType = normalizeBanType(fields["Ban Type"]);
      const textColor = banTypeColorsMap[banType];

      const terms = [
        (fields["Substance Name"] || "").trim(),
        ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
      ].filter(Boolean);

      terms.forEach((term) => {
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
        if (regex.test(highlighted)) {
          highlighted = highlighted.replace(
            regex,
            (match) =>
              `<span style="color:${textColor}; font-weight:600; text-decoration:underline; text-decoration-color:${textColor}; text-underline-offset:2px;">${match}</span>`
          );
        }
      });
    });

    return highlighted;
  }, [ocrText, filteredSubstances]);

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 py-6 font-sans space-y-6">
      {showOCR && !hideTitle && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
        >
          <h2 className="text-2xl font-bold mb-4">OCR Result</h2>
          <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-md whitespace-pre-wrap break-words">
            <div dangerouslySetInnerHTML={{ __html: highlightedOCRText }} />
          </div>
        </motion.section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-2">Detected Banned Substances</h2>

        {/* Ban Type Legend */}
        <div className="overflow-x-auto mb-4">
          <div className="flex gap-4 w-[420px] min-w-max pl-2">
            {banTypeColors.map((type) => (
              <div
                key={type.label}
                className="flex items-center gap-1 cursor-pointer transition-transform hover:scale-110"
                onClick={() => handleLegendClick(type.label)}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    activeBanType === type.label ? "border-gray-700" : "border-transparent"
                  }`}
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-gray-800 text-sm font-medium">{type.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        {filteredSubstances.length > 0 ? (
          <ResultsTable
            records={filteredSubstances}
            highlightedCells={highlightedTableCells}
          />
        ) : (
          <p className="italic text-gray-500 mt-2">No banned substances detected.</p>
        )}
      </section>
    </div>
  );
}
