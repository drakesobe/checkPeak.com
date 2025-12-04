// components/ModalContent.jsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/**
 * ModalContent (SmartStack)
 *
 * - Tabs:
 *   • "detected"  → Banned + ingredient cards (3-box layout)
 *   • "all"       → Raw OCR text with inline highlights (dark themed)
 *
 * - Filters inside "detected":
 *   • All = all banned + all ingredients
 *   • Prohibited = banned only with Ban Type "Prohibited"
 *   • Limited = banned only with Ban Type "Limited to Out of Competition"
 *   • Other = banned with any other Ban Type + ALL ingredients
 *
 * - Cards:
 *   • Headline + synonyms
 *   • Inside (when expanded):
 *       What it does
 *       Things to watch for
 *       Interactions with other nutrients
 *       Where this information comes from (if present)
 *       OCR snippet: "How it showed up on this label"
 *
 * - Styling:
 *   • Dark SmartStack palette (bg-gray-800/700, white text)
 *   • Brand ban colors: red-600 / orange-500 / blue-600
 */

// Simple helpers
const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/** Resolve ban type from normalized record + _raw */
const getBanType = (rec) => {
  if (!rec) return null;
  if (rec.banType) return rec.banType;
  const f = rec._raw || {};
  return f["Ban Type"] || f["banType"] || null;
};

const normalizeBanLabel = (val) => {
  if (!val) return null;
  const s = String(val).trim().toLowerCase();
  if (s === "prohibited") return "Prohibited";
  if (
    s === "limited to out of competition" ||
    s === "limited out of competition"
  )
    return "Limited to Out of Competition";
  if (s === "particular sports") return "Particular Sports";
  return val;
};

const getBannedBy = (rec) => {
  const f = rec?._raw || {};
  return rec?.bannedBy || f["Banned By"] || null;
};

const getDosageLimit = (rec) => {
  const f = rec?._raw || {};
  return rec?.dosageLimit || f["Dosage Limit"] || null;
};

const getSourceField = (rec) => {
  const f = rec?._raw || {};
  return (
    rec?.source ||
    f["Source"] ||
    f["Sources / References"] ||
    f["Source / Citation"] ||
    ""
  );
};

// ---------- MAIN COMPONENT ----------

export default function ModalContent({
  activeTab,
  loadingOCR = false,
  loadingRecords = false,
  animDots = "",
  ocrText = "",
  matchedRecords = [],       // normalized in NutritionModal, but we also read rec._raw
  matchedIngredients = [],   // normalized in NutritionModal, but we also read rec._raw
  error = "",
  runOCR = null,
  stackId = null,
}) {
  const [expandedIds, setExpandedIds] = useState([]);
  const [filter, setFilter] = useState("All");
  const runOnceRef = useRef(false);
  const prevStackRef = useRef(stackId);

  // Reset when stack changes
  useEffect(() => {
    if (prevStackRef.current !== stackId) {
      setExpandedIds([]);
      runOnceRef.current = false;
      prevStackRef.current = stackId;
    }
  }, [stackId]);

  // Trigger OCR once when switching to "detected"
  useEffect(() => {
    if (
      activeTab === "detected" &&
      typeof runOCR === "function" &&
      !runOnceRef.current
    ) {
      runOnceRef.current = true;
      try {
        runOCR();
      } catch (e) {
        console.warn("runOCR triggered from modal failed:", e);
      }
    }
  }, [activeTab, runOCR, stackId]);

  // ----- Brand color system -----

  // These match your original SmartStack palette
  const filterColorsActive = {
    All: "bg-gray-600 text-white",
    Prohibited: "bg-red-600 text-white",
    Limited: "bg-orange-500 text-white",
    Other: "bg-blue-600 text-white",
  };

  const filterColorsInactive = {
    All: "bg-gray-700 text-gray-300 hover:bg-gray-600",
    Prohibited: "bg-red-700 text-gray-200 hover:bg-red-600",
    Limited: "bg-orange-600 text-gray-200 hover:bg-orange-500",
    Other: "bg-blue-700 text-gray-200 hover:bg-blue-600",
  };

  const pillColorsForBan = (banTypeNormalized) => {
    if (banTypeNormalized === "Prohibited") return "bg-red-600";
    if (banTypeNormalized === "Limited to Out of Competition") return "bg-orange-500";
    if (banTypeNormalized === "Particular Sports") return "bg-blue-600";
    return "bg-gray-500";
  };

  const highlightColors = {
    Prohibited: "bg-red-600 text-white px-1 rounded",
    "Limited to Out of Competition": "bg-orange-500 text-white px-1 rounded",
    Other: "bg-blue-600 text-white px-1 rounded",
    Ingredient: "bg-gray-500 text-white px-1 rounded",
  };

  // ----- Derive typed lists for filter logic -----

  const bannedRecordsNormalized = matchedRecords.map((rec) => {
    const banTypeRaw = getBanType(rec);
    const banType = normalizeBanLabel(banTypeRaw);
    return { ...rec, banType };
  });

  const bannedProhibited = bannedRecordsNormalized.filter(
    (r) => r.banType === "Prohibited"
  );
  const bannedLimited = bannedRecordsNormalized.filter(
    (r) => r.banType === "Limited to Out of Competition"
  );
  const bannedOther = bannedRecordsNormalized.filter(
    (r) =>
      r.banType !== "Prohibited" &&
      r.banType !== "Limited to Out of Competition"
  );

  const counts = {
    All: bannedRecordsNormalized.length + matchedIngredients.length,
    Prohibited: bannedProhibited.length,
    Limited: bannedLimited.length,
    Other: bannedOther.length + matchedIngredients.length,
  };

  // Visible lists based on filter
  let visibleBanned = [];
  let visibleIngredients = [];

  if (filter === "All") {
    visibleBanned = bannedRecordsNormalized;
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
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // ----- OCR highlighting helpers -----

  // React-node based highlighter for the ALL tab
  const highlightText = (text = "", bannedList = [], ingList = []) => {
    if (!text) return null;

    const terms = [];

    const pushTerms = (rec, colorClass, prefix) => {
      if (!rec) return;
      if (rec.name) {
        terms.push({
          term: rec.name,
          colorClass,
          key: `${prefix}-${rec.id}-name`,
        });
      }
      const syn = rec.synonyms || "";
      String(syn)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s, idx) =>
          terms.push({
            term: s,
            colorClass,
            key: `${prefix}-${rec.id}-syn-${idx}`,
          })
        );
    };

    bannedList.forEach((r) => {
      const banType = r.banType || "Other";
      const colorClass = highlightColors[banType] || highlightColors.Other;
      pushTerms(r, colorClass, "b");
    });

    ingList.forEach((r) =>
      pushTerms(r, highlightColors.Ingredient, "i")
    );

    // Sort longest first
    terms.sort((a, b) => b.term.length - a.term.length);

    let segments = [text];

    for (const { term, colorClass, key } of terms) {
      const safeTerm = escapeRegex(term);
      if (!safeTerm) continue;

      const rx = new RegExp(`(${safeTerm})`, "gi");
      segments = segments.flatMap((seg, segIndex) => {
        if (typeof seg !== "string") return seg;

        const pieces = seg.split(rx);
        return pieces.map((piece, pieceIndex) => {
          if (piece.match(rx)) {
            return (
              <span
                key={`${key}-${segIndex}-${pieceIndex}`}
                className={colorClass}
                style={{ margin: "0 2px", display: "inline-block" }}
              >
                {piece}
              </span>
            );
          }
          return piece;
        });
      });
    }

    return segments;
  };

  // HTML-string highlighter for card bodies
  const highlightBlobWithOCR = (text, terms, color = "#93c5fd") => {
    if (!text) return "";
    const base = escapeHtml(text);
    const normalizedOCR = String(ocrText || "").toLowerCase();
    if (!ocrText || !terms || !terms.length) return base;

    let html = base;

    terms.forEach((termRaw) => {
      const term = (termRaw || "").trim();
      if (!term) return;
      const key = term.toLowerCase();
      if (!normalizedOCR.includes(key)) return;

      try {
        const rx = new RegExp(escapeRegex(term), "gi");
        html = html.replace(
          rx,
          (m) =>
            `<span style="color:${color};font-weight:600;text-decoration:underline;text-underline-offset:2px;">${escapeHtml(
              m
            )}</span>`
        );
      } catch {
        // ignore malformed
      }
    });

    return html;
  };

  // ----- Error / Loading states -----

  if (error)
    return (
      <div className="text-red-400 text-center py-4">
        <p className="px-4 break-words">{error}</p>
        <button
          className="mt-3 px-4 py-2 rounded transition bg-gray-700 hover:bg-gray-600 text-sm font-medium"
          onClick={runOCR || (() => {})}
        >
          Retry OCR
        </button>
      </div>
    );

  if (loadingOCR || loadingRecords)
    return (
      <div className="text-center text-gray-300 py-8 text-sm">
        {loadingOCR && <p className="mb-1 px-4">Scanning label{animDots}</p>}
        {loadingRecords && (
          <p className="px-4">Checking substances against SmartStack{animDots}</p>
        )}
      </div>
    );

  // ----- Card components (DETECTED TAB) -----

  const BannedCards = ({ records }) => {
    if (!records || !records.length) {
      return (
        <p className="text-gray-400 text-sm italic text-center px-3 mt-2">
          No banned or monitored substances detected for this filter.
        </p>
      );
    }

    return (
      <div className="space-y-2 mt-3">
        {records.map((rec) => {
          const expanded = expandedIds.includes(rec.id);
          const banTypeNormalized = rec.banType || "Other";
          const pillColor = pillColorsForBan(banTypeNormalized);
          const bannedBy = getBannedBy(rec);
          const dosageLimit = getDosageLimit(rec);

          const name = rec.name || "Unnamed substance";
          const synonyms = rec.synonyms || "";

          const allTerms = [
            name,
            ...String(synonyms)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ];

          const raw = rec._raw || {};
          const benefits = (rec.benefits || raw["Benefits"] || "").toString();
          const weaknesses = (rec.weaknesses || raw["Weaknesses"] || "").toString();
          const antagonism =
            (rec.antagonism ||
              raw["Nutrient Antagonism"] ||
              raw["Nutrient Antagonisms"] ||
              "") + "";

          const whatItDoesText = benefits || rec.notes || raw["Notes"] || "";
          const whatItDoesHTML = highlightBlobWithOCR(
            whatItDoesText,
            allTerms,
            "#bfdbfe"
          );
          const weaknessesHTML = highlightBlobWithOCR(
            weaknesses,
            allTerms,
            "#fecaca"
          );
          const antagonismHTML = highlightBlobWithOCR(
            antagonism,
            allTerms,
            "#facc15"
          );

          const sourceField = getSourceField(rec);

          return (
            <motion.div
              key={`b-${rec.id}`}
              layout
              whileHover={{ scale: 1.01 }}
              className="bg-gray-700/90 hover:bg-gray-700 transition-colors rounded-lg text-sm text-white shadow-sm cursor-pointer border border-gray-600/70"
              onClick={() => toggleExpanded(rec.id)}
            >
              {/* Header */}
              <div className="flex justify-between items-start gap-3 px-3 py-3 sm:px-4 sm:py-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${pillColor}`}
                    >
                      {banTypeNormalized}
                    </span>
                    {bannedBy && (
                      <span className="text-[11px] sm:text-xs text-gray-300">
                        Banned by: {bannedBy}
                      </span>
                    )}
                    {dosageLimit && (
                      <span className="text-[11px] sm:text-xs text-gray-300">
                        Dosage limit: {dosageLimit}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                    {name}
                  </h3>
                  {synonyms && (
                    <p className="text-[11px] text-gray-300 line-clamp-2">
                      <span className="opacity-80">Also labeled as: </span>
                      {synonyms}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 pl-2 pt-1 text-gray-300">
                  {expanded ? (
                    <FaChevronUp className="text-gray-400" />
                  ) : (
                    <FaChevronDown className="text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded body */}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key={`b-details-${rec.id}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 overflow-hidden text-[11px] sm:text-xs text-gray-100 space-y-3"
                  >
                    {(whatItDoesText || weaknesses || antagonism) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        {whatItDoesText && (
                          <div className="bg-gray-800 rounded-md border border-gray-700 px-3 py-2">
                            <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                              What it does
                            </p>
                            <p
                              className="leading-relaxed whitespace-pre-line text-gray-100 text-[11px]"
                              dangerouslySetInnerHTML={{
                                __html: whatItDoesHTML,
                              }}
                            />
                          </div>
                        )}
                        {weaknesses && (
                          <div className="bg-gray-800 rounded-md border border-gray-700 px-3 py-2">
                            <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                              Things to watch for
                            </p>
                            <p
                              className="leading-relaxed whitespace-pre-line text-gray-100 text-[11px]"
                              dangerouslySetInnerHTML={{
                                __html: weaknessesHTML,
                              }}
                            />
                          </div>
                        )}
                        {antagonism && (
                          <div className="bg-gray-800 rounded-md border border-gray-700 px-3 py-2">
                            <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                              Interactions with other nutrients
                            </p>
                            <p
                              className="leading-relaxed whitespace-pre-line text-gray-100 text-[11px]"
                              dangerouslySetInnerHTML={{
                                __html: antagonismHTML,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {sourceField && (
                      <div className="bg-gray-800 rounded-md border border-gray-700 px-3 py-2">
                        <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                          Where this information comes from
                        </p>
                        <p className="leading-relaxed break-words text-gray-200 text-[11px]">
                          {sourceField}
                        </p>
                      </div>
                    )}

                    {ocrText && (
                      <div className="rounded-md bg-gray-900/70 border border-gray-700 px-3 py-2">
                        <p className="text-[10px] font-medium text-gray-300 mb-1">
                          How it showed up on this label
                        </p>
                        <p className="text-[10px] leading-snug text-gray-200 line-clamp-3">
                          {ocrText}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const IngredientCards = ({ records }) => {
    if (!records || !records.length) {
      return (
        <p className="text-gray-400 text-sm italic px-3 mt-2">
          {filter === "Prohibited" || filter === "Limited"
            ? "Ingredients are hidden while a banned-only filter is active."
            : "No ingredients matched in the ingredients database."}
        </p>
      );
    }

    return (
      <div className="space-y-2 mt-3">
        {records.map((ing) => {
          const id = `ing-${ing.id}`;
          const isExpanded = expandedIds.includes(id);

          const name =
            ing.name ||
            (ing._raw && (ing._raw["Ingredient Name"] || ing._raw["Substance Name"])) ||
            "Unnamed ingredient";

          const synonyms =
            ing.synonyms ||
            (ing._raw && (ing._raw["Synonyms (Extended)"] || ing._raw["Synonyms"])) ||
            "";

          const raw = ing._raw || {};
          const benefits = (ing.benefits || raw["Benefits"] || "").toString();
          const weaknesses = (ing.weaknesses || raw["Weaknesses"] || "").toString();
          const antagonism =
            (ing.antagonism ||
              raw["Nutrient Antagonism"] ||
              raw["Nutrient Antagonisms"] ||
              "") + "";
          const sources =
            (ing.source ||
              raw["Sources / References"] ||
              raw["Source"] ||
              raw["Source / Citation"] ||
              "") + "";

          const terms = [
            name,
            ...String(synonyms)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          ];

          const benefitsHTML = highlightBlobWithOCR(
            benefits,
            terms,
            "#a5b4fc"
          );
          const weaknessesHTML = highlightBlobWithOCR(
            weaknesses,
            terms,
            "#fecaca"
          );
          const antagonismHTML = highlightBlobWithOCR(
            antagonism,
            terms,
            "#facc15"
          );
          const sourcesHTML = highlightBlobWithOCR(
            sources,
            terms,
            "#93c5fd"
          );

          return (
            <motion.div
              key={id}
              layout
              whileHover={{ scale: 1.01 }}
              className="bg-gray-800 hover:bg-gray-700 transition-colors rounded-lg text-sm text-gray-100 shadow-sm cursor-pointer border border-gray-600/70"
              onClick={() => toggleExpanded(id)}
            >
              <div className="flex justify-between items-center gap-3 px-3 py-3 sm:px-4 sm:py-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm sm:text-base truncate text-white">
                    {name}
                  </div>
                  {synonyms && (
                    <div className="text-[11px] text-gray-300 line-clamp-2 mt-1">
                      <span className="opacity-80">Also listed as: </span>
                      {synonyms}
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
                    key={`ing-details-${id}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 overflow-hidden text-[11px] sm:text-xs text-gray-100 space-y-3"
                  >
                    {(benefits || weaknesses || antagonism) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        {benefits && (
                          <div className="bg-gray-900 rounded-md border border-gray-700 px-3 py-2">
                            <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                              What it does
                            </p>
                            <p
                              className="leading-relaxed whitespace-pre-line text-gray-100 text-[11px]"
                              dangerouslySetInnerHTML={{
                                __html: benefitsHTML,
                              }}
                            />
                          </div>
                        )}
                        {weaknesses && (
                          <div className="bg-gray-900 rounded-md border border-gray-700 px-3 py-2">
                            <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                              Things to watch for
                            </p>
                            <p
                              className="leading-relaxed whitespace-pre-line text-gray-100 text-[11px]"
                              dangerouslySetInnerHTML={{
                                __html: weaknessesHTML,
                              }}
                            />
                          </div>
                        )}
                        {antagonism && (
                          <div className="bg-gray-900 rounded-md border border-gray-700 px-3 py-2">
                            <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                              Interactions with other nutrients
                            </p>
                            <p
                              className="leading-relaxed whitespace-pre-line text-gray-100 text-[11px]"
                              dangerouslySetInnerHTML={{
                                __html: antagonismHTML,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {sources && (
                      <div className="bg-gray-900 rounded-md border border-gray-700 px-3 py-2">
                        <p className="font-semibold text-gray-100 mb-1 text-[11px]">
                          Where this information comes from
                        </p>
                        <p
                          className="leading-relaxed break-words text-gray-200 text-[11px]"
                          dangerouslySetInnerHTML={{
                            __html: sourcesHTML,
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    );
  };

  // ---------- RENDER ----------

  return (
    <div className="space-y-4 scroll-smooth break-words text-gray-100">
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
            {/* Filter bar */}
            <div className="sticky top-0 z-10 bg-gray-800/95 py-2 px-1 rounded-md">
              <div className="flex gap-2 items-center overflow-x-auto no-scrollbar">
                {[
                  { key: "All", label: "All" },
                  { key: "Prohibited", label: "Prohibited" },
                  { key: "Limited", label: "Limited" },
                  { key: "Other", label: "Other" },
                ].map(({ key, label }) => {
                  const isActive = filter === key;
                  const activeClass = filterColorsActive[key];
                  const inactiveClass = filterColorsInactive[key];

                  return (
                    <button
                      key={key}
                      className={`min-w-[96px] px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition border ${
                        isActive
                          ? `${activeClass} border-gray-100/60`
                          : `${inactiveClass} border-gray-600`
                      }`}
                      onClick={() => setFilter(key)}
                    >
                      <span className="truncate">{label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/10">
                        {counts[key] ?? 0}
                      </span>
                    </button>
                  );
                })}

                <div className="ml-auto text-[10px] sm:text-xs text-gray-300 px-2 shrink-0">
                  Ingredients detected:{" "}
                  <strong className="text-white">
                    {matchedIngredients.length}
                  </strong>
                </div>
              </div>
            </div>

            {/* BANNED CARDS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-gray-100">
                  Banned / monitored substances
                </h3>
                <span className="text-[11px] text-gray-400">
                  {visibleBanned.length} shown
                </span>
              </div>
              <BannedCards records={visibleBanned} />
            </div>

            {/* INGREDIENT CARDS */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-gray-100">
                  Ingredients detected
                </h3>
                <span className="text-[11px] text-gray-400">
                  {visibleIngredients.length} shown
                </span>
              </div>
              <IngredientCards records={visibleIngredients} />
            </div>
          </motion.div>
        )}

        {/* ALL TAB → RAW OCR WITH HIGHLIGHTS */}
        {activeTab === "all" && (
          <motion.div
            key={`all-${stackId || "default"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-gray-800 border border-gray-700 p-3 sm:p-4 rounded-lg text-gray-100 text-sm whitespace-pre-wrap break-words max-h-[50vh] overflow-auto"
          >
            {highlightText(
              ocrText || "No OCR text detected.",
              bannedRecordsNormalized,
              matchedIngredients
            ) || "No OCR text detected."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
