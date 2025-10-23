// components/OCRSearchResults.js
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedEllipsis from "./AnimatedEllipsis";

/**
 * Desktop visuals preserved.
 * Mobile UX:
 *  - Vertical stacking of controls so nothing collides
 *  - No "Toggle All" (redundant with section toggles)
 *  - Native horizontal scrollbars only (no gradients/overlays)
 *  - Clear separation between sections with a neutral gray divider
 *  - "Searching..." appears above heading, fades in/out
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
  // UI state
  const [activeBanType, setActiveBanType] = useState(null);
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Refs kept in case you later want to add any scroll-linked behavior
  const bannedScrollRef = useRef(null);
  const ingScrollRef = useRef(null);

  // Palette
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Normalize + split into banned vs ingredients
  const { bannedRecords, ingredientRecords, countsByBanType } = useMemo(() => {
    const banned = [];
    const ingredients = [];
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    (matchedSubstances || []).forEach((rRaw) => {
      const r = rRaw?.fields ? rRaw.fields : rRaw || {};
      const record = {
        id: rRaw?.id || rRaw?.recordId || Math.random().toString(36).slice(2),
        name: r["Substance Name"] ?? r.name ?? r["Name"] ?? "",
        synonyms: r["Synonyms"] ?? r["Synonyms (Extended)"] ?? r.synonyms ?? "",
        bannedBy: r["Banned By"] ?? r.bannedBy ?? "",
        banType: r["Ban Type"] ?? r.banType ?? null,
        dosageLimit: r["Dosage Limit"] ?? r.dosageLimit ?? "",
        notes: r["Notes"] ?? r["Pharmacology Notes"] ?? r.notes ?? "",
        source:
          r["Source / Citation"] ??
          r["Sources / References"] ??
          r["Source"] ??
          r.source ??
          "",
        benefits: r["Benefits"] ?? r.benefits ?? "",
        weaknesses: r["Weaknesses"] ?? r.weaknesses ?? "",
        antagonisms:
          r["Nutrient Antagonisms"] ??
          r["Nutrient Antagonism"] ??
          r.antagonisms ??
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

    return { bannedRecords: banned, ingredientRecords: ingredients, countsByBanType: counts };
  }, [matchedSubstances]);

  // Filters
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter((r) => (r.banType || "").trim() === activeBanType);
  }, [bannedRecords, activeBanType]);

  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(bannedRecords.map((b) => (b.name || "").toLowerCase()));
    return ingredientRecords.filter((ing) => !bannedNames.has((ing.name || "").toLowerCase()));
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

  // Legend
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
  const collapseLabel = (open, name) => (open ? `Collapse ${name}` : `Expand ${name}`);

  // Search status
  const showSearchingIndicator =
    String(searchTerm || "").trim().length >= 2 && (matchedSubstances?.length ?? 0) === 0;

  // Ensure native scrollbars appear when needed (mobile momentum)
  useEffect(() => {
    const b = bannedScrollRef.current;
    const i = ingScrollRef.current;
    if (b) b.style.WebkitOverflowScrolling = "touch";
    if (i) i.style.WebkitOverflowScrolling = "touch";
  }, []);

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 sm:px-4 py-6 font-sans space-y-8 relative">
      <section>
        {/* Searching indicator (above heading) */}
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

        {/* Heading + summary */}
        <h2 className="text-2xl font-bold text-center sm:text-left">Search Results</h2>
        <p className="text-sm text-gray-600 text-center sm:text-left mt-1">
          {matchedSubstances?.length ?? 0} total results — {bannedRecords.length} banned ·{" "}
          {ingredientRecords.length} ingredients
        </p>

        {/* ===================== BANNED ===================== */}
        <div className="mt-6">
          {/* Controls: stack vertically on mobile so nothing collides */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setBannedOpen((s) => !s)}
                aria-expanded={bannedOpen}
                aria-label={collapseLabel(bannedOpen, "Banned Substances")}
                className={`search-toggle-btn ${bannedOpen ? "active" : ""} w-full sm:w-auto`}
              >
                <span className="section-label">Banned Substances</span>
                <span className="badge">{bannedRecords.length}</span>
                <span className="caret">{bannedOpen ? "▾" : "▸"}</span>
              </button>

              <p className="text-xs sm:text-sm text-gray-600 leading-snug">
                Filter by ban type using legend below.
              </p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {bannedOpen && (
              <motion.div
                key="banned-table"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                ref={bannedScrollRef}
                className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {filteredBanned?.length > 0 ? (
                  <table className="min-w-full w-full text-xs sm:text-sm">
                    <thead className="bg-[#46769B] text-white sticky top-0 z-10">
                      <tr>
                        {[
                          "Substance Name",
                          "Synonyms",
                          "Banned By",
                          "Ban Type",
                          "Dosage Limit",
                          "Notes",
                          "Source / Citation",
                          "Benefits",
                          "Weaknesses",
                          "Nutrient Antagonisms",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 sm:px-4 py-2 text-left font-medium whitespace-nowrap"
                            scope="col"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBanned.map((rec) => {
                        const banType = (rec.banType || "").trim();
                        const colorEntry =
                          banTypeColors.find((b) => b.label === banType) || null;
                        const c = colorEntry?.color || "#111827";

                        return (
                          <motion.tr
                            key={rec.id}
                            className="hover:bg-gray-50 transition"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.name, c) }}
                            />
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.synonyms, c) }}
                            />
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.bannedBy, c) }}
                            />
                            <td className="px-3 py-2 align-top">
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${c}20`,
                                  color: c,
                                }}
                              >
                                {banType || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-top">{rec.dosageLimit || ""}</td>
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.notes, c) }}
                            />
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.source, c) }}
                            />
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.benefits, c) }}
                            />
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.weaknesses, c) }}
                            />
                            <td
                              className="px-3 py-2 align-top"
                              dangerouslySetInnerHTML={{ __html: highlightHTML(rec.antagonisms, c) }}
                            />
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="italic text-gray-500 p-4">No banned substances found.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* neutral divider keeps sections distinct on mobile */}
        <div className="border-t border-gray-300 my-8" />

        {/* ===================== INGREDIENTS ===================== */}
        <div className="mb-16">
          {/* Controls: stack vertically on mobile so nothing collides */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setIngredientsOpen((s) => !s)}
                aria-expanded={ingredientsOpen}
                aria-label={collapseLabel(ingredientsOpen, "Ingredients (non-banned)")}
                className={`search-toggle-btn ${ingredientsOpen ? "active" : ""} w-full sm:w-auto`}
              >
                <span className="section-label">Ingredients (non-banned)</span>
                <span className="badge">{ingredientRecords.length}</span>
                <span className="caret">{ingredientsOpen ? "▾" : "▸"}</span>
              </button>

              <p className="text-xs sm:text-sm text-gray-600 leading-snug">
                Ingredient database results and nutrient info.
              </p>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {ingredientsOpen && (
              <motion.div
                key="ingredients-table"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                ref={ingScrollRef}
                className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {filteredIngredients?.length > 0 ? (
                  <table className="min-w-full w-full text-xs sm:text-sm">
                    <thead className="bg-[#334E63] text-white sticky top-0 z-10">
                      <tr>
                        {[
                          "Ingredient Name",
                          "Synonyms",
                          "Benefits",
                          "Weaknesses",
                          "Nutrient Antagonisms",
                          "Source / Notes",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 sm:px-4 py-2 text-left font-medium whitespace-nowrap"
                            scope="col"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIngredients.map((rec) => (
                        <motion.tr
                          key={rec.id}
                          className="hover:bg-gray-50 transition"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <td
                            className="px-3 py-2 align-top"
                            dangerouslySetInnerHTML={{ __html: highlightHTML(rec.name) }}
                          />
                          <td
                            className="px-3 py-2 align-top"
                            dangerouslySetInnerHTML={{ __html: highlightHTML(rec.synonyms) }}
                          />
                          <td
                            className="px-3 py-2 align-top"
                            dangerouslySetInnerHTML={{ __html: highlightHTML(rec.benefits) }}
                          />
                          <td
                            className="px-3 py-2 align-top"
                            dangerouslySetInnerHTML={{ __html: highlightHTML(rec.weaknesses) }}
                          />
                          <td
                            className="px-3 py-2 align-top"
                            dangerouslySetInnerHTML={{ __html: highlightHTML(rec.antagonisms) }}
                          />
                          <td
                            className="px-3 py-2 align-top"
                            dangerouslySetInnerHTML={{ __html: highlightHTML(rec.source) }}
                          />
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : showSearchingIndicator ? (
                  <div className="flex items-center justify-center py-12">
                    <AnimatedEllipsis text="Searching for ingredients" />
                  </div>
                ) : (
                  <p className="italic text-gray-500 p-4">No ingredients found.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ===================== STICKY LEGEND ===================== */}
      <div className="sticky bottom-0 left-0 right-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-t-xl border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg">
            <div
              className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1 w-full sm:w-auto"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <button
                className="mr-2 px-3 py-1 rounded-md bg-gray-100 text-sm whitespace-nowrap"
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
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border transition text-sm whitespace-nowrap ${
                        active ? "shadow-md bg-gray-800 text-white" : "bg-white"
                      }`}
                      style={{ borderColor: active ? "#444" : "transparent" }}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color, display: "inline-block" }}
                      />
                      <span className="font-medium">{t.label}</span>
                      <span className="text-gray-500">({countsByBanType[t.label] || 0})</span>
                    </button>
                  );
                })}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-sm text-gray-600 hidden sm:block">
                Showing: {filteredBanned.length} banned · {filteredIngredients.length} ingredients
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-md bg-[#46769B] text-white text-sm font-semibold shadow-sm hover:brightness-105 w-full sm:w-auto"
                aria-label="Clear filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Local styles for the flat toggle buttons */}
      <style jsx>{`
        .search-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 2px solid transparent;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: box-shadow 0.18s ease-in-out, transform 0.18s ease-in-out,
            background-color 0.18s ease-in-out, border-color 0.18s ease-in-out;
          background: rgba(255, 255, 255, 0.88);
          color: #0f172a;
          box-shadow: 0 1px 0 rgba(16, 24, 40, 0.03);
        }
        .search-toggle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(16, 24, 40, 0.06);
        }
        .search-toggle-btn .section-label {
          letter-spacing: -0.2px;
        }
        .search-toggle-btn .badge {
          background-color: #46769b; /* brand */
          color: #fff;
          font-size: 0.825rem;
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
          background-color: rgba(70, 118, 155, 0.08); /* subtle brand tint */
        }

        /* Keep table header on top when scrolling horizontally */
        thead.sticky {
          z-index: 20;
        }

        /* Mobile tweaks: keep buttons prominent without crowding */
        @media (max-width: 640px) {
          .search-toggle-btn {
            padding: 10px 12px;
            gap: 8px;
            font-size: 0.98rem;
          }
          .search-toggle-btn .badge {
            font-size: 0.78rem;
            padding: 3px 6px;
          }
        }
      `}</style>
    </div>
  );
}
