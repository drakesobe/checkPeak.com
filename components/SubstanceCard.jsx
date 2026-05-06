// components/SubstanceCard.jsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DS, BAN_COLOR_MAP, BAN_TYPE_CONFIG, INGREDIENT_COLOR } from "./scanResultsTokens";

/**
 * SubstanceCard - v2
 *
 * Visual upgrades aligned with OCRSearchResults (Search page):
 *   - VerdictPill  - icon-circle + label (✕ Banned / ! Limited Use / ✓ Not Banned)
 *   - Hover glow   - colored ambient shadow matching verdict
 *   - OrgBadge     - dark navy chips for "Banned by" orgs
 *   - WhyPanel     - "Why it's in your supplement" for ingredient cards
 *   - Compliance notice - inside expanded banned cards
 *   - Source eyebrow label (matching search card style)
 */

// ---------------------------------------------------------------------------
// Verdict config - parallel to OCRSearchResults VERDICT object
// ---------------------------------------------------------------------------

const VERDICT = {
  BANNED: {
    label:     "Banned",
    icon:      "✕",
    color:     DS.banned,
    bg:        DS.bannedBg,
    border:    DS.bannedBorder,
    glowColor: "#C8102E20",
  },
  CAUTION: {
    label:     "Limited Use",
    icon:      "!",
    color:     DS.caution,
    bg:        DS.cautionBg,
    border:    DS.cautionBorder,
    glowColor: "#E8772218",
  },
  SAFE: {
    label:     "Not Banned",
    icon:      "✓",
    color:     DS.safe,
    bg:        DS.safeBg,
    border:    DS.safeBorder,
    glowColor: "#00873E18",
  },
  INGREDIENT: {
    label:     "Ingredient",
    icon:      "·",
    color:     INGREDIENT_COLOR,
    bg:        DS.ingredientBg,
    border:    DS.ingredientBorder,
    glowColor: "#6D3FBB14",
  },
};

function getVerdict(variant, banType) {
  if (variant !== "banned") return VERDICT.INGREDIENT;
  if (!banType)             return VERDICT.SAFE;
  if (banType === "Prohibited" || banType === "Particular Sports") return VERDICT.BANNED;
  if (banType === "Limited to Out of Competition")                  return VERDICT.CAUTION;
  return VERDICT.BANNED;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml  = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

function highlightTermsInText(text, terms, color, ocrIndex) {
  if (!text) return "";
  const blob  = String(text);
  const lower = blob.toLowerCase();
  let   html  = escapeHtml(blob);
  if (!terms?.length || !ocrIndex) return html;

  terms.forEach((raw) => {
    const term = String(raw ?? "").trim();
    if (!term || term.length < 3) return;
    const termLower   = term.toLowerCase();
    const termCompact = termLower.replace(/[^a-z0-9]/g, "");
    const inOCR =
      (termLower   && ocrIndex.raw.includes(termLower))   ||
      (termCompact && ocrIndex.compact.includes(termCompact));
    if (!inOCR || !lower.includes(termLower)) return;
    try {
      const safe = escapeRegex(term);
      const rx = /^[a-z0-9 ]+$/i.test(term) && term.length >= 4
        ? new RegExp(`\\b${safe}\\b`, "gi")
        : new RegExp(safe, "gi");
      html = html.replace(
        rx,
        (m) => `<span style="color:${color};font-weight:700;text-decoration:underline;text-underline-offset:2px;">${escapeHtml(m)}</span>`
      );
    } catch { /* ignore */ }
  });
  return html;
}

function getSnippets(ocrText, terms, { radius = 90, maxSnippets = 2, maxChars = 260 } = {}) {
  const base = String(ocrText ?? "");
  if (!base.trim() || !terms?.length) return [];
  const lower = base.toLowerCase();
  const hits  = [];
  terms.filter((t) => String(t ?? "").trim().length >= 3)
    .forEach((t) => {
      const idx = lower.indexOf(t.toLowerCase());
      if (idx >= 0) hits.push({ term: t, idx });
    });
  hits.sort((a, b) => a.idx - b.idx);
  const deduped = [];
  for (const h of hits) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(h.idx - last.idx) > radius) deduped.push(h);
  }
  return deduped.slice(0, maxSnippets).map(({ idx }) => {
    const start = Math.max(0, idx - radius);
    const end   = Math.min(base.length, idx + radius);
    let slice   = base.slice(start, end).trim();
    if (start > 0)          slice = `…${slice}`;
    if (end < base.length)  slice = `${slice}…`;
    if (slice.length > maxChars) slice = slice.slice(0, maxChars - 1).trim() + "…";
    return slice;
  });
}

// ---------------------------------------------------------------------------
// VerdictPill - icon circle + label, same as OCRSearchResults
// ---------------------------------------------------------------------------

function VerdictPill({ verdict }) {
  return (
    <span
      className="sr-body inline-flex items-center gap-1.5 rounded-full font-bold"
      style={{
        padding:         "5px 12px 5px 5px",
        fontSize:        12,
        backgroundColor: verdict.bg,
        color:           verdict.color,
        border:          `1.5px solid ${verdict.border}`,
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-full font-black leading-none shrink-0"
        style={{
          width:           20,
          height:          20,
          fontSize:        10,
          backgroundColor: verdict.color,
          color:           "#fff",
        }}
      >
        {verdict.icon}
      </span>
      {verdict.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// OrgBadge - dark navy, matches OCRSearchResults
// ---------------------------------------------------------------------------

function OrgBadge({ org }) {
  return (
    <span
      className="sr-body inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide leading-none"
      style={{ backgroundColor: DS.brand, color: "#fff" }}
    >
      {org}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EyebrowLabel
// ---------------------------------------------------------------------------

function EyebrowLabel({ children, color = DS.labelText }) {
  return (
    <p className="sr-body text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color }}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// InfoPanel
// ---------------------------------------------------------------------------

function InfoPanel({ title, html, accentColor = DS.labelText }) {
  if (!html) return null;
  return (
    <div
      className="sr-body flex flex-col gap-1 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}
    >
      <EyebrowLabel color={accentColor}>{title}</EyebrowLabel>
      <p
        className="text-xs leading-relaxed whitespace-pre-line"
        style={{ color: DS.bodyText }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhyPanel - "Why it's in your supplement" (ingredient cards)
// ---------------------------------------------------------------------------

function WhyPanel({ html }) {
  if (!html) return null;
  return (
    <div
      className="sr-body rounded-xl px-3 py-2.5"
      style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
    >
      <EyebrowLabel color={DS.brand}>Why it&apos;s in your supplement</EyebrowLabel>
      <p
        className="text-xs leading-relaxed"
        style={{ color: DS.bodyText }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SnippetPanel - "How it showed up on your label"
// ---------------------------------------------------------------------------

function SnippetPanel({ snippets, snippetHTML }) {
  if (!snippets?.length) return null;
  return (
    <div
      className="sr-body rounded-xl px-3 py-2.5"
      style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
    >
      <EyebrowLabel color={DS.brandLight}>How it showed up on your label</EyebrowLabel>
      <div className="space-y-1.5">
        {snippets.map((s, i) => (
          <p
            key={i}
            className="text-[11px] leading-snug"
            style={{ color: DS.bodyText }}
            dangerouslySetInnerHTML={{ __html: snippetHTML(s) }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComplianceNotice - bottom of expanded banned cards
// ---------------------------------------------------------------------------

function ComplianceNotice() {
  return (
    <div
      className="sr-body rounded-xl px-3 py-2.5"
      style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}` }}
    >
      <p className="text-[11px] leading-relaxed" style={{ color: DS.banned }}>
        <span className="font-bold">Always confirm with your program.</span>{" "}
        This is a screening result, not an official ruling. Verify with your athletic trainer,
        compliance officer, or governing body before use.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubstanceCard
// ---------------------------------------------------------------------------

export default function SubstanceCard({
  rec,
  index      = 0,
  variant    = "ingredient",
  ocrText    = "",
  ocrIndex   = null,
  isExpanded = false,
  onToggle,
}) {
  const [hovered, setHovered] = useState(false);

  const fields    = rec?.fields ?? {};
  const dupeCount = rec?._dupeCount ?? 1;
  const banType   = fields["Ban Type"] ?? null;
  const verdict   = getVerdict(variant, banType);
  const accentColor = verdict.color;
  const banConfig   = BAN_TYPE_CONFIG.find((b) => b.label === banType);

  // Field extraction
  const name        = fields["Substance Name"] ?? fields["Name"] ?? fields["Ingredient Name"] ?? "Unnamed";
  const synonyms    = String(fields["Synonyms"] ?? fields["Synonyms (Extended)"] ?? "");
  const bannedBy    = String(fields["Banned By"]     ?? "");
  const dosageLimit = String(fields["Dosage Limit"]  ?? "");
  const benefits    = String(fields["Benefits"]      ?? fields["Notes"] ?? "");
  const weaknesses  = String(fields["Weaknesses"]    ?? "");
  const antagonisms = String(fields["Nutrient Antagonism"] ?? fields["Nutrient Antagonisms"] ?? "");
  const source      = String(fields["Source / Citation"] ?? fields["Sources / References"] ?? fields["Source"] ?? "");

  // Org badges - parse comma/semicolon separated
  const orgList = bannedBy
    ? bannedBy.split(/[,;\/·]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const visibleOrgs = orgList.slice(0, 4);
  const extraOrgs   = orgList.length - visibleOrgs.length;

  // Terms for highlighting
  const terms = Array.isArray(rec?.matchedTerms) && rec.matchedTerms.length
    ? rec.matchedTerms.map((t) => String(t ?? "").trim()).filter(Boolean)
    : [name, ...synonyms.split(/[;,\/|\n]+/).map((s) => s.trim())].filter(Boolean);

  const h           = (text) => highlightTermsInText(text, terms, accentColor, ocrIndex);
  const snippets    = getSnippets(ocrText, terms);
  const snippetHTML = (s) => highlightTermsInText(s, terms, accentColor, ocrIndex);
  const previewSnippet = !isExpanded && snippets[0] ? snippets[0] : null;

  const isBanned = variant === "banned";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, delay: index * 0.015 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="sr-body rounded-2xl overflow-hidden"
      style={{
        backgroundColor: DS.cardBg,
        border:          `1.5px solid ${hovered ? accentColor + "55" : accentColor + "28"}`,
        borderLeftWidth: 5,
        borderLeftColor: accentColor,
        boxShadow:       hovered
          ? `0 8px 28px ${verdict.glowColor}, 0 2px 8px rgba(0,0,0,0.06)`
          : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-4 flex items-start justify-between gap-3"
        style={{ backgroundColor: isExpanded ? accentColor + "06" : "transparent" }}
      >
        <div className="flex flex-col gap-2 flex-1 min-w-0">

          {/* Verdict pill + dupe badge */}
          <div className="flex flex-wrap items-center gap-2">
            <VerdictPill verdict={verdict} />
            {dosageLimit && (
              <span className="sr-body text-[11px]" style={{ color: DS.labelText }}>
                Limit: <span className="font-semibold" style={{ color: DS.bodyText }}>{dosageLimit}</span>
              </span>
            )}
            {dupeCount > 1 && (
              <span
                className="sr-body inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: DS.pageBg, color: DS.dimText, border: `1px solid ${DS.border}` }}
                title={`${dupeCount} database entries merged into this card`}
              >
                {dupeCount} matches
              </span>
            )}
          </div>

          {/* Substance name */}
          <h3
            className="sr-display font-bold text-sm sm:text-base leading-tight"
            style={{ color: DS.bodyText, letterSpacing: "0.03em" }}
          >
            {name}
          </h3>

          {/* Org badges (banned) */}
          {isBanned && orgList.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="sr-body text-[11px] font-semibold" style={{ color: DS.labelText }}>
                Banned by
              </span>
              {visibleOrgs.map((org) => <OrgBadge key={org} org={org} />)}
              {extraOrgs > 0 && (
                <span
                  className="sr-body text-[11px] font-semibold px-2 py-1 rounded-lg"
                  style={{ color: DS.brand, backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
                >
                  +{extraOrgs} more
                </span>
              )}
            </div>
          )}

          {/* Synonyms */}
          {synonyms && (
            <p className="sr-body text-xs line-clamp-2" style={{ color: DS.labelText }}>
              <span className="font-semibold" style={{ color: DS.bodyText }}>Also listed as: </span>
              {synonyms}
            </p>
          )}

          {/* Collapsed snippet preview */}
          {previewSnippet && (
            <p
              className="sr-body text-[11px] line-clamp-2"
              style={{ color: DS.labelText }}
              dangerouslySetInnerHTML={{ __html: snippetHTML(previewSnippet) }}
            />
          )}
        </div>

        {/* Expand/collapse CTA - matches search card style */}
        <div className="shrink-0 pt-1 flex flex-col items-end gap-1">
          <span
            className="sr-body inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition-colors"
            style={{
              color:           accentColor,
              backgroundColor: accentColor + "12",
              border:          `1px solid ${accentColor}28`,
            }}
          >
            {isExpanded
              ? "Hide ▲"
              : isBanned
              ? "Details ▼"
              : "Learn more ▼"}
          </span>
        </div>
      </button>

      {/* ── Expanded body ────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key={`${rec.id}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-3 space-y-3"
              style={{
                borderTop:       `1.5px solid ${accentColor}18`,
                backgroundColor: accentColor + "04",
              }}
            >
              {/* Info panels grid */}
              {(benefits || weaknesses || antagonisms) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {variant === "ingredient"
                    ? <WhyPanel html={h(benefits)} />
                    : <InfoPanel title="What it does"    html={h(benefits)}    accentColor={accentColor} />
                  }
                  <InfoPanel title="Things to watch for"              html={h(weaknesses)}  accentColor={DS.caution} />
                  <InfoPanel title="Interactions with other nutrients" html={h(antagonisms)} accentColor={DS.brand}   />
                </div>
              )}

              {/* Source */}
              {source && (
                <div
                  className="pt-3"
                  style={{ borderTop: `1px solid ${DS.border}` }}
                >
                  <EyebrowLabel color={DS.dimText}>Source</EyebrowLabel>
                  <p
                    className="sr-body text-[10px] leading-relaxed break-words"
                    style={{ color: DS.dimText }}
                    dangerouslySetInnerHTML={{ __html: h(source) }}
                  />
                </div>
              )}

              {/* Label snippet */}
              <SnippetPanel snippets={snippets} snippetHTML={snippetHTML} />

              {/* Compliance notice - banned cards only */}
              {isBanned && <ComplianceNotice />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}