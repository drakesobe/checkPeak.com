"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

export default function ModalContent({
  activeTab,
  loadingOCR,
  loadingRecords,
  animDots,
  ocrText,
  matchedRecords,
  error,
  runOCR,
}) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [filter, setFilter] = useState("All"); // 'All' | 'Prohibited' | 'Limited' | 'Other'

  const toggleExpand = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Map banType to severity for sorting
  const severityMap = {
    Prohibited: 0,
    "Limited to Out of Competition": 1,
    Other: 2,
  };

  const counts = {
    Prohibited: matchedRecords.filter((r) => r.banType === "Prohibited").length,
    Limited: matchedRecords.filter(
      (r) => r.banType === "Limited to Out of Competition"
    ).length,
    Other: matchedRecords.filter(
      (r) =>
        !["Prohibited", "Limited to Out of Competition"].includes(r.banType)
    ).length,
    All: matchedRecords.length,
  };

  const filteredRecords = matchedRecords
    .filter((rec) => {
      if (filter === "All") return true;
      if (filter === "Prohibited") return rec.banType === "Prohibited";
      if (filter === "Limited") return rec.banType === "Limited to Out of Competition";
      if (filter === "Other") return !["Prohibited", "Limited to Out of Competition"].includes(rec.banType);
      return true;
    })
    .sort((a, b) => {
      const sevA = severityMap[a.banType] ?? 2;
      const sevB = severityMap[b.banType] ?? 2;
      return sevA - sevB;
    });

  const filterColors = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    Limited: "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const highlightColors = {
    Prohibited: "bg-red-600 text-white",
    "Limited to Out of Competition": "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Highlight all detected substances and their synonyms in OCR text
const highlightSubstances = (text, records) => {
  if (!text) return null;

  let terms = [];

  records.forEach((rec) => {
    terms.push({ term: rec.name, color: highlightColors[rec.banType] || highlightColors.Other, id: rec.id });
    if (rec.synonyms) {
      rec.synonyms.split(",").forEach((syn) => {
        const trimmed = syn.trim();
        if (trimmed) {
          terms.push({ term: trimmed, color: highlightColors[rec.banType] || highlightColors.Other, id: rec.id });
        }
      });
    }
  });

  // Sort by length descending to prevent partial matches
  terms.sort((a, b) => b.term.length - a.term.length);

  let result = [text];

  terms.forEach(({ term, color, id }) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedTerm})`, "gi");

    result = result.flatMap((segment) => {
      if (typeof segment !== "string") return [segment];
      return segment.split(regex).map((part, i) =>
        regex.test(part) ? (
          <span key={id + term + i} className={`px-1 rounded ${color}`}>
            {part}
          </span>
        ) : (
          part
        )
      );
    });
  });

  return result;
};


  // Error + Retry
  if (error) {
    return (
      <div className="text-red-400 text-center py-4">
        <p>{error}</p>
        <button
          className="mt-3 px-4 py-1 bg-gray-700 hover:bg-gray-600 rounded transition"
          onClick={runOCR}
        >
          Retry OCR
        </button>
      </div>
    );
  }

  // Loading state
  if (loadingOCR || loadingRecords) {
    return (
      <div className="text-center text-gray-300 py-8">
        {loadingOCR && <p className="mb-2">Scanning label{animDots}</p>}
        {loadingRecords && <p>Checking substances{animDots}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {activeTab === "detected" && (
          <motion.div
            key="detected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-2"
          >
            {/* Sticky filter buttons with counts */}
            {matchedRecords.length > 0 && (
              <div className="sticky top-0 z-10 bg-gray-800 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {["All", "Prohibited", "Limited", "Other"].map((f) => (
                  <button
                    key={f}
                    className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 transition
                      ${filter === f ? `${filterColors[f]}` : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${filterColors[f]}`}>
                      {counts[f]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {filteredRecords.length > 0 ? (
              filteredRecords.map((rec) => {
                const expanded = expandedIds.includes(rec.id);
                return (
                  <motion.div
                    key={rec.id}
                    layout
                    whileHover={{ scale: 1.02 }}
                    className="bg-gray-700 p-3 rounded-lg text-sm text-white flex flex-col shadow-sm cursor-pointer"
                    onClick={() => toggleExpanded(rec.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{rec.name}</span>
                      <div className="flex items-center gap-2">
                        {rec.banType && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              rec.banType === "Prohibited"
                                ? "bg-red-600"
                                : rec.banType === "Limited to Out of Competition"
                                ? "bg-orange-500"
                                : "bg-blue-600"
                            }`}
                          >
                            {rec.banType}
                          </span>
                        )}
                        {expanded ? (
                          <FaChevronUp className="text-gray-400 text-xs" />
                        ) : (
                          <FaChevronDown className="text-gray-400 text-xs" />
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 text-gray-300 text-xs space-y-1"
                      >
                        {rec.synonyms && (
                          <p>
                            <span className="font-semibold">Synonyms:</span>{" "}
                            {rec.synonyms}
                          </p>
                        )}
                        {rec.bannedBy && (
                          <p>
                            <span className="font-semibold">Banned By:</span>{" "}
                            {rec.bannedBy}
                          </p>
                        )}
                        {rec.dosageLimit && (
                          <p>
                            <span className="font-semibold">Dosage Limit:</span>{" "}
                            {rec.dosageLimit}
                          </p>
                        )}
                        {rec.notes && (
                          <p>
                            <span className="font-semibold">Notes:</span>{" "}
                            {rec.notes}
                          </p>
                        )}
                        {rec.source && (
                          <p>
                            <span className="font-semibold">Source:</span>{" "}
                            {rec.source}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <p className="text-gray-400 text-sm italic text-center">
                No banned or monitored substances detected.
              </p>
            )}
          </motion.div>
        )}

        {activeTab === "all" && (
          <motion.div
            key="all"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-gray-700 p-3 rounded-lg text-gray-200 text-sm whitespace-pre-wrap max-h-[50vh] overflow-auto"
          >
            {highlightSubstances(ocrText, matchedRecords) || "No OCR text detected."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
