// components/OCRSearchResults.js
"use client";

/**
 * OCRSearchResults — v3 (Visual Polish)
 *
 * Design system:
 *   Fonts    — Syne (display/substance names) + DM Sans (body) via Google Fonts
 *              Loaded once via a <style> tag injected into the component root.
 *   Colors   — 4-token semantic palette:
 *                Brand navy  #1E3A5F  (UI chrome, labels)
 *                Banned red  #C8102E  (banned verdict + left bar)
 *                Safe green  #00873E  (not-banned verdict)
 *                Caution     #E87722  (weaknesses, watch-for panels)
 *              All other surfaces: neutral grays + white
 *   Spacing  — Generous: cards px-6 py-5, expanded panels gap-4
 *   Shadows  — Colored ambient glow matching verdict on hover
 *   Badges   — Org chips unified: dark navy bg, white text, consistent sizing
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Design tokens — single source of truth for all colors / type
// ---------------------------------------------------------------------------

const DS = {
  brand:    "#1E3A5F",
  banned:   "#C8102E",
  safe:     "#00873E",
  caution:  "#E87722",
  // Derived tints (used for backgrounds / borders)
  bannedBg:   "#FFF0F0",
  bannedBorder: "#FFC8C8",
  safeBg:     "#F0FBF4",
  safeBorder: "#A8E6BC",
  cautionBg:  "#FFFBF0",
  cautionBorder: "#FFE0A8",
  brandBg:    "#EEF3F9",
  brandBorder:"#C0D0E0",
  // Neutrals
  cardBg:       "#FFFFFF",
  pageBg:       "#F7F9FC",
  border:       "#E8ECF0",
  labelText:    "#6B7A8D",
  bodyText:     "#2D3748",
  dimText:      "#9BA8B4",
  hoverBg:      "#EDF1F7",
  cautionText:  "#7A4A0A",
};

// Google Fonts injected once — Syne for display, DM Sans for body
const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  .cp-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.03em; }
  .cp-body    { font-family: 'Barlow', sans-serif; }
  .cp-mono    { font-family: 'JetBrains Mono', monospace; }
`;

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

// All orgs unified to brand navy for a clean, consistent look.
// The org NAME itself carries identity — the color doesn't need to.
const ORG_STYLE = { bg: DS.brand, text: "#FFFFFF" };

const VERDICT = {
  BANNED: {
    label:    "Banned",
    color:    DS.banned,
    bg:       DS.bannedBg,
    border:   DS.bannedBorder,
    glowColor:"#C8102E22",
    icon:     "✕",
    barColor: DS.banned,
  },
  CAUTION: {
    label:    "Limited Use",
    color:    DS.caution,
    bg:       DS.cautionBg,
    border:   DS.cautionBorder,
    glowColor:"#E8772218",
    icon:     "!",
    barColor: DS.caution,
  },
  NOT_BANNED: {
    label:    "Not Banned",
    color:    DS.safe,
    bg:       DS.safeBg,
    border:   DS.safeBorder,
    glowColor:"#00873E18",
    icon:     "✓",
    barColor: DS.safe,
  },
};

// ---------------------------------------------------------------------------
// Safety helpers
// ---------------------------------------------------------------------------

const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (s = "") =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// highlight() — escapes first, then injects only our own <span> markup (XSS-safe)
const highlight = (text = "", term = "", color = DS.brand) => {
  const escaped = escapeHtml(text);
  if (!term?.trim()) return escaped;
  try {
    const rx = new RegExp(escapeRegex(term.trim()), "gi");
    return escaped.replace(
      rx,
      (m) =>
        `<span style="color:${color};font-weight:700;background:${color}18;` +
        `border-radius:3px;padding:0 2px;text-decoration:underline;` +
        `text-underline-offset:2px;">${m}</span>`
    );
  } catch {
    return escaped;
  }
};

// ---------------------------------------------------------------------------
// Data normalization
// ---------------------------------------------------------------------------

function normalizeRecord(rRaw) {
  const r = rRaw?.fields ?? rRaw ?? {};
  return {
    id:          rRaw?.id ?? rRaw?.recordId ?? Math.random().toString(36).slice(2),
    name:        r["Substance Name"] ?? r.name ?? r["Name"] ?? r["Ingredient Name"] ?? "",
    synonyms:    r["Synonyms"] ?? r["Synonyms (Extended)"] ?? r.synonyms ?? r["Aliases"] ?? "",
    bannedBy:    r["Banned By"] ?? r.bannedBy ?? "",
    banType:     r["Ban Type"] ?? r.banType ?? null,
    dosageLimit: r["Dosage Limit"] ?? r.dosageLimit ?? "",
    notes:       r["Notes"] ?? r["Pharmacology Notes"] ?? r.notes ?? "",
    benefits:    r["Benefits"] ?? r.benefits ?? "",
    weaknesses:  r["Weaknesses"] ?? r.weaknesses ?? "",
    antagonisms: r["Nutrient Antagonisms"] ?? r["Nutrient Antagonism"] ?? r["Nutrient Interactions"] ?? r.antagonisms ?? "",
    source:      r["Source / Citation"] ?? r["Sources / References"] ?? r["Source / Notes"] ?? r["Source"] ?? r.source ?? "",
  };
}

// ---------------------------------------------------------------------------
// Grouping — one SubstanceGroup per unique substance name
// ---------------------------------------------------------------------------

function groupBySubstance(records, searchTerm) {
  const groups = new Map();
  const term = (searchTerm ?? "").trim().toLowerCase();

  records.forEach((rec) => {
    const key = (rec.name ?? "").toLowerCase().trim();
    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: rec.name,
        isExactMatch: key === term,
        records: [],
        bannedByOrgs: [],
        synonymsSet: new Set(),
        benefits: "",
        weaknesses: "",
        antagonisms: "",
        notes: "",
        source: "",
      });
    }

    const g = groups.get(key);
    g.records.push(rec);

    if (rec.banType && rec.bannedBy) {
      rec.bannedBy.split(/[,;\/·]/).map((s) => s.trim()).filter(Boolean)
        .forEach((org) => { if (!g.bannedByOrgs.includes(org)) g.bannedByOrgs.push(org); });
    }

    if (rec.synonyms) {
      rec.synonyms.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        .forEach((s) => g.synonymsSet.add(s));
    }

    if (!g.benefits    && rec.benefits)    g.benefits    = rec.benefits;
    if (!g.weaknesses  && rec.weaknesses)  g.weaknesses  = rec.weaknesses;
    if (!g.antagonisms && rec.antagonisms) g.antagonisms = rec.antagonisms;
    if (!g.notes       && rec.notes)       g.notes       = rec.notes;
    if (!g.source      && rec.source)      g.source      = rec.source;
  });

  return Array.from(groups.values()).map((g) => {
    const banTypes = g.records
      .filter((r) => r.banType)
      .map((r) => (r.banType || "").trim());

    const hasHardBan = banTypes.some((t) =>
      t === "Prohibited" || t === "Particular Sports"
    );
    const hasLimitedBan = banTypes.some((t) =>
      t === "Limited to Out of Competition" || t.toLowerCase().includes("limited")
    );

    const verdict = hasHardBan
      ? VERDICT.BANNED
      : hasLimitedBan
      ? VERDICT.CAUTION
      : VERDICT.NOT_BANNED;

    return {
      ...g,
      synonyms: Array.from(g.synonymsSet).join(", "),
      verdict,
    };
  });
}

// ---------------------------------------------------------------------------
// Reusable UI pieces
// ---------------------------------------------------------------------------

// Section label — small uppercase eyebrow used throughout
function EyebrowLabel({ children, color = DS.labelText }) {
  return (
    <p
      className="cp-body text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
      style={{ color }}
    >
      {children}
    </p>
  );
}

// Org badge — unified dark navy
function OrgBadge({ org }) {
  return (
    <span
      className="cp-body inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide leading-none"
      style={{ backgroundColor: ORG_STYLE.bg, color: ORG_STYLE.text }}
    >
      {org}
    </span>
  );
}

// Verdict pill — the primary status signal
function VerdictPill({ verdict, size = "md" }) {
  const isLg = size === "lg";
  return (
    <span
      className="cp-body inline-flex items-center gap-2 rounded-full font-bold"
      style={{
        padding: isLg ? "6px 14px 6px 6px" : "4px 10px 4px 4px",
        fontSize: isLg ? "13px" : "11px",
        backgroundColor: verdict.bg,
        color: verdict.color,
        border: `1.5px solid ${verdict.border}`,
      }}
    >
      {/* Icon circle */}
      <span
        className="inline-flex items-center justify-center rounded-full font-black leading-none"
        style={{
          width:  isLg ? 22 : 18,
          height: isLg ? 22 : 18,
          fontSize: isLg ? 11 : 9,
          backgroundColor: verdict.color,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {verdict.icon}
      </span>
      {verdict.label}
    </span>
  );
}

// Info panel — used for What it does / Things to watch / Interactions
function InfoPanel({ label, content, searchTerm, accentColor = DS.brand }) {
  if (!content) return null;
  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        backgroundColor: DS.cardBg,
        border: `1px solid ${DS.border}`,
      }}
    >
      <EyebrowLabel color={accentColor}>{label}</EyebrowLabel>
      <p
        className="cp-body text-sm leading-relaxed whitespace-pre-line"
        style={{ color: DS.bodyText }}
        dangerouslySetInnerHTML={{ __html: highlight(content, searchTerm, accentColor) }}
      />
    </div>
  );
}

// "Why it's in your supplement" panel — CheckPeak differentiator
function WhyPanel({ benefits }) {
  if (!benefits) return null;
  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        backgroundColor: DS.brandBg,
        border: `1px solid ${DS.brandBorder}`,
      }}
    >
      <EyebrowLabel color={DS.brand}>Why it&apos;s in your supplement</EyebrowLabel>
      <p className="cp-body text-sm leading-relaxed" style={{ color: DS.bodyText }}>
        {benefits}
      </p>
    </div>
  );
}

// Per-org row inside the ban breakdown accordion
function OrgDetailRow({ rec, searchTerm }) {
  const [open, setOpen] = useState(false);
  const hasDetail = rec.notes || rec.benefits || rec.weaknesses || rec.antagonisms;

  const banTypeColor =
    rec.banType === "Prohibited" ? DS.banned
    : rec.banType === "Limited to Out of Competition" ? DS.caution
    : DS.brand;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${DS.border}` }}
    >
      {/* Row header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: DS.pageBg }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = DS.hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.pageBg)}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <OrgBadge org={rec.bannedBy} />
          {rec.banType && (
            <span
              className="cp-body text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                color: banTypeColor,
                borderColor: banTypeColor + "40",
                backgroundColor: banTypeColor + "12",
                border: `1px solid ${banTypeColor}40`,
              }}
            >
              {rec.banType}
            </span>
          )}
          {rec.dosageLimit && (
            <span
              className="cp-body text-[11px]"
              style={{ color: DS.labelText }}
            >
              Limit:{" "}
              <span className="font-semibold" style={{ color: DS.bodyText }}>
                {rec.dosageLimit}
              </span>
            </span>
          )}
        </div>
        {hasDetail && (
          <span
            className="cp-body text-xs ml-2 shrink-0 font-semibold"
            style={{ color: DS.dimText }}
          >
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>

      {/* Row detail */}
      <AnimatePresence initial={false}>
        {open && hasDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-4 space-y-3"
              style={{ backgroundColor: DS.cardBg }}
            >
              {(rec.benefits || rec.notes) && (
                <InfoPanel
                  label="What it does"
                  content={rec.benefits || rec.notes}
                  searchTerm={searchTerm}
                  accentColor={banTypeColor}
                />
              )}
              {rec.weaknesses && (
                <InfoPanel
                  label="Things to watch for"
                  content={rec.weaknesses}
                  searchTerm={searchTerm}
                  accentColor={DS.caution}
                />
              )}
              {rec.antagonisms && (
                <InfoPanel
                  label="Interactions"
                  content={rec.antagonisms}
                  searchTerm={searchTerm}
                  accentColor={DS.brand}
                />
              )}
              {rec.source && (
                <p
                  className="cp-body text-[10px] leading-relaxed break-words pt-2"
                  style={{
                    color: DS.dimText,
                    borderTop: `1px solid ${DS.border}`,
                  }}
                  dangerouslySetInnerHTML={{ __html: highlight(rec.source, searchTerm, DS.dimText) }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main substance card
// ---------------------------------------------------------------------------

function SubstanceCard({ group, searchTerm, index }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { verdict, name, bannedByOrgs, synonyms, records,
          benefits, notes, weaknesses, antagonisms, source } = group;

  const isBanned   = verdict === VERDICT.BANNED;
  const accentColor = verdict.color;
  const bannedRecords = records.filter((r) => r.banType);

  // Show up to 5 org badges inline
  const visibleOrgs = bannedByOrgs.slice(0, 5);
  const extraOrgs   = bannedByOrgs.length - visibleOrgs.length;

  const whatItDoes = benefits || notes || "";
  const hasExpandableContent =
    whatItDoes || weaknesses || antagonisms || source ||
    (isBanned && bannedRecords.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: DS.cardBg,
        border: `1.5px solid ${hovered ? accentColor + "60" : accentColor + "28"}`,
        borderLeftWidth: 5,
        borderLeftColor: accentColor,
        borderRadius: 16,
        boxShadow: hovered
          ? `0 8px 28px ${verdict.glowColor}, 0 2px 8px rgba(0,0,0,0.06)`
          : "0 1px 4px rgba(0,0,0,0.05)",
        transition: "box-shadow 0.22s ease, border-color 0.22s ease",
        overflow: "hidden",
      }}
    >
      {/* ── CARD HEADER ──────────────────────────────────────────── */}
      <div style={{ padding: "20px 24px 16px" }}>

        {/* Verdict + substance name */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <VerdictPill verdict={verdict} size="lg" />
          <h3
            className="cp-display leading-tight"
            style={{
              fontSize: "clamp(1.1rem, 3vw, 1.35rem)",
              fontWeight: 800,
              color: DS.bodyText,
              letterSpacing: "0.06em",
            }}
            dangerouslySetInnerHTML={{ __html: highlight(name, searchTerm, accentColor) }}
          />
        </div>

        {/* Org badges (banned) */}
        {isBanned && bannedByOrgs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            <span
              className="cp-body text-[11px] font-semibold mr-0.5"
              style={{ color: DS.labelText }}
            >
              Banned by
            </span>
            {visibleOrgs.map((org) => (
              <OrgBadge key={org} org={org} />
            ))}
            {extraOrgs > 0 && (
              <span
                className="cp-body text-[11px] font-semibold px-2 py-1 rounded-lg"
                style={{
                  color: DS.brand,
                  backgroundColor: DS.brandBg,
                  border: `1px solid ${DS.brandBorder}`,
                }}
              >
                +{extraOrgs} more
              </span>
            )}
          </div>
        )}

        {/* Not banned note */}
        {!isBanned && (
          <p
            className="cp-body text-xs mb-2"
            style={{ color: DS.labelText }}
          >
            No ban classification found in the PEAK database.
          </p>
        )}

        {/* Synonyms */}
        {synonyms && (
          <p
            className="cp-body text-[11px] leading-relaxed line-clamp-1 mb-1"
            style={{ color: DS.labelText }}
          >
            <span className="font-semibold" style={{ color: DS.bodyText }}>
              Also known as:{" "}
            </span>
            <span
              dangerouslySetInnerHTML={{ __html: highlight(synonyms, searchTerm, accentColor) }}
            />
          </p>
        )}

        {/* One-line summary for non-banned */}
        {!isBanned && whatItDoes && (
          <p
            className="cp-body text-sm leading-relaxed line-clamp-2 mt-1.5"
            style={{ color: DS.bodyText }}
          >
            {whatItDoes}
          </p>
        )}

        {/* Expand / collapse CTA */}
        {hasExpandableContent && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="cp-body mt-3 inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5 transition-colors"
            style={{
              color: accentColor,
              backgroundColor: accentColor + "12",
              border: `1px solid ${accentColor}28`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = accentColor + "22")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = accentColor + "12")}
          >
            {expanded
              ? "Hide details ▲"
              : isBanned
              ? "View ban details ▼"
              : "Learn more ▼"}
          </button>
        )}
      </div>

      {/* ── EXPANDED BODY ────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="overflow-hidden"
          >
            <div
              style={{
                padding: "20px 24px 24px",
                borderTop: `1.5px solid ${accentColor}18`,
                backgroundColor: accentColor + "04",
              }}
            >

              {/* ── BANNED: per-org breakdown ── */}
              {isBanned && bannedRecords.length > 0 && (
                <div className="mb-5">
                  <EyebrowLabel color={accentColor}>
                    Ban breakdown by organization
                  </EyebrowLabel>
                  <div className="space-y-2 mt-2">
                    {bannedRecords.map((rec) => (
                      <OrgDetailRow
                        key={rec.id}
                        rec={rec}
                        searchTerm={searchTerm}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── INGREDIENT: educational content ── */}
              {!isBanned && (
                <div className="space-y-3">
                  {whatItDoes && (
                    <InfoPanel
                      label="What it does"
                      content={whatItDoes}
                      searchTerm={searchTerm}
                      accentColor={accentColor}
                    />
                  )}
                  <WhyPanel benefits={benefits} />
                  {weaknesses && (
                    <InfoPanel
                      label="Things to watch for"
                      content={weaknesses}
                      searchTerm={searchTerm}
                      accentColor={DS.caution}
                    />
                  )}
                  {antagonisms && (
                    <InfoPanel
                      label="Interactions with other nutrients"
                      content={antagonisms}
                      searchTerm={searchTerm}
                      accentColor={DS.brand}
                    />
                  )}
                </div>
              )}

              {/* Source — bottom of every card */}
              {source && (
                <div
                  className="mt-4 pt-4"
                  style={{ borderTop: `1px solid ${DS.border}` }}
                >
                  <EyebrowLabel color={DS.dimText}>Source</EyebrowLabel>
                  <p
                    className="cp-body text-[10px] leading-relaxed break-words"
                    style={{ color: DS.dimText }}
                    dangerouslySetInnerHTML={{ __html: highlight(source, searchTerm, DS.dimText) }}
                  />
                </div>
              )}

              {/* Compliance notice — banned cards only */}
              {isBanned && (
                <div
                  className="mt-4 rounded-xl px-4 py-3.5"
                  style={{
                    backgroundColor: DS.bannedBg,
                    border: `1px solid ${DS.bannedBorder}`,
                  }}
                >
                  <p
                    className="cp-body text-[11px] leading-relaxed"
                    style={{ color: DS.banned }}
                  >
                    <span className="font-bold">Always confirm with your program.</span>{" "}
                    This is a screening result, not an official ruling. Verify with your
                    athletic trainer, compliance officer, or governing body before use.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function OCRSearchResults({
  searchTerm = "",
  matchedSubstances = [],
}) {
  const trimmedSearch = String(searchTerm ?? "").trim();

  const normalized = useMemo(
    () => (matchedSubstances ?? []).map(normalizeRecord),
    [matchedSubstances]
  );

  const allGroups = useMemo(
    () => groupBySubstance(normalized, trimmedSearch),
    [normalized, trimmedSearch]
  );

  const { exactGroups, relatedGroups } = useMemo(() => {
    const term = trimmedSearch.toLowerCase();
    const exact = [], related = [];
    allGroups.forEach((g) => (g.key === term ? exact : related).push(g));
    const sort = (arr) => [
      ...arr.filter((g) => g.verdict === VERDICT.BANNED),
      ...arr.filter((g) => g.verdict === VERDICT.CAUTION),
      ...arr.filter((g) => g.verdict !== VERDICT.BANNED && g.verdict !== VERDICT.CAUTION),
    ];
    return { exactGroups: sort(exact), relatedGroups: sort(related) };
  }, [allGroups, trimmedSearch]);

  const [showRelated, setShowRelated] = useState(false);
  const totalResults = allGroups.length;

  const bannedCount    = allGroups.filter((g) => g.verdict === VERDICT.BANNED).length;
  const cautionCount   = allGroups.filter((g) => g.verdict === VERDICT.CAUTION).length;
  const notBannedCount = allGroups.filter((g) => g.verdict === VERDICT.NOT_BANNED).length;

  // ── Empty state ──
  if (!trimmedSearch) {
    return (
      <div className="py-14 text-center">
        <p className="cp-body text-sm" style={{ color: DS.labelText }}>
          Enter an ingredient or substance above to see results.
        </p>
      </div>
    );
  }

  // ── No results ──
  if (totalResults === 0) {
    return (
      <div className="py-12 text-center space-y-4">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto mb-1"
          style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
        >
          <span style={{ fontSize: 22, color: DS.brand }}>?</span>
        </div>
        <p className="cp-body text-sm" style={{ color: DS.bodyText }}>
          No results found for{" "}
          <span
            className="cp-mono font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: DS.brandBg, color: DS.brand }}
          >
            {trimmedSearch}
          </span>
        </p>
        <p
          className="cp-body text-xs max-w-xs mx-auto"
          style={{ color: DS.labelText }}
        >
          Try a shorter term, an alternate spelling, or a common alias.
        </p>
        <a
          href="/suggest-ingredient"
          className="cp-body inline-flex items-center gap-1.5 mt-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
          style={{
            backgroundColor: DS.brandBg,
            color: DS.brand,
            border: `1px solid ${DS.brandBorder}`,
          }}
        >
          Suggest a missing ingredient →
        </a>
      </div>
    );
  }

  // ── Results ──
  return (
    <>
      {/* Inject fonts once */}
      <style dangerouslySetInnerHTML={{ __html: FONT_STYLE }} />

      <div className="cp-body space-y-5 pb-8">

        {/* ── Summary bar ─────────────────────────────────────────── */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl"
          style={{
            backgroundColor: DS.cardBg,
            border: `1px solid ${DS.border}`,
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="cp-body text-xs" style={{ color: DS.labelText }}>
              {totalResults} result{totalResults !== 1 ? "s" : ""} for
            </span>
            <span
              className="cp-mono text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: DS.brandBg,
                color: DS.brand,
                border: `1px solid ${DS.brandBorder}`,
              }}
            >
              {trimmedSearch}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {bannedCount > 0 && (
              <span
                className="cp-body text-[11px] font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: DS.bannedBg,
                  color: DS.banned,
                  border: `1px solid ${DS.bannedBorder}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: DS.banned }} />
                {bannedCount} banned
              </span>
            )}
            {cautionCount > 0 && (
              <span
                className="cp-body text-[11px] font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: DS.cautionBg,
                  color: DS.caution,
                  border: `1px solid ${DS.cautionBorder}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: DS.caution }} />
                {cautionCount} limited use
              </span>
            )}
            {notBannedCount > 0 && (
              <span
                className="cp-body text-[11px] font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: DS.safeBg,
                  color: DS.safe,
                  border: `1px solid ${DS.safeBorder}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: DS.safe }} />
                {notBannedCount} not banned
              </span>
            )}
          </div>
        </div>

        {/* ── Primary / exact matches ──────────────────────────────── */}
        {exactGroups.length > 0 && (
          <div className="space-y-3">
            {exactGroups.map((group, i) => (
              <SubstanceCard
                key={group.key}
                group={group}
                searchTerm={trimmedSearch}
                index={i}
              />
            ))}
          </div>
        )}

        {/* If no exact match: show top 3 related directly */}
        {exactGroups.length === 0 && relatedGroups.length > 0 && (
          <div className="space-y-3">
            {relatedGroups.slice(0, 3).map((group, i) => (
              <SubstanceCard
                key={group.key}
                group={group}
                searchTerm={trimmedSearch}
                index={i}
              />
            ))}
          </div>
        )}

        {/* ── Related compounds (collapsed by default) ─────────────── */}
        {exactGroups.length > 0 && relatedGroups.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowRelated((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-colors"
              style={{
                backgroundColor: DS.pageBg,
                border: `1.5px dashed ${DS.border}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = DS.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.pageBg)}
            >
              <div>
                <p
                  className="cp-body text-xs font-bold"
                  style={{ color: DS.bodyText }}
                >
                  Related compounds containing &ldquo;{trimmedSearch}&rdquo;
                </p>
                <p
                  className="cp-body text-[11px] mt-0.5"
                  style={{ color: DS.labelText }}
                >
                  {relatedGroups.length} compound{relatedGroups.length !== 1 ? "s" : ""} —
                  contain &ldquo;{trimmedSearch}&rdquo; as part of a larger ingredient name
                </p>
              </div>
              <span
                className="cp-body text-sm ml-3 shrink-0 font-semibold"
                style={{ color: DS.dimText }}
              >
                {showRelated ? "▲" : "▼"}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {showRelated && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    {relatedGroups.map((group, i) => (
                      <SubstanceCard
                        key={group.key}
                        group={group}
                        searchTerm={trimmedSearch}
                        index={i}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Global disclaimer ────────────────────────────────────── */}
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            backgroundColor: DS.cautionBg,
            border: `1px solid ${DS.cautionBorder}`,
          }}
        >
          <p
            className="cp-body text-[11px] leading-relaxed"
            style={{ color: DS.cautionText }}
          >
            <span className="font-bold">Screening tool only.</span>{" "}
            CheckPeak surfaces risk flags and ban classifications as a first pass.
            Results do not replace official rulings. Always verify with your athletic
            trainer, compliance officer, or governing body before consuming any product.
          </p>
        </div>

      </div>
    </>
  );
}