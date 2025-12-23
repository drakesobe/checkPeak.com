// components/OCRScanResults.js
"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/**
 * OCRScanResults
 *
 * Mobile-first, card-based results:
 *  - Scan summary card
 *  - Collapsible OCR text section (with inline highlights)
 *  - Banned substances as SmartStack-style accordion cards
 *  - Ingredients as SmartStack-style accordion cards
 *  - Ban-type legend filter with brand colors
 *
 * Key behavior:
 * ✅ Highlight ONLY terms that were actually matched/detected (matchedTerms),
 *    and only where those terms exist in the OCR text.
 */

const escapeRegex = (string = "") =>
  String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (unsafe = "") =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Normalize ban type text for consistent labels
const normalizeBanType = (s) => {
  if (!s) return null;
  const val = String(s).trim().toLowerCase();
  if (val === "prohibited") return "Prohibited";
  if (
    val === "limited to out of competition" ||
    val === "limited out of competition"
  )
    return "Limited to Out of Competition";
  if (val === "particular sports") return "Particular Sports";
  return s;
};

// Build an OCR index to catch terms even if spacing/punctuation is weird
const buildTextIndex = (text) => {
  const raw = String(text || "").toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  return { raw, compact };
};

// Split synonyms/terms robustly across common delimiters
const splitTerms = (val) =>
  String(val || "")
    .split(/[;,\/\|\(\)\[\]\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

// Decide if a record *really* appears in OCR text (fallback only)
const recordAppearsInText = (index, fields = {}) => {
  const candidates = [
    fields["Substance Name"],
    fields["Name"],
    fields["Ingredient Name"],
    fields["Synonyms"],
    fields["Synonyms (Extended)"],
  ]
    .filter(Boolean)
    .flatMap((val) => splitTerms(val));

  if (!candidates.length) return false;

  return candidates.some((term) => {
    const lower = term.toLowerCase();
    const compact = lower.replace(/[^a-z0-9]/g, "");
    if (lower && index.raw.includes(lower)) return true;
    if (compact && index.compact.includes(compact)) return true;
    return false;
  });
};

// Stable fallback ID (prevents accordion state from breaking)
const stableIdFromFields = (fields = {}, prefix = "rec") => {
  const name =
    fields["Substance Name"] ||
    fields["Name"] ||
    fields["Ingredient Name"] ||
    fields["title"] ||
    "";
  const banType = fields["Ban Type"] || fields["banType"] || "";
  const raw = `${prefix}:${String(name).trim()}|${String(banType).trim()}`;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `${prefix}-unknown`;
};

/**
 * Prefer "matchedTerms" from API.
 * Fallback: name + synonyms if matchedTerms missing.
 */
const getMatchedTermsForRecord = (rec) => {
  const fields = rec?.fields || {};
  const mt = Array.isArray(rec?.matchedTerms) ? rec.matchedTerms : [];

  if (mt.length) {
    return mt
      .map((t) => String(t || "").trim())
      .filter(Boolean);
  }

  const name =
    fields["Substance Name"] ||
    fields["Name"] ||
    fields["Ingredient Name"] ||
    "";

  const syn =
    fields["Synonyms (Extended)"] ||
    fields["Synonyms"] ||
    "";

  return [name, ...splitTerms(syn)]
    .map((t) => String(t || "").trim())
    .filter(Boolean);
};

// Produce compact OCR snippet(s) around matched terms
const getOcrSnippets = (ocrText = "", terms = [], opts = {}) => {
  const {
    radius = 90,
    maxSnippets = 2,
    maxChars = 260,
    minTermLength = 3,
  } = opts;

  const base = String(ocrText || "");
  if (!base.trim()) return [];

  const lower = base.toLowerCase();

  const cleanedTerms = (terms || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .filter((t) => t.length >= minTermLength);

  if (!cleanedTerms.length) return [];

  const hits = [];
  for (const term of cleanedTerms) {
    const needle = term.toLowerCase();
    const idx = lower.indexOf(needle);
    if (idx >= 0) hits.push({ term, idx });
  }

  hits.sort((a, b) => a.idx - b.idx);

  // Deduplicate close hits
  const deduped = [];
  for (const h of hits) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(h.idx - last.idx) > radius) deduped.push(h);
  }

  const snippets = deduped.slice(0, maxSnippets).map(({ idx }) => {
    const start = Math.max(0, idx - radius);
    const end = Math.min(base.length, idx + radius);
    let slice = base.slice(start, end).trim();

    if (start > 0) slice = `…${slice}`;
    if (end < base.length) slice = `${slice}…`;

    // Enforce char cap
    if (slice.length > maxChars) {
      slice = slice.slice(0, maxChars - 1).trim() + "…";
    }
    return slice;
  });

  return snippets;
};

export default function OCRScanResults({
  ocrText = "",
  detectedSubstances = [],
  detectedIngredients = [],
  showOCR = true,
}) {
  const [ocrOpen, setOcrOpen] = useState(false);
  const [bannedOpen, setBannedOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [activeBanType, setActiveBanType] = useState(null);

  // accordion open state for cards
  const [expandedBannedIds, setExpandedBannedIds] = useState({});
  const [expandedIngredientIds, setExpandedIngredientIds] = useState({});

  const toggleBannedCard = (id) =>
    setExpandedBannedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleIngredientCard = (id) =>
    setExpandedIngredientIds((prev) => ({ ...prev, [id]: !prev[id] }));

  // Brand-consistent colors
  const banTypeColors = [
    { label: "Prohibited", color: "#d62828", priority: 3 },
    { label: "Limited to Out of Competition", color: "#f77f00", priority: 2 },
    { label: "Particular Sports", color: "#003049", priority: 1 },
  ];
  const INGREDIENT_HIGHLIGHT_COLOR = "#8556da";

  // Map label -> color for quick lookup
  const banColorMap = useMemo(() => {
    const map = {};
    banTypeColors.forEach((b) => {
      map[b.label] = b.color;
    });
    return map;
  }, [banTypeColors]);

  // Normalize incoming records (works with Airtable-style or plain objects)
  const normalizeRecords = (arr = [], isBannedSet = false) =>
    (arr || []).map((r) => {
      const fields = r.fields || r || {};
      const banTypeRaw = fields["Ban Type"] || fields["banType"] || null;
      const banType = normalizeBanType(banTypeRaw);
      const isBanned = isBannedSet || !!banType;

      const id =
        r.id ||
        r.recordId ||
        stableIdFromFields(
          { ...fields, "Ban Type": banType },
          isBanned ? "banned" : "ing"
        );

      // IMPORTANT: keep matchedTerms at the top level
      const matchedTerms = Array.isArray(r.matchedTerms) ? r.matchedTerms : [];

      return {
        id,
        matchedTerms,
        fields: {
          ...fields,
          "Ban Type": banType,
        },
        isBanned,
      };
    });

  // 1) Normalize banned
  const normalizedBanned = useMemo(
    () => normalizeRecords(detectedSubstances, true),
    [detectedSubstances]
  );

  // 2) Keep banned records that actually appear in the OCR text
  //    Prefer matchedTerms check; fallback to recordAppearsInText() if matchedTerms missing.
  const bannedRecordsAll = useMemo(() => {
    if (!ocrText) return normalizedBanned; // e.g. barcode path – keep all
    const idx = buildTextIndex(ocrText);

    return normalizedBanned.filter((rec) => {
      const terms = getMatchedTermsForRecord(rec);
      if (terms.length) {
        return terms.some((t) => {
          const lower = String(t || "").toLowerCase();
          const compact = lower.replace(/[^a-z0-9]/g, "");
          return (
            (lower && idx.raw.includes(lower)) ||
            (compact && idx.compact.includes(compact))
          );
        });
      }
      return recordAppearsInText(idx, rec.fields || {});
    });
  }, [normalizedBanned, ocrText]);

  const ingredientRecordsAll = useMemo(
    () => normalizeRecords(detectedIngredients, false),
    [detectedIngredients]
  );

  // Build counts + filter banned by active ban type
  const { bannedRecords, countsByBanType } = useMemo(() => {
    const counts = {};
    banTypeColors.forEach((b) => (counts[b.label] = 0));

    let records = bannedRecordsAll;

    bannedRecordsAll.forEach((rec) => {
      const bt = rec.fields["Ban Type"];
      if (bt && counts[bt] !== undefined) {
        counts[bt] += 1;
      }
    });

    if (activeBanType) {
      records = records.filter((rec) => rec.fields["Ban Type"] === activeBanType);
    }

    return { bannedRecords: records, countsByBanType: counts };
  }, [bannedRecordsAll, banTypeColors, activeBanType]);

  // Filter ingredients so they do not duplicate banned names
  const ingredientRecords = useMemo(() => {
    const bannedNames = new Set(
      bannedRecordsAll.map(
        (rec) =>
          (
            rec.fields["Substance Name"] ||
            rec.fields["Name"] ||
            rec.fields["Ingredient Name"] ||
            ""
          )
            .toString()
            .trim()
            .toLowerCase()
      )
    );
    return ingredientRecordsAll.filter((rec) => {
      const name =
        rec.fields["Name"] ||
        rec.fields["Ingredient Name"] ||
        rec.fields["Substance Name"] ||
        "";
      return !bannedNames.has(String(name).toLowerCase());
    });
  }, [ingredientRecordsAll, bannedRecordsAll]);

  const bannedCount = bannedRecordsAll.length;
  const ingredientCount = ingredientRecords.length;
  const totalMatches = bannedCount + ingredientCount;

  const riskLabel =
    bannedCount === 0
      ? "No banned substances detected"
      : bannedCount >= 3
      ? "Multiple banned substances detected"
      : "Some banned substances detected";

  const riskTone =
    bannedCount === 0
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : bannedCount >= 3
      ? "text-red-700 bg-red-50 border-red-100"
      : "text-red-600 bg-red-50 border-red-100";

  // ---------- Highlight only DETECTED / MATCHED terms ----------
  const { ocrHTML, ocrMatchCount } = useMemo(() => {
    const base = String(ocrText || "");
    if (!base) return { ocrHTML: "", ocrMatchCount: 0 };

    const termMap = new Map();

    const upsert = (termRaw, color, priority, idx) => {
      const t = String(termRaw || "").trim();
      if (!t) return;
      if (t.length < 3) return;

      const lower = t.toLowerCase();
      const compact = lower.replace(/[^a-z0-9]/g, "");

      // Only keep terms that exist in OCR (prevents highlighting noise)
      const appearsInOCR =
        (lower && idx.raw.includes(lower)) ||
        (compact && idx.compact.includes(compact));

      if (!appearsInOCR) return;

      const key = lower;
      const existing = termMap.get(key);
      if (!existing || priority > existing.priority) {
        termMap.set(key, { term: t, color, priority });
      }
    };

    const idx = buildTextIndex(base);

    // Banned terms — use matchedTerms
    bannedRecordsAll.forEach((rec) => {
      const fields = rec.fields || {};
      const banType = fields["Ban Type"];
      const color = banColorMap[banType] || "#111827";
      const priority =
        banTypeColors.find((b) => b.label === banType)?.priority ?? 1;

      const terms = getMatchedTermsForRecord(rec);
      terms.forEach((t) => upsert(t, color, priority, idx));
    });

    // Ingredient terms — use matchedTerms
    ingredientRecordsAll.forEach((rec) => {
      const color = INGREDIENT_HIGHLIGHT_COLOR;
      const priority = 0;

      const terms = getMatchedTermsForRecord(rec);
      terms.forEach((t) => upsert(t, color, priority, idx));
    });

    // Priority first, then longer terms first
    const entries = Array.from(termMap.values()).sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.term.length - a.term.length;
    });

    let working = base;
    const replacements = [];
    let ridx = 0;

    entries.forEach(({ term, color }) => {
      try {
        const safe = escapeRegex(term);
        const shouldUseBoundaries = /^[a-z0-9 ]+$/i.test(term) && term.length >= 4;

        const rx = shouldUseBoundaries
          ? new RegExp(`\\b${safe}\\b`, "gi")
          : new RegExp(safe, "gi");

        working = working.replace(rx, (m) => {
          const placeholder = `@@OCR_${ridx++}@@`;
          replacements.push({ placeholder, match: m, color });
          return placeholder;
        });
      } catch {
        // ignore malformed term
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
  }, [ocrText, bannedRecordsAll, ingredientRecordsAll, banColorMap, banTypeColors]);

  const collapseLabel = (open, name) =>
    open ? `Collapse ${name}` : `Expand ${name}`;

  const handleLegendClick = (label) => {
    setActiveBanType((cur) => (cur === label ? null : label));
  };

  // Highlight helper used inside cards/snippets.
  // It only highlights terms that exist in OCR AND exist in the blob text.
  const highlightBlobWithOCR = (text, terms, color) => {
    if (!text) return "";
    const blob = String(text || "");
    const blobLower = blob.toLowerCase();
    let html = escapeHtml(blob);

    const idx = buildTextIndex(ocrText || "");
    if (!ocrText || !terms || !terms.length) return html;

    terms.forEach((termRaw) => {
      const term = String(termRaw || "").trim();
      if (!term) return;
      if (term.length < 3) return;

      const lower = term.toLowerCase();
      const compact = lower.replace(/[^a-z0-9]/g, "");

      const appearsInOCR =
        (lower && idx.raw.includes(lower)) ||
        (compact && idx.compact.includes(compact));
      if (!appearsInOCR) return;

      const appearsInBlob = blobLower.includes(lower);
      if (!appearsInBlob) return;

      try {
        const safe = escapeRegex(term);
        const shouldUseBoundaries = /^[a-z0-9 ]+$/i.test(term) && term.length >= 4;

        const rx = shouldUseBoundaries
          ? new RegExp(`\\b${safe}\\b`, "gi")
          : new RegExp(safe, "gi");

        html = html.replace(
          rx,
          (m) =>
            `<span style="color:${color};font-weight:600;text-decoration:underline;text-underline-offset:2px;">${escapeHtml(
              m
            )}</span>`
        );
      } catch {
        // ignore malformed term
      }
    });

    return html;
  };

  // ---------- CARD COMPONENTS ----------
  const BannedCards = ({ records }) => {
    if (!records || !records.length) {
      return (
        <p className="italic text-gray-500 p-3 text-sm">
          No banned substances match your scan.
        </p>
      );
    }

    return (
      <div className="space-y-3 mt-3">
        {records.map((rec, index) => {
          const fields = rec.fields || {};
          const banType = fields["Ban Type"] || "Unknown ban classification";
          const name = fields["Substance Name"] || "Unnamed substance";
          const synonyms = fields["Synonyms"] || "";
          const bannedBy = fields["Banned By"] || "";
          const dosageLimit = fields["Dosage Limit"] || "";
          const notes = fields["Notes"] || "";
          const benefits = (fields["Benefits"] || "").toString();
          const weaknesses = (fields["Weaknesses"] || "").toString();
          const antagonisms =
            (fields["Nutrient Antagonism"] ||
              fields["Nutrient Antagonisms"] ||
              "") + "";
          const source = fields["Source / Citation"] || "";
          const color = banColorMap[banType] || "#111827";

          // ✅ Use detected terms (matchedTerms preferred)
          const terms = getMatchedTermsForRecord(rec);

          const whatItDoesText = benefits || notes || "";
          const whatItDoesHTML = highlightBlobWithOCR(whatItDoesText, terms, color);
          const weaknessesHTML = highlightBlobWithOCR(weaknesses, terms, color);
          const antagonismsHTML = highlightBlobWithOCR(antagonisms, terms, color);

          const expanded = !!expandedBannedIds[rec.id];

          const ocrSnippets = getOcrSnippets(ocrText, terms, {
            radius: 90,
            maxSnippets: 2,
            maxChars: 260,
            minTermLength: 3,
          });

          const snippetHTML = (snippet) =>
            highlightBlobWithOCR(snippet, terms, color);

          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, delay: index * 0.01 }}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: color,
              }}
            >
              {/* HEADER */}
              <button
                type="button"
                onClick={() => toggleBannedCard(rec.id)}
                className="w-full text-left px-3 py-3 sm:px-4 sm:py-3 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: `${color}20`,
                        color,
                      }}
                    >
                      {banType}
                    </span>
                    {bannedBy && (
                      <span className="text-[11px] sm:text-xs text-gray-600">
                        Banned by: {bannedBy}
                      </span>
                    )}
                    {dosageLimit && (
                      <span className="text-[11px] sm:text-xs text-gray-600">
                        Dosage: {dosageLimit}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                    {name}
                  </h3>

                  {synonyms && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      Also labeled as: {synonyms}
                    </p>
                  )}
                </div>

                <div className="flex items-center pl-2 pt-1">
                  {expanded ? (
                    <FaChevronUp className="text-gray-400" />
                  ) : (
                    <FaChevronDown className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* BODY */}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key={`${rec.id}-body`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t border-gray-100 text-[11px] sm:text-sm text-gray-800 space-y-4 overflow-hidden"
                  >
                    {(whatItDoesText || weaknesses || antagonisms) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {whatItDoesText && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              What it does
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{ __html: whatItDoesHTML }}
                            />
                          </div>
                        )}

                        {weaknesses && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Things to watch for
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{ __html: weaknessesHTML }}
                            />
                          </div>
                        )}

                        {antagonisms && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Interactions with other nutrients
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{ __html: antagonismsHTML }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {source && (
                      <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                          Where this information comes from
                        </p>
                        <p className="leading-relaxed break-words text-gray-700 text-[11px] sm:text-xs">
                          {source}
                        </p>
                      </div>
                    )}

                    {ocrSnippets.length > 0 && (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                        <p className="text-[10px] sm:text-[11px] font-medium text-gray-600 mb-1">
                          How it showed up on your label
                        </p>
                        <div className="space-y-2">
                          {ocrSnippets.map((s, i) => (
                            <p
                              key={`${rec.id}-snip-${i}`}
                              className="text-[10px] sm:text-[11px] leading-snug text-gray-700"
                              dangerouslySetInnerHTML={{ __html: snippetHTML(s) }}
                            />
                          ))}
                        </div>
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
        <p className="italic text-gray-500 p-3 text-sm">
          No ingredient-only results found for this scan.
        </p>
      );
    }

    return (
      <div className="space-y-3 mt-3">
        {records.map((rec, index) => {
          const fields = rec.fields || {};
          const id = rec.id;

          const name =
            fields["Name"] ||
            fields["Ingredient Name"] ||
            fields["Substance Name"] ||
            "Unnamed ingredient";

          const synonyms =
            fields["Synonyms (Extended)"] || fields["Synonyms"] || "";

          const benefits = (fields["Benefits"] || "").toString();
          const weaknesses = (fields["Weaknesses"] || "").toString();
          const antagonisms =
            (fields["Nutrient Antagonism"] ||
              fields["Nutrient Antagonisms"] ||
              "") + "";
          const sources =
            (fields["Sources / References"] || fields["Source"] || "") + "";

          // ✅ Use detected terms (matchedTerms preferred)
          const terms = getMatchedTermsForRecord(rec);

          const benefitsHTML = highlightBlobWithOCR(
            benefits,
            terms,
            INGREDIENT_HIGHLIGHT_COLOR
          );
          const weaknessesHTML = highlightBlobWithOCR(
            weaknesses,
            terms,
            INGREDIENT_HIGHLIGHT_COLOR
          );
          const antagonismsHTML = highlightBlobWithOCR(
            antagonisms,
            terms,
            INGREDIENT_HIGHLIGHT_COLOR
          );
          const sourcesHTML = highlightBlobWithOCR(
            sources,
            terms,
            INGREDIENT_HIGHLIGHT_COLOR
          );

          const expanded = !!expandedIngredientIds[id];

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, delay: index * 0.01 }}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              {/* HEADER */}
              <button
                type="button"
                onClick={() => toggleIngredientCard(id)}
                className="w-full text-left px-3 py-3 sm:px-4 sm:py-3 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="inline-flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                      Ingredient
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                    {name}
                  </h3>
                  {synonyms && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      Also listed as: {synonyms}
                    </p>
                  )}
                </div>

                <div className="flex items-center pl-2 pt-1">
                  {expanded ? (
                    <FaChevronUp className="text-gray-400" />
                  ) : (
                    <FaChevronDown className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* BODY */}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    key={`${id}-body`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 border-t border-gray-100 text-[11px] sm:text-sm text-gray-800 space-y-4 overflow-hidden"
                  >
                    {(benefits || weaknesses || antagonisms) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {benefits && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              What it does
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{ __html: benefitsHTML }}
                            />
                          </div>
                        )}

                        {weaknesses && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Things to watch for
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{ __html: weaknessesHTML }}
                            />
                          </div>
                        )}

                        {antagonisms && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2">
                            <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                              Interactions with other nutrients
                            </p>
                            <p
                              className="text-[11px] sm:text-xs leading-relaxed whitespace-pre-line text-gray-800"
                              dangerouslySetInnerHTML={{ __html: antagonismsHTML }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {sources && (
                      <div className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                        <p className="text-[11px] sm:text-xs font-semibold text-gray-900 mb-1">
                          Where this information comes from
                        </p>
                        <p
                          className="text-[11px] sm:text-xs leading-relaxed break-words text-gray-800"
                          dangerouslySetInnerHTML={{ __html: sourcesHTML }}
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

  return (
    <div className="w-full max-w-[2500px] mx-auto px-3 sm:px-4 py-5 sm:py-6 font-sans space-y-7 text-gray-900">
      {/* SCAN SUMMARY CARD */}
      <section>
        <div className="rounded-2xl bg-white border border-blue-100 shadow-sm px-3 py-3 sm:px-4 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-[#46769B] font-semibold">
              Scan summary
            </p>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {riskLabel}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 max-w-xl">
              These results are based on your latest label scan. Use the cards
              below to review any banned substances and understand how each
              ingredient behaves in your body.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 min-w-[90px]">
              <p className="text-[11px] font-medium text-gray-500">
                Total matches
              </p>
              <p className="text-base font-semibold text-gray-900">
                {totalMatches}
              </p>
            </div>
            <div className={`px-3 py-2 rounded-xl border min-w-[90px] ${riskTone}`}>
              <p className="text-[11px] font-medium">Banned</p>
              <p className="text-base font-semibold">{bannedCount}</p>
            </div>
            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 min-w-[90px]">
              <p className="text-[11px] font-medium text-gray-500">
                Ingredients
              </p>
              <p className="text-base font-semibold text-gray-900">
                {ingredientCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OCR TEXT SECTION */}
      {showOCR && (
        <section>
          <button
            onClick={() => setOcrOpen((s) => !s)}
            aria-expanded={ocrOpen}
            aria-label={collapseLabel(ocrOpen, "Scanned Text (OCR)")}
            className={`section-toggle-btn ${ocrOpen ? "active" : ""} w-full sm:w-auto`}
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
                className="mt-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm text-sm leading-relaxed text-gray-900 max-h-[280px] sm:max-h-[320px] overflow-y-auto"
              >
                {ocrText ? (
                  <div dangerouslySetInnerHTML={{ __html: ocrHTML }} />
                ) : (
                  <p className="text-gray-500 italic text-sm">
                    No OCR text available.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* BANNED SUBSTANCES */}
      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <button
              onClick={() => setBannedOpen((s) => !s)}
              aria-expanded={bannedOpen}
              aria-label={collapseLabel(bannedOpen, "Banned Substances")}
              className={`section-toggle-btn ${bannedOpen ? "active" : ""} w-full sm:w-auto`}
            >
              <span className="section-label">Banned Substances</span>
              <span className="badge">{bannedRecordsAll.length}</span>
              <span className="caret">{bannedOpen ? "▾" : "▸"}</span>
            </button>

            <p className="text-xs sm:text-sm text-gray-600 leading-snug">
              These are substances with an active ban classification. Only
              entries that actually appear in the scanned text are shown here.
              Use the chips below to focus on a specific ban type.
            </p>
          </div>
        </div>

        {/* Legend chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {banTypeColors.map((t) => {
            const active = activeBanType === t.label;
            const count = countsByBanType[t.label] || 0;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => handleLegendClick(t.label)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs sm:text-sm transition ${
                  active
                    ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <span className="font-medium">{t.label}</span>
                <span className="text-gray-500">({count})</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {bannedOpen && (
            <motion.div
              key="banned-cards"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="mt-2"
            >
              <BannedCards records={bannedRecords} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* DIVIDER */}
      <div className="border-t border-gray-300 my-2" />

      {/* INGREDIENTS */}
      <section className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <button
              onClick={() => setIngredientsOpen((s) => !s)}
              aria-expanded={ingredientsOpen}
              aria-label={collapseLabel(ingredientsOpen, "Ingredients")}
              className={`section-toggle-btn ${ingredientsOpen ? "active" : ""} w-full sm:w-auto`}
            >
              <span className="section-label">Ingredients (non-banned)</span>
              <span className="badge">{ingredientRecords.length}</span>
              <span className="caret">{ingredientsOpen ? "▾" : "▸"}</span>
            </button>

            <p className="text-xs sm:text-sm text-gray-600 leading-snug">
              These are ingredients that are not flagged as banned in your scan.
              Each card explains what it does, potential drawbacks, and
              interactions.
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
              className="mt-2"
            >
              <IngredientCards records={ingredientRecords} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Local styles for section buttons */}
      <style jsx>{`
        .section-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          border-radius: 10px;
          border: 2px solid transparent;
          font-size: 0.95rem;
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
          padding: 3px 7px;
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
            padding: 8px 12px;
            gap: 8px;
            font-size: 0.9rem;
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
