// components/ModalContent.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/**
 * ModalContent (mobile-optimized)
 *
 * - Filters: All | Prohibited | Limited | Other
 *   • All = all banned + all ingredients
 *   • Prohibited = banned only with banType === "Prohibited"
 *   • Limited = banned only with banType === "Limited to Out of Competition"
 *   • Other = banned with any other banType + ALL ingredients
 *
 * - Cards show dropdown sections for: Benefits, Weaknesses, Nutrient Antagonism
 * - Mobile polish:
 *   • Horiz. scroll filter bar with min button widths for thumb-friendly taps
 *   • Larger base padding on cards (p-4 on mobile, sm:p-3 on larger)
 *   • line-clamp-2 for long synonym lines (Tailwind plugin recommended)
 *   • scroll-smooth and safe word breaks to avoid overflow
 */

export default function ModalContent({
  activeTab,
  loadingOCR = false,
  loadingRecords = false,
  animDots = "",
  ocrText = "",
  matchedRecords = [],        // already normalized in NutritionModal
  matchedIngredients = [],    // already normalized in NutritionModal
  error = "",
  runOCR = null,
  stackId = null,
}) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [filter, setFilter] = useState("All");
  const runOnceRef = useRef(false);
  const prevStackRef = useRef(stackId);

  useEffect(() => {
    if (prevStackRef.current !== stackId) {
      setExpandedIds([]);
      runOnceRef.current = false;
      prevStackRef.current = stackId;
    }
  }, [stackId]);

  // Trigger OCR once when switching to "detected"
  useEffect(() => {
    if (activeTab === "detected" && typeof runOCR === "function" && !runOnceRef.current) {
      runOnceRef.current = true;
      try {
        runOCR();
      } catch (e) {
        console.warn("runOCR triggered from modal failed:", e);
      }
    }
  }, [activeTab, runOCR, stackId]);

  // --- Colors (as requested) ---
  const filterColorsActive = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    "Limited to Out of Competition": "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const filterColorsInactive = {
    All: "bg-gray-700 text-gray-300 hover:bg-gray-600",
    Prohibited: "bg-red-700 text-gray-200 hover:bg-red-600",
    "Limited to Out of Competition": "bg-orange-600 text-gray-200 hover:bg-orange-500",
    Other: "bg-blue-700 text-gray-200 hover:bg-blue-600",
  };

  const pillColorsForBan = (banType) => {
    if (banType === "Prohibited") return "bg-red-600";
    if (banType === "Limited to Out of Competition") return "bg-orange-500";
    return "bg-blue-600";
  };

  const highlightColors = {
    Prohibited: "bg-red-600 text-white px-1 rounded",
    "Limited to Out of Competition": "bg-orange-500 text-white px-1 rounded",
    Other: "bg-blue-600 text-white px-1 rounded",
    Ingredient: "bg-gray-500 text-white px-1 rounded",
  };

  // --- Build count model per UX spec ---
  const bannedProhibited = matchedRecords.filter((r) => r.banType === "Prohibited");
  const bannedLimited = matchedRecords.filter((r) => r.banType === "Limited to Out of Competition");
  const bannedOther = matchedRecords.filter(
    (r) => r.banType !== "Prohibited" && r.banType !== "Limited to Out of Competition"
  );

  const counts = {
    All: matchedRecords.length + matchedIngredients.length,
    Prohibited: bannedProhibited.length,
    Limited: bannedLimited.length,
    Other: bannedOther.length + matchedIngredients.length, // Other includes non-prohibited/limited + ALL ingredients
  };

  // --- Filtered lists for current view ---
  let visibleBanned = [];
  let visibleIngredients = [];

  if (filter === "All") {
    visibleBanned = matchedRecords;
    visibleIngredients = matchedIngredients;
  } else if (filter === "Prohibited") {
    visibleBanned = bannedProhibited;
    visibleIngredients = [];
  } else if (filter === "Limited") {
    visibleBanned = bannedLimited;
    visibleIngredients = [];
  } else {
    // "Other"
    visibleBanned = bannedOther;
    visibleIngredients = matchedIngredients;
  }

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Highlight OCR text using current normalized lists
  const highlightText = (text = "", bannedList = [], ingList = []) => {
    if (!text) return null;
    const terms = [];

    const pushTerms = (rec, color, prefix) => {
      if (rec.name) terms.push({ term: rec.name, color, key: `${prefix}-${rec.id}` });
      if (rec.synonyms) {
        String(rec.synonyms)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((syn) => terms.push({ term: syn, color, key: `${prefix}-${rec.id}-${syn}` }));
      }
    };

    bannedList.forEach((r) =>
      pushTerms(r, highlightColors[r.banType] || highlightColors.Other, "b")
    );
    ingList.forEach((r) => pushTerms(r, highlightColors.Ingredient, "i"));

    terms.sort((a, b) => b.term.length - a.term.length);

    let segments = [text];
    for (const { term, color, key } of terms) {
      const rx = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      segments = segments.flatMap((seg, idx) =>
        typeof seg === "string"
          ? seg.split(rx).map((p, i) =>
              rx.test(p) ? (
                <span
                  key={`${key}-${idx}-${i}`}
                  className={color}
                  style={{ margin: "0 2px", display: "inline-block" }}
                >
                  {p}
                </span>
              ) : (
                p
              )
            )
          : seg
      );
    }
    return segments;
  };

  // --- Error / Loading states ---
  if (error)
    return (
      <div className="text-red-400 text-center py-4">
        <p className="px-4 break-words">{error}</p>
        <button
          className="mt-3 px-4 py-2 rounded transition bg-gray-700 hover:bg-gray-600"
          onClick={runOCR}
        >
          Retry OCR
        </button>
      </div>
    );

  if (loadingOCR || loadingRecords)
    return (
      <div className="text-center text-gray-300 py-8">
        {loadingOCR && <p className="mb-2 px-4">Scanning label{animDots}</p>}
        {loadingRecords && <p className="px-4">Checking substances{animDots}</p>}
      </div>
    );

  return (
    <div className="space-y-4 scroll-smooth break-words">
      <AnimatePresence mode="wait">
        {/* DETECTED TAB */}
        {activeTab === "detected" && (
          <motion.div
            key={`detected-${stackId || "default"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Filter Header (mobile-friendly) */}
            <div className="sticky top-0 z-10 bg-gray-800/60 py-2 px-1 rounded">
              <div className="flex gap-2 items-center overflow-x-auto no-scrollbar">
                {[
                  { key: "All", label: "All" },
                  { key: "Prohibited", label: "Prohibited" },
                  { key: "Limited to Out of Competition", label: "Limited" },
                  { key: "Other", label: "Other" },
                ].map(({ key, label }) => {
                  const isActive = filter === label || filter === key;
                  const activeClass = filterColorsActive[key] || filterColorsActive.Other;
                  const inactiveClass =
                    filterColorsInactive[key] || filterColorsInactive.Other;
                  return (
                    <button
                      key={key}
                      className={`min-w-[96px] px-3 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition ${
                        isActive ? activeClass : inactiveClass
                      }`}
                      onClick={() => setFilter(label)}
                    >
                      <span className="truncate">{label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10">
                        {counts[label] ?? counts[key]}
                      </span>
                    </button>
                  );
                })}

                <div className="ml-auto text-xs sm:text-sm text-gray-400 px-2 shrink-0">
                  Ingredients detected:{" "}
                  <strong className="text-white">{matchedIngredients.length}</strong>
                </div>
              </div>
            </div>


            {/* BANNED SUBSTANCES */}
            <div className="space-y-2 mt-2 sm:mt-0">
              {visibleBanned.length > 0 ? (
                visibleBanned.map((rec) => {
                  const expanded = expandedIds.includes(rec.id);
                  return (
                    <motion.div
                      key={`b-${rec.id}`}
                      layout
                      whileHover={{ scale: 1.01 }}
                      className="bg-gray-700 hover:bg-gray-600 transition-colors p-4 sm:p-3 rounded-lg text-sm text-white flex flex-col shadow-sm cursor-pointer"
                      onClick={() => toggleExpanded(rec.id)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {rec.name || "Unnamed Substance"}
                            </span>
                            {rec.banType && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${pillColorsForBan(
                                  rec.banType
                                )}`}
                              >
                                {rec.banType}
                              </span>
                            )}
                          </div>
                          {rec.synonyms && (
                            <div className="text-xs text-gray-300 mt-1 line-clamp-2">
                              <span className="opacity-80">Synonyms:</span> {rec.synonyms}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-gray-300 pl-2">
                          {expanded ? (
                            <FaChevronUp className="text-gray-400" />
                          ) : (
                            <FaChevronDown className="text-gray-400" />
                          )}
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            key={`details-${rec.id}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="mt-3 text-gray-300 text-xs space-y-1 overflow-hidden"
                          >
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
                                <span className="font-semibold">Notes:</span> {rec.notes}
                              </p>
                            )}
                            {rec.source && (
                              <p>
                                <span className="font-semibold">Source:</span> {rec.source}
                              </p>
                            )}

                            {(rec.benefits || rec.weaknesses || rec.antagonism) && (
                              <div className="mt-3 border-t border-white/10 divide-y divide-white/10 rounded-lg overflow-hidden">
                                {rec.benefits && (
                                  <div className="bg-gray-800/40 px-3 py-2">
                                    <h4 className="text-gray-100 font-semibold text-[11px] uppercase tracking-wide mb-1">
                                      Benefits
                                    </h4>
                                    <p className="text-gray-300 text-xs leading-relaxed">
                                      {rec.benefits}
                                    </p>
                                  </div>
                                )}
                                {rec.weaknesses && (
                                  <div className="bg-gray-800/40 px-3 py-2">
                                    <h4 className="text-gray-100 font-semibold text-[11px] uppercase tracking-wide mb-1">
                                      Weaknesses
                                    </h4>
                                    <p className="text-gray-300 text-xs leading-relaxed">
                                      {rec.weaknesses}
                                    </p>
                                  </div>
                                )}
                                {rec.antagonism && (
                                  <div className="bg-gray-800/40 px-3 py-2">
                                    <h4 className="text-gray-100 font-semibold text-[11px] uppercase tracking-wide mb-1">
                                      Nutrient Antagonism
                                    </h4>
                                    <p className="text-gray-300 text-xs leading-relaxed">
                                      {rec.antagonism}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              ) : (
                <p className="text-gray-400 text-sm italic text-center px-3">
                  No banned or monitored substances detected for this filter.
                </p>
              )}
            </div>

            {/* INGREDIENTS */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">Ingredients Detected</h3>
                <div className="text-xs text-gray-400">{visibleIngredients.length} shown</div>
              </div>

              {visibleIngredients.length > 0 ? (
                <div className="grid gap-2">
                  {visibleIngredients.map((ing) => {
                    const isExpanded = expandedIds.includes(`ing-${ing.id}`);
                    return (
                      <motion.div
                        key={`ing-${ing.id}`}
                        layout
                        whileHover={{ scale: 1.01 }}
                        className="bg-gray-800 hover:bg-gray-700 transition-colors p-4 sm:p-3 rounded-lg text-sm text-gray-100 flex flex-col cursor-pointer"
                        onClick={() => toggleExpanded(`ing-${ing.id}`)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {ing.name || "Unnamed Ingredient"}
                            </div>
                            {ing.synonyms && (
                              <div className="text-xs text-gray-300 line-clamp-2 mt-1">
                                <span className="opacity-80">Synonyms:</span> {ing.synonyms}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0 pl-2">
                            {isExpanded ? (
                              <FaChevronUp className="text-gray-400" />
                            ) : (
                              <FaChevronDown className="text-gray-400" />
                            )}
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              key={`ing-details-${ing.id}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="mt-3 text-gray-300 text-xs space-y-1 overflow-hidden"
                            >
                              {(ing.benefits || ing.weaknesses || ing.antagonism) && (
                                <div className="border-t border-white/10 divide-y divide-white/10 rounded-lg overflow-hidden">
                                  {ing.benefits && (
                                    <div className="bg-gray-800/40 px-3 py-2">
                                      <h4 className="text-gray-100 font-semibold text-[11px] uppercase tracking-wide mb-1">
                                        Benefits
                                      </h4>
                                      <p className="text-gray-300 text-xs leading-relaxed">
                                        {ing.benefits}
                                      </p>
                                    </div>
                                  )}
                                  {ing.weaknesses && (
                                    <div className="bg-gray-800/40 px-3 py-2">
                                      <h4 className="text-gray-100 font-semibold text-[11px] uppercase tracking-wide mb-1">
                                        Weaknesses
                                      </h4>
                                      <p className="text-gray-300 text-xs leading-relaxed">
                                        {ing.weaknesses}
                                      </p>
                                    </div>
                                  )}
                                  {ing.antagonism && (
                                    <div className="bg-gray-800/40 px-3 py-2">
                                      <h4 className="text-gray-100 font-semibold text-[11px] uppercase tracking-wide mb-1">
                                        Nutrient Antagonism
                                      </h4>
                                      <p className="text-gray-300 text-xs leading-relaxed">
                                        {ing.antagonism}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {ing.source && (
                                <p className="pt-2 text-gray-400 text-xs">
                                  <span className="font-semibold text-gray-300">Source:</span>{" "}
                                  {ing.source}
                                </p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic px-3">
                  {filter === "Prohibited" || filter === "Limited"
                    ? "Ingredients are hidden when a banned-only filter is active."
                    : "No ingredients matched in the ingredients database."}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ALL TAB (OCR with highlights) */}
        {activeTab === "all" && (
          <motion.div
            key={`all-${stackId || "default"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-gray-700 p-3 rounded-lg text-gray-200 text-sm whitespace-pre-wrap break-words max-h-[50vh] overflow-auto"
          >
            {highlightText(
              ocrText || "No OCR text detected.",
              matchedRecords,
              matchedIngredients
            ) || "No OCR text detected."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
