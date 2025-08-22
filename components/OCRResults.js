import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function OCRResults({ ocrText, matchedSubstances, hideTitle = false }) {
  if (!matchedSubstances) return null;

  const [activeBanType, setActiveBanType] = useState(null);

  const normalizedOCRText = (ocrText || "").replace(/\s+/g, " ").toLowerCase();

  const detectedSubstances = matchedSubstances?.filter((record) => {
    const fields = record.fields || {};
    const names = [
      (fields["Substance Name"] || "").trim(),
      ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
    ];

    if (!ocrText) return true;

    return names.some((name) => {
      if (!name) return false;
      return normalizedOCRText.includes(name.toLowerCase());
    });
  });

  const filteredSubstances = activeBanType
    ? detectedSubstances.filter((record) => (record.fields["Ban Type"] || "None") === activeBanType)
    : detectedSubstances;

  const getHighlightedText = () => {
    if (!ocrText) return "No text scanned yet.";

    let highlighted = ocrText;

    detectedSubstances?.forEach((record) => {
      const fields = record.fields || {};
      const banType = fields["Ban Type"] || "None";
      const colorMap = {
        "Prohibited": "#d62828",
        "Limited to Out of Competition": "#f77f00",
        "Particular Sports": "#003049",
      };
      const textColor = colorMap[banType] || "#d62828";

      const names = [
        (fields["Substance Name"] || "").trim(),
        ...((fields["Synonyms"]?.split(",") || []).map((s) => s.trim())),
      ];

      names.forEach((name) => {
        if (!name) return;
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(\\b${escapedName}\\b)(?![^<]*>)`, "gi");
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
  };

  const getBanTypeHighlight = (banType) => {
    const colorMap = {
      "Prohibited": "#d62828",
      "Limited to Out of Competition": "#f77f00",
      "Particular Sports": "#003049",
    };
    const color = colorMap[banType] || "#d62828";

    return <span style={{ color, fontWeight: 600 }}>{banType}</span>;
  };

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];

  const handleLegendClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 py-6 font-sans space-y-6">
      {/* OCR Scan Section */}
      {ocrText && !hideTitle && (
        <section>
          <h2 className="text-2xl font-bold mb-4">OCR Result</h2>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 bg-white border border-gray-200 rounded-xl shadow-md whitespace-pre-wrap break-words"
          >
            <div dangerouslySetInnerHTML={{ __html: getHighlightedText() }} />
          </motion.div>
        </section>
      )}

      {/* Detected Substances Section */}
      {!hideTitle && (
        <section>
          <h2 className="text-2xl font-bold mb-2">Detected Banned Substances</h2>

          {/* Ban Type Color Legend - Interactive */}
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
                        <th key={h} className="px-4 py-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubstances.map((record) => {
                      const fields = record.fields || {};
                      const banType = fields["Ban Type"] || "None";
                      const isFiltered = activeBanType === banType;

                      return (
                        <motion.tr
                          key={record.id}
                          className={`hover:bg-gray-100 transition ${isFiltered ? "single-pulse-row" : ""}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                        >
                          <td className="px-4 py-2">{fields["Substance Name"]?.trim() || ""}</td>
                          <td className="px-4 py-2">{fields["Synonyms"]?.trim() || ""}</td>
                          <td className="px-4 py-2">{fields["Banned By"]?.trim() || ""}</td>
                          <td className="px-4 py-2">{getBanTypeHighlight(banType)}</td>
                          <td className="px-4 py-2">{fields["Dosage Limit"]?.trim() || ""}</td>
                          <td className="px-4 py-2">{fields["Notes"]?.trim() || ""}</td>
                          <td className="px-4 py-2 max-w-xs break-words whitespace-normal">
                            {fields["Source / Citation"]?.trim() || ""}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            ) : (
              <p className="italic text-gray-500">
                No banned substances detected in this label.
              </p>
            )}
          </AnimatePresence>
        </section>
      )}

      <style jsx>{`
        @keyframes singlePulse {
          0% { background-color: rgba(214,40,40,0.3); }
          50% { background-color: rgba(214,40,40,0.6); }
          100% { background-color: rgba(214,40,40,0.3); }
        }

        .single-pulse-row {
          animation: singlePulse 1s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
