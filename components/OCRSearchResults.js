// components/OCRScanResults.js
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Matches OCRSearchResults design:
 * - OCR text card at the top, collapsed by default
 * - Mobile-friendly: vertical stacking, native horizontal scrollbars
 * - Sticky legend/footer (collapsed by default)
 * - Highlights in OCR text:
 *   - Prohibited: #d62828
 *   - Limited to Out of Competition: #f77f00
 *   - Particular Sports: #003049
 *   - Ingredients: #8556da
 */

// ---------- helpers ----------
const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// ---------- component ----------
export default function OCRScanResults({
  ocrText = "",
  detectedSubstances = [],
  detectedIngredients = [],
}) {
  // UI state
  const [ocrOpen, setOcrOpen] = useState(false); // collapsed by default
  const [activeBanType, setActiveBanType] = useState(null);
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(true); // collapsed by default

  // Scroll containers (native momentum on iOS)
  const bannedScrollRef = useRef(null);
  const ingScrollRef = useRef(null);

  // Colors
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Merge + normalize input
  const mergedInput = useMemo(
    () => [...(detectedSubstances || []), ...(detectedIngredients || [])],
    [detectedSubstances, detectedIngredients]
  );

  const { bannedRecords, ingredientRecords, countsByBanType } = useMemo(() => {
    const banned = [];
    const ingredients = [];
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    (mergedInput || []).forEach((rRaw) => {
      const r = rRaw?.fields ? rRaw.fields : rRaw || {};
      const rec = {
        id: rRaw?.id || rRaw?.recordId || Math.random().toString(36).slice(2),
        name: r["Substance Name"] ?? r.name ?? r["Name"] ?? "",
        synonyms: r["Synonyms"] ?? r["Synonyms (Extended)"] ?? "",
        bannedBy: r["Banned By"] ?? "",
        banType: r["Ban Type"] ?? null,
        dosageLimit: r["Dosage Limit"] ?? "",
        notes: r["Notes"] ?? r["Pharmacology Notes"] ?? "",
        source:
          r["Source / Citation"] ??
          r["Source"] ??
          r["Sources / References"] ??
          "",
        benefits: r["Benefits"] ?? "",
        weaknesses: r["Weaknesses"] ?? "",
        antagonisms:
          r["Nutrient Antagonism"] ?? r["Nutrient Antagonisms"] ?? "",
      };

      if (rec.banType) {
        banned.push(rec);
        const normalized = (rec.banType || "").trim();
        if (counts[normalized] !== undefined) counts[normalized] += 1;
      } else {
        ingredients.push(rec);
      }
    });

    return { bannedRecords: banned, ingredientRecords: ingredients, countsByBanType: counts };
  }, [mergedInput]);

  // Filters
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter((r) => (r.banType || "").trim() === activeBanType);
  }, [bannedRecords, activeBanType]);

  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(bannedRecords.map((b) => (b.name || "").toLowerCase()));
    return ingredientRecords.filter((ing) => !bannedNames.has((ing.name || "").toLowerCase()));
  }, [ingredientRecords, bannedRecords]);

  // OCR highlighting (names only, to avoid noisy false positives from long synonym lists)
  const highlightOCRText = (text = "") => {
    if (!text) return "";
    let highlighted = escapeHtml(text);

    // highlight banned with their specific color
    bannedRecords.forEach((rec) => {
      if (!rec.name) return;
      const colorEntry = banTypeColors.find((b) => b.label === (rec.banType || "").trim());
      const color = colorEntry?.color || "#d62828";
      try {
        const rx = new RegExp(escapeRegex(rec.name), "gi");
        highlighted = highlighted.replace(
          rx,
          `<span style="color:${color};font-weight:600;text-decoration:underline;text-underline-offset:2px;">$&</span>`
        );
      } catch {}
    });

    // highlight ingredients with ingredient color
    ingredientRecords.forEach((rec) => {
      if (!rec.name) return;
      try {
        const rx = new RegExp(escapeRegex(rec.name), "gi");
        highlighted = highlighted.replace(
          rx,
          `<span style="color:${INGREDIENT_HIGHLIGHT_COLOR};font-weight:600;text-decoration:underline;text-underline-offset:2px;">$&</span>`
        );
      } catch {}
    });

    return highlighted;
  };

  // Legend handlers
  const handleLegendClick = (label) => {
    setActiveBanType((cur) => (cur === label ? null : label));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const clearFilters = () => {
    setActiveBanType(null);
    setLegendCollapsed(true);
  };
  const collapseLabel = (open, name) => (open ? `Collapse ${name}` : `Expand ${name}`);

  // iOS momentum scroll
  useEffect(() => {
    const b = bannedScrollRef.current;
    const i = ingScrollRef.current;
    if (b) b.style.WebkitOverflowScrolling = "touch";
    if (i) i.style.WebkitOverflowScrolling = "touch";
  }, []);

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 py-6 font-sans space-y-8 relative">
      <section>
        {/* Heading + summary */}
        <h2 className="text-2xl font-bold text-center sm:text-left">Scan Results</h2>
        <p className="text-sm text-gray-600 text-center sm:text-left mt-1">
          {(mergedInput?.length ?? 0)} total — {bannedRecords.length} banned ·{" "}
          {ingredientRecords.length} ingredients
        </p>

        {/* ===================== OCR TEXT (collapsed by default) ===================== */}
        <div className="mt-6">
          <button
            onClick={() => setOcrOpen((o) => !o)}
            aria-expanded={ocrOpen}
            aria-label={collapseLabel(ocrOpen, "Scanned Text (OCR)")}
            className={`search-toggle-btn ${ocrOpen ? "active" : ""} w-full sm:w-auto`}
          >
            <span className="section-label">Scanned Text (OCR)</span>
            <span className="caret">{ocrOpen ? "▾" : "▸"}</span>
          </button>

          <AnimatePresence initial={false}>
            {ocrOpen && (
              <motion.div
                key="ocr-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-sm text-gray-800 leading-relaxed"
              >
                <div dangerouslySetInnerHTML={{ __html: highlightOCRText(ocrText) }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===================== BANNED ===================== */}
        <div className="mt-8">
          {/* Controls: stacked on mobile so nothing collides */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
                        const color =
                          banTypeColors.find((b) => b.label === (rec.banType || "").trim())
                            ?.color || "#111827";
                        return (
                          <tr key={rec.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 align-top">{rec.name}</td>
                            <td className="px-3 py-2 align-top">{rec.synonyms}</td>
                            <td className="px-3 py-2 align-top">{rec.bannedBy}</td>
                            <td className="px-3 py-2 align-top">
                              <span
                                className="px-2 py-1 rounded-full text-xs font-medium"
                                style={{ backgroundColor: `${color}20`, color }}
                              >
                                {rec.banType || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-top">{rec.dosageLimit}</td>
                            <td className="px-3 py-2 align-top">{rec.notes}</td>
                            <td className="px-3 py-2 align-top">{rec.source}</td>
                            <td className="px-3 py-2 align-top">{rec.benefits}</td>
                            <td className="px-3 py-2 align-top">{rec.weaknesses}</td>
                            <td className="px-3 py-2 align-top">{rec.antagonisms}</td>
                          </tr>
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

        {/* Neutral divider keeps sections distinct on mobile */}
        <div className="border-t border-gray-300 my-8" />

        {/* ===================== INGREDIENTS ===================== */}
        <div className="mb-16">
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
                        <tr key={rec.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 align-top">{rec.name}</td>
                          <td className="px-3 py-2 align-top">{rec.synonyms}</td>
                          <td className="px-3 py-2 align-top">{rec.benefits}</td>
                          <td className="px-3 py-2 align-top">{rec.weaknesses}</td>
                          <td className="px-3 py-2 align-top">{rec.antagonisms}</td>
                          <td className="px-3 py-2 align-top">{rec.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

      {/* Local styles (same flat toggles as Search) */}
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
          margin-left: 6px;
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
