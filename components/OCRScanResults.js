// components/OCRScanResults.js
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedEllipsis from "./AnimatedEllipsis";

/**
 * Mobile-friendly (desktop unchanged) version.
 * - Desktop: identical visuals & layout.
 * - Mobile: horizontal table scroll, smaller paddings/fonts, flexible legend/wrap.
 */

// safety: escape regex special chars
const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// minimal HTML escape
const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function OCRScanResults({
  ocrText = "",
  detectedSubstances = [],
  detectedIngredients = [],
  showOCR = true,
}) {
  // UI state
  const [activeBanType, setActiveBanType] = useState(null); // single-select
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Colors
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Merge + normalize
  const mergedInput = useMemo(() => {
    const arr = [];
    (detectedSubstances || []).forEach((r) => arr.push(r));
    (detectedIngredients || []).forEach((r) => arr.push(r));
    return arr;
  }, [detectedSubstances, detectedIngredients]);

  const { bannedRecords, ingredientRecords, countsByBanType } = useMemo(() => {
    const banned = [];
    const ingredients = [];
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    (mergedInput || []).forEach((rRaw) => {
      const r = rRaw && rRaw.fields ? rRaw.fields : rRaw || {};
      const record = {
        id: rRaw?.id || rRaw?.recordId || Math.random().toString(36).slice(2),
        name: r["Substance Name"] ?? r.name ?? r["Name"] ?? rRaw?.name ?? "",
        synonyms: r["Synonyms"] ?? r["Synonyms (Extended)"] ?? r.synonyms ?? "",
        bannedBy: r["Banned By"] ?? r.bannedBy ?? "",
        banType: r["Ban Type"] ?? r.banType ?? null,
        dosageLimit: r["Dosage Limit"] ?? r.dosageLimit ?? "",
        notes: r["Notes"] ?? r["Pharmacology Notes"] ?? r.notes ?? "",
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
        rawFields: r,
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
  }, [mergedInput]);

  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter((r) => (r.banType || "").trim() === activeBanType);
  }, [bannedRecords, activeBanType]);

  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(bannedRecords.map((b) => (b.name || "").toLowerCase()));
    return ingredientRecords.filter((ing) => !bannedNames.has((ing.name || "").toLowerCase()));
  }, [ingredientRecords, bannedRecords]);

  const showSearchingIndicator = false;

  // highlight terms that appear in OCR
  const highlightHTML = (text = "", color = "") => {
    const raw = String(text ?? "");
    if (!raw) return "";
    const ocr = String(ocrText ?? "").trim();
    if (!ocr) return escapeHtml(raw);

    const terms = raw.split(/,\s*/).map((t) => t.trim()).filter(Boolean);
    if (!terms.length) return escapeHtml(raw);

    let working = raw;
    const placeholders = [];

    terms.forEach((term, idx) => {
      if (!term) return;
      try {
        const termRx = new RegExp(escapeRegex(term), "i");
        if (!termRx.test(ocr)) return; // only highlight if OCR contained the term
        const placeholder = `@@HIGHLIGHT_${Math.random().toString(36).slice(2)}_${idx}@@`;
        working = working.replace(new RegExp(escapeRegex(term), "gi"), placeholder);
        placeholders.push({ placeholder, term });
      } catch {}
    });

    if (!placeholders.length) return escapeHtml(raw);

    let escaped = escapeHtml(working);
    placeholders.forEach(({ placeholder, term }) => {
      const escapedTerm = escapeHtml(term);
      const appliedColor = color || INGREDIENT_HIGHLIGHT_COLOR;
      const span = `<span style="color:${appliedColor}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${escapedTerm}</span>`;
      escaped = escaped.split(placeholder).join(span);
    });

    return escaped;
  };

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

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 sm:px-4 py-6 sm:py-6 font-sans space-y-6 relative">
      <section>
        <h2 className="text-2xl font-bold mb-2 text-center sm:text-left">Scan Results</h2>
        <p className="text-sm text-gray-600 mb-4 text-center sm:text-left">
          {(mergedInput?.length ?? 0)} total results — {bannedRecords.length} banned · {ingredientRecords.length} ingredients
        </p>

        {/* Banned Substances Collapsible */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={() => setBannedOpen((s) => !s)}
                aria-expanded={bannedOpen}
                aria-label={collapseLabel(bannedOpen, "Banned Substances")}
                className={`toggle-section-btn ${bannedOpen ? "active" : ""}`}
              >
                <span className="section-label">Banned Substances</span>
                <span className="badge">{bannedRecords.length}</span>
                <span className="caret">{bannedOpen ? "▾" : "▸"}</span>
              </button>
              <div className="text-xs sm:text-sm text-gray-600">Filter by ban type using legend below.</div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
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
                className="mt-3 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {filteredBanned && filteredBanned.length > 0 ? (
                  <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden text-xs sm:text-sm">
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
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: nameHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: synHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: bannedByHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <span
                                className="px-2 py-1 rounded-full text-xs sm:text-sm font-medium"
                                style={{
                                  backgroundColor: colorEntry ? `${colorEntry.color}20` : "#11182710",
                                  color: colorEntry ? colorEntry.color : "#111827",
                                }}
                              >
                                {banType || "—"}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm">{rec.dosageLimit || ""}</div>
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: notesHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: sourceHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: benefitsHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: weaknessesHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: antagonismsHTML }} />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="italic text-gray-500">No banned substances match your scan.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ingredients Collapsible */}
        <div className="mb-24">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIngredientsOpen((s) => !s)}
                aria-expanded={ingredientsOpen}
                aria-label={collapseLabel(ingredientsOpen, "Ingredients")}
                className={`toggle-section-btn ${ingredientsOpen ? "active" : ""}`}
              >
                <span className="section-label">Ingredients (non-banned)</span>
                <span className="badge">{ingredientRecords.length}</span>
                <span className="caret">{ingredientsOpen ? "▾" : "▸"}</span>
              </button>
              <div className="text-xs sm:text-sm text-gray-600">Ingredients database results and nutrient info.</div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {ingredientsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {filteredIngredients && filteredIngredients.length > 0 ? (
                  <table className="min-w-full w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden text-xs sm:text-sm">
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
                            className="px-3 sm:px-4 py-2 text-left font-medium whitespace-nowrap"
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
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: nameHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm" dangerouslySetInnerHTML={{ __html: synHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: benefitsHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: weaknessesHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div dangerouslySetInnerHTML={{ __html: antagonismsHTML }} />
                            </td>
                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
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
                  <p className="italic text-gray-500">No ingredient-only results found for this scan.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Sticky Legend / Footer */}
      <div className="sticky bottom-0 left-0 right-0 z-40" style={{ pointerEvents: "auto" }}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-t-xl border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg">
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1 w-full sm:w-auto" style={{ WebkitOverflowScrolling: "touch" }}>
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
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border transition transform hover:scale-[1.02] text-sm whitespace-nowrap ${
                        active ? "shadow-md bg-gray-800 text-white" : "bg-white"
                      }`}
                      style={{ borderColor: active ? "#444" : "transparent" }}
                    >
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color, display: "inline-block" }} />
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

      {/* Local styles (retain your premium look) */}
      <style jsx>{`
        .highlight-match {
          background: transparent;
          padding: 0 0.12rem;
          border-radius: 3px;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 600;
        }
        thead.sticky {
          z-index: 20;
        }
        .toggle-section-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 2px solid transparent;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease-in-out;
          background: rgba(255, 255, 255, 0.88);
          color: #0f172a;
          box-shadow: 0 1px 0 rgba(16, 24, 40, 0.03);
        }
        .toggle-section-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(16, 24, 40, 0.06);
        }
        .toggle-section-btn .section-label {
          letter-spacing: -0.2px;
        }
        .toggle-section-btn .badge {
          background-color: #46769b;
          color: #fff;
          font-size: 0.825rem;
          padding: 4px 8px;
          border-radius: 999px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .toggle-section-btn .caret {
          color: #6b7280;
          font-weight: 600;
        }
        .toggle-section-btn.active {
          border-color: #46769b;
          background-color: rgba(70, 118, 155, 0.08);
        }

        /* Mobile fine-tuning without touching desktop look */
        @media (max-width: 640px) {
          .toggle-section-btn {
            padding: 10px 12px;
            gap: 8px;
            font-size: 0.98rem;
          }
          .toggle-section-btn .badge {
            font-size: 0.78rem;
            padding: 3px 6px;
          }
        }
      `}</style>
    </div>
  );
}
