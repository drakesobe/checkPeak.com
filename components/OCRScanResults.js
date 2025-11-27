// components/OCRScanResults.js
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * OCRScanResults
 *
 * - OCR text section (collapsible, above everything else)
 * - Top-level summary card (total results, banned, ingredients)
 * - Banned + Ingredients sections with toggle headers
 * - Highlighting of terms that appear both in OCR and tables
 * - Sticky bottom legend that doubles as a filter by ban type
 */

// ---------- utilities ----------
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
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  // Refs to enable momentum scroll on iOS
  const bannedScrollRef = useRef(null);
  const ingScrollRef = useRef(null);

  useEffect(() => {
    const b = bannedScrollRef.current;
    const i = ingScrollRef.current;
    if (b) b.style.WebkitOverflowScrolling = "touch";
    if (i) i.style.WebkitOverflowScrolling = "touch";
  }, []);

  // Colors (brand-consistent)
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828", priority: 3 },
    { label: "Limited to Out of Competition", color: "#f77f00", priority: 2 },
    { label: "Particular Sports", color: "#003049", priority: 1 },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da"; // for non-banned ingredients
  const INGREDIENT_PRIORITY = 0;

  // Merge inputs (support fields-embedded or flattened records)
  const mergedInput = useMemo(() => {
    const arr = [];
    (detectedSubstances || []).forEach((r) => arr.push(r));
    (detectedIngredients || []).forEach((r) => arr.push(r));
    return arr;
  }, [detectedSubstances, detectedIngredients]);

  // Normalize & split banned vs ingredients
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
  }, [mergedInput, banTypeColors]);

  // Filters
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter((r) => (r.banType || "").trim() === activeBanType);
  }, [bannedRecords, activeBanType]);

  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(
      bannedRecords.map((b) => (b.name || "").toLowerCase())
    );
    return ingredientRecords.filter(
      (ing) => !bannedNames.has((ing.name || "").toLowerCase())
    );
  }, [ingredientRecords, bannedRecords]);

  // ---------- Table highlighting (only if term appears in OCR) ----------
  const highlightInTableIfOCRHas = (ocr, text = "", color = "") => {
    const raw = String(text ?? "");
    if (!raw) return "";
    const o = String(ocr ?? "").trim();
    if (!o) return escapeHtml(raw);

    const terms = raw
      .split(/,\s*/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!terms.length) return escapeHtml(raw);

    // placeholder technique to keep HTML-escaping safe
    let working = raw;
    const placeholders = [];

    // Only highlight if OCR has the term (case-insensitive)
    terms.forEach((term, idx) => {
      try {
        const hasRx = new RegExp(escapeRegex(term), "i");
        if (!hasRx.test(o)) return;
        const placeholder = `@@HL_${Math.random()
          .toString(36)
          .slice(2)}_${idx}@@`;
        const replaceRx = new RegExp(escapeRegex(term), "gi");
        working = working.replace(replaceRx, placeholder);
        placeholders.push({ placeholder, display: term });
      } catch {
        /* ignore broken term */
      }
    });

    if (!placeholders.length) return escapeHtml(raw);

    let escaped = escapeHtml(working);
    const appliedColor = color || INGREDIENT_HIGHLIGHT_COLOR;
    placeholders.forEach(({ placeholder, display }) => {
      const span =
        `<span style="color:${appliedColor};font-weight:600;text-decoration:underline;text-underline-offset:2px;">` +
        `${escapeHtml(display)}</span>`;
      escaped = escaped.split(placeholder).join(span);
    });

    return escaped;
  };

  // ---------- OCR text highlighting (reflects table contents) ----------
  const ocrTermsSorted = useMemo(() => {
    const termMap = new Map();

    const upsert = (termRaw, color, priority) => {
      const t = String(termRaw || "").trim();
      if (!t) return;
      const key = t.toLowerCase();
      const existing = termMap.get(key);
      if (!existing || priority > existing.priority) {
        termMap.set(key, { color, priority, term: t });
      }
    };

    // BANNED
    bannedRecords.forEach((rec) => {
      const banType = (rec.banType || "").trim();
      const entry = banTypeColors.find((b) => b.label === banType);
      const color = entry?.color || "#111827";
      const prio = entry?.priority ?? 1;
      upsert(rec.name, color, prio);
      (rec.synonyms || "")
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => upsert(s, color, prio));
    });

    // INGREDIENTS
    ingredientRecords.forEach((rec) => {
      upsert(rec.name, INGREDIENT_HIGHLIGHT_COLOR, INGREDIENT_PRIORITY);
      (rec.synonyms || "")
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => upsert(s, INGREDIENT_HIGHLIGHT_COLOR, INGREDIENT_PRIORITY));
    });

    const entries = Array.from(termMap.entries()).map(([key, v]) => ({
      key,
      color: v.color,
      priority: v.priority,
      term: v.term,
      length: v.term.length,
    }));

    // Sort by priority then length, so more critical and longer matches win
    entries.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.length - a.length;
    });

    return entries;
  }, [bannedRecords, ingredientRecords, banTypeColors]);

  const { ocrHTML, ocrMatchCount } = useMemo(() => {
    const base = String(ocrText || "");
    if (!base) return { ocrHTML: "", ocrMatchCount: 0 };

    let working = base;
    const replacements = [];
    let idx = 0;

    ocrTermsSorted.forEach(({ term, color }) => {
      try {
        const rx = new RegExp(escapeRegex(term), "gi");
        working = working.replace(rx, (m) => {
          const placeholder = `@@OCRHL_${idx++}@@`;
          replacements.push({
            placeholder,
            match: m,
            color,
          });
          return placeholder;
        });
      } catch {
        /* ignore malformed term */
      }
    });

    let escaped = escapeHtml(working);
    replacements.forEach(({ placeholder, match, color }) => {
      const span =
        `<span style="color:${color};font-weight:600;text-decoration:underline;text-underline-offset:2px;">` +
        `${escapeHtml(match)}</span>`;
      escaped = escaped.split(placeholder).join(span);
    });

    return { ocrHTML: escaped, ocrMatchCount: replacements.length };
  }, [ocrText, ocrTermsSorted]);

  // Legend handlers
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

  const totalResults = mergedInput?.length ?? 0;

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 sm:px-4 py-6 font-sans space-y-8 relative text-gray-900">
      <section className="max-w-5xl mx-auto">
        {/* ======= OCR TEXT (collapsed by default) ======= */}
        <div className="mb-4">
          <button
            onClick={() => setOcrOpen((s) => !s)}
            aria-expanded={ocrOpen}
            aria-label={collapseLabel(ocrOpen, "Scanned Text (OCR)")}
            className={`section-toggle-btn ${
              ocrOpen ? "active" : ""
            } w-full sm:w-auto`}
          >
            <span className="section-label">Scanned Text (OCR)</span>
            <span className="badge">{ocrMatchCount}</span>
            <span className="caret">{ocrOpen ? "▾" : "▸"}</span>
          </button>

          <AnimatePresence initial={false}>
            {ocrOpen && (
              <motion.div
                key="ocr-box"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm leading-relaxed text-gray-900 max-h-[320px] overflow-y-auto"
              >
                {ocrText ? (
                  <div dangerouslySetInnerHTML={{ __html: ocrHTML }} />
                ) : (
                  <p className="text-gray-500 italic">
                    No OCR text available for this scan.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ======= TOP SUMMARY CARD ======= */}
        <div className="mt-2">
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Scan Results
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Parsed from your nutrition label and cross-checked against our
                banned-substance and ingredient databases.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs sm:text-sm">
                <span className="font-medium text-gray-800">
                  {totalResults}
                </span>
                <span className="text-gray-600">total matches</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs sm:text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d62828]" />
                <span className="font-medium text-[#b22222]">
                  {bannedRecords.length}
                </span>
                <span className="text-[#b22222]">banned</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs sm:text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8556da]" />
                <span className="font-medium text-[#4c2ea0]">
                  {ingredientRecords.length}
                </span>
                <span className="text-[#4c2ea0]">ingredients</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================== BANNED ===================== */}
        <div className="mt-8">
          {/* Controls: vertical stack on mobile */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setBannedOpen((s) => !s)}
                aria-expanded={bannedOpen}
                aria-label={collapseLabel(bannedOpen, "Banned Substances")}
                className={`section-toggle-btn ${
                  bannedOpen ? "active" : ""
                } w-full sm:w-auto`}
              >
                <span className="section-label">Banned Substances</span>
                <span className="badge">{bannedRecords.length}</span>
                <span className="caret">{bannedOpen ? "▾" : "▸"}</span>
              </button>

              <p className="text-xs sm:text-sm text-gray-600 leading-snug max-w-xl">
                Substances flagged against anti-doping and prohibited lists.
                Use the legend below to focus on a specific ban type.
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
                  <table className="min-w-[960px] w-full text-xs sm:text-sm text-gray-900">
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
                          banTypeColors.find((b) => b.label === banType) ||
                          null;
                        const c = colorEntry?.color || "#111827";

                        return (
                          <motion.tr
                            key={rec.id}
                            className="hover:bg-gray-50 transition text-gray-900"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.name,
                                  c
                                ),
                              }}
                            />
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.synonyms,
                                  c
                                ),
                              }}
                            />
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.bannedBy,
                                  c
                                ),
                              }}
                            />
                            <td className="px-3 py-2 align-top text-gray-900 whitespace-nowrap">
                              <span
                                className="px-2 py-1 rounded-full text-[11px] font-medium"
                                style={{
                                  backgroundColor: `${c}20`,
                                  color: c,
                                }}
                              >
                                {banType || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words">
                              {rec.dosageLimit || ""}
                            </td>
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.notes,
                                  c
                                ),
                              }}
                            />
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.source,
                                  c
                                ),
                              }}
                            />
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.benefits,
                                  c
                                ),
                              }}
                            />
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.weaknesses,
                                  c
                                ),
                              }}
                            />
                            <td
                              className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                              dangerouslySetInnerHTML={{
                                __html: highlightInTableIfOCRHas(
                                  ocrText,
                                  rec.antagonisms,
                                  c
                                ),
                              }}
                            />
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="italic text-gray-500 p-4 text-sm">
                    No banned substances match your scan.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* neutral divider between sections */}
        <div className="border-t border-gray-200 my-8" />

        {/* ===================== INGREDIENTS ===================== */}
        <div className="mb-20">
          {/* Controls: vertical stack on mobile */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={() => setIngredientsOpen((s) => !s)}
                aria-expanded={ingredientsOpen}
                aria-label={collapseLabel(
                  ingredientsOpen,
                  "Ingredients (non-banned)"
                )}
                className={`section-toggle-btn ${
                  ingredientsOpen ? "active" : ""
                } w-full sm:w-auto`}
              >
                <span className="section-label">Ingredients (non-banned)</span>
                <span className="badge">{ingredientRecords.length}</span>
                <span className="caret">{ingredientsOpen ? "▾" : "▸"}</span>
              </button>

              <p className="text-xs sm:text-sm text-gray-600 leading-snug max-w-xl">
                Ingredient matches from our nutrient database. These are not
                currently flagged as banned in your sport.
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
                  <table className="min-w-[720px] w-full text-xs sm:text-sm text-gray-900">
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
                          className="hover:bg-gray-50 transition text-gray-900"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <td
                            className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                            dangerouslySetInnerHTML={{
                              __html: highlightInTableIfOCRHas(
                                ocrText,
                                rec.name,
                                INGREDIENT_HIGHLIGHT_COLOR
                              ),
                            }}
                          />
                          <td
                            className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                            dangerouslySetInnerHTML={{
                              __html: highlightInTableIfOCRHas(
                                ocrText,
                                rec.synonyms,
                                INGREDIENT_HIGHLIGHT_COLOR
                              ),
                            }}
                          />
                          <td
                            className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                            dangerouslySetInnerHTML={{
                              __html: highlightInTableIfOCRHas(
                                ocrText,
                                rec.benefits,
                                INGREDIENT_HIGHLIGHT_COLOR
                              ),
                            }}
                          />
                          <td
                            className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                            dangerouslySetInnerHTML={{
                              __html: highlightInTableIfOCRHas(
                                ocrText,
                                rec.weaknesses,
                                INGREDIENT_HIGHLIGHT_COLOR
                              ),
                            }}
                          />
                          <td
                            className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                            dangerouslySetInnerHTML={{
                              __html: highlightInTableIfOCRHas(
                                ocrText,
                                rec.antagonisms,
                                INGREDIENT_HIGHLIGHT_COLOR
                              ),
                            }}
                          />
                          <td
                            className="px-3 py-2 align-top text-gray-900 whitespace-normal break-words"
                            dangerouslySetInnerHTML={{
                              __html: highlightInTableIfOCRHas(
                                ocrText,
                                rec.source,
                                INGREDIENT_HIGHLIGHT_COLOR
                              ),
                            }}
                          />
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="italic text-gray-500 p-4 text-sm">
                    No ingredient-only results found for this scan.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ===================== STICKY LEGEND ===================== */}
      <div className="sticky bottom-0 left-0 right-0 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-t-xl border-t border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg">
            <div
              className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1 w-full sm:w-auto"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <button
                className="mr-2 px-3 py-1 rounded-md bg-gray-100 text-xs sm:text-sm whitespace-nowrap"
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
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border transition text-xs sm:text-sm whitespace-nowrap ${
                        active
                          ? "shadow-md bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: t.color,
                          display: "inline-block",
                        }}
                      />
                      <span className="font-medium">{t.label}</span>
                      <span className="text-gray-500 text-[11px] sm:text-xs">
                        ({countsByBanType[t.label] || 0})
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
              <div className="text-xs sm:text-sm text-gray-600 sm:text-right">
                Showing{" "}
                <span className="font-semibold">
                  {filteredBanned.length}
                </span>{" "}
                banned ·{" "}
                <span className="font-semibold">
                  {filteredIngredients.length}
                </span>{" "}
                ingredients
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

      {/* Local styles (flat toggles + sticky header support) */}
      <style jsx>{`
        .section-toggle-btn {
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
          background: rgba(255, 255, 255, 0.9);
          color: #0f172a;
          box-shadow: 0 1px 0 rgba(16, 24, 40, 0.03);
        }
        .section-toggle-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(16, 24, 40, 0.06);
        }
        .section-toggle-btn .section-label {
          letter-spacing: -0.2px;
        }
        .section-toggle-btn .badge {
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
        .section-toggle-btn .caret {
          color: #6b7280;
          font-weight: 600;
        }
        .section-toggle-btn.active {
          border-color: #46769b;
          background-color: rgba(70, 118, 155, 0.08);
        }

        @media (max-width: 640px) {
          .section-toggle-btn {
            padding: 10px 12px;
            gap: 8px;
            font-size: 0.95rem;
          }
          .section-toggle-btn .badge {
            font-size: 0.78rem;
            padding: 3px 6px;
          }
        }
      `}</style>
    </div>
  );
}
