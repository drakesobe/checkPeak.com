// components/OCRSearchResults.js
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedEllipsis from "./AnimatedEllipsis";

/**
 * OCRSearchResults
 *
 * Props:
 *  - searchTerm: string
 *  - matchedSubstances: array of records in unified shape (or fields)
 *
 * Behavior:
 *  - shows Banned Substances and Ingredients (non-banned) in two collapsible tables
 *  - highlights the searchTerm in Substance Name / Synonyms and other fields
 *  - has sticky table headers and a sticky footer legend wheel
 *  - allows filtering by ban type (single-select)
 */

// safety: escape regex special chars
const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// minimal HTML escape to keep innerHTML safe for raw text (we still inject highlight spans)
const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function OCRSearchResults({
  searchTerm = "",
  matchedSubstances = [],
}) {
  // UI state
  const [activeBanType, setActiveBanType] = useState(null); // single-select (keeps old UX)
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Ban type palette (consistent across site)
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];

  // Ingredient highlight color (user chose #8556da)
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Normalize incoming records (accept either {fields: {...}} or flattened shapes)
  const { bannedRecords, ingredientRecords, countsByBanType } = useMemo(() => {
    const banned = [];
    const ingredients = [];
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    (matchedSubstances || []).forEach((rRaw) => {
      const r = rRaw.fields ? rRaw.fields : rRaw; // support both shapes
      const record = {
        id: rRaw.id || rRaw.recordId || Math.random().toString(36).slice(2),
        // Banned Airtable uses "Substance Name"; Ingredients use "Name"
        name:
          r["Substance Name"] ??
          r.name ??
          r["Name"] ??
          rRaw.name ??
          "",
        // Synonyms could be "Synonyms" (banned) or "Synonyms (Extended)" (ingredients)
        synonyms:
          r["Synonyms"] ??
          r["Synonyms (Extended)"] ??
          r.synonyms ??
          "",
        bannedBy: r["Banned By"] ?? r.bannedBy ?? "",
        banType: r["Ban Type"] ?? r.banType ?? null,
        dosageLimit: r["Dosage Limit"] ?? r.dosageLimit ?? "",
        // Notes mapping: banned uses "Notes", ingredients use "Pharmacology Notes"
        notes: r["Notes"] ?? r["Pharmacology Notes"] ?? r.notes ?? "",
        // Sources mapping: banned might have "Source / Citation", ingredients "Sources / References"
        source:
          r["Source / Citation"] ??
          r["Source"] ??
          r["Sources / References"] ??
          r.source ??
          "",
        benefits: r["Benefits"] ?? r.benefits ?? "",
        weaknesses: r["Weaknesses"] ?? r.weaknesses ?? "",
        antagonisms:
          r["Nutrient Antagonism"] ??
          r["Nutrient Antagonisms"] ??
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

  // Filter banned by legend (single-select activeBanType)
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter((r) => (r.banType || "").trim() === activeBanType);
  }, [bannedRecords, activeBanType]);

  // Ingredients shown excluding ones already present in banned (by name)
  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(bannedRecords.map((b) => (b.name || "").toLowerCase()));
    return ingredientRecords.filter((ing) => !bannedNames.has((ing.name || "").toLowerCase()));
  }, [ingredientRecords, bannedRecords]);

  // Highlight function: highlights occurrences of searchTerm in `text`.
  // If color provided, it sets inline color on highlights (useful for ban-type highlighting).
  const highlightHTML = (text = "", color = "") => {
    const raw = String(text ?? "");
    if (!raw) return "";
    const term = String(searchTerm ?? "").trim();
    if (!term) return escapeHtml(raw);

    try {
      const regex = new RegExp(escapeRegex(term), "gi");
      // Wrap matches with a span; apply inline color style if provided
      return escapeHtml(raw).replace(regex, (match) => {
        const appliedColor = color || INGREDIENT_HIGHLIGHT_COLOR;
        return `<span style="color:${appliedColor}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${match}</span>`;
      });
    } catch (err) {
      // If regex fails for any reason, fallback to plain escaping
      return escapeHtml(raw);
    }
  };

  const handleLegendClick = (label) => {
    setActiveBanType((cur) => (cur === label ? null : label));
    // smooth scroll to top of results for clarity
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const clearFilters = () => {
    setActiveBanType(null);
    setLegendCollapsed(false);
  };

  const collapseLabel = (open, name) => (open ? `Collapse ${name}` : `Expand ${name}`);

  // Show AnimatedEllipsis when user has typed a query but no results yet
  const showSearchingIndicator =
    String(searchTerm || "").trim().length >= 2 && (matchedSubstances?.length ?? 0) === 0;

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 py-6 font-sans space-y-6 relative">
      <section>
        <h2 className="text-2xl font-bold mb-2">Search Results</h2>
        <p className="text-sm text-gray-600 mb-4">
          {matchedSubstances?.length ?? 0} total results — {bannedRecords.length} banned /{" "}
          {ingredientRecords.length} ingredients
        </p>

        {/* Banned Substances Collapsible */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBannedOpen((s) => !s)}
                aria-expanded={bannedOpen}
                aria-label={collapseLabel(bannedOpen, "Banned Substances")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md transition"
              >
                <span className="text-sm font-semibold">Banned Substances</span>
                <span className="text-xs text-gray-500">({bannedRecords.length})</span>
                <span className="text-gray-500">{bannedOpen ? "▾" : "▸"}</span>
              </button>
              <div className="text-sm text-gray-600">Filter by ban type using legend below.</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !(bannedOpen && ingredientsOpen);
                  setBannedOpen(next);
                  setIngredientsOpen(next);
                }}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50"
              >
                Toggle All
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {bannedOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 overflow-x-auto"
              >
                {filteredBanned && filteredBanned.length > 0 ? (
                  <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <thead className="bg-[#46769B] text-white sticky top-0 z-20">
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
                            className="px-4 py-2 text-left font-medium whitespace-nowrap"
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
                        const colorEntry = banTypeColors.find((b) => b.label === banType);
                        const matchColor = colorEntry?.color || "";

                        const nameHTML = highlightHTML(rec.name || "", matchColor);
                        const synHTML = highlightHTML(rec.synonyms || "", matchColor);
                        const bannedByHTML = highlightHTML(rec.bannedBy || "", matchColor);
                        const notesHTML = highlightHTML(rec.notes || "", matchColor);
                        const sourceHTML = highlightHTML(rec.source || "", matchColor);
                        const benefitsHTML = highlightHTML(rec.benefits || "", matchColor);
                        const weaknessesHTML = highlightHTML(rec.weaknesses || "", matchColor);
                        const antagonismsHTML = highlightHTML(rec.antagonisms || "", matchColor);

                        return (
                          <motion.tr
                            key={rec.id}
                            className="hover:bg-gray-50 transition"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.14 }}
                          >
                            <td className="px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: nameHTML }}
                              />
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: synHTML }}
                              />
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: bannedByHTML }}
                              />
                            </td>

                            <td className="px-4 py-3 align-top">
                              <span
                                className="px-2 py-1 rounded-full text-sm font-medium"
                                style={{
                                  backgroundColor: colorEntry ? `${colorEntry.color}20` : "#11182710",
                                  color: colorEntry ? colorEntry.color : "#111827",
                                }}
                              >
                                {banType || "—"}
                              </span>
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div className="text-sm">{rec.dosageLimit || ""}</div>
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: notesHTML }}
                              />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: sourceHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: benefitsHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: weaknessesHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: antagonismsHTML }} />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="italic text-gray-500">No banned substances match your filters/search.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ingredients Collapsible */}
        <div className="mb-24">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIngredientsOpen((s) => !s)}
                aria-expanded={ingredientsOpen}
                aria-label={collapseLabel(ingredientsOpen, "Ingredients")}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 shadow-sm hover:shadow-md transition"
              >
                <span className="text-sm font-semibold">Ingredients (non-banned)</span>
                <span className="text-xs text-gray-500">({ingredientRecords.length})</span>
                <span className="text-gray-500">{ingredientsOpen ? "▾" : "▸"}</span>
              </button>
              <div className="text-sm text-gray-600">Ingredients database results and nutrient info.</div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {ingredientsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 overflow-x-auto"
              >
                {filteredIngredients && filteredIngredients.length > 0 ? (
                  <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <thead className="bg-[#334E63] text-white sticky top-0 z-20">
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
                            className="px-4 py-2 text-left font-medium whitespace-nowrap"
                            scope="col"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {filteredIngredients.map((rec) => {
                        const nameHTML = highlightHTML(rec.name || "", INGREDIENT_HIGHLIGHT_COLOR);
                        const synHTML = highlightHTML(rec.synonyms || "", INGREDIENT_HIGHLIGHT_COLOR);
                        const benefitsHTML = highlightHTML(rec.benefits || "", INGREDIENT_HIGHLIGHT_COLOR);
                        const weaknessesHTML = highlightHTML(rec.weaknesses || "", INGREDIENT_HIGHLIGHT_COLOR);
                        const antagonismsHTML = highlightHTML(rec.antagonisms || "", INGREDIENT_HIGHLIGHT_COLOR);
                        const sourceHTML = highlightHTML(rec.source || "", INGREDIENT_HIGHLIGHT_COLOR);

                        return (
                          <motion.tr
                            key={rec.id}
                            className="hover:bg-gray-50 transition"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.14 }}
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: nameHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: synHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: benefitsHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: weaknessesHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: antagonismsHTML }} />
                            </td>

                            <td className="px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: sourceHTML }} />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : showSearchingIndicator ? (
                  <div className="flex items-center justify-center py-12">
                    <AnimatedEllipsis text="Searching for ingredients" />
                  </div>
                ) : (
                  <p className="italic text-gray-500">No ingredient-only results found for this search.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Sticky Legend / Footer (bottom of viewport) */}
      <div
        className="sticky bottom-0 left-0 right-0 z-40"
        style={{ pointerEvents: "auto" }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-t-xl border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg">
            <div className="flex items-center gap-3 overflow-x-auto py-1">
              <button
                className="mr-2 px-3 py-1 rounded-md bg-gray-100 text-sm"
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
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border transition transform hover:scale-[1.02] text-sm ${
                        active ? "shadow-md bg-gray-800 text-white" : "bg-white"
                      }`}
                      style={{
                        borderColor: active ? "#444" : "transparent",
                      }}
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

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">
                Showing: {filteredBanned.length} banned · {filteredIngredients.length} ingredients
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-md bg-[#46769B] text-white text-sm font-semibold shadow-sm hover:brightness-105"
                aria-label="Clear filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Local styles for highlight-match */}
      <style jsx>{`
        .highlight-match {
          background: transparent;
          padding: 0 0.12rem;
          border-radius: 3px;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 600;
        }

        /* Ensure table header cells remain visually on top */
        thead.sticky {
          z-index: 20;
        }
      `}</style>
    </div>
  );
}
