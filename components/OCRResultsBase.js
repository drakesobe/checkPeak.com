import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function OCRResultsBase({
  ocrText,
  detectedSubstances = [],
  showOCR = false,
  hideTitle = false,
}) {
  const [activeBanType, setActiveBanType] = useState(null);

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];

  const handleLegendClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  const filteredSubstances = useMemo(() => {
    return activeBanType
      ? detectedSubstances.filter(
          (record) => (record.fields["Ban Type"] || "None") === activeBanType
        )
      : detectedSubstances;
  }, [detectedSubstances, activeBanType]);

  const getBanTypeHighlight = (banType) => {
    const color = banTypeColors.find((b) => b.label === banType)?.color || "#d62828";
    return <span style={{ color, fontWeight: 600 }}>{banType}</span>;
  };

  // Memoize OCR text highlighting
  const highlightedOCRText = useMemo(() => {
    if (!ocrText) return "No text scanned yet.";
    let highlighted = ocrText;

    filteredSubstances.forEach((record) => {
      const fields = record.fields || {};
      const banType = fields["Ban Type"] || "None";
      const textColor = banTypeColors.find((b) => b.label === banType)?.color || "#d62828";

      const names = [
        (fields["Substance Name"] || "").trim(),
        ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
      ];

      names.forEach((name) => {
        if (!name) return;
        const safe = escapeRegex(name);
        const regex = new RegExp(`\\b${safe}\\b`, "gi");
        highlighted = highlighted.replace(regex, (match) => {
          return `<span style="
            color: ${textColor};
            font-weight: 600;
            text-decoration: underline;
            text-decoration-color: ${textColor};
            text-underline-offset: 2px;
          ">${match}</span>`;
        });
      });
    });

    return highlighted;
  }, [ocrText, filteredSubstances]);

  // Precompute highlighted table cells per record
  const highlightedTableCells = useMemo(() => {
    const map = {};
    filteredSubstances.forEach((record) => {
      const fields = record.fields || {};
      const banType = fields["Ban Type"] || "None";
      const textColor = banTypeColors.find((b) => b.label === banType)?.color || "#d62828";

      const highlightText = (text) => {
        if (!ocrText || !text) return text || "";
        let cellText = text;
        const names = [
          (fields["Substance Name"] || "").trim(),
          ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
        ];
        names.forEach((name) => {
          if (!name) return;
          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");
          cellText = cellText.replace(regex, (match) => {
            return `<span style="
              color: ${textColor};
              font-weight: 600;
              text-decoration: underline;
              text-decoration-color: ${textColor};
              text-underline-offset: 2px;
            ">${match}</span>`;
          });
        });
        return cellText;
      };

      map[record.id] = {
        substanceName: highlightText(fields["Substance Name"]?.trim() || ""),
        synonyms: highlightText(fields["Synonyms"]?.trim() || ""),
      };
    });
    return map;
  }, [filteredSubstances, ocrText]);

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

      {!hideTitle && (
        <section>
          <h2 className="text-2xl font-bold mb-2">Detected Banned Substances</h2>

          <div className="overflow-x-auto mb-4">
            <div className="flex gap-4 w-[420px] min-w-max pl-2">
              {banTypeColors.map((type) => (
                <div
                  key={type.label}
                  className={`flex items-center gap-1 cursor-pointer transition-transform hover:scale-110`}
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

          <AnimatePresence>
            {filteredSubstances && filteredSubstances.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto w-full"
              >
                <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                  <thead className="bg-[#46769B] text-white">
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
                        <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubstances.map((record) => {
                      const fields = record.fields || {};
                      const banType = fields["Ban Type"] || "None";

                      return (
                        <motion.tr
                          key={record.id}
                          className="hover:bg-gray-100 transition"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                        >
                          <td
                            className="px-4 py-2"
                            dangerouslySetInnerHTML={{ __html: highlightedTableCells[record.id].substanceName }}
                          />
                          <td
                            className="px-4 py-2"
                            dangerouslySetInnerHTML={{ __html: highlightedTableCells[record.id].synonyms }}
                          />
                          <td className="px-4 py-2">{fields["Banned By"]?.trim() || ""}</td>
                          <td className="px-4 py-2">{getBanTypeHighlight(banType)}</td>
                          <td className="px-4 py-2">{fields["Dosage Limit"]?.trim() || ""}</td>
                          <td className="px-4 py-2">{fields["Notes"]?.trim() || ""}</td>
                          <td className="px-4 py-2 max-w-xs break-words whitespace-normal">{fields["Source / Citation"]?.trim() || ""}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            ) : (
              <p className="italic text-gray-500">No banned substances detected in this label.</p>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
