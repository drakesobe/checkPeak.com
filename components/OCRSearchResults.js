// components/OCRSearchResults.js
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import AnimatedEllipsis from "./AnimatedEllipsis";

/**
 * OCRSearchResults (card + accordion view)
 *
 * Data model (normalized per record):
 *  - name
 *  - synonyms
 *  - bannedBy
 *  - banType
 *  - dosageLimit
 *  - notes
 *  - benefits
 *  - weaknesses
 *  - antagonisms  (Nutrient Antagonism / Nutrient Antagonisms)
 *  - source       (Source / Citation, Sources / References)
 *
 * UI:
 *  - Banned section:
 *      - SmartStack-style cards with left color bar and accordion body
 *      - Inside body: 3 neutral-gray panels
 *          • What it does          (benefits || notes)
 *          • Things to watch for   (weaknesses)
 *          • Interactions with other nutrients (antagonisms)
 *      - Sources block at bottom
 *  - Ingredients section:
 *      - SmartStack-style cards
 *      - Inside body: same 3 neutral-gray panels + sources
 *  - Sticky legend:
 *      - Filter banned by ban type
 *      - Shows counts by ban type, clear filters
 */

// --------- small safety helpers ----------
const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// --------- component ----------
export default function OCRSearchResults({
  searchTerm = "",
  matchedSubstances = [],
}) {
  // Section + filter state
  const [activeBanType, setActiveBanType] = useState(null);
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Row accordion state
  const [expandedBannedRows, setExpandedBannedRows] = useState({});
  const [expandedIngredientRows, setExpandedIngredientRows] = useState({});

  // Refs for scroll behavior (mobile momentum)
  const bannedScrollRef = useRef(null);
  const ingScrollRef = useRef(null);

  // Palette: banType accent colors + ingredient highlight color
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Normalize + split into banned vs ingredients, and build counts
  const { bannedRecords, ingredientRecords, countsByBanType } = useMemo(() => {
    const banned = [];
    const ingredients = [];
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    (matchedSubstances || []).forEach((rRaw) => {
      const r = rRaw?.fields ? rRaw.fields : rRaw || {};

      const record = {
        id: rRaw?.id || rRaw?.recordId || Math.random().toString(36).slice(2),
        name:
          r["Substance Name"] ??
          r.name ??
          r["Name"] ??
          r["Ingredient Name"] ??
          "",
        synonyms:
          r["Synonyms"] ??
          r["Synonyms (Extended)"] ??
          r.synonyms ??
          r["Aliases"] ??
          "",
        bannedBy: r["Banned By"] ?? r.bannedBy ?? "",
        banType: r["Ban Type"] ?? r.banType ?? null,
        dosageLimit: r["Dosage Limit"] ?? r.dosageLimit ?? "",
        notes: r["Notes"] ?? r["Pharmacology Notes"] ?? r.notes ?? "",
        benefits: r["Benefits"] ?? r.benefits ?? "",
        weaknesses: r["Weaknesses"] ?? r.weaknesses ?? "",
        antagonisms:
          r["Nutrient Antagonisms"] ??
          r["Nutrient Antagonism"] ??
          r["Nutrient Interactions"] ??
          r.antagonisms ??
          "",
        source:
          r["Source / Citation"] ??
          r["Sources / References"] ??
          r["Source / Notes"] ??
          r["Source"] ??
          r.source ??
          "",
      };

      if (record.banType) {
        banned.push(record);
        const normalized = (record.banType || "").trim();
        if (counts[normalized] !== undefined) counts[normalized] += 1;
      } else {
        ingredients.push(record);
      }
    });

    return {
      bannedRecords: banned,
      ingredientRecords: ingredients,
      countsByBanType: counts,
    };
  }, [matchedSubstances, banTypeColors]);

  // Filters – respect active ban type for banned list
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter(
      (r) => (r.banType || "").trim() === activeBanType
    );
  }, [bannedRecords, activeBanType]);

  // Filter ingredients so they don’t duplicate banned names
  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(
      bannedRecords.map((b) => (b.name || "").toLowerCase())
    );
    return ingredientRecords.filter(
      (ing) => !bannedNames.has((ing.name || "").toLowerCase())
    );
  }, [ingredientRecords, bannedRecords]);

  // Highlight searchTerm in text (color optionally passed for banned)
  const highlightHTML = (text = "", color = "") => {
    const raw = String(text ?? "");
    const term = String(searchTerm ?? "").trim();
    if (!term) return escapeHtml(raw);
    try {
      const regex = new RegExp(escapeRegex(term), "gi");
      const appliedColor = color || INGREDIENT_HIGHLIGHT_COLOR;
      return escapeHtml(raw).replace(
        regex,
        (m) =>
          `<span style="color:${appliedColor};font-weight:600;text-decoration:underline;text-underline-offset:2px;">${m}</span>`
      );
    } catch {
      return escapeHtml(raw);
    }
  };

  // Legend / filters
  const handleLegendClick = (label) => {
    setActiveBanType((cur) => (cur === label ? null : label));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const clearFilters = () => {
    setActiveBanType(null);
    setLegendCollapsed(false);
  };

  const collapseLabel = (open, name) =>
    open ? `Collapse ${name}` : `Expand ${name}`;

  // Search status
  const trimmedSearch = String(searchTerm || "").trim();
  const showSearchingIndicator =
    trimmedSearch.length >= 2 && (matchedSubstances?.length ?? 0) === 0;

  // Initial “hint” if nothing searched yet
  const showInitialEmptyState =
    !trimmedSearch && (matchedSubstances?.length ?? 0) === 0;

  // Momentum scroll on mobile for the inner card lists
  useEffect(() => {
    const b = bannedScrollRef.current;
    const i = ingScrollRef.current;
    if (b) b.style.WebkitOverflowScrolling = "touch";
    if (i) i.style.WebkitOverflowScrolling = "touch";
  }, []);

  // Accordion toggles
  const toggleBannedRow = (id) => {
    setExpandedBannedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleIngredientRow = (id) => {
    setExpandedIngredientRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // ---------- CARD COMPONENTS (SmartStack-style accordions with neutral panels) ----------

  const BannedCards = ({ records }) => {
    if (!records || !records.length) {
      return trimmedSearch ? (
        <p className="italic text-gray-500 text-sm px-1 py-2">
          No banned substances matched this search.
        </p>
      ) : (
        <p className="italic text-gray-500 text-sm px-1 py-2">
          No banned substances to display yet.
        </p>
      );
    }

    return (
      <div className="space-y-3 mt-3" ref={bannedScrollRef}>
        {records.map((rec, idx) => {
          const banType = (rec.banType || "").trim();
          const colorEntry =
            banTypeColors.find((b) => b.label === banType) || null;
          const c = colorEntry?.color || "#111827";
          const isExpanded = !!expandedBannedRows[rec.id];

          // unify into 3 panels like OCRScanResults
          const whatItDoesText = rec.benefits || rec.notes || "";
          const whatItDoesHTML = highlightHTML(whatItDoesText, c);
          const weaknessesHTML = highlightHTML(rec.weaknesses || "", c);
          const antagonismsHTML = highlightHTML(rec.antagonisms || "", c);
          const sourceHTML = highlightHTML(rec.source || "", c);

          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, delay: idx * 0.01 }}
              className="group rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: c,
              }}
            >
              {/* HEADER */}
              <button
                type="button"
                onClick={() => toggleBannedRow(rec.id)}
                className="w-full text-left px-4 sm:px-5 py-3 sm:py-4 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                      Banned substance
                    </span>
                    {banType && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border"
                        style={{
                          backgroundColor: `${c}15`,
                          color: c,
                          borderColor: `${c}30`,
                        }}
                      >
                        {banType}
                      </span>
                    )}
                    {rec.bannedBy && (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 max-w-full">
                        <span className="mr-1 text-[10px] font-semibold text-gray-500">
                          By:
                        </span>
                        <span
                          className="truncate"
                          dangerouslySetInnerHTML={{
                            __html: highlightHTML(rec.bannedBy, c),
                          }}
                        />
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-sm sm:text-base font-semibold text-gray-900 truncate"
                    dangerouslySetInnerHTML={{
                      __html: highlightHTML(rec.name, c),
                    }}
                  />

                  <div className="mt-1 text-[11px] sm:text-xs text-gray-600 space-y-0.5">
                    {rec.synonyms && (
                      <p
                        className="line-clamp-1"
                        dangerouslySetInnerHTML={{
                          __html: `Synonyms: ${highlightHTML(
                            rec.synonyms,
                            c
                          )}`,
                        }}
                      />
                    )}
                    {rec.dosageLimit && (
                      <p
                        dangerouslySetInnerHTML={{
                          __html: `Dosage limit: ${highlightHTML(
                            rec.dosageLimit,
                            c
                          )}`,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center pl-2 pt-1">
                  {isExpanded ? (
                    <FaChevronUp className="text-gray-400" />
                  ) : (
                    <FaChevronDown className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* BODY: 3 neutral-gray panels + sources, matching OCRScanResults layout */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key={`${rec.id}-body`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-gray-100 bg-gray-50/80 text-[11px] sm:text-sm text-gray-800 space-y-4 overflow-hidden"
                  >
                    {(whatItDoesText || rec.weaknesses || rec.antagonisms) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {whatItDoesText && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              What it does
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{
                                __html: whatItDoesHTML,
                              }}
                            />
                          </div>
                        )}

                        {rec.weaknesses && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Things to watch for
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{
                                __html: weaknessesHTML,
                              }}
                            />
                          </div>
                        )}

                        {rec.antagonisms && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Interactions with other nutrients
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{
                                __html: antagonismsHTML,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {rec.source && (
                      <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                          Where this information comes from
                        </p>
                        <p
                          className="text-[11px] sm:text-xs leading-relaxed break-words text-gray-800"
                          dangerouslySetInnerHTML={{ __html: sourceHTML }}
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

  const IngredientCards = ({ records }) => {
    if (!records || !records.length) {
      return trimmedSearch ? (
        <div className="flex items-center justify-center py-8">
          <p className="italic text-gray-500 text-sm text-center max-w-sm">
            No ingredient entries matched this search that weren’t already tagged
            as banned.
          </p>
        </div>
      ) : (
        <p className="italic text-gray-500 text-sm px-1 py-2">
          No ingredient details to display yet.
        </p>
      );
    }

    return (
      <div className="space-y-3 mt-3" ref={ingScrollRef}>
        {records.map((rec, idx) => {
          const isExpanded = !!expandedIngredientRows[rec.id];

          const whatItDoesHTML = highlightHTML(rec.benefits || "");
          const weaknessesHTML = highlightHTML(rec.weaknesses || "");
          const antagonismsHTML = highlightHTML(rec.antagonisms || "");
          const sourceHTML = highlightHTML(rec.source || "");

          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, delay: idx * 0.01 }}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* HEADER */}
              <button
                type="button"
                onClick={() => toggleIngredientRow(rec.id)}
                className="w-full text-left px-4 sm:px-5 py-3 sm:py-4 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                      Ingredient
                    </span>
                  </div>

                  <h3
                    className="text-sm sm:text-base font-semibold text-gray-900 truncate"
                    dangerouslySetInnerHTML={{
                      __html: highlightHTML(rec.name),
                    }}
                  />

                  <div className="mt-1 text-[11px] sm:text-xs text-gray-600 space-y-0.5">
                    {rec.synonyms && (
                      <p
                        className="line-clamp-1"
                        dangerouslySetInnerHTML={{
                          __html: `Synonyms: ${highlightHTML(rec.synonyms)}`,
                        }}
                      />
                    )}
                    {rec.benefits && (
                      <p
                        className="line-clamp-1"
                        dangerouslySetInnerHTML={{
                          __html: `Benefits: ${highlightHTML(rec.benefits)}`,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center pl-2 pt-1">
                  {isExpanded ? (
                    <FaChevronUp className="text-gray-400" />
                  ) : (
                    <FaChevronDown className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* BODY: 3 neutral-gray panels + sources, matching OCRScanResults layout */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key={`${rec.id}-body`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-gray-100 bg-gray-50/80 text-[11px] sm:text-sm text-gray-800 space-y-4 overflow-hidden"
                  >
                    {(rec.benefits || rec.weaknesses || rec.antagonisms) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {rec.benefits && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              What it does
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{
                                __html: whatItDoesHTML,
                              }}
                            />
                          </div>
                        )}

                        {rec.weaknesses && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Things to watch for
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{
                                __html: weaknessesHTML,
                              }}
                            />
                          </div>
                        )}

                        {rec.antagonisms && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Interactions with other nutrients
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{
                                __html: antagonismsHTML,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {rec.source && (
                      <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                          Where this information comes from
                        </p>
                        <p
                          className="text-[11px] sm:text-xs leading-relaxed break-words text-gray-800"
                          dangerouslySetInnerHTML={{ __html: sourceHTML }}
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
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-0 py-4 sm:py-6 font-sans space-y-8 relative text-gray-900">
      <section>
        {/* Searching indicator */}
        <AnimatePresence>
          {showSearchingIndicator && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex justify-center sm:justify-start text-gray-500 text-sm mb-1"
            >
              <AnimatedEllipsis text="Searching..." />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial hint */}
        {showInitialEmptyState && (
          <div className="mb-4 rounded-xl border border-dashed border-[#c5d6e7] bg-[#e7f1fb] px-4 py-3 text-xs sm:text-sm text-[#1f3042]">
            Start by entering a substance or ingredient above. When results come
            back, banned items and ingredients will appear in expandable cards
            with clear sections for what it does, things to watch for,
            interactions, and sources.
          </div>
        )}

        {/* Heading + summary */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Search Results
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {matchedSubstances?.length ?? 0} total — {bannedRecords.length}{" "}
              banned · {ingredientRecords.length} ingredients
            </p>
          </div>

          {trimmedSearch && (
            <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full bg-gray-100 px-3 py-1 text-[11px] sm:text-xs text-gray-700">
              <span className="font-semibold text-gray-800">Search:</span>
              <span className="font-mono text-gray-900 truncate max-w-[180px] sm:max-w-[260px]">
                {trimmedSearch}
              </span>
            </div>
          )}
        </div>

        {/* ===================== BANNED (cards + accordion) ===================== */}
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setBannedOpen((s) => !s)}
                aria-expanded={bannedOpen}
                aria-label={collapseLabel(bannedOpen, "Banned Substances")}
                className={`search-toggle-btn ${
                  bannedOpen ? "active" : ""
                } w-full sm:w-auto`}
              >
                <span className="section-label">Banned Substances</span>
                <span className="badge">{bannedRecords.length}</span>
                <span className="caret">{bannedOpen ? "▾" : "▸"}</span>
              </button>

              <p className="text-[11px] sm:text-xs text-gray-600 leading-snug">
                These are substances with an active ban classification. Use the
                legend filters to focus on a specific ban type, then expand a
                card to see a breakdown of what it does, things to watch for,
                interactions, and sources.
              </p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {bannedOpen && (
              <motion.div
                key="banned-cards"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-1"
              >
                <BannedCards records={filteredBanned} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider between sections */}
        <div className="border-t border-gray-300 my-8" />

        {/* ===================== INGREDIENTS (cards + accordion) ===================== */}
        <div className="mb-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setIngredientsOpen((s) => !s)}
                aria-expanded={ingredientsOpen}
                aria-label={collapseLabel(
                  ingredientsOpen,
                  "Ingredients (non-banned)"
                )}
                className={`search-toggle-btn ${
                  ingredientsOpen ? "active" : ""
                } w-full sm:w-auto`}
              >
                <span className="section-label">Ingredients (non-banned)</span>
                <span className="badge">{ingredientRecords.length}</span>
                <span className="caret">{ingredientsOpen ? "▾" : "▸"}</span>
              </button>

              <p className="text-[11px] sm:text-xs text-gray-600 leading-snug">
                These appear in the ingredient database without a ban flag.
                Expand a card to see what the ingredient does, potential
                drawbacks, interactions, and where the information comes from.
              </p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {ingredientsOpen && (
              <motion.div
                key="ingredient-cards"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-1"
              >
                <IngredientCards records={filteredIngredients} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ===================== STICKY LEGEND ===================== */}
      <div className="sticky bottom-0 left-0 right-0 z-40">
        <div className="max-w-5xl mx-auto px-2 sm:px-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-t-xl border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-[0_-2px_8px_rgba(15,23,42,0.08)]">
            <div
              className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1 w-full sm:w-auto"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <button
                className="mr-2 px-3 py-1 rounded-md bg-gray-100 text-sm whitespace-nowrap text-gray-700 border border-gray-200"
                onClick={() => setLegendCollapsed((c) => !c)}
                aria-expanded={!legendCollapsed}
                aria-label={legendCollapsed ? "Expand legend" : "Collapse legend"}
              >
                {legendCollapsed ? "▸ Legend" : "Legend ▾"}
              </button>

              {!legendCollapsed &&
                banTypeColors.map((t) => {
                  const active = activeBanType === t.label;
                  return (
                    <button
                      key={t.label}
                      onClick={() => handleLegendClick(t.label)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm whitespace-nowrap transition-all ${
                        active
                          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                          : "bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: t.color,
                          display: "inline-block",
                        }}
                      />
                      <span className="font-medium">{t.label}</span>
                      <span className="text-gray-500">
                        ({countsByBanType[t.label] || 0})
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="text-xs sm:text-sm text-gray-600 sm:mr-2 text-center sm:text-right">
                Showing: {filteredBanned.length} banned ·{" "}
                {filteredIngredients.length} ingredients
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-md bg-[#46769B] text-white text-xs sm:text-sm font-semibold shadow-sm hover:brightness-105 w-full sm:w-auto"
                aria-label="Clear filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Local styles for section buttons */}
      <style jsx>{`
        .search-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 2px solid transparent;
          font-size: 0.98rem;
          font-weight: 700;
          cursor: pointer;
          transition: box-shadow 0.18s ease-in-out, transform 0.18s ease-in-out,
            background-color 0.18s ease-in-out, border-color 0.18s ease-in-out;
          background: rgba(249, 250, 251, 0.96);
          color: #111827;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
        }
        .search-toggle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
          background-color: rgba(248, 250, 252, 1);
        }
        .search-toggle-btn .section-label {
          letter-spacing: -0.2px;
        }
        .search-toggle-btn .badge {
          background-color: #46769b;
          color: #fff;
          font-size: 0.8rem;
          padding: 4px 8px;
          border-radius: 999px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .search-toggle-btn .caret {
          color: #6b7280;
          font-weight: 600;
        }
        .search-toggle-btn.active {
          border-color: #46769b;
          background-color: rgba(70, 118, 155, 0.08);
        }

        @media (max-width: 640px) {
          .search-toggle-btn {
            padding: 10px 12px;
            gap: 8px;
            font-size: 0.95rem;
          }
          .search-toggle-btn .badge {
            font-size: 0.75rem;
            padding: 3px 6px;
          }
        }
      `}</style>
    </div>
  );
}
