// components/ModalContent.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/**
 * ModalContent
 *
 * Props:
 * - activeTab: "detected" | "all" | ...
 * - loadingOCR, loadingRecords, animDots
 * - ocrText: raw OCR or combined raw text
 * - matchedRecords: array of banned-substance records (Airtable-like or flattened)
 * - matchedIngredients: array of ingredient records (Airtable-like or flattened)
 * - error: error string
 * - runOCR: optional function to trigger OCR/scan (called once per stack open)
 * - stackId: unique id for the currently opened stack (used to rerun OCR per stack)
 *
 * Behavior:
 * - When activeTab === "detected" and runOCR exists, call runOCR once per stack open
 * - Render banned substances (collapsible cards) followed by Ingredients Detected
 * - "All" tab shows OCR text with highlights for both banned and ingredient matches
 */

export default function ModalContent({
  activeTab,
  loadingOCR = false,
  loadingRecords = false,
  animDots = "",
  ocrText = "",
  matchedRecords = [], // banned substances
  matchedIngredients = [], // ingredient DB matches
  error = "",
  runOCR = null,
  stackId = null,
}) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [filter, setFilter] = useState("All"); // 'All' | 'Prohibited' | 'Limited' | 'Other'
  const runOnceRef = useRef(false);
  const prevStackRef = useRef(stackId);

  // Reset expanded state and runOnceRef when a new stack opens
  useEffect(() => {
    if (prevStackRef.current !== stackId) {
      setExpandedIds([]);
      runOnceRef.current = false;
      prevStackRef.current = stackId;
    }
  }, [stackId]);

  // Map banType to severity for sorting
  const severityMap = {
    Prohibited: 0,
    "Limited to Out of Competition": 1,
    Other: 2,
  };

  // Normalizers (accept Airtable record shapes or flattened objects)
  const normalizeBanned = (r) => {
    if (!r) return null;
    if (r.fields) {
      const f = r.fields;
      return {
        id: r.id,
        name: f["Substance Name"] || f["Name"] || f.name || "",
        banType: f["Ban Type"] || f["Ban Type"] || "",
        synonyms: f["Synonyms"] || f["Synonyms (Extended)"] || "",
        bannedBy: f["Banned By"] || "",
        dosageLimit: f["Dosage Limit"] || "",
        notes: f["Notes"] || "",
        source: f["Source / Citation"] || f["Source"] || "",
        benefits: f["Benefits"] || "",
        weaknesses: f["Weaknesses"] || "",
        antagonism: f["Nutrient Antagonism"] || "",
        _raw: r,
      };
    }
    return {
      id: r.id || r.recordId || Math.random().toString(36).slice(2),
      name: r.name || r["Substance Name"] || r.Name || "",
      banType: r.banType || r["Ban Type"] || "",
      synonyms: r.synonyms || r.Synonyms || "",
      bannedBy: r.bannedBy || r["Banned By"] || "",
      dosageLimit: r.dosageLimit || r["Dosage Limit"] || "",
      notes: r.notes || r.Notes || "",
      source: r.source || r["Source / Citation"] || "",
      benefits: r.Benefits || "",
      weaknesses: r.Weaknesses || "",
      antagonism: r["Nutrient Antagonism"] || "",
      _raw: r,
    };
  };

  const normalizeIngredient = (r) => {
    if (!r) return null;
    if (r.fields) {
      const f = r.fields;
      return {
        id: r.id,
        name: f["Name"] || f["Ingredient Name"] || f.name || "",
        synonyms: f["Synonyms (Extended)"] || f["Synonyms"] || "",
        notes: f["Pharmacology Notes"] || f["Notes"] || f["Benefits"] || "",
        benefits: f["Benefits"] || "",
        weaknesses: f["Weaknesses"] || "",
        antagonism: f["Nutrient Antagonism"] || "",
        source: f["Sources / References"] || f["Source"] || f["Source / Citation"] || "",
        _raw: r,
      };
    }
    return {
      id: r.id || r.recordId || Math.random().toString(36).slice(2),
      name: r.name || r.Name || r["Ingredient Name"] || "",
      synonyms: r.synonyms || r.Synonyms || "",
      notes: r.notes || r.Notes || "",
      benefits: r.Benefits || "",
      weaknesses: r.Weaknesses || "",
      antagonism: r["Nutrient Antagonism"] || "",
      source: r.source || r.Source || "",
      _raw: r,
    };
  };

  // Normalize arrays
  const bannedNormalized = (matchedRecords || []).map(normalizeBanned).filter(Boolean);
  const ingredientsNormalized = (matchedIngredients || []).map(normalizeIngredient).filter(Boolean);

  const counts = {
    Prohibited: bannedNormalized.filter((r) => r.banType === "Prohibited").length,
    Limited: bannedNormalized.filter((r) => r.banType === "Limited to Out of Competition").length,
    Other: bannedNormalized.filter((r) => !["Prohibited", "Limited to Out of Competition"].includes(r.banType)).length,
    All: bannedNormalized.length,
    IngredientsTotal: ingredientsNormalized.length,
  };

  // Filtered banned records by filter control
  const filteredRecords = bannedNormalized
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

  // run OCR / scan once when the modal shows detected tab for THIS stack
  useEffect(() => {
    if (activeTab === "detected" && typeof runOCR === "function" && !runOnceRef.current) {
      runOnceRef.current = true;
      try {
        runOCR();
      } catch (e) {
        console.warn("runOCR triggered from modal failed:", e);
      }
    }
    // include stackId so a new stack triggers the effect check again
  }, [activeTab, runOCR, stackId]);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Filter button classes (active/inactive per filter)
  const filterColors = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    Limited: "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  // colors used for highlighting captured text (All tab)
  const highlightColors = {
    Prohibited: "bg-red-600 text-white px-1 rounded",
    "Limited to Out of Competition": "bg-orange-500 text-white px-1 rounded",
    Other: "bg-blue-600 text-white px-1 rounded",
    Ingredient: "bg-purple-600 text-white px-1 rounded",
  };

  // Highlighting helper for "All" tab: wraps matched terms with colored spans
  const highlightText = (text = "", bannedList = [], ingList = []) => {
    if (!text) return null;
    const terms = [];

    bannedList.forEach((rec) => {
      if (rec.name) terms.push({ term: rec.name, color: highlightColors[rec.banType] || highlightColors.Other, key: `b-${rec.id}` });
      if (rec.synonyms) {
        rec.synonyms
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((syn) => terms.push({ term: syn, color: highlightColors[rec.banType] || highlightColors.Other, key: `b-${rec.id}-${syn}` }));
      }
    });

    ingList.forEach((rec) => {
      if (rec.name) terms.push({ term: rec.name, color: highlightColors.Ingredient, key: `i-${rec.id}` });
      if (rec.synonyms) {
        rec.synonyms
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((syn) => terms.push({ term: syn, color: highlightColors.Ingredient, key: `i-${rec.id}-${syn}` }));
      }
    });

    // Sort by length to avoid partial matches swallowing longer terms
    terms.sort((a, b) => b.term.length - a.term.length);

    let segments = [text];

    for (const { term, color, key } of terms) {
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(`(${escaped})`, "gi");

      segments = segments.flatMap((seg, segIdx) => {
        if (typeof seg !== "string") return [seg];
        const pieces = seg.split(rx);
        if (pieces.length === 1) return [seg];
        return pieces.map((p, i) =>
          rx.test(p) ? (
            <span key={`${key}-${segIdx}-${i}`} className={color} style={{ margin: "0 2px", display: "inline-block" }}>
              {p}
            </span>
          ) : (
            p
          )
        );
      });
    }

    return segments;
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
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {activeTab === "detected" && (
          <motion.div
            key={`detected-${stackId || "default"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Sticky filter buttons with counts */}
            <div className="sticky top-0 z-10 bg-gray-800/60 py-2 px-1 rounded">
              <div className="flex gap-2 items-center overflow-x-auto">
                {["All", "Prohibited", "Limited", "Other"].map((f) => {
                  const isActive = filter === f;
                  const activeClass = filterColors[f];
                  const inactiveClass =
                    f === "All"
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : f === "Prohibited"
                      ? "bg-red-700 text-gray-200 hover:bg-red-600"
                      : f === "Limited"
                      ? "bg-orange-600 text-gray-200 hover:bg-orange-500"
                      : "bg-blue-700 text-gray-200 hover:bg-blue-600"; // Other
                  return (
                    <button
                      key={f}
                      className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 transition ${isActive ? activeClass : inactiveClass}`}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10">
                        {counts[f]}
                      </span>
                    </button>
                  );
                })}

                <div className="ml-auto text-sm text-gray-400 px-2">
                  Ingredients detected: <strong className="text-white">{counts.IngredientsTotal}</strong>
                </div>
              </div>
            </div>

            {/* Banned Substances list (collapsible cards) */}
            <div className="space-y-2">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => {
                  const expanded = expandedIds.includes(rec.id);
                  return (
                    <motion.div
                      key={`b-${rec.id}`}
                      layout
                      whileHover={{ scale: 1.01 }}
                      className="bg-gray-700 p-3 rounded-lg text-sm text-white flex flex-col shadow-sm cursor-pointer"
                      onClick={() => toggleExpanded(rec.id)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{rec.name || "Unnamed Substance"}</span>
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
                          </div>
                          {rec.synonyms && <div className="text-xs text-gray-300 mt-1 truncate">Synonyms: {rec.synonyms}</div>}
                        </div>
                        <div className="flex-shrink-0 text-gray-300 pl-2">
                          {expanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                        </div>
                      </div>

                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.16 }}
                          className="mt-2 text-gray-300 text-xs space-y-1"
                        >
                          {rec.synonyms && <p><span className="font-semibold">Synonyms:</span> {rec.synonyms}</p>}
                          {rec.bannedBy && <p><span className="font-semibold">Banned By:</span> {rec.bannedBy}</p>}
                          {rec.dosageLimit && <p><span className="font-semibold">Dosage Limit:</span> {rec.dosageLimit}</p>}
                          {rec.notes && <p><span className="font-semibold">Notes:</span> {rec.notes}</p>}
                          {rec.source && <p><span className="font-semibold">Source:</span> {rec.source}</p>}

                          {/* Enriched ingredient fields if present */}
                          {(rec.benefits || rec.weaknesses || rec.antagonism) && (
                            <div className="mt-2 pt-2 border-t border-white/6 space-y-1">
                              {rec.benefits && <p><span className="font-semibold">Benefits:</span> {rec.benefits}</p>}
                              {rec.weaknesses && <p><span className="font-semibold">Weaknesses:</span> {rec.weaknesses}</p>}
                              {rec.antagonism && <p><span className="font-semibold">Nutrient Antagonism:</span> {rec.antagonism}</p>}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <p className="text-gray-400 text-sm italic text-center">No banned or monitored substances detected for this filter.</p>
              )}
            </div>

            {/* Ingredients Detected Section */}
            <div className="pt-2 border-t border-white/6 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">Ingredients Detected</h3>
                <div className="text-xs text-gray-400">{ingredientsNormalized.length} found</div>
              </div>

              {ingredientsNormalized.length > 0 ? (
                <div className="grid gap-2">
                  {ingredientsNormalized.map((ing) => {
                    const isExpanded = expandedIds.includes(`ing-${ing.id}`);
                    return (
                      <motion.div
                        key={`ing-${ing.id}`}
                        layout
                        whileHover={{ scale: 1.01 }}
                        className="bg-gray-800 p-3 rounded-lg text-sm text-gray-100 flex flex-col cursor-pointer"
                        onClick={() => toggleExpanded(`ing-${ing.id}`)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{ing.name || "Unnamed Ingredient"}</div>
                            {ing.synonyms && <div className="text-xs text-gray-300 truncate mt-1">Synonyms: {ing.synonyms}</div>}
                          </div>
                          <div className="flex-shrink-0 pl-2">
                            {isExpanded ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.14 }}
                            className="mt-2 text-gray-300 text-xs space-y-1"
                          >
                            {ing.notes && <p><span className="font-semibold">Notes:</span> {ing.notes}</p>}
                            {ing.benefits && <p><span className="font-semibold">Benefits:</span> {ing.benefits}</p>}
                            {ing.weaknesses && <p><span className="font-semibold">Weaknesses:</span> {ing.weaknesses}</p>}
                            {ing.antagonism && <p><span className="font-semibold">Nutrient Antagonism:</span> {ing.antagonism}</p>}
                            {ing.source && <p><span className="font-semibold">Source:</span> {ing.source}</p>}
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic">No ingredients matched in the ingredients database.</p>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "all" && (
          <motion.div
            key={`all-${stackId || "default"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-gray-700 p-3 rounded-lg text-gray-200 text-sm whitespace-pre-wrap max-h-[50vh] overflow-auto"
          >
            {highlightText(ocrText || "No OCR text detected.", bannedNormalized, ingredientsNormalized) || "No OCR text detected."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
