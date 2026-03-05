// components/OCRScanResults.jsx
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScanSummaryCard from "./ScanSummaryCard";
import SubstanceCard   from "./SubstanceCard";
import { DS, FONT_STYLE, BAN_TYPE_CONFIG, BAN_COLOR_MAP, INGREDIENT_COLOR } from "./scanResultsTokens";

/**
 * OCRScanResults — refactored
 *
 * What changed from the original:
 *
 * Architecture:
 * - BannedCards/IngredientCards extracted to module-level SubstanceCard
 *   → accordion state no longer resets on parent re-renders
 * - BAN_TYPE_CONFIG and BAN_COLOR_MAP are module constants (in scanResultsTokens)
 *   → three useMemo calls that depended on the inline array no longer re-run
 * - normalizeRecords / stableIdFromFields are pure module functions
 *   → not recreated on every render
 * - 7 separate state variables → 2 objects (sectionOpen, expandedIds)
 * - styled-jsx removed → App Router safe
 *
 * Visual:
 * - Full DS token system + Barlow fonts (matches SearchPage, OCRUpload)
 * - Section toggles rebuilt as clean pill buttons, no custom CSS class soup
 * - Ban type filter chips use DS colors
 * - "Clear but calm" tone — banned is visible but not alarming
 *
 * Same external props as original — nothing upstream needs to change.
 */

// ---------------------------------------------------------------------------
// Pure helpers — module level, never recreated
// ---------------------------------------------------------------------------

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml  = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function splitTerms(val) {
  return String(val ?? "")
    .split(/[;,\/|\(\)\[\]\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildOCRIndex(text) {
  const raw     = String(text ?? "").toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  return { raw, compact };
}

function normalizeBanType(s) {
  if (!s) return null;
  const v = String(s).trim().toLowerCase();
  if (v === "prohibited")                                          return "Prohibited";
  if (v === "limited to out of competition" ||
      v === "limited out of competition")                          return "Limited to Out of Competition";
  if (v === "particular sports")                                   return "Particular Sports";
  return s;
}

function stableId(fields = {}, prefix = "rec") {
  const name    = fields["Substance Name"] ?? fields["Name"] ?? fields["Ingredient Name"] ?? "";
  const banType = fields["Ban Type"] ?? "";
  return `${prefix}:${String(name).trim()}|${String(banType).trim()}`
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)
    || `${prefix}-unknown`;
}

function normalizeRecords(arr = [], isBannedSet = false) {
  return (arr ?? []).map((r) => {
    const fields      = r?.fields ?? r ?? {};
    const banTypeRaw  = fields["Ban Type"] ?? fields["banType"] ?? null;
    const banType     = normalizeBanType(banTypeRaw);
    const matchedTerms = Array.isArray(r?.matchedTerms) ? r.matchedTerms : [];
    const id = r?.id ?? r?.recordId ?? stableId({ ...fields, "Ban Type": banType }, isBannedSet ? "banned" : "ing");

    return {
      id,
      matchedTerms,
      fields: { ...fields, "Ban Type": banType },
      isBanned: isBannedSet || !!banType,
    };
  });
}

function getTermsForRecord(rec) {
  const mt = Array.isArray(rec?.matchedTerms) ? rec.matchedTerms : [];
  if (mt.length) return mt.map((t) => String(t ?? "").trim()).filter(Boolean);

  const fields   = rec?.fields ?? {};
  const name     = fields["Substance Name"] ?? fields["Name"] ?? fields["Ingredient Name"] ?? "";
  const synonyms = fields["Synonyms (Extended)"] ?? fields["Synonyms"] ?? "";
  return [name, ...splitTerms(synonyms)].map((t) => String(t ?? "").trim()).filter(Boolean);
}

function termAppearsInOCR(terms, ocrIndex) {
  return terms.some((t) => {
    const lower   = String(t ?? "").toLowerCase();
    const compact = lower.replace(/[^a-z0-9]/g, "");
    return (lower && ocrIndex.raw.includes(lower)) || (compact && ocrIndex.compact.includes(compact));
  });
}

// ---------------------------------------------------------------------------
// deduplicateRecords
//
// Groups records that refer to the same substance under different names or
// synonyms. Without this, the API returns one record per DB row, so a search
// for "Citric Acid" can yield multiple rows — one exact match, one synonym
// match — all showing as separate cards.
//
// Strategy:
//   1. Normalize name → strip parentheticals, lowercase, collapse whitespace
//      "Lactic Acid (fermented)" → "lactic acid" (groups with "Lactic Acid")
//   2. Group by normalized key
//   3. Winner = record with most non-empty fields (richest data)
//   4. Merge matchedTerms + synonyms from all duplicates into winner
//   5. Attach _dupeCount so SubstanceCard can optionally show "2 matches"
// ---------------------------------------------------------------------------

function normalizeGroupKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")   // strip "(fermented)", "(high-oleic)", etc.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fieldRichness(rec) {
  return Object.values(rec?.fields ?? {})
    .filter((v) => String(v ?? "").trim().length > 0).length;
}

function deduplicateRecords(records) {
  const groups = new Map(); // groupKey → record[]

  for (const rec of records) {
    const fields = rec.fields ?? {};
    const name   =
      fields["Substance Name"] ??
      fields["Name"]           ??
      fields["Ingredient Name"] ?? "";
    const key = normalizeGroupKey(name) || rec.id;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }

  return Array.from(groups.values()).map((group) => {
    if (group.length === 1) return group[0];

    // Pick the richest record as the canonical one
    const winner = group.reduce((best, rec) =>
      fieldRichness(rec) > fieldRichness(best) ? rec : best,
      group[0]
    );

    // Merge all matchedTerms (deduplicated)
    const mergedTerms = Array.from(
      new Set(group.flatMap((rec) => rec.matchedTerms ?? []).map((t) => String(t ?? "").trim()).filter(Boolean))
    );

    // Merge all synonym strings into one comma-separated list (deduplicated)
    const allSynonyms = Array.from(
      new Set(
        group.flatMap((rec) => {
          const syn = rec.fields["Synonyms (Extended)"] ?? rec.fields["Synonyms"] ?? "";
          return splitTerms(syn);
        }).filter(Boolean)
      )
    );

    return {
      ...winner,
      matchedTerms: mergedTerms,
      _dupeCount:   group.length,
      fields: {
        ...winner.fields,
        // Replace synonyms with merged set — richer "Also listed as" display
        "Synonyms":            allSynonyms.join(", "),
        "Synonyms (Extended)": allSynonyms.join(", "),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Section toggle button
// ---------------------------------------------------------------------------

function SectionToggle({ label, count, isOpen, onToggle, countColor }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="sr-body inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 font-bold text-sm transition"
      style={{
        backgroundColor: isOpen ? DS.brandBg : DS.cardBg,
        border:         `1.5px solid ${isOpen ? DS.brandBorder : DS.border}`,
        color:           DS.bodyText,
        boxShadow:       isOpen ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = DS.hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isOpen ? DS.brandBg : DS.cardBg)}
    >
      <span className="sr-display" style={{ letterSpacing: "0.03em" }}>{label}</span>
      <span
        className="sr-body inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{
          backgroundColor: countColor ?? DS.brand,
          minWidth: 22,
          height: 22,
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        {count}
      </span>
      <span style={{ color: DS.dimText, fontSize: 11 }}>{isOpen ? "▲" : "▼"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// OCR text section
// ---------------------------------------------------------------------------

function OCRTextSection({ ocrText, ocrHTML, matchCount, termCount, isOpen, onToggle }) {
  return (
    <section>
      <div className="flex items-center gap-3 flex-wrap">
        <SectionToggle
          label="Scanned Text"
          count={termCount}
          isOpen={isOpen}
          onToggle={onToggle}
        />
        {matchCount > 0 && (
          <span className="sr-body text-xs" style={{ color: DS.dimText }}>
            {matchCount} highlight{matchCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="ocr"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="sr-body mt-3 rounded-2xl p-4 text-sm leading-relaxed overflow-y-auto"
              style={{
                backgroundColor: DS.cardBg,
                border:    `1.5px solid ${DS.border}`,
                color:      DS.bodyText,
                maxHeight:  300,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {ocrText
                ? <div dangerouslySetInnerHTML={{ __html: ocrHTML }} />
                : <p className="italic" style={{ color: DS.dimText }}>No OCR text available.</p>
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ban type filter chips
// ---------------------------------------------------------------------------

function BanTypeFilter({ counts, active, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BAN_TYPE_CONFIG.map(({ label, color, bg, border }) => {
        const isActive = active === label;
        const count    = counts[label] ?? 0;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(label)}
            aria-pressed={isActive}
            className="sr-body inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition"
            style={{
              backgroundColor: isActive ? color        : DS.cardBg,
              border:          `1.5px solid ${isActive ? color : DS.border}`,
              color:            isActive ? "#fff"       : DS.bodyText,
              boxShadow:        isActive ? `0 2px 8px ${color}40` : "none",
            }}
          >
            <span
              className="rounded-full shrink-0"
              style={{ width: 10, height: 10, backgroundColor: isActive ? "rgba(255,255,255,0.7)" : color }}
            />
            {label}
            <span style={{ opacity: 0.65 }}>({count})</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyState({ message }) {
  return (
    <p className="sr-body text-sm italic py-4 text-center" style={{ color: DS.dimText }}>
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// OCRScanResults
// ---------------------------------------------------------------------------

export default function OCRScanResults({
  ocrText              = "",
  detectedSubstances   = [],
  detectedIngredients  = [],
  showOCR              = true,
  scanMethod           = "ocr",
  scanMeta             = null,
  scanMetaList         = null,
}) {
  // ── UI state — two objects instead of 7 variables ──
  const [sectionOpen, setSectionOpen] = useState({
    ocr:         false,
    banned:      true,
    ingredients: true,
  });
  const toggleSection = (key) => setSectionOpen((s) => ({ ...s, [key]: !s[key] }));

  const [expandedIds, setExpandedIds] = useState({ banned: {}, ingredient: {} });
  const toggleCard = (variant, id) =>
    setExpandedIds((s) => ({
      ...s,
      [variant]: { ...s[variant], [id]: !s[variant][id] },
    }));

  const [activeBanType, setActiveBanType] = useState(null);

  // ── Normalize records ──
  const bannedNorm     = useMemo(() => normalizeRecords(detectedSubstances, true),  [detectedSubstances]);
  const ingredientNorm = useMemo(() => normalizeRecords(detectedIngredients, false), [detectedIngredients]);

  // ── OCR index — O(1) lookup, built once ──
  const ocrIndex = useMemo(() => buildOCRIndex(ocrText), [ocrText]);

  // ── Filter banned to only those appearing in OCR text, then deduplicate ──
  const bannedAll = useMemo(() => {
    const filtered = ocrText
      ? bannedNorm.filter((rec) => termAppearsInOCR(getTermsForRecord(rec), ocrIndex))
      : bannedNorm;
    return deduplicateRecords(filtered);
  }, [bannedNorm, ocrText, ocrIndex]);

  // ── Deduplicate ingredients against banned, then against each other ──
  const ingredientsAll = useMemo(() => {
    const bannedNames = new Set(
      bannedAll.map((rec) =>
        String(rec.fields["Substance Name"] ?? rec.fields["Name"] ?? rec.fields["Ingredient Name"] ?? "")
          .trim().toLowerCase()
      )
    );
    const withoutBanned = ingredientNorm.filter((rec) => {
      const name = String(rec.fields["Name"] ?? rec.fields["Ingredient Name"] ?? rec.fields["Substance Name"] ?? "")
        .trim().toLowerCase();
      return !bannedNames.has(name);
    });
    return deduplicateRecords(withoutBanned);
  }, [ingredientNorm, bannedAll]);

  // ── Ban type counts + filtered banned list ──
  const { bannedFiltered, banTypeCounts } = useMemo(() => {
    const counts = Object.fromEntries(BAN_TYPE_CONFIG.map((b) => [b.label, 0]));
    bannedAll.forEach((rec) => {
      const bt = rec.fields["Ban Type"];
      if (bt && counts[bt] !== undefined) counts[bt]++;
    });
    const filtered = activeBanType
      ? bannedAll.filter((rec) => rec.fields["Ban Type"] === activeBanType)
      : bannedAll;
    return { bannedFiltered: filtered, banTypeCounts: counts };
  }, [bannedAll, activeBanType]);

  // ── OCR highlighting ──
  const { ocrHTML, matchCount, termCount } = useMemo(() => {
    const base = String(ocrText ?? "");
    if (!base) return { ocrHTML: "", matchCount: 0, termCount: 0 };

    const termMap = new Map();

    const upsert = (termRaw, color, priority) => {
      const t = String(termRaw ?? "").trim();
      if (!t || t.length < 3) return;
      const lower = t.toLowerCase();
      const compact = lower.replace(/[^a-z0-9]/g, "");
      const inOCR = (lower && ocrIndex.raw.includes(lower)) || (compact && ocrIndex.compact.includes(compact));
      if (!inOCR) return;
      const existing = termMap.get(lower);
      if (!existing || priority > existing.priority) termMap.set(lower, { term: t, color, priority });
    };

    bannedAll.forEach((rec) => {
      const banType  = rec.fields["Ban Type"];
      const color    = BAN_COLOR_MAP[banType] ?? DS.bodyText;
      const priority = BAN_TYPE_CONFIG.find((b) => b.label === banType)?.priority ?? 1;
      getTermsForRecord(rec).forEach((t) => upsert(t, color, priority));
    });

    ingredientsAll.forEach((rec) => {
      getTermsForRecord(rec).forEach((t) => upsert(t, INGREDIENT_COLOR, 0));
    });

    const entries = Array.from(termMap.values())
      .sort((a, b) => b.priority - a.priority || b.term.length - a.term.length);

    let working = base;
    const replacements = [];

    entries.forEach(({ term, color }) => {
      try {
        const safe = escapeRegex(term);
        const useWord = /^[a-z0-9 ]+$/i.test(term) && term.length >= 4;
        const rx = useWord ? new RegExp(`\\b${safe}\\b`, "gi") : new RegExp(safe, "gi");
        working = working.replace(rx, (m) => {
          const key = `@@${replacements.length}@@`;
          replacements.push({ key, m, color });
          return key;
        });
      } catch { /* ignore */ }
    });

    let html = escapeHtml(working);
    replacements.forEach(({ key, m, color }) => {
      html = html.split(key).join(
        `<span style="color:${color};font-weight:700;text-decoration:underline;text-underline-offset:2px;">${escapeHtml(m)}</span>`
      );
    });

    return { ocrHTML: html, matchCount: replacements.length, termCount: termMap.size };
  }, [ocrText, ocrIndex, bannedAll, ingredientsAll]);

  // ── Counts ──
  const bannedCount     = bannedAll.length;
  const ingredientCount = ingredientsAll.length;
  const hasResults      = bannedCount > 0 || ingredientCount > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FONT_STYLE }} />

      <div
        className="sr-body w-full mx-auto space-y-6 py-6"
        style={{ maxWidth: 900, paddingLeft: 16, paddingRight: 16 }}
      >
        {/* ── Summary ────────────────────────────────────────────── */}
        <ScanSummaryCard
          bannedCount={bannedCount}
          ingredientCount={ingredientCount}
          scanMethod={scanMethod}
          scanMeta={scanMeta}
          scanMetaList={scanMetaList}
        />

        {/* ── OCR text ───────────────────────────────────────────── */}
        {showOCR && (
          <OCRTextSection
            ocrText={ocrText}
            ocrHTML={ocrHTML}
            matchCount={matchCount}
            termCount={termCount}
            isOpen={sectionOpen.ocr}
            onToggle={() => toggleSection("ocr")}
          />
        )}

        {/* ── Banned substances ──────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <SectionToggle
                label="Banned Substances"
                count={bannedAll.length}
                isOpen={sectionOpen.banned}
                onToggle={() => toggleSection("banned")}
                countColor={bannedCount > 0 ? DS.banned : DS.brand}
              />
              <p className="sr-body text-xs sm:text-sm" style={{ color: DS.labelText, maxWidth: 480 }}>
                {ocrText
                  ? "Only substances that appear in the scanned text are shown."
                  : "Showing all matched substances from the lookup."}
              </p>
            </div>
          </div>

          {/* Ban type filter */}
          <BanTypeFilter
            counts={banTypeCounts}
            active={activeBanType}
            onToggle={(label) => setActiveBanType((cur) => cur === label ? null : label)}
          />

          <AnimatePresence initial={false}>
            {sectionOpen.banned && (
              <motion.div
                key="banned"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-3"
              >
                {bannedFiltered.length === 0
                  ? <EmptyState message="No banned substances match your scan." />
                  : bannedFiltered.map((rec, i) => (
                    <SubstanceCard
                      key={rec.id}
                      rec={rec}
                      index={i}
                      variant="banned"
                      ocrText={ocrText}
                      ocrIndex={ocrIndex}
                      isExpanded={!!expandedIds.banned[rec.id]}
                      onToggle={() => toggleCard("banned", rec.id)}
                    />
                  ))
                }
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Divider ────────────────────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${DS.border}` }} />

        {/* ── Ingredients ────────────────────────────────────────── */}
        <section className="space-y-3 pb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <SectionToggle
              label="Ingredients"
              count={ingredientCount}
              isOpen={sectionOpen.ingredients}
              onToggle={() => toggleSection("ingredients")}
              countColor={INGREDIENT_COLOR}
            />
            <p className="sr-body text-xs sm:text-sm" style={{ color: DS.labelText, maxWidth: 480 }}>
              Not flagged as banned. Each card covers what it does, potential drawbacks, and interactions.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {sectionOpen.ingredients && (
              <motion.div
                key="ingredients"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-3"
              >
                {ingredientsAll.length === 0
                  ? <EmptyState message="No ingredient-only results found for this scan." />
                  : ingredientsAll.map((rec, i) => (
                    <SubstanceCard
                      key={rec.id}
                      rec={rec}
                      index={i}
                      variant="ingredient"
                      ocrText={ocrText}
                      ocrIndex={ocrIndex}
                      isExpanded={!!expandedIds.ingredient[rec.id]}
                      onToggle={() => toggleCard("ingredient", rec.id)}
                    />
                  ))
                }
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Global disclaimer ──────────────────────────────────── */}
        {hasResults && (
          <div
            className="sr-body rounded-2xl px-5 py-4"
            style={{
              backgroundColor: DS.cautionBg,
              border:          `1px solid ${DS.cautionBorder}`,
            }}
          >
            <p className="text-[11px] leading-relaxed" style={{ color: DS.cautionText }}>
              <span className="font-bold">Screening tool only.</span>{" "}
              CheckPeak surfaces risk flags and ban classifications as a first pass.
              Results do not replace official rulings. Always verify with your athletic
              trainer, compliance officer, or governing body before consuming any product.
            </p>
          </div>
        )}
      </div>
    </>
  );
}