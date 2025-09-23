// components/OCRResultsBase.js
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import ResultsTable from "./ResultsTable";

// Escape regex special characters
const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Normalize ban types (keeps compatibility with previous normalization)
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
  detectedSubstances = [], // banned substances
  detectedIngredients = [], // newly added — ingredients results array
  showOCR = false,
  hideTitle = false,
}) {
  const [activeBanType, setActiveBanType] = useState(null);

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#2a9d8f" },
  ];

  const INGREDIENT_HIGHLIGHT = "#8556da";

  const handleLegendClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  // Filter banned substances by active legend
  const filteredSubstances = useMemo(() => {
    if (!activeBanType) return detectedSubstances;
    return detectedSubstances.filter(
      (r) => normalizeBanType(r.fields?.["Ban Type"]) === activeBanType
    );
  }, [detectedSubstances, activeBanType]);

  // We don't filter ingredients by legend (legend is ban-type-focused).
  const filteredIngredients = useMemo(() => detectedIngredients || [], [detectedIngredients]);

  // Build highlighted table cells for banned substances (existing behavior)
  const highlightedSubstanceCells = useMemo(() => {
    const map = {};
    filteredSubstances.forEach((record) => {
      const fields = record.fields || {};
      const banType = normalizeBanType(fields["Ban Type"]);
      const textColor = banTypeColorsMap[banType] || "#111827";

      const highlightCellText = (text) => {
        if (!ocrText || !text) return text || "";
        let cellText = text;
        const terms = [
          (fields["Substance Name"] || "").trim(),
          ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
        ].filter(Boolean);

        terms.forEach((term) => {
          const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
          if (regex.test(ocrText)) {
            cellText = cellText.replace(
              regex,
              (match) =>
                `<span style="color:${textColor}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${match}</span>`
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

  // Build highlighted table cells for ingredients (new)
  const highlightedIngredientCells = useMemo(() => {
    const map = {};
    filteredIngredients.forEach((record) => {
      const fields = record.fields || {};
      const highlightCellText = (text) => {
        if (!ocrText || !text) return text || "";
        let cellText = text;
        const terms = [
          (fields["Name"] || "").trim(),
          ...(((fields["Synonyms (Extended)"] || fields["Synonyms"] || "")?.split?.(",") ||
            []
          ).map((s) => s.trim())),
        ].filter(Boolean);

        terms.forEach((term) => {
          const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
          if (regex.test(ocrText)) {
            cellText = cellText.replace(
              regex,
              (match) =>
                `<span style="color:${INGREDIENT_HIGHLIGHT}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${match}</span>`
            );
          }
        });
        return cellText;
      };

      map[record.id] = {
        name: highlightCellText(fields["Name"] || fields["Ingredient Name"] || ""),
        synonyms: highlightCellText(fields["Synonyms (Extended)"] || fields["Synonyms"] || ""),
      };
    });
    return map;
  }, [filteredIngredients, ocrText]);

  // Highlight OCR text for display above table — merge both banned + ingredients terms
  const highlightedOCRText = useMemo(() => {
    if (!ocrText) return "No text scanned yet.";
    let highlighted = ocrText;

    const processRecord = (fields, color, termFields) => {
      const terms = termFields
        .map((f) => (fields[f] || "").trim())
        .flatMap((t) => (t ? (t.split?.(",") || [t]) : []))
        .map((s) => s.trim())
        .filter(Boolean);

      terms.forEach((term) => {
        const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
        if (regex.test(highlighted)) {
          highlighted = highlighted.replace(
            regex,
            (match) =>
              `<span style="color:${color}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${match}</span>`
          );
        }
      });
    };

    // banned
    (filteredSubstances || []).forEach((rec) => {
      processRecord(rec.fields || {}, banTypeColorsMap[normalizeBanType(rec.fields?.["Ban Type"])], [
        "Substance Name",
        "Synonyms",
      ]);
    });

    // ingredients
    (filteredIngredients || []).forEach((rec) => {
      processRecord(rec.fields || {}, INGREDIENT_HIGHLIGHT, ["Name", "Synonyms (Extended)", "Synonyms"]);
    });

    return highlighted;
  }, [ocrText, filteredSubstances, filteredIngredients]);

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 py-6 font-sans space-y-6">
      {showOCR && !hideTitle && (
        <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-2xl font-bold mb-4">OCR Result</h2>
          <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-md whitespace-pre-wrap break-words">
            <div dangerouslySetInnerHTML={{ __html: highlightedOCRText }} />
          </div>
        </motion.section>
      )}

      {/* Banned Substances Section */}
      <section>
        <h2 className="text-2xl font-bold mb-2">Detected Banned Substances</h2>

        {/* Legend (ban types + ingredients indicator) */}
        <div className="overflow-x-auto mb-4">
          <div className="flex gap-4 items-center min-w-[420px]">
            {banTypeColors.map((type) => (
              <div
                key={type.label}
                className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer"
                onClick={() => handleLegendClick(type.label)}
                role="button"
                aria-pressed={activeBanType === type.label}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 ${activeBanType === type.label ? "border-gray-700" : "border-transparent"}`}
                  style={{ backgroundColor: type.color }}
                />
                <span className="text-gray-800 text-sm font-medium">{type.label}</span>
              </div>
            ))}

            {/* Ingredients legend chip for clarity */}
            <div className="flex items-center gap-2 px-2 py-1 rounded-md">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: INGREDIENT_HIGHLIGHT }} />
              <span className="text-gray-800 text-sm font-medium">Ingredients</span>
            </div>
          </div>
        </div>

        {/* Banned results table */}
        {filteredSubstances.length > 0 ? (
          <ResultsTable records={filteredSubstances} highlightedCells={highlightedSubstanceCells} />
        ) : (
          <p className="italic text-gray-500 mt-2">No banned substances detected.</p>
        )}
      </section>

      {/* Ingredients Section (separate) */}
      <section>
        <h2 className="text-2xl font-bold mt-6 mb-2">Detected Ingredients</h2>

        {filteredIngredients.length > 0 ? (
          <div className="mt-3">
            <div className="overflow-x-auto">
              <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                <thead className="bg-[#334E63] text-white sticky top-0 z-20">
                  <tr>
                    {["Name", "Synonyms", "Benefits", "Weaknesses", "Nutrient Antagonism", "Sources / References"].map(
                      (h) => (
                        <th key={h} className="px-4 py-2 text-left font-medium whitespace-nowrap">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((rec) => {
                    const fields = rec.fields || {};
                    const id = rec.id;
                    const nameHTML = highlightedIngredientCells[id]?.name ?? (fields["Name"] || "");
                    const synHTML = highlightedIngredientCells[id]?.synonyms ?? (fields["Synonyms (Extended)"] || fields["Synonyms"] || "");
                    const benefits = (fields["Benefits"] || "").toString();
                    const weaknesses = (fields["Weaknesses"] || "").toString();
                    const antagonisms = (fields["Nutrient Antagonism"] || fields["Nutrient Antagonisms"] || "").toString();
                    const sources = (fields["Sources / References"] || fields["Source"] || "").toString();

                    // highlight inside these text blobs (matches against OCR) using same purple
                    const highlightBlob = (text) => {
                      if (!ocrText || !text) return escapeHtml(text || "");
                      try {
                        const regex = new RegExp(escapeRegex(String(ocrText).trim()), "gi");
                        // we only want to highlight terms that match ingredient names/synonyms; highlightedIngredientCells already flagged name/synonyms
                        return String(text).replace(regex, (m) => `<span style="color:${INGREDIENT_HIGHLIGHT}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${m}</span>`);
                      } catch {
                        return escapeHtml(text || "");
                      }
                    };

                    return (
                      <motion.tr key={id} className="hover:bg-gray-50 transition" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                          <div dangerouslySetInnerHTML={{ __html: nameHTML }} />
                        </td>
                        <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                          <div dangerouslySetInnerHTML={{ __html: synHTML }} />
                        </td>
                        <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                          <div dangerouslySetInnerHTML={{ __html: highlightBlob(benefits) }} />
                        </td>
                        <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                          <div dangerouslySetInnerHTML={{ __html: highlightBlob(weaknesses) }} />
                        </td>
                        <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                          <div dangerouslySetInnerHTML={{ __html: highlightBlob(antagonisms) }} />
                        </td>
                        <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                          <div dangerouslySetInnerHTML={{ __html: highlightBlob(sources) }} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="italic text-gray-500">No ingredients detected.</p>
        )}
      </section>
    </div>
  );
}

// small helper to escape HTML (same as earlier)
function escapeHtml(unsafe = "") {
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
