"use client";

/**
 * OCRSearchResults
 *
 * Desktop visuals preserved 1:1.
 * Mobile adds:
 *  - horizontal scroll with momentum (iOS friendly)
 *  - brand-blue gradient fades on left/right edges of the scroll containers
 *  - gradients follow the visible edge and disappear at extremes
 *  - small, careful tweaks for spacing/typography at small breakpoints
 *
 * Notes:
 *  - This file preserves your original structure, props, and normalized data mapping.
 *  - Gradients are rendered INSIDE each scroll container, absolutely positioned,
 *    and visibility is driven by a rAF-powered watcher (more reliable than scroll events alone).
 *  - Desktop behavior is unchanged; gradients are hidden at `sm` and above.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedEllipsis from "./AnimatedEllipsis";

/* -------------------------------------------------------------------------- */
/* Utilities: safe regex + HTML escape                                        */
/* -------------------------------------------------------------------------- */

const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/* -------------------------------------------------------------------------- */
/* Hook: useScrollFade — rAF-driven scroll edge detection for gradients       */
/* -------------------------------------------------------------------------- */
/**
 * useScrollFade
 * - Watches a scroll container's horizontal position and determines
 *   if there is more content to the left or right (to show gradient hints).
 * - Uses requestAnimationFrame while actively scrolling for smooth updates
 *   and stops automatically when scrolling ends (perf-friendly).
 * - Returns:
 *    { left: boolean, right: boolean, bind: { ref, onScroll? } }
 */
function useScrollFade() {
  const ref = useRef(null);
  const [fade, setFade] = useState({ left: false, right: false });
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  const compute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = Math.max(scrollWidth - clientWidth, 0);

    // 2px tolerance to avoid flicker at boundaries
    const next = {
      left: scrollLeft > 2,
      right: scrollLeft < max - 2,
    };

    // Only set state if changed (prevents re-renders)
    setFade((prev) => {
      if (prev.left === next.left && prev.right === next.right) return prev;
      return next;
    });
  }, []);

  const tick = useCallback(() => {
    compute();
    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [compute]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Attach listeners and do initial compute
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial compute on mount
    compute();

    // Event listeners
    el.addEventListener("scroll", start, { passive: true });
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", stop, { passive: true });
    el.addEventListener("mouseenter", start, { passive: true });
    el.addEventListener("mouseleave", stop, { passive: true });

    // On resize, recompute (layout changes)
    const onResize = () => compute();
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", start);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", stop);
      el.removeEventListener("mouseenter", start);
      el.removeEventListener("mouseleave", stop);
      window.removeEventListener("resize", onResize);
      stop();
    };
  }, [compute, start, stop]);

  return { fade, bind: { ref } };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function OCRSearchResults({
  searchTerm = "",
  matchedSubstances = [],
}) {
  /* ------------------------------ UI State -------------------------------- */
  const [activeBanType, setActiveBanType] = useState(null); // single-select
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  /* -------------------------- Brand / UI Palette -------------------------- */
  const BRAND_BLUE = "#46769B"; // for gradients
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  const banTypeColors = [
    { label: "Prohibited", color: "#d62828" },
    { label: "Limited to Out of Competition", color: "#f77f00" },
    { label: "Particular Sports", color: "#003049" },
  ];

  /* ----------------------------- Scroll Fades ----------------------------- */
  // One watcher per table for precise, independent behavior on mobile
  const bannedFadeApi = useScrollFade();      // { fade: {left,right}, bind: {ref} }
  const ingredientsFadeApi = useScrollFade(); // { fade: {left,right}, bind: {ref} }

  /* ---------------------------- Data Normalize ---------------------------- */
  const { bannedRecords, ingredientRecords, countsByBanType } = useMemo(() => {
    const banned = [];
    const ingredients = [];
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    (matchedSubstances || []).forEach((rRaw) => {
      const r = rRaw?.fields ? rRaw.fields : rRaw;

      const record = {
        id: rRaw?.id || rRaw?.recordId || Math.random().toString(36).slice(2),
        // Banned Airtable uses "Substance Name"; Ingredients use "Name"
        name:
          r["Substance Name"] ??
          r.name ??
          r["Name"] ??
          rRaw?.name ??
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
        if (normalized in counts) counts[normalized] += 1;
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

  /* ----------------------------- Data Filters ----------------------------- */
  const filteredBanned = useMemo(() => {
    if (!activeBanType) return bannedRecords;
    return bannedRecords.filter(
      (r) => (r.banType || "").trim() === activeBanType
    );
  }, [bannedRecords, activeBanType]);

  const filteredIngredients = useMemo(() => {
    const bannedNames = new Set(
      bannedRecords.map((b) => (b.name || "").toLowerCase())
    );
    return ingredientRecords.filter(
      (ing) => !bannedNames.has((ing.name || "").toLowerCase())
    );
  }, [ingredientRecords, bannedRecords]);

  /* ---------------------------- Highlight Helper -------------------------- */
  // Highlights occurrences of searchTerm in `text`.
  const highlightHTML = (text = "", color = "") => {
    const raw = String(text ?? "");
    if (!raw) return "";
    const term = String(searchTerm ?? "").trim();
    if (!term) return escapeHtml(raw);

    try {
      const regex = new RegExp(escapeRegex(term), "gi");
      return escapeHtml(raw).replace(regex, (match) => {
        const appliedColor = color || INGREDIENT_HIGHLIGHT_COLOR;
        return `<span style="color:${appliedColor}; font-weight:600; text-decoration:underline; text-underline-offset:2px;">${match}</span>`;
      });
    } catch {
      return escapeHtml(raw);
    }
  };

  /* ----------------------------- Legend Actions --------------------------- */
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

  /* -------------------------- Searching Indicator ------------------------- */
  const showSearchingIndicator =
    String(searchTerm || "").trim().length >= 2 &&
    (matchedSubstances?.length ?? 0) === 0;

  /* -------------------------------------------------------------------------- */
  /* Render                                                                      */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="w-full max-w-[2500px] mx-auto px-4 sm:px-4 py-6 sm:py-6 font-sans space-y-6 relative">
      <section>
        <h2 className="text-2xl font-bold mb-2 text-center sm:text-left">
          Search Results
        </h2>

        <p className="text-sm text-gray-600 mb-4 text-center sm:text-left">
          {matchedSubstances?.length ?? 0} total results — {bannedRecords.length} banned ·{" "}
          {ingredientRecords.length} ingredients
        </p>

        {/* ============================ BANNED ============================ */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setBannedOpen((s) => !s)}
                aria-expanded={bannedOpen}
                aria-label={collapseLabel(bannedOpen, "Banned Substances")}
                className={`search-toggle-btn ${bannedOpen ? "active" : ""}`}
              >
                <span className="section-label">Banned Substances</span>
                <span className="badge">{bannedRecords.length}</span>
                <span className="caret">{bannedOpen ? "▾" : "▸"}</span>
              </button>

              <div className="text-xs sm:text-sm text-gray-600">
                Filter by ban type using legend below.
              </div>
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
                className="mt-3 relative overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0"
                style={{ WebkitOverflowScrolling: "touch" }}
                {...bannedFadeApi.bind}
              >
                {/* Mobile-only gradient fades that follow the visible edge */}
                {bannedFadeApi.fade.left && (
                  <div
                    className="sm:hidden pointer-events-none absolute left-0 top-0 bottom-0 w-6"
                    style={{
                      background: `linear-gradient(to right, ${hexToRgba(
                        BRAND_BLUE,
                        0.25
                      )}, rgba(70,118,155,0))`,
                    }}
                  />
                )}
                {bannedFadeApi.fade.right && (
                  <div
                    className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6"
                    style={{
                      background: `linear-gradient(to left, ${hexToRgba(
                        BRAND_BLUE,
                        0.25
                      )}, rgba(70,118,155,0))`,
                    }}
                  />
                )}

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
                        const colorEntry = banTypeColors.find(
                          (b) => b.label === banType
                        );
                        const matchColor = colorEntry?.color || "";

                        const nameHTML = highlightHTML(rec.name || "", matchColor);
                        const synHTML = highlightHTML(rec.synonyms || "", matchColor);
                        const bannedByHTML = highlightHTML(
                          rec.bannedBy || "",
                          matchColor
                        );
                        const notesHTML = highlightHTML(rec.notes || "", matchColor);
                        const sourceHTML = highlightHTML(rec.source || "", matchColor);
                        const benefitsHTML = highlightHTML(
                          rec.benefits || "",
                          matchColor
                        );
                        const weaknessesHTML = highlightHTML(
                          rec.weaknesses || "",
                          matchColor
                        );
                        const antagonismsHTML = highlightHTML(
                          rec.antagonisms || "",
                          matchColor
                        );

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
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: nameHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: synHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: bannedByHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top">
                              <span
                                className="px-2 py-1 rounded-full text-xs sm:text-sm font-medium"
                                style={{
                                  backgroundColor: colorEntry
                                    ? `${colorEntry.color}20`
                                    : "#11182710",
                                  color: colorEntry
                                    ? colorEntry.color
                                    : "#111827",
                                }}
                              >
                                {banType || "—"}
                              </span>
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div className="text-sm">
                                {rec.dosageLimit || ""}
                              </div>
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: notesHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{ __html: sourceHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{ __html: benefitsHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{ __html: weaknessesHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{ __html: antagonismsHTML }}
                              />
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="italic text-gray-500">
                    No banned substances match your filters/search.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ========================== INGREDIENTS ========================== */}
        <div className="mb-24">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIngredientsOpen((s) => !s)}
                aria-expanded={ingredientsOpen}
                aria-label={collapseLabel(ingredientsOpen, "Ingredients")}
                className={`search-toggle-btn ${ingredientsOpen ? "active" : ""}`}
              >
                <span className="section-label">Ingredients (non-banned)</span>
                <span className="badge">{ingredientRecords.length}</span>
                <span className="caret">{ingredientsOpen ? "▾" : "▸"}</span>
              </button>

              <div className="text-xs sm:text-sm text-gray-600">
                Ingredients database results and nutrient info.
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {ingredientsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 relative overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0"
                style={{ WebkitOverflowScrolling: "touch" }}
                {...ingredientsFadeApi.bind}
              >
                {/* Mobile-only gradient fades that follow the visible edge */}
                {ingredientsFadeApi.fade.left && (
                  <div
                    className="sm:hidden pointer-events-none absolute left-0 top-0 bottom-0 w-6"
                    style={{
                      background: `linear-gradient(to right, ${hexToRgba(
                        BRAND_BLUE,
                        0.25
                      )}, rgba(70,118,155,0))`,
                    }}
                  />
                )}
                {ingredientsFadeApi.fade.right && (
                  <div
                    className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-6"
                    style={{
                      background: `linear-gradient(to left, ${hexToRgba(
                        BRAND_BLUE,
                        0.25
                      )}, rgba(70,118,155,0))`,
                    }}
                  />
                )}

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
                        const nameHTML = highlightHTML(
                          rec.name || "",
                          INGREDIENT_HIGHLIGHT_COLOR
                        );
                        const synHTML = highlightHTML(
                          rec.synonyms || "",
                          INGREDIENT_HIGHLIGHT_COLOR
                        );
                        const benefitsHTML = highlightHTML(
                          rec.benefits || "",
                          INGREDIENT_HIGHLIGHT_COLOR
                        );
                        const weaknessesHTML = highlightHTML(
                          rec.weaknesses || "",
                          INGREDIENT_HIGHLIGHT_COLOR
                        );
                        const antagonismsHTML = highlightHTML(
                          rec.antagonisms || "",
                          INGREDIENT_HIGHLIGHT_COLOR
                        );
                        const sourceHTML = highlightHTML(
                          rec.source || "",
                          INGREDIENT_HIGHLIGHT_COLOR
                        );

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
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: nameHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top">
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: synHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{ __html: benefitsHTML }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: weaknessesHTML,
                                }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: antagonismsHTML,
                                }}
                              />
                            </td>

                            <td className="px-3 sm:px-4 py-3 align-top max-w-xs break-words whitespace-normal text-sm">
                              <div
                                dangerouslySetInnerHTML={{ __html: sourceHTML }}
                              />
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
                  <p className="italic text-gray-500">
                    No ingredient-only results found for this search.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ============================ LEGEND / FOOTER ============================ */}
      <div className="sticky bottom-0 left-0 right-0 z-40" style={{ pointerEvents: "auto" }}>
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
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border transition transform hover:scale-[1.02] text-sm whitespace-nowrap ${
                        active ? "shadow-md bg-gray-800 text-white" : "bg-white"
                      }`}
                      style={{
                        borderColor: active ? "#444" : "transparent",
                      }}
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

      {/* ================================ Styles ================================ */}
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

        /* Clean, noticeable toggle button to match site style */
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
          transition: all 0.18s ease-in-out;
          background: rgba(255, 255, 255, 0.88);
          color: #0f172a;
          box-shadow: 0 1px 0 rgba(16, 24, 40, 0.03);
        }

        .search-toggle-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(16, 24, 40, 0.06);
        }

        .search-toggle-btn .section-label {
          letter-spacing: -0.2px;
        }

        .search-toggle-btn .badge {
          background-color: #46769B;
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
          border-color: #46769B;
          background-color: rgba(70, 118, 155, 0.08);
        }

        /* Slight responsive scaling for small screens so the button stays prominent */
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

/* -------------------------------------------------------------------------- */
/* Helper: hexToRgba                                                         */
/* -------------------------------------------------------------------------- */
/**
 * Converts a hex color like "#46769B" to "rgba(r,g,b,a)".
 * Falls back to the original hex if parsing fails.
 */
function hexToRgba(hex, alpha = 1) {
  try {
    const h = hex.replace("#", "");
    const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return hex;
  }
}
